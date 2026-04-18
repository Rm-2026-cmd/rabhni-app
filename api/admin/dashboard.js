// api/admin/dashboard.js — Admin dashboard stats
import { authenticateAdmin, setCors } from '../../lib/auth.js';
import { supabase, getEconomySettings } from '../../lib/supabase.js';
import { getRewardProgress } from '../../lib/economy.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticateAdmin(req, res);
  if (!auth) return;

  const [
    { count: totalUsers },
    { count: activeThisWeek },
    { count: totalSessions },
    { count: totalAdsDB },
    settings,
    { data: topUsers },
    { data: recentSessions },
    { data: recentPrizes }
  ] = await Promise.all([
    supabase.from('users').select('*', { count: 'exact', head: true }),
    supabase.from('users').select('*', { count: 'exact', head: true })
      .gte('last_active', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
    supabase.from('game_sessions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('ad_events').select('*', { count: 'exact', head: true }),
    getEconomySettings(),
    supabase.from('users').select('id, username, weekly_score, total_score, ads_watched_week')
      .order('weekly_score', { ascending: false }).limit(10),
    supabase.from('game_sessions').select('id, user_id, score, level, status, started_at')
      .order('started_at', { ascending: false }).limit(20),
    supabase.from('prizes').select('*').order('created_at', { ascending: false }).limit(10)
  ]);

  const progress = getRewardProgress(settings.current_week_ads, settings.current_week_users);

  return res.status(200).json({
    stats: {
      total_users: totalUsers || 0,
      active_this_week: activeThisWeek || 0,
      total_sessions: totalSessions || 0,
      total_ads: totalAdsDB || 0,
      current_week_ads: settings.current_week_ads,
      current_week_users: settings.current_week_users,
    },
    economy: {
      reward_level: settings.reward_level,
      rewards_active: settings.rewards_active,
      progress
    },
    top_users: topUsers || [],
    recent_sessions: recentSessions || [],
    recent_prizes: recentPrizes || [],
    settings
  });
}
