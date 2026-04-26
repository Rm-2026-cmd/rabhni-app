// src/pages/Home.jsx — Fixed: ProfileContext + referral share
import { useState } from 'react';
import { useTelegram } from '../hooks/useTelegram';
import { useProfile }  from '../context/ProfileContext';

const LEVELS = [
  { n:1,  label:'مبتدئ', c:'#4CAF50', e:'🌱' },
  { n:2,  label:'سهل',   c:'#8BC34A', e:'🍃' },
  { n:3,  label:'متوسط', c:'#FFC107', e:'⚡' },
  { n:4,  label:'صعب',   c:'#FF5722', e:'🔥' },
  { n:5,  label:'خبير',  c:'#E91E63', e:'💎' },
  { n:6,  label:'Pro 1', c:'#9C27B0', e:'🚀', pro:true },
  { n:7,  label:'Pro 2', c:'#673AB7', e:'🌌', pro:true },
  { n:8,  label:'Pro 3', c:'#3F51B5', e:'⚔️',  pro:true },
  { n:9,  label:'Pro 4', c:'#2196F3', e:'🏆', pro:true },
  { n:10, label:'Pro 5', c:'#FFD700', e:'👑', pro:true },
];
const LANGS = [
  { id:'ar', label:'عربي 🇸🇦' },
  { id:'en', label:'English 🇬🇧' },
  { id:'tr', label:'Türkçe 🇹🇷' },
];

export default function Home({ onStartGame }) {
  const { user, haptic, tg } = useTelegram();
  const { profile } = useProfile();   // ✅ دائماً fresh من الـ context
  const [selLv, setSelLv] = useState(1);
  const [selLg, setSelLg] = useState('ar');

  const u       = profile?.user;
  const weekly  = u?.weekly_score || 0;
  const TARGET  = 300;
  const pct     = Math.min(100, Math.round((weekly / TARGET) * 100));
  const sel     = LEVELS.find(l => l.n === selLv);

  // ✅ FIX referral
  function handleShare() {
    const code = user?.id ? `ref${user.id}` : 'share';
    const link  = `https://t.me/Rabahni_Bot?start=${code}`;
    const text  = '🎮 العب ربحني معجم واربح جوائز حقيقية!\nمجاني 100% — مهارة فقط';
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
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div>
          <div style={{ fontSize:21, fontWeight:900 }}>مرحباً، {user?.first_name || 'لاعب'} 👋</div>
          {/* ✅ FIX weekly_score — يتحدث فوراً من الـ context بعد كل جلسة */}
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>
            نقاطك هذا الأسبوع:&nbsp;
            <span style={{ color:'var(--primary)', fontWeight:700 }}>
              {weekly.toLocaleString()}
            </span>
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
          { l:'الألعاب',    v: u?.games_played || 0,   e:'🎮' },
          // ✅ FIX accuracy — مأخوذة من _session_accuracy في الـ context
          { l:'آخر دقة',    v: u?._session_accuracy != null ? `${u._session_accuracy}%` : '—', e:'🎯' },
          { l:'الإحالات',   v: u?.referral_count || 0,  e:'👥' },
        ].map(s => (
          <div key={s.l} className="card" style={{ textAlign:'center', padding:'12px 8px' }}>
            <div style={{ fontSize:20 }}>{s.e}</div>
            <div style={{ fontSize:16, fontWeight:900 }}>{s.v}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Prize eligibility */}
      <div className="card" style={{ marginBottom:18, padding:'12px 14px',
        borderColor: pct >= 100 ? 'rgba(37,211,102,0.3)' : 'var(--border)' }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
          <span style={{ fontSize:13, fontWeight:700 }}>
            {pct >= 100 ? '✅ مؤهل للجوائز!' : '🔒 تقدم نحو الجائزة'}
          </span>
          <span style={{ fontSize:12, color:'var(--primary)', fontWeight:700 }}>
            {weekly.toLocaleString()} / {TARGET}
          </span>
        </div>
        <div style={{ height:6, background:'var(--bg3)', borderRadius:99, overflow:'hidden' }}>
          <div style={{
            height:'100%', borderRadius:99,
            background: pct >= 100
              ? 'var(--primary)'
              : 'linear-gradient(90deg,#2196F3,var(--primary))',
            width:`${pct}%`, transition:'width 0.8s ease'
          }} />
        </div>
        {pct < 100 && (
          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:5 }}>
            تحتاج {TARGET - weekly} نقطة إضافية للتأهل
          </div>
        )}
      </div>

      {/* اللغة */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:8, fontWeight:700 }}>🌐 اللغة</div>
        <div style={{ display:'flex', gap:8 }}>
          {LANGS.map(l => (
            <button key={l.id} onClick={() => { haptic.impact('light'); setSelLg(l.id); }} style={{
              flex:1, padding:'10px 4px', borderRadius:10, border:'none', cursor:'pointer',
              fontFamily:'Cairo,sans-serif', fontSize:13, fontWeight:700, transition:'all 0.15s',
              background: selLg === l.id ? 'var(--primary)' : 'var(--bg3)',
              color: selLg === l.id ? '#000' : 'var(--text-muted)',
              transform: selLg === l.id ? 'scale(1.04)' : 'scale(1)',
            }}>{l.label}</button>
          ))}
        </div>
      </div>

      {/* المستوى */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:8, fontWeight:700 }}>🏅 المستوى</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
          {LEVELS.map(lv => (
            <button key={lv.n} onClick={() => { haptic.impact('light'); setSelLv(lv.n); }} style={{
              padding:'10px 4px', borderRadius:12, border:'none', cursor:'pointer',
              fontFamily:'Cairo,sans-serif', transition:'all 0.15s',
              background: selLv === lv.n ? lv.c : 'var(--bg3)',
              color: selLv === lv.n ? '#fff' : 'var(--text-muted)',
              fontSize:18, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
              boxShadow: selLv === lv.n ? `0 4px 16px ${lv.c}44` : 'none',
              transform: selLv === lv.n ? 'scale(1.08)' : 'scale(1)',
            }}>
              <span>{lv.e}</span>
              <span style={{ fontSize:10 }}>{lv.n}</span>
            </button>
          ))}
        </div>
        {sel && (
          <div style={{ marginTop:10, padding:'8px 14px', background:'var(--bg3)',
            borderRadius:10, fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:20 }}>{sel.e}</span>
            <span style={{ fontWeight:700 }}>{sel.label}</span>
            {sel.pro && (
              <span style={{ fontSize:10, background:'var(--gold)', color:'#000',
                padding:'2px 8px', borderRadius:99, fontWeight:900 }}>PRO</span>
            )}
          </div>
        )}
      </div>

      {/* ابدأ */}
      <button className="btn btn-primary"
        onClick={() => { haptic.impact('medium'); onStartGame(selLv, selLg); }}
        style={{ marginBottom:14, fontSize:17, fontWeight:900 }}>
        🎮 ابدأ اللعبة
      </button>

      {/* Referral card */}
      <div className="card" style={{ marginBottom:16,
        borderColor:'rgba(37,211,102,0.2)',
        background:'linear-gradient(135deg,var(--bg3),var(--bg2))' }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>
          👥 ادعُ أصدقاء — اكسب 50 عملة لكل دعوة
        </div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10,
          direction:'ltr', wordBreak:'break-all',
          background:'var(--bg)', padding:8, borderRadius:8 }}>
          {u?.referral_link || `https://t.me/Rabahni_Bot?start=ref${user?.id || ''}`}
        </div>
        {/* ✅ FIX referral — يعمل داخل تيليغرام */}
        <button className="btn btn-secondary btn-sm" onClick={handleShare}>
          📤 مشاركة رابط الدعوة
        </button>
      </div>
    </div>
  );
}
