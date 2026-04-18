// api/webhook.js — Telegram Bot webhook handler
import { supabase, auditLog } from '../lib/supabase.js';
import { sendMessage } from '../lib/telegram.js';
import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_ID = parseInt(process.env.ADMIN_TELEGRAM_ID || '8079733623');
const APP_URL = process.env.APP_URL || 'https://rabhni-app.vercel.app';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verify webhook secret
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  if (secret !== process.env.WEBHOOK_SECRET) {
    return res.status(403).end();
  }

  const update = req.body;

  try {
    // Handle callback queries (inline button taps)
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return res.status(200).json({ ok: true });
    }

    // Handle messages
    if (update.message) {
      await handleMessage(update.message);
    }
  } catch (err) {
    console.error('Webhook error:', err);
  }

  return res.status(200).json({ ok: true });
}

async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  const userId = msg.from.id;

  // Get user language
  const { data: user } = await supabase
    .from('users')
    .select('language_code, username')
    .eq('id', userId)
    .single();

  const lang = user?.language_code === 'tr' ? 'tr' : 'ar';

  // /start command
  if (text.startsWith('/start')) {
    const refCode = text.split(' ')[1];

    // Handle referral
    if (refCode) {
      const { data: referrer } = await supabase
        .from('users')
        .select('id, referral_count')
        .eq('referral_code', refCode)
        .single();

      if (referrer && referrer.id !== userId) {
        // Update referred_by if not set
        const { data: currentUser } = await supabase
          .from('users').select('referred_by').eq('id', userId).single();

        if (!currentUser?.referred_by) {
          await supabase.from('users').update({ referred_by: referrer.id }).eq('id', userId);
          await supabase.from('users').update({
            referral_count: (referrer.referral_count || 0) + 1,
            coins: supabase.rpc('increment_coins', { amount: 50 })
          }).eq('id', referrer.id);
        }
      }
    }

    const welcomeMsg = lang === 'tr'
      ? `🎮 <b>ربحني معجم'e hoş geldiniz!</b>

Kelime bilginizi test edin, sıralamaya girin ve ödüller kazanın.

🏆 Yetenek bazlı rekabet — şans yok!
📚 Arapça, İngilizce ve Türkçe
🎁 Hepsiburada & Trendyol ödülleri

Başlamak için aşağıdaki butona tıklayın 👇`
      : `🎮 <b>أهلاً بك في ربحني معجم!</b>

اختبر معرفتك بالكلمات، تصدّر الليدربورد، واكسب الجوائز.

🏆 منافسة تعتمد على المهارة — لا حظ!
📚 عربي، إنجليزي وتركي
🎁 جوائز Hepsiburada و Trendyol

اضغط الزر أدناه للبدء 👇`;

    await sendMessage(chatId, welcomeMsg, {
      reply_markup: {
        inline_keyboard: [[
          {
            text: lang === 'tr' ? '🎮 Oyunu Başlat' : '🎮 ابدأ اللعبة',
            web_app: { url: APP_URL }
          }
        ]]
      }
    });
    return;
  }

  // /myreward — resend prize code (max 1 time)
  if (text === '/myreward') {
    const { data: prize } = await supabase
      .from('prizes')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'sent')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!prize) {
      const noReward = lang === 'tr'
        ? '❌ Bu hafta için ödülünüz bulunmamaktadır.'
        : '❌ لا يوجد لديك جائزة هذا الأسبوع.';
      await sendMessage(chatId, noReward);
      return;
    }

    if (prize.resend_count >= prize.resend_max) {
      const alreadySent = lang === 'tr'
        ? '⚠️ Kod zaten gönderildi. Bir sorun varsa destek ile iletişime geçin.'
        : '⚠️ تم إرسال الكود مسبقاً. إذا واجهت مشكلة، تواصل مع الدعم.';
      await sendMessage(chatId, alreadySent);
      return;
    }

    // Resend
    const msg2 = `🔑 <b>كودك:</b> <code>${prize.prize_code}</code>\n\n⚠️ هذه آخر مرة يمكن إرسال الكود.`;
    await sendMessage(chatId, msg2);
    await supabase.from('prizes').update({ resend_count: prize.resend_count + 1 }).eq('id', prize.id);
    await auditLog(userId, 'prize_resent', 'prize', prize.id);
    return;
  }

  // /help
  if (text === '/help') {
    const helpMsg = lang === 'tr'
      ? `ℹ️ <b>Yardım — ربحني معجم</b>

/myreward — Son ödül kodunuzu alın
/start — Oyunu başlatın

❓ Sorun için: @lordNe88`
      : `ℹ️ <b>المساعدة — ربحني معجم</b>

/myreward — استرجع كود جائزتك
/start — ابدأ اللعبة

❓ للدعم: @lordNe88`;

    await sendMessage(chatId, helpMsg);
    return;
  }

  // Default: send mini app button
  await sendMessage(chatId, lang === 'tr' ? '👇 Oyunu açmak için tıklayın' : '👇 اضغط للعب', {
    reply_markup: {
      inline_keyboard: [[
        { text: '🎮 ' + (lang === 'tr' ? 'Oyna' : 'العب'), web_app: { url: APP_URL } }
      ]]
    }
  });
}

async function handleCallback(cbq) {
  const data = cbq.data || '';
  const userId = cbq.from.id;

  if (data.startsWith('copy_code:')) {
    const code = data.split(':')[1];
    await sendMessage(cbq.message.chat.id, `🔑 الكود: <code>${code}</code>`);
  }

  // Answer callback
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: cbq.id })
  });
}
