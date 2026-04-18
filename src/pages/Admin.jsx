// src/pages/Admin.jsx — Admin panel (only visible to admin user)
import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

export default function Admin() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [distributing, setDistributing] = useState(false);
  const [prizes, setPrizes] = useState([]);
  const [periodKey, setPeriodKey] = useState(getCurrentWeekKey());

  useEffect(() => { loadDashboard(); }, []);

  async function loadDashboard() {
    try {
      const [dash, winners] = await Promise.all([
        api.get('/admin/dashboard'),
        api.get('/admin/distribute')
      ]);
      setData(dash);
      setPrizes(winners.winners_preview.map(w => ({
        ...w,
        prize_code: '',
        prize_type: 'hepsiburada'
      })));
    } catch (e) { alert('Admin load failed: ' + e.message); }
    finally { setLoading(false); }
  }

  async function distribute() {
    const missing = prizes.filter(p => p.prize_tl > 0 && !p.prize_code.trim());
    if (missing.length > 0) {
      alert(`أدخل الكود لـ ${missing.length} فائز/ين أولاً`);
      return;
    }
    setDistributing(true);
    try {
      const result = await api.post('/admin/distribute', {
        period_key: periodKey,
        prizes: prizes.filter(p => p.prize_tl > 0).map(p => ({
          user_id: p.user_id,
          rank: p.rank,
          prize_type: p.prize_type,
          prize_value_tl: p.prize_tl,
          prize_code: p.prize_code.trim()
        }))
      });
      alert(`✅ تم الإرسال: ${result.distributed} | فشل: ${result.failed}`);
      loadDashboard();
    } catch (e) { alert('Distribution failed: ' + e.message); }
    finally { setDistributing(false); }
  }

  if (loading) return <div style={{padding:20,color:'var(--text-muted)'}}>تحميل...</div>;

  const { stats, economy } = data || {};

  return (
    <div className="scroll-y" style={{ height:'100%', padding:'16px 16px 8px' }}>
      <div style={{ fontSize:18, fontWeight:900, marginBottom:16 }}>🛡️ لوحة التحكم</div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
        {[
          { label:'المستخدمون', value:stats?.total_users||0, emoji:'👥' },
          { label:'نشطون هذا الأسبوع', value:stats?.active_this_week||0, emoji:'🟢' },
          { label:'إعلانات الأسبوع', value:stats?.current_week_ads||0, emoji:'📺' },
          { label:'الجلسات الكلية', value:stats?.total_sessions||0, emoji:'🎮' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding:'12px 10px' }}>
            <div style={{ fontSize:18 }}>{s.emoji}</div>
            <div style={{ fontSize:18, fontWeight:900 }}>{s.value?.toLocaleString()}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Economy */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:10 }}>💰 حالة الجوائز</div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ fontSize:20 }}>{economy?.rewards_active ? '✅' : '🔒'}</div>
          <div>
            <div style={{ fontWeight:700 }}>{economy?.reward_level?.toUpperCase()}</div>
            <div style={{ fontSize:12, color:'var(--text-muted)' }}>
              {stats?.current_week_ads}/{5000} إعلانات — {stats?.active_this_week}/{100} مستخدم
            </div>
          </div>
        </div>
      </div>

      {/* Distribute prizes */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>🎁 توزيع الجوائز</div>
        <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:12 }}>
          أدخل الأكواد ثم اضغط إرسال — سيتلقى كل فائز رسالة خاصة
        </div>

        <div style={{ marginBottom:10 }}>
          <label style={{ fontSize:12, color:'var(--text-muted)' }}>رمز الأسبوع</label>
          <input
            value={periodKey}
            onChange={e => setPeriodKey(e.target.value)}
            style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--text)', fontFamily:'Cairo,sans-serif', fontSize:13, marginTop:4 }}
          />
        </div>

        {prizes.map((p, i) => p.prize_tl > 0 ? (
          <div key={i} style={{ marginBottom:12, padding:12, background:'var(--bg3)', borderRadius:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, fontSize:13 }}>
              <span style={{ fontWeight:700 }}>#{p.rank} @{p.username}</span>
              <span style={{ color:'var(--gold)' }}>{p.prize_tl}₺</span>
            </div>
            <div style={{ display:'flex', gap:8, marginBottom:6 }}>
              {['hepsiburada','trendyol'].map(type => (
                <button key={type} onClick={() => {
                  const updated = [...prizes];
                  updated[i] = { ...updated[i], prize_type: type };
                  setPrizes(updated);
                }} style={{
                  padding:'4px 10px', borderRadius:8, border:'none', cursor:'pointer',
                  background: p.prize_type===type ? 'var(--primary)' : 'var(--bg4)',
                  color: p.prize_type===type ? '#000' : 'var(--text-muted)',
                  fontSize:11, fontWeight:700, fontFamily:'Cairo,sans-serif'
                }}>{type}</button>
              ))}
            </div>
            <input
              placeholder={`كود ${p.prize_type} (${p.prize_tl}₺)`}
              value={p.prize_code}
              onChange={e => {
                const updated = [...prizes];
                updated[i] = { ...updated[i], prize_code: e.target.value };
                setPrizes(updated);
              }}
              style={{ width:'100%', padding:'8px 10px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg4)', color:'var(--text)', fontFamily:'monospace', fontSize:12 }}
            />
          </div>
        ) : null)}

        <button className="btn btn-primary" onClick={distribute} disabled={distributing}>
          {distributing ? '⏳ جاري الإرسال...' : '🚀 إرسال الجوائز للفائزين'}
        </button>
      </div>

      <button className="btn btn-secondary" onClick={loadDashboard}>🔄 تحديث</button>
    </div>
  );
}

function getCurrentWeekKey() {
  const now = new Date();
  const year = now.getFullYear();
  const week = getISOWeek(now);
  return `${year}-W${String(week).padStart(2,'0')}`;
}

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
