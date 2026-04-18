// api/admin/distribute.js — Admin: distribute prizes to weekly winners
import { authenticateAdmin, setCors } from '../../lib/auth.js';
import { supabase, auditLog } from '../../lib/supabase.js';
import { sendMessage, buildWinnerMessage, postToChannel, buildChannelWinnerAnnouncement } from '../../lib/telegram.js';
import { getEconomySettings } from '../../lib/supabase.js';
import { getPrizeForRank, isUserEligible } from '../../lib/economy.js';

const CHANNEL_ID = process.env.AFFILIATE_CHANNEL_ID || '@rabahnimujam';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await authenticateAdmin(req, res);
  if (!auth) return;

  // ── GET — Preview winners before distributing ──
  if (req.method === 'GET') {
    const settings = await getEconomySettings();
    const { data: winners } = await supabase
      .from('users')
      .select('id, username, first_name, weekly_score, language_code, ads_watched_week')
      .eq('is_banned', false)
      .gte('weekly_score', settings.min_user_points || 300)
      .order('weekly_score', { ascending: false })
      .limit(settings.weekly_winners_count || 5);

    const preview = (winners || []).map((w, i) => ({
      rank: i + 1,
      user_id: w.id,
      username: w.username || w.first_name,
      score: w.weekly_score,
      eligible: isUserEligible(w.weekly_score),
      prize_tl: getPrizeForRank(settings.reward_level, i + 1),
      prize_type: 'hepsiburada', // default
      language: w.language_code || 'ar'
    }));

    return res.status(200).json({
      reward_level: settings.reward_level,
      rewards_active: settings.rewards_active,
      current_week_ads: settings.current_week_ads,
      winners_preview: preview,
      total_payout_tl: preview.reduce((sum, w) => sum + w.prize_tl, 0)
    });
  }

  // ── POST — Execute distribution ──
  if (req.method === 'POST') {
    const { period_key, prizes: prizeList } = req.body;

    if (!period_key || !prizeList?.length) {
      return res.status(400).json({ error: 'Missing period_key or prizes array' });
    }

    const results = [];

    for (const prize of prizeList) {
      const { user_id, rank, prize_type, prize_value_tl, prize_code } = prize;

      if (!user_id || !rank || !prize_code || !prize_value_tl) {
        results.push({ user_id, status: 'skipped', reason: 'missing fields' });
        continue;
      }

      // Check no duplicate for this period
      const { data: existing } = await supabase
        .from('prizes')
        .select('id')
        .eq('period_type', 'weekly')
        .eq('period_key', period_key)
        .eq('user_id', user_id)
        .single();

      if (existing) {
        results.push({ user_id, status: 'skipped', reason: 'already sent' });
        continue;
      }

      // Get user info
      const { data: winner } = await supabase
        .from('users')
        .select('id, username, first_name, language_code')
        .eq('id', user_id)
        .single();

      if (!winner) {
        results.push({ user_id, status: 'failed', reason: 'user not found' });
        continue;
      }

      // Build multilingual message
      const lang = winner.language_code === 'tr' ? 'tr' : 'ar';
      const message = buildWinnerMessage(lang, rank, prize_value_tl, prize_type, prize_code, period_key);

      // Send Telegram DM
      const telegramResult = await sendMessage(user_id, message, {
        reply_markup: {
          inline_keyboard: [[
            { text: lang === 'tr' ? '📋 Kodu Kopyala' : '📋 نسخ الكود', callback_data: `copy_code:${prize_code}` }
          ]]
        }
      });

      const sentOk = telegramResult?.ok === true;

      // Save prize record
      const { data: savedPrize } = await supabase.from('prizes').insert({
        period_type: 'weekly',
        period_key,
        user_id,
        username: winner.username || winner.first_name,
        rank,
        prize_type,
        prize_value_tl,
        prize_code,
        status: sentOk ? 'sent' : 'failed',
        message_sent_at: sentOk ? new Date().toISOString() : null,
        notes: sentOk ? null : JSON.stringify(telegramResult)
      }).select().single();

      // Log bot message
      await supabase.from('bot_messages').insert({
        user_id,
        message_type: 'prize_notification',
        content_preview: `Rank ${rank} - ${prize_value_tl}TL ${prize_type}`,
        status: sentOk ? 'sent' : 'failed',
        error: sentOk ? null : JSON.stringify(telegramResult?.description)
      });

      await auditLog(auth.user.id, 'prize_distributed', 'prize', savedPrize?.id, {
        winner_id: user_id,
        rank,
        prize_value_tl,
        prize_type,
        sent: sentOk
      });

      results.push({
        user_id,
        username: winner.username,
        rank,
        prize_value_tl,
        status: sentOk ? 'sent' : 'failed',
        telegram_ok: sentOk
      });
    }

    // Post public announcement to channel (no codes shown)
    const sentWinners = results.filter(r => r.status === 'sent');
    if (sentWinners.length > 0) {
      const announcement = buildChannelWinnerAnnouncement(
        sentWinners.map(w => ({ username: w.username, prize_value_tl: w.prize_value_tl })),
        period_key
      );
      await postToChannel(CHANNEL_ID, announcement);
    }

    return res.status(200).json({
      success: true,
      distributed: results.filter(r => r.status === 'sent').length,
      failed: results.filter(r => r.status === 'failed').length,
      results
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
}
