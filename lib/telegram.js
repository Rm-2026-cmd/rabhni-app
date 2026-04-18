// lib/telegram.js — Telegram auth + bot messaging
import crypto from 'crypto';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// ─────────────────────────────────────────────────────
// Validate Telegram Web App init data (CRITICAL SECURITY)
// ─────────────────────────────────────────────────────
export function validateTelegramAuth(initData) {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;

    params.delete('hash');

    // Sort alphabetically and build check string
    const checkString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    // HMAC-SHA256 with "WebAppData" as key
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const expectedHash = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');

    if (expectedHash !== hash) return null;

    // Check auth_date is not older than 1 hour
    const authDate = parseInt(params.get('auth_date'), 10);
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > 3600) return null;

    const userStr = params.get('user');
    if (!userStr) return null;

    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────
// Send a private message to a user
// ─────────────────────────────────────────────────────
export async function sendMessage(chatId, text, options = {}) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...options
  };

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  return data;
}

// ─────────────────────────────────────────────────────
// Send winner notification (multilingual)
// ─────────────────────────────────────────────────────
export function buildWinnerMessage(lang, rank, prizeValueTL, prizeType, prizeCode, periodKey) {
  const rankEmoji = ['🥇','🥈','🥉','4️⃣','5️⃣'][rank - 1] || '🏆';
  const storeInstructions = {
    hepsiburada: {
      ar: 'افتح تطبيق Hepsiburada → سلة التسوق → أضف هدية → الصق الكود.',
      tr: 'Hepsiburada uygulamasını aç → Sepet → Hediye ekle → Kodu yapıştır.',
    },
    trendyol: {
      ar: 'افتح تطبيق Trendyol → حسابي → بطاقة هدية → الصق الكود.',
      tr: 'Trendyol uygulamasını aç → Hesabım → Hediye kartı → Kodu yapıştır.',
    }
  };

  const store = prizeType === 'hepsiburada' ? 'Hepsiburada' : 'Trendyol';
  const instructions = storeInstructions[prizeType] || storeInstructions.hepsiburada;

  if (lang === 'tr') {
    return `${rankEmoji} <b>Tebrikler!</b>

<b>ربحني معجم</b> oyununda <b>${rank}. sırayı</b> kazandınız! (${periodKey})

🎁 Ödülünüz: <b>${prizeValueTL} TL ${store} Hediye Çeki</b>
🔑 Kod: <code>${prizeCode}</code>

📋 Nasıl kullanılır: ${instructions.tr}

⚠️ Bu kodu kimseyle paylaşmayın.
❓ Sorularınız için /destek yazın.`;
  }

  return `${rankEmoji} <b>تهانينا!</b>

فزت بالمركز <b>${rank}</b> في لعبة <b>ربحني معجم</b>! (${periodKey})

🎁 جائزتك: <b>${prizeValueTL} TL ${store} Hediye Çeki</b>
🔑 الكود: <code>${prizeCode}</code>

📋 كيف تستخدمه: ${instructions.ar}

⚠️ لا تشارك هذا الكود مع أحد.
❓ للمساعدة اكتب /myreward`;
}

// ─────────────────────────────────────────────────────
// Post to channel
// ─────────────────────────────────────────────────────
export async function postToChannel(channelId, text) {
  return sendMessage(channelId, text);
}

// ─────────────────────────────────────────────────────
// Build winner announcement for channel (no code shown)
// ─────────────────────────────────────────────────────
export function buildChannelWinnerAnnouncement(winners, periodKey) {
  const rankEmoji = ['🥇','🥈','🥉','4️⃣','5️⃣'];
  const lines = winners.map((w, i) =>
    `${rankEmoji[i]} @${w.username || 'مستخدم'} — ${w.prize_value_tl} TL`
  ).join('\n');

  return `🏆 <b>نتائج هذا الأسبوع — ربحني معجم</b> (${periodKey})

${lines}

🎮 العب الآن وكن الفائز القادم!
👉 t.me/Rabahni_Bot`;
}
