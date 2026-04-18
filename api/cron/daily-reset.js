// api/cron/daily-reset.js — Runs every day at 00:00 Istanbul (21:00 UTC)
import { supabase, auditLog } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Reset daily ad counters
    await supabase.from('users').update({ ads_watched_today: 0 });

    // Update active user count in economy settings
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: activeUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('last_active', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    await supabase.from('economy_settings').update({
      current_week_users: activeUsers || 0
    }).eq('id', 1);

    await auditLog(null, 'daily_cron_executed', 'system', 'cron', {
      active_users: activeUsers,
      executed_at: new Date().toISOString()
    });

    return res.status(200).json({ success: true, active_users: activeUsers });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
