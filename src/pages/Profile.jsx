// src/pages/Profile.jsx — Fixed: ProfileContext + referral share
import { useTelegram } from '../hooks/useTelegram';
import { useProfile }  from '../context/ProfileContext';

export default function Profile() {
  const { user, haptic, tg } = useTelegram();
  const { profile, loadProfile } = useProfile();  // ✅ من الـ context
  const u = profile?.user;

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

      {/* Avatar */}
      <div style={{ textAlign:'center', marginBottom:24 }}>
        <div style={{
          width:72, height:72, borderRadius:'50%',
          background:'linear-gradient(135deg,var(--primary-dk),var(--primary))',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:32, margin:'0 auto 10px', color:'#000', fontWeight:900,
          boxShadow:'0 4px 20px rgba(37,211,102,0.3)'
        }}>
          {(user?.first_name?.[0] || '?').toUpperCase()}
        </div>
        <div style={{ fontSize:20, fontWeight:900 }}>{user?.first_name} {user?.last_name}</div>
        {user?.username && (
          <div style={{ fontSize:14, color:'var(--text-muted)' }}>@{user.username}</div>
        )}
      </div>

      {/* Stats — ✅ كلها من context، دائماً محدّثة */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
        {[
          { l:'النقاط الكلية',  v:(u?.total_score  || 0).toLocaleString(), e:'⭐' },
          // ✅ FIX weekly_score — من الـ context مباشرة
          { l:'نقاط الأسبوع',  v:(u?.weekly_score || 0).toLocaleString(), e:'📅' },
          { l:'الألعاب',        v: u?.games_played || 0,                   e:'🎮' },
          { l:'العملات',        v: u?.coins || 0,                          e:'🪙' },
          { l:'الإحالات',       v: u?.referral_count || 0,                 e:'👥' },
          // ✅ FIX accuracy
          { l:'آخر دقة',        v: u?._session_accuracy != null ? `${u._session_accuracy}%` : '—', e:'🎯' },
        ].map(s => (
          <div key={s.l} className="card" style={{ padding:'14px 12px' }}>
            <div style={{ fontSize:20, marginBottom:4 }}>{s.e}</div>
            <div style={{ fontSize:18, fontWeight:900 }}>{s.v}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Ad counter */}
      <div className="card" style={{ marginBottom:16, padding:'12px 14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700 }}>📺 الإعلانات اليوم</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>الحد اليومي: 20 إعلان</div>
          </div>
          <div style={{ fontSize:20, fontWeight:900, color:'var(--primary)' }}>
            {u?.ads_watched_today || 0}/20
          </div>
        </div>
        <div style={{ height:4, background:'var(--bg3)', borderRadius:99, marginTop:10, overflow:'hidden' }}>
          <div style={{
            height:'100%', borderRadius:99, background:'var(--primary)',
            width:`${Math.min(100, ((u?.ads_watched_today || 0) / 20) * 100)}%`,
            transition:'width 0.5s ease'
          }} />
        </div>
      </div>

      {/* Referral */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:10 }}>👥 رابط الدعوة</div>
        <div style={{
          fontSize:12, color:'var(--text-muted)',
          direction:'ltr', wordBreak:'break-all',
          marginBottom:10, background:'var(--bg3)', padding:8, borderRadius:8
        }}>
          {u?.referral_link || `https://t.me/Rabahni_Bot?start=ref${user?.id || ''}`}
        </div>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:12 }}>
          اكسب <strong style={{ color:'var(--gold)' }}>50 عملة</strong> لكل صديق يسجّل برابطك
        </div>
        <button className="btn btn-primary" onClick={handleShare}>📤 مشاركة الرابط</button>
      </div>

      {/* Bot commands */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:10 }}>🤖 أوامر البوت</div>
        {[
          { cmd:'/myreward', desc:'استرجع كود جائزتك' },
          { cmd:'/start',    desc:'إعادة تشغيل البوت' },
          { cmd:'/help',     desc:'المساعدة والدعم' },
        ].map(c => (
          <div key={c.cmd} style={{
            display:'flex', justifyContent:'space-between', alignItems:'center',
            padding:'8px 0', borderBottom:'1px solid var(--border)', fontSize:13
          }}>
            <code style={{
              color:'var(--primary)', background:'rgba(37,211,102,0.1)',
              padding:'2px 8px', borderRadius:6
            }}>{c.cmd}</code>
            <span style={{ color:'var(--text-muted)' }}>{c.desc}</span>
          </div>
        ))}
      </div>

      <button className="btn btn-secondary" onClick={loadProfile}>🔄 تحديث البيانات</button>
    </div>
  );
}
