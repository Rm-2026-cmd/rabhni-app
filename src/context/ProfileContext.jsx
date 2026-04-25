// src/context/ProfileContext.jsx
// ROOT FIX for weekly_score not syncing across pages.
// Problem was: App.jsx passes `profile` as a prop snapshot to each page,
// but after a game session, only App re-fetches, pages get new props only
// if they re-render. Pages that don't re-render keep stale data.
// Fix: centralized context + explicit refresh trigger after every session submit.

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useApi } from '../hooks/useApi';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const api = useApi();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // Track in-flight refresh to avoid duplicate fetches
  const refreshingRef = useRef(false);

  const loadProfile = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const data = await api.get('/user/profile');
      setProfile(data);
      return data;
    } catch (e) {
      console.error('Profile load failed:', e);
    } finally {
      refreshingRef.current = false;
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Called immediately after a game session is submitted
  // Optimistically patches weekly_score so UI updates instantly,
  // then re-fetches to confirm server value.
  const patchScore = useCallback((scoreDelta) => {
    setProfile(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        user: {
          ...prev.user,
          weekly_score: (prev.user.weekly_score || 0) + scoreDelta,
          total_score: (prev.user.total_score || 0) + scoreDelta,
          games_played: (prev.user.games_played || 0) + 1,
        }
      };
    });
    // Confirm from server after 1s
    setTimeout(loadProfile, 1000);
  }, [loadProfile]);

  // Update accuracy after each answer — purely client-side stat
  const patchAccuracy = useCallback((totalAnswered, totalCorrect) => {
    setProfile(prev => {
      if (!prev) return prev;
      const accuracy = totalAnswered > 0
        ? Math.round((totalCorrect / totalAnswered) * 100)
        : 0;
      return {
        ...prev,
        user: { ...prev.user, _session_accuracy: accuracy }
      };
    });
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, setProfile, loading, loadProfile, patchScore, patchAccuracy }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}
