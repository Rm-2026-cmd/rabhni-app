// api/ads/reward.js — Process ad completion and grant fixed rewards
import { authenticate, setCors } from '../../lib/auth.js';
import { supabase, auditLog, getEconomySettings, incrementWeeklyAds } from '../../lib/supabase.js';
import { checkRateLimit, hashIP } from '../../lib/anti-cheat.js';

// FIXED REWARDS — deterministic, NOT probabilistic (legal requirement)
const AD_REWARDS = {
  revive: { coins: 0, lives: 3, description: 'Lives restored' },
  bonus_coins: { coins: 10, lives: 0, description: '+10 coins' },
  retry: { coins: 5, lives: 0, description: '+5 coins' },
};

const DAILY_AD_LIMIT = 20;

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticate(req, res);
  if (!auth) return;

  const { user, ipHash } = auth;
  const { ad_type, zone_id, reward_type, session_id } = req.body;

  // Validate ad type
  if (!['rewarded', 'interstitial', 'native'].includes(ad_type)) {
    return res.status(400).json({ error: 'Invalid ad type' });
  }

  // Only rewarded ads grant user rewards
  const isRewarded = ad_type === 'rewarded';

  // Rate limit: max 5 ad rewards per minute
  if (!checkRateLimit(`ads:${user.id}`, 5)) {
    return res.status(429).json({ error: 'Too many ad requests' });
  }

  // Check daily ad limit (abuse prevention)
  if (user.ads_watched_today >= DAILY_AD_LIMIT) {
    return res.status(429).json({
      error: 'Daily ad limit reached',
      limit: DAILY_AD_LIMIT,
      reset: 'midnight Istanbul time'
    });
  }

  // Validate reward type
  const reward = isRewarded ? (AD_REWARDS[reward_type] || AD_REWARDS.bonus_coins) : null;

  // Record ad event
  const { data: adEvent } = await supabase.from('ad_events').insert({
    user_id: user.id,
    session_id: session_id || null,
    ad_type,
    zone_id: zone_id || '10883938',
    reward_type: isRewarded ? reward_type : null,
    reward_amount: isRewarded ? (reward?.coins || 0) : 0,
    verified: true, // In production, verify with Monetag webhook
    ip_hash: ipHash,
    device_fp: req.body.device_fp || null
  }).select().single();

  // Update user ad counters
  const updates = {
    ads_watched_today: user.ads_watched_today + 1,
    ads_watched_week: (user.ads_watched_week || 0) + 1,
    ads_watched_total: (user.ads_watched_total || 0) + 1,
  };

  // Apply fixed reward (coins only — NOT affecting score or ranking)
  if (isRewarded && reward) {
    updates.coins = (user.coins || 0) + (reward.coins || 0);
  }

  await supabase.from('users').update(updates).eq('id', user.id);

  // Increment global weekly ad count (for reward pool activation)
  await incrementWeeklyAds(1);

  await auditLog(user.id, 'ad_watched', 'ad_event', adEvent?.id, {
    ad_type,
    reward_type,
    coins_awarded: isRewarded ? reward?.coins : 0
  });

  return res.status(200).json({
    success: true,
    reward: isRewarded ? {
      coins: reward?.coins || 0,
      lives: reward?.lives || 0,
      description: reward?.description
    } : null,
    ads_today: updates.ads_watched_today,
    daily_limit: DAILY_AD_LIMIT,
    remaining_today: DAILY_AD_LIMIT - updates.ads_watched_today
  });
}
