// api/cron/weekly-reset.js — Runs Sunday 00:00 Istanbul (21:00 UTC)
import { supabase, auditLog } from '../../lib/supabase.js';
import { postToChannel } from '../../lib/telegram.js';

export default async function handler(req, res) {
  // Vercel cron auth
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Run the weekly reset function defined in schema
    await supabase.rpc('reset_weekly_scores');

    // Notify channel
    const channelId = process.env.AFFILIATE_CHANNEL_ID || '@rabahnimujam';
    await postToChannel(channelId, `🔄 <b>أسبوع جديد بدأ! — ربحني معجم</b>

🏆 تم إعلان نتائج الأسبوع الماضي.
🎮 العب الآن وابدأ في تجميع نقاطك!
📊 الليدربورد تم تصفيره.

👉 t.me/Rabahni_Bot`);

    await auditLog(null, 'weekly_cron_executed', 'system', 'cron', { executed_at: new Date().toISOString() });

    return res.status(200).json({ success: true, message: 'Weekly reset executed' });
  } catch (err) {
    console.error('Weekly reset failed:', err);
    return res.status(500).json({ error: err.message });
  }
}
