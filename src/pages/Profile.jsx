// src/pages/Profile.jsx
import { useTelegram } from '../hooks/useTelegram';

export default function Profile({ profile, onRefresh }) {
  const { user, haptic } = useTelegram();
  const u = profile?.user;

  async function share() {
    haptic.impact('light');
    if (navigator.share) {
      await navigator.share({ text: `🎮 العب ربحني معجم واكسب جوائز حقيقية!\n${u?.referral_link}` });
    } else {
      navigator.clipboard.writeText(u?.referral_link || '');
      alert('تم نسخ الرابط!');
    }
  }

  return (
    <div className="scroll-y" style={{ height:'100%', padding:'16px 16px 8px' }}>
      {/* Avatar */}
      <div style={{ textAlign:'center', marginBottom:24 }}>
        <div style={{
          width:72, height:72, borderRadius:'50%', background:'linear-gradient(135deg,var(--primary-dk),var(--primary))',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:32, margin:'0 auto 10px', fontWeight:900, color:'#000'
        }}>
          {(user?.first_name?.[0] || '?').toUpperCase()}
        </div>
        <div style={{ fontSize:20, fontWeight:900 }}>{user?.first_name} {user?.last_name}</div>
        {user?.username && <div style={{ fontSize:14, color:'var(--text-muted)' }}>@{user.username}</div>}
      </div>

      {/* Stats grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
        {[
          { label:'النقاط الكلية', value:(u?.total_score||0).toLocaleString(), emoji:'⭐' },
          { label:'نقاط الأسبوع', value:(u?.weekly_score||0).toLocaleString(), emoji:'📅' },
          { label:'الألعاب', value:u?.games_played||0, emoji:'🎮' },
          { label:'العملات', value:u?.coins||0, emoji:'🪙' },
          { label:'الإحالات', value:u?.referral_count||0, emoji:'👥' },
          { label:'إعلانات اليوم', value:`${u?.ads_watched_today||0} / 20`, emoji:'📺' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'14px 12px' }}>
            <div style={{ fontSize:20, marginBottom:4 }}>{s.emoji}</div>
            <div style={{ fontSize:18, fontWeight:900, color:'var(--text)' }}>{s.value}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Referral */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:10 }}>👥 رابط الدعوة</div>
        <div style={{ fontSize:12, color:'var(--text-muted)', direction:'ltr', wordBreak:'break-all', marginBottom:10, background:'var(--bg3)', padding:8, borderRadius:8 }}>
          {u?.referral_link}
        </div>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:12 }}>
          اكسب 50 عملة لكل صديق يسجل باستخدام رابطك
        </div>
        <button className="btn btn-primary" onClick={share}>📤 مشاركة الرابط</button>
      </div>

      {/* Bot commands */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:10 }}>🤖 أوامر البوت</div>
        {[
          { cmd:'/myreward', desc:'استرجع كود جائزتك' },
          { cmd:'/start', desc:'إعادة تشغيل البوت' },
          { cmd:'/help', desc:'المساعدة والدعم' },
        ].map(c => (
          <div key={c.cmd} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
            <code style={{ color:'var(--primary)', background:'rgba(37,211,102,0.1)', padding:'2px 8px', borderRadius:6 }}>{c.cmd}</code>
            <span style={{ color:'var(--text-muted)' }}>{c.desc}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-secondary" onClick={onRefresh}>🔄 تحديث البيانات</button>
    </div>
  );
}
