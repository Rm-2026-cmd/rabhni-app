// api/leaderboard/index.js — Leaderboard (deterministic, auditable)
import { authenticate, setCors } from '../../lib/auth.js';
import { supabase, getEconomySettings } from '../../lib/supabase.js';
import { getRewardProgress, isUserEligible } from '../../lib/economy.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticate(req, res);
  if (!auth) return;

  const { user } = auth;
  const { type = 'weekly', level, language, limit = 50 } = req.query;

  // Build leaderboard query — sorted by score DESC, then by last_active ASC (tie-breaker)
  let query = supabase
    .from('users')
    .select('id, username, first_name, weekly_score, total_score, level, ads_watched_week, last_active')
    .eq('is_banned', false)
    .eq('shadow_banned', false)
    .gt('weekly_score', 0)
    .order('weekly_score', { ascending: false })
    .order('last_active', { ascending: true })  // Tie-break: earlier activity wins
    .limit(parseInt(limit));

  const { data: leaderboard, error } = await query;

  if (error) return res.status(500).json({ error: 'Failed to fetch leaderboard' });

  // Get economy settings for reward pool status
  const settings = await getEconomySettings();
  const progress = getRewardProgress(settings.current_week_ads, settings.current_week_users);

  // Find current user's rank
  let userRank = null;
  const { data: rankData } = await supabase
    .from('users')
    .select('id')
    .eq('is_banned', false)
    .eq('shadow_banned', false)
    .gt('weekly_score', user.weekly_score)
    .select('id', { count: 'exact', head: true });

  if (rankData !== null) {
    userRank = (rankData || 0) + 1;
  }

  // Add rank numbers and eligibility
  const rankedLeaderboard = (leaderboard || []).map((u, index) => ({
    rank: index + 1,
    user_id: u.id,
    username: u.username || u.first_name || `Player_${String(u.id).slice(-4)}`,
    score: u.weekly_score,
    eligible: isUserEligible(u.weekly_score),
    is_you: u.id === user.id,
  }));

  // Prize preview per rank
  const prizePreview = settings.reward_level !== 'locked' ? {
    medium: [50, 30, 20],
    high: [200, 100, 50, 30, 20]
  }[settings.reward_level] : null;

  return res.status(200).json({
    leaderboard: rankedLeaderboard,
    user_rank: userRank,
    user_score: user.weekly_score,
    user_eligible: isUserEligible(user.weekly_score),
    reward_progress: progress,
    prize_preview: prizePreview,
    reward_level: settings.reward_level,
    rewards_active: settings.rewards_active,
    // Transparency (legal requirement): explain ranking rules
    ranking_rules: {
      primary: 'weekly_score (highest wins)',
      tiebreak: 'earliest_activity_this_week',
      deterministic: true,
      auditable: true
    }
  });
}
