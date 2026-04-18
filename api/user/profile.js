// api/user/profile.js — User profile + stats
import { authenticate, setCors } from '../../lib/auth.js';
import { supabase } from '../../lib/supabase.js';
import { isUserEligible } from '../../lib/economy.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticate(req, res);
  if (!auth) return;

  const { user } = auth;

  // Get missions progress
  const { data: missions } = await supabase
    .from('user_missions')
    .select('*, missions(*)')
    .eq('user_id', user.id)
    .eq('completed', false);

  // Get prizes
  const { data: prizes } = await supabase
    .from('prizes')
    .select('rank, prize_value_tl, prize_type, period_key, status')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  // Get recent sessions
  const { data: sessions } = await supabase
    .from('game_sessions')
    .select('score, level, accuracy, completed_at, status')
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(5);

  const referralLink = `https://t.me/Rabahni_Bot?start=${user.referral_code}`;

  return res.status(200).json({
    user: {
      id: user.id,
      username: user.username,
      first_name: user.first_name,
      coins: user.coins,
      level: user.level,
      xp: user.xp,
      weekly_score: user.weekly_score,
      total_score: user.total_score,
      games_played: user.games_played,
      referral_code: user.referral_code,
      referral_count: user.referral_count,
      referral_link: referralLink,
      ads_watched_today: user.ads_watched_today,
      ads_watched_week: user.ads_watched_week,
      eligible_for_prizes: isUserEligible(user.weekly_score),
      agreed_to_terms: user.agreed_to_terms,
    },
    missions: missions || [],
    prizes: prizes || [],
    recent_sessions: sessions || []
  });
}
