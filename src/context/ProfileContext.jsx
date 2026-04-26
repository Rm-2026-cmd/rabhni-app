// src/context/ProfileContext.jsx
// المصدر الوحيد لبيانات المستخدم عبر كل الصفحات.
// يحل مشكلة weekly_score لأن الصفحات تقرأ من هنا مباشرة،
// وليس من props ثابتة تُمرَّر من App.jsx.

import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useApi } from '../hooks/useApi';

const ProfileContext = createContext(null);

export function ProfileProvider({ children }) {
  const api = useApi();
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const refreshingRef = useRef(false);

  // تحميل الملف الشخصي من API
  const loadProfile = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const data = await api.get('/user/profile');
      setProfile(data);
      return data;
    } catch (e) {
      console.error('[Profile] load failed:', e);
    } finally {
      refreshingRef.current = false;
      setLoading(false);
    }
  }, []); // eslint-disable-line

  // 1) تحديث فوري (optimistic) ثم تأكيد من السيرفر
  const patchScore = useCallback((delta) => {
    setProfile(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        user: {
          ...prev.user,
          weekly_score: (prev.user.weekly_score || 0) + delta,
          total_score:  (prev.user.total_score  || 0) + delta,
          games_played: (prev.user.games_played || 0) + 1,
        }
      };
    });
    // تأكيد بعد 800ms بالقيم الحقيقية من DB
    setTimeout(() => loadProfile(), 800);
  }, [loadProfile]);

  // 2) مزامنة مباشرة من الـ response (أدق من patchScore)
  const syncFromServer = useCallback((serverUser) => {
    if (!serverUser) return;
    setProfile(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        user: {
          ...prev.user,
          weekly_score: serverUser.weekly_score ?? prev.user.weekly_score,
          total_score:  serverUser.total_score  ?? prev.user.total_score,
          games_played: serverUser.games_played ?? prev.user.games_played,
          coins:        serverUser.coins        ?? prev.user.coins,
        }
      };
    });
  }, []);

  // 3) تحديث الدقة بعد كل جلسة (client-only)
  const patchAccuracy = useCallback((pct) => {
    setProfile(prev => {
      if (!prev) return prev;
      return { ...prev, user: { ...prev.user, _session_accuracy: pct } };
    });
  }, []);

  return (
    <ProfileContext.Provider value={{
      profile, setProfile, loading,
      loadProfile, patchScore, syncFromServer, patchAccuracy
    }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be inside ProfileProvider');
  return ctx;
}
