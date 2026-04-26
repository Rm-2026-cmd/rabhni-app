// src/App.jsx — Fixed: ProfileContext يلف كل شيء
import { useState, useEffect } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { useApi } from './hooks/useApi';
import { ProfileProvider, useProfile } from './context/ProfileContext';
import Home        from './pages/Home';
import Game        from './pages/Game';
import Leaderboard from './pages/Leaderboard';
import Rewards     from './pages/Rewards';
import Profile     from './pages/Profile';
import Admin       from './pages/Admin';
import TermsModal  from './components/TermsModal';
import BottomNav   from './components/BottomNav';

const ADMIN_ID = 8079733623;

// AppInner — داخل ProfileProvider، تقدر تستخدم useProfile
function AppInner() {
  const { user, haptic } = useTelegram();
  const api = useApi();
  const { profile, setProfile, loading, loadProfile } = useProfile();
  const [page, setPage]           = useState('home');
  const [gameConfig, setGameConfig] = useState(null);
  const [showTerms, setShowTerms]   = useState(false);

  useEffect(() => {
    if (!user) return;
    loadProfile().then(data => {
      if (data && !data.user.agreed_to_terms) setShowTerms(true);
    });
  }, [user]); // eslint-disable-line

  function startGame(level, language) {
    haptic.impact('medium');
    setGameConfig({ level, language });
    setPage('game');
  }

  function exitGame() {
    setGameConfig(null);
    setPage('home');
    // patchScore + syncFromServer في Game.jsx يكفلان التحديث قبل الخروج
  }

  const isAdmin = user?.id === ADMIN_ID;

  if (loading) return <LoadingScreen />;

  if (!user) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center',
      height:'100%', flexDirection:'column', gap:16, padding:24, textAlign:'center' }}>
      <div style={{ fontSize:56 }}>🎮</div>
      <div style={{ fontSize:20, fontWeight:900 }}>ربحني معجم</div>
      <div style={{ color:'var(--text-muted)', fontSize:14 }}>افتح التطبيق من داخل تيليغرام</div>
    </div>
  );

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column' }}>

      {showTerms && (
        <TermsModal onAccept={async () => {
          await api.post('/user/accept-terms', {});
          setShowTerms(false);
          setProfile(p => p ? { ...p, user: { ...p.user, agreed_to_terms: true } } : p);
        }} />
      )}

      <div style={{ flex:1, overflow:'hidden' }}>
        {page === 'home'        && <Home onStartGame={startGame} />}
        {page === 'game'        && gameConfig && <Game config={gameConfig} onExit={exitGame} />}
        {page === 'leaderboard' && <Leaderboard />}
        {page === 'rewards'     && <Rewards />}
        {page === 'profile'     && <Profile />}
        {page === 'admin'       && isAdmin && <Admin />}
      </div>

      {page !== 'game' && (
        <BottomNav current={page} onChange={setPage} isAdmin={isAdmin} />
      )}
    </div>
  );
}

// Root — يلف الكل بـ ProfileProvider
export default function App() {
  return (
    <ProfileProvider>
      <AppInner />
    </ProfileProvider>
  );
}

function LoadingScreen() {
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:20, background:'var(--bg)' }}>
      <div style={{ fontSize:56, animation:'pulse 1.5s ease infinite' }}>🎮</div>
      <div style={{ fontWeight:900, fontSize:22, color:'var(--primary)', letterSpacing:1 }}>
        ربحني معجم
      </div>
      <div style={{ width:200, height:4, background:'var(--bg3)', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%',
          background:'linear-gradient(90deg,var(--primary-dk),var(--primary))',
          borderRadius:99, animation:'shimmer 1.2s linear infinite',
          backgroundSize:'200% 100%' }} />
      </div>
    </div>
  );
}
