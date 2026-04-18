// src/pages/Home.jsx
import { useState } from 'react';
import { useTelegram } from '../hooks/useTelegram';

const LEVELS = [
  { n:1, label:'مبتدئ', labelTr:'Başlangıç', color:'#4CAF50', emoji:'🌱' },
  { n:2, label:'سهل',   labelTr:'Kolay',      color:'#8BC34A', emoji:'🍃' },
  { n:3, label:'متوسط', labelTr:'Orta',       color:'#FFC107', emoji:'⚡' },
  { n:4, label:'صعب',   labelTr:'Zor',        color:'#FF5722', emoji:'🔥' },
  { n:5, label:'خبير',  labelTr:'Uzman',      color:'#E91E63', emoji:'💎' },
  { n:6, label:'Pro 1', labelTr:'Pro 1',      color:'#9C27B0', emoji:'🚀', pro:true },
  { n:7, label:'Pro 2', labelTr:'Pro 2',      color:'#673AB7', emoji:'🌌', pro:true },
  { n:8, label:'Pro 3', labelTr:'Pro 3',      color:'#3F51B5', emoji:'⚔️', pro:true },
  { n:9, label:'Pro 4', labelTr:'Pro 4',      color:'#2196F3', emoji:'🏆', pro:true },
  { n:10,label:'Pro 5', labelTr:'Pro 5',      color:'#FFD700', emoji:'👑', pro:true },
];

const LANGS = [
  { id:'ar', label:'عربي 🇸🇦' },
  { id:'en', label:'English 🇬🇧' },
  { id:'tr', label:'Türkçe 🇹🇷' },
];

export default function Home({ profile, onStartGame }) {
  const { user, haptic } = useTelegram();
  const [selLevel, setSelLevel] = useState(1);
  const [selLang, setSelLang] = useState('ar');

  const u = profile?.user;
  const firstName = user?.first_name || 'لاعب';

  function handleStart() {
    haptic.impact('medium');
    onStartGame(selLevel, selLang);
  }

  return (
    <div className="scroll-y" style={{ height:'100%', padding:'16px 16px 8px' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:22, fontWeight:900, color:'var(--text)' }}>
            مرحباً، {firstName} 👋
          </div>
          <div style={{ fontSize:13, color:'var(--text-muted)' }}>
            نقاطك هذا الأسبوع:&nbsp;
            <span style={{ color:'var(--primary)', fontWeight:700 }}>
              {(u?.weekly_score || 0).toLocaleString()}
            </span>
          </div>
        </div>
        <div style={{ textAlign:'center' }}>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>العملات</div>
          <div style={{ fontSize:20, fontWeight:900, color:'var(--gold)' }}>🪙 {u?.coins || 0}</div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20 }}>
        {[
          { label:'الألعاب', value: u?.games_played || 0, emoji:'🎮' },
          { label:'الدقة', value: `—`, emoji:'🎯' },
          { label:'الإحالات', value: u?.referral_count || 0, emoji:'👥' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ textAlign:'center', padding:'12px 8px' }}>
            <div style={{ fontSize:20 }}>{stat.emoji}</div>
            <div style={{ fontSize:16, fontWeight:900, color:'var(--text)' }}>{stat.value}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Language selection */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:8, fontWeight:700 }}>🌐 اللغة</div>
        <div style={{ display:'flex', gap:8 }}>
          {LANGS.map(l => (
            <button key={l.id} onClick={() => { haptic.impact('light'); setSelLang(l.id); }} style={{
              flex:1, padding:'10px 4px', borderRadius:10, border:'none', cursor:'pointer',
              fontFamily:'Cairo,sans-serif', fontSize:13, fontWeight:700, transition:'all 0.15s',
              background: selLang===l.id ? 'var(--primary)' : 'var(--bg3)',
              color: selLang===l.id ? '#000' : 'var(--text-muted)',
            }}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Level selection */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:8, fontWeight:700 }}>
          🏅 اختر المستوى
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8 }}>
          {LEVELS.map(lv => (
            <button
              key={lv.n}
              onClick={() => { haptic.impact('light'); setSelLevel(lv.n); }}
              style={{
                padding:'10px 4px', borderRadius:12, border:'none', cursor:'pointer',
                fontFamily:'Cairo,sans-serif', fontWeight:700, transition:'all 0.15s',
                background: selLevel===lv.n ? lv.color : 'var(--bg3)',
                color: selLevel===lv.n ? '#fff' : 'var(--text-muted)',
                fontSize:18, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
                boxShadow: selLevel===lv.n ? `0 0 12px ${lv.color}55` : 'none',
                transform: selLevel===lv.n ? 'scale(1.05)' : 'scale(1)',
              }}
            >
              <span>{lv.emoji}</span>
              <span style={{ fontSize:10 }}>{lv.n}</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop:8, padding:'8px 12px', background:'var(--bg3)', borderRadius:10, fontSize:13 }}>
          <span style={{ color:'var(--text-muted)' }}>المستوى المختار: </span>
          <span style={{ color:'var(--text)', fontWeight:700 }}>
            {LEVELS.find(l=>l.n===selLevel)?.label} {LEVELS.find(l=>l.n===selLevel)?.emoji}
            {LEVELS.find(l=>l.n===selLevel)?.pro && <span className="badge badge-gold" style={{marginRight:6,fontSize:10}}>PRO</span>}
          </span>
        </div>
      </div>

      {/* Start button */}
      <button className="btn btn-primary" onClick={handleStart} style={{ marginBottom:16, fontSize:17, fontWeight:900 }}>
        🎮 ابدأ اللعبة
      </button>

      {/* Referral card */}
      {u?.referral_code && (
        <div className="card" style={{ marginBottom:16, background:'linear-gradient(135deg,var(--bg3),var(--bg2))' }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:6 }}>👥 ادعُ أصدقاء — اكسب 50 عملة لكل دعوة</div>
          <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10, direction:'ltr', wordBreak:'break-all' }}>
            {u.referral_link}
          </div>
          <button className="btn btn-secondary btn-sm" onClick={async () => {
            haptic.impact('light');
            if (navigator.share) {
              await navigator.share({ text: `🎮 العب ربحني معجم واكسب جوائز حقيقية!\n${u.referral_link}` });
            } else {
              navigator.clipboard.writeText(u.referral_link);
            }
          }}>
            📤 مشاركة رابط الدعوة
          </button>
        </div>
      )}
    </div>
  );
}
