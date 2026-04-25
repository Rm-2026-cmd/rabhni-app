// src/pages/Home.jsx — Fixed: ProfileContext + working referral share + live weekly_score
import { useState } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { useProfile } from '../context/ProfileContext';

const LEVELS = [
  { n:1,  label:'مبتدئ', color:'#4CAF50', emoji:'🌱' },
  { n:2,  label:'سهل',   color:'#8BC34A', emoji:'🍃' },
  { n:3,  label:'متوسط', color:'#FFC107', emoji:'⚡' },
  { n:4,  label:'صعب',   color:'#FF5722', emoji:'🔥' },
  { n:5,  label:'خبير',  color:'#E91E63', emoji:'💎' },
  { n:6,  label:'Pro 1', color:'#9C27B0', emoji:'🚀', pro:true },
  { n:7,  label:'Pro 2', color:'#673AB7', emoji:'🌌', pro:true },
  { n:8,  label:'Pro 3', color:'#3F51B5', emoji:'⚔️', pro:true },
  { n:9,  label:'Pro 4', color:'#2196F3', emoji:'🏆', pro:true },
  { n:10, label:'Pro 5', color:'#FFD700', emoji:'👑', pro:true },
];
const LANGS = [
  { id:'ar', label:'عربي 🇸🇦' },
  { id:'en', label:'English 🇬🇧' },
  { id:'tr', label:'Türkçe 🇹🇷' },
];

export default function Home({ onStartGame }) {
  const { user, haptic, tg } = useTelegram();
  const { profile } = useProfile(); // FIX: from context, always fresh
  const [selLevel, setSelLevel] = useState(1);
  const [selLang, setSelLang]   = useState('ar');

  const u = profile?.user;
  const weekly = u?.weekly_score || 0;
  const TARGET = 300;
  const eligiblePct = Math.min(100, Math.round((weekly / TARGET) * 100));
  const sel = LEVELS.find(l => l.n === selLevel);

  // FIX referral — Telegram WebApp SDK share
  function handleShare() {
    const refCode = user?.id ? `ref${user.id}` : 'share';
    const link = `https://t.me/Rabahni_Bot?start=${refCode}`;
    const text = '🎮 العب ربحني معجم واربح جوائز حقيقية!\nمجاني 100% — مهارة فقط';
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
    } else if (navigator.share) {
      navigator.share({ text: `${text}\n${link}` });
    } else {
      navigator.clipboard?.writeText(`${text}\n${link}`);
    }
    haptic.impact('light');
  }

  return (
    <div className="scroll-y" style={{ height:'100%', padding:'16px 16px 8px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <div>
          <div style={{ fontSize:21, fontWeight:900 }}>مرحباً، {user?.first_name || 'لاعب'} 👋</div>
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>
            نقاطك هذا الأسبوع:&nbsp;
            {/* FIX: weekly_score always live from context */}
            <span style={{ color:'var(--primary)', fontWeight:700 }}>{weekly.toLocaleString()}</span>
          </div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:10, color:'var(--text-muted)', marginBottom:2 }}>العملات</div>
          <div style={{ fontSize:20, fontWeight:900, color:'var(--gold)' }}>🪙 {u?.coins || 0}</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:18 }}>
        {[
          { label:'الألعاب',    value: u?.games_played || 0, emoji:'🎮' },
          // FIX accuracy: shows last-session accuracy stored in context via patchAccuracy()
          { label:'دقة الجلسة', value: u?._session_accuracy != null ? `${u._session_accuracy}%` : '—', emoji:'🎯' },
          { label:'الإحالات',   value: u?.referral_count || 0, emoji:'👥' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign:'center', padding:'12px 8px' }}>
            <div style={{ fontSize:20 }}>{s.emoji}</div>
            <div style={{ fontSize:16, fontWeight:900 }}>{s.value}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Prize eligibility progress */}
      <div className="card" style={{ marginBottom:18, padding:'12px 14px', borderColor:'rgba(37,211,102,0.15)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:13, fontWeight:700 }}>
            {eligiblePct >= 100 ? '✅ مؤهل للجوائز!' : '🔒 تقدم نحو الجائزة'}
          </span>
          <span style={{ fontSize:12, color:'var(--primary)', fontWeight:700 }}>{weekly} / {TARGET}</span>
        </div>
        <div style={{ height:6, background:'var(--bg3)', borderRadius:99, overflow:'hidden' }}>
          <div style={{ height:'100%', borderRadius:99,
            background: eligiblePct >= 100 ? 'var(--primary)' : 'linear-gradient(90deg,#2196F3,var(--primary))',
            width:`${eligiblePct}%`, transition:'width 0.8s ease' }} />
        </div>
        {eligiblePct < 100 && (
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:5 }}>
            تحتاج {TARGET - weekly} نقطة إضافية للتأهل
          </div>
        )}
      </div>

      {/* Language */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:8, fontWeight:700 }}>🌐 اللغة</div>
        <div style={{ display:'flex', gap:8 }}>
          {LANGS.map(l => (
            <button key={l.id} onClick={() => { haptic.impact('light'); setSelLang(l.id); }} style={{
              flex:1, padding:'10px 4px', borderRadius:10, border:'none', cursor:'pointer',
              fontFamily:'Cairo,sans-serif', fontSize:13, fontWeight:700, transition:'all 0.15s',
              background: selLang===l.id ? 'var(--primary)' : 'var(--bg3)',
              color: selLang===l.id ? '#000' : 'var(--text-muted)',
              transform: selLang===l.id ? 'scale(1.04)' : 'scale(1)',
            }}>{l.label}</button>
          ))}
        </div>
      </div>

      {/* Level grid */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:8, fontWeight:700 }}>🏅 المستوى</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
          {LEVELS.map(lv => (
            <button key={lv.n} onClick={() => { haptic.impact('light'); setSelLevel(lv.n); }} style={{
              padding:'10px 4px', borderRadius:12, border:'none', cursor:'pointer',
              fontFamily:'Cairo,sans-serif', fontWeight:700, transition:'all 0.15s',
              background: selLevel===lv.n ? lv.color : 'var(--bg3)',
              color: selLevel===lv.n ? '#fff' : 'var(--text-muted)',
              fontSize:18, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
              boxShadow: selLevel===lv.n ? `0 4px 16px ${lv.color}44` : 'none',
              transform: selLevel===lv.n ? 'scale(1.08)' : 'scale(1)',
            }}>
              <span>{lv.emoji}</span>
              <span style={{ fontSize:10 }}>{lv.n}</span>
            </button>
          ))}
        </div>
        {sel && (
          <div style={{ marginTop:10, padding:'8px 14px', background:'var(--bg3)', borderRadius:10,
            fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:20 }}>{sel.emoji}</span>
            <span style={{ fontWeight:700 }}>{sel.label}</span>
            {sel.pro && <span style={{ fontSize:10, background:'var(--gold)', color:'#000',
              padding:'2px 8px', borderRadius:99, fontWeight:900 }}>PRO</span>}
          </div>
        )}
      </div>

      <button className="btn btn-primary" onClick={() => onStartGame(selLevel, selLang)}
        style={{ marginBottom:14, fontSize:17, fontWeight:900 }}>
        🎮 ابدأ اللعبة
      </button>

      {/* Referral card — FIX: working share button */}
      <div className="card" style={{ marginBottom:16,
        background:'linear-gradient(135deg,var(--bg3),var(--bg2))',
        borderColor:'rgba(37,211,102,0.2)' }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>
          👥 ادعُ أصدقاء — اكسب 50 عملة لكل دعوة
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10, direction:'ltr',
          wordBreak:'break-all', background:'var(--bg)', padding:8, borderRadius:8 }}>
          {u?.referral_link || `https://t.me/Rabahni_Bot?start=ref${user?.id || ''}`}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={handleShare}>
          📤 مشاركة رابط الدعوة
        </button>
      </div>
    </div>
  );
}
