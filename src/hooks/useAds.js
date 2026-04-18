// src/hooks/useAds.js — Monetag ad integration
import { useApi } from './useApi';
import { useTelegram } from './useTelegram';

const ZONE_ID = import.meta.env.VITE_MONETAG_ZONE || '10883938';
const showAd = window[`show_${ZONE_ID}`];

export function useAds() {
  const api = useApi();
  const { haptic } = useTelegram();

  // Show rewarded ad + grant server-side reward
  async function showRewarded(rewardType = 'bonus_coins', sessionId = null) {
    return new Promise(async (resolve) => {
      if (typeof showAd !== 'function') {
        console.warn('Monetag SDK not loaded');
        resolve({ success: false, error: 'Ad not available' });
        return;
      }

      try {
        await showAd();  // Wait for user to complete watching

        // Notify server (server grants fixed reward)
        const result = await api.post('/ads/reward', {
          ad_type: 'rewarded',
          zone_id: ZONE_ID,
          reward_type: rewardType,
          session_id: sessionId
        });

        haptic.success();
        resolve({ success: true, reward: result.reward });
      } catch (err) {
        // Ad failed (skipped, network error, etc.)
        resolve({ success: false, error: err.message });
      }
    });
  }

  // Show interstitial (no user reward — background revenue)
  async function showInterstitial() {
    if (typeof showAd !== 'function') return;
    try {
      await showAd({ type: 'inApp', inAppSettings: { frequency: 2, capping: 0.1, interval: 30, timeout: 5, everyPage: false } });
      await api.post('/ads/reward', { ad_type: 'interstitial', zone_id: ZONE_ID });
    } catch {}
  }

  return { showRewarded, showInterstitial };
}
