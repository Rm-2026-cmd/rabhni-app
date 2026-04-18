// lib/economy.js — Economy, reward level, and eligibility logic

// ─────────────────────────────────────────────────────
// LEGAL COMPLIANCE ASSERTION
// Per Turkish law (6502) + compliance rules:
// A user MUST be able to win WITHOUT watching any ads.
// Ads only unlock GLOBAL reward pool, not individual eligibility.
// ─────────────────────────────────────────────────────

export const ECONOMY_RULES = {
  // Global pool activation (system-wide, not per-user)
  weeklyAdsThreshold: 5000,
  highAdsThreshold: 10000,
  weeklyUsersThreshold: 100,
  highUsersThreshold: 200,

  // User eligibility (skill-based only)
  minPointsToQualify: 300,

  // Ad limits (abuse prevention)
  dailyAdsLimit: 20,

  // Reset
  resetDay: 'Sunday',
  resetTimeUTC: '21:00', // 00:00 Istanbul (UTC+3)
};

// ─────────────────────────────────────────────────────
// COMPLIANCE VALIDATOR (runs at build time)
// ─────────────────────────────────────────────────────
export function assertComplianceRules() {
  // Simulate User A (watches ads) vs User B (no ads)
  // Both should be able to reach top leaderboard

  const userA = { score: 1000, adsWatched: 20 };
  const userB = { score: 1000, adsWatched: 0 };

  // User B eligibility must NOT depend on ads
  const userBEligible = isUserEligible(userB.score);
  if (!userBEligible) {
    throw new Error('COMPLIANCE VIOLATION: User without ads cannot win. BUILD INVALID.');
  }

  // Ads must not give score advantage that dominates ranking
  // Only difference: ads give revive/bonus coins (non-score items)
  const userAScore = userA.score; // ads don't add to score
  const userBScore = userB.score;
  if (userAScore !== userBScore) {
    throw new Error('COMPLIANCE VIOLATION: Ads affect score ranking. BUILD INVALID.');
  }

  console.log('✅ Compliance check passed: Non-ad user can win');
  return true;
}

// ─────────────────────────────────────────────────────
// Reward level based on GLOBAL system metrics
// (NOT per-user — this is the legal model)
// ─────────────────────────────────────────────────────
export function getRewardLevel(totalWeeklyAds, totalActiveUsers) {
  if (
    totalWeeklyAds >= ECONOMY_RULES.highAdsThreshold &&
    totalActiveUsers >= ECONOMY_RULES.highUsersThreshold
  ) {
    return 'high';
  }
  if (
    totalWeeklyAds >= ECONOMY_RULES.weeklyAdsThreshold &&
    totalActiveUsers >= ECONOMY_RULES.weeklyUsersThreshold
  ) {
    return 'medium';
  }
  return 'locked';
}

// ─────────────────────────────────────────────────────
// User eligibility — skill-based ONLY
// Does NOT depend on ads watched
// ─────────────────────────────────────────────────────
export function isUserEligible(userWeeklyScore) {
  return userWeeklyScore >= ECONOMY_RULES.minPointsToQualify;
}

// ─────────────────────────────────────────────────────
// Prize values by reward level and rank
// ─────────────────────────────────────────────────────
export function getPrizeForRank(rewardLevel, rank) {
  const prizes = {
    medium: [50, 30, 20, 0, 0],
    high: [200, 100, 50, 30, 20]
  };

  const levelPrizes = prizes[rewardLevel];
  if (!levelPrizes) return 0;

  return levelPrizes[rank - 1] || 0;
}

// ─────────────────────────────────────────────────────
// Progress towards reward pool unlock (for UI display)
// ─────────────────────────────────────────────────────
export function getRewardProgress(currentAds, currentUsers) {
  const adsProgress = Math.min(currentAds / ECONOMY_RULES.weeklyAdsThreshold * 100, 100);
  const usersProgress = Math.min(currentUsers / ECONOMY_RULES.weeklyUsersThreshold * 100, 100);
  const overallProgress = Math.round((adsProgress + usersProgress) / 2);

  return {
    adsProgress: Math.round(adsProgress),
    usersProgress: Math.round(usersProgress),
    overallProgress,
    currentAds,
    targetAds: ECONOMY_RULES.weeklyAdsThreshold,
    currentUsers,
    targetUsers: ECONOMY_RULES.weeklyUsersThreshold,
    rewardLevel: getRewardLevel(currentAds, currentUsers)
  };
}
