// src/App.jsx — Main app with page routing
import { useState, useEffect } from 'react';
import { useTelegram } from './hooks/useTelegram';
import { useApi } from './hooks/useApi';
import Home from './pages/Home';
import Game from './pages/Game';
import Leaderboard from './pages/Leaderboard';
import Rewards from './pages/Rewards';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import TermsModal from './components/TermsModal';
import BottomNav from './components/BottomNav';

const ADMIN_ID = 8079733623;

export default function App() {
  const { tg, user } = useTelegram();
  const api = useApi();
  const [page, setPage] = useState('home');
  const [gameConfig, setGameConfig] = useState(null);
  const [profile, setProfile] = useState(null);
  const [showTerms, setShowTerms] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadProfile();
  }, [user]);

  async function loadProfile() {
    try {
      const data = await api.get('/user/profile');
      setProfile(data);
      if (!data.user.agreed_to_terms) setShowTerms(true);
    } catch (e) {
      console.error('Profile load failed:', e);
    } finally {
      setLoading(false);
    }
  }

  function startGame(level, language) {
    setGameConfig({ level, language });
    setPage('game');
  }

  function exitGame() {
    setGameConfig(null);
    setPage('home');
    loadProfile(); // refresh score
  }

  const isAdmin = user?.id === ADMIN_ID;

  if (loading) return <LoadingScreen />;

  if (!user) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:16, color:'var(--text-muted)', padding:24, textAlign:'center' }}>
      <div style={{ fontSize:48 }}>🎮</div>
      <div style={{ fontSize:18, fontWeight:700, color:'var(--text)' }}>ربحني معجم</div>
      <div>افتح التطبيق من داخل تيليغرام</div>
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
        {page === 'home' && <Home profile={profile} onStartGame={startGame} onNavigate={setPage} />}
        {page === 'game' && gameConfig && <Game config={gameConfig} profile={profile} onExit={exitGame} />}
        {page === 'leaderboard' && <Leaderboard profile={profile} />}
        {page === 'rewards' && <Rewards profile={profile} />}
        {page === 'profile' && <Profile profile={profile} onRefresh={loadProfile} />}
        {page === 'admin' && isAdmin && <Admin />}
      </div>

      {page !== 'game' && (
        <BottomNav
          current={page}
          onChange={setPage}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, background:'var(--bg)' }}>
      <div style={{ fontSize:56, animation:'pulse 1.5s ease infinite' }}>🎮</div>
      <div style={{ fontWeight:900, fontSize:22, color:'var(--primary)', letterSpacing:1 }}>ربحني معجم</div>
      <div style={{ width:200, height:4, background:'var(--bg3)', borderRadius:99, overflow:'hidden' }}>
        <div style={{ height:'100%', background:'linear-gradient(90deg,var(--primary-dk),var(--primary))', borderRadius:99, animation:'shimmer 1.2s linear infinite', backgroundSize:'200% 100%' }} />
      </div>
    </div>
  );
}
