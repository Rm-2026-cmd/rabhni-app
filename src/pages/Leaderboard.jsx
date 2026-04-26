// src/pages/Leaderboard.jsx — Fixed: لا يحتاج profile prop
import { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import { useProfile } from '../context/ProfileContext';

const RANK_EMOJI = ['🥇','🥈','🥉','4️⃣','5️⃣'];

export default function Leaderboard() {
  const api = useApi();
  const { profile } = useProfile();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await api.get('/leaderboard');
      setData(res);
    } catch (e) { setError('فشل تحميل التصنيف'); }
    finally { setLoading(false); }
  }

  if (loading) return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontSize:36, animation:'pulse 1s infinite' }}>⏳</div>
    </div>
  );

  if (error) return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:16, padding:24 }}>
      <div style={{ fontSize:36 }}>⚠️</div>
      <div style={{ color:'var(--text-muted)' }}>{error}</div>
      <button className="btn btn-primary btn-sm" onClick={load}>إعادة المحاولة</button>
    </div>
  );

  const { leaderboard, user_rank, user_score, reward_progress, reward_level, rewards_active, prize_preview } = data;

  return (
    <div className="scroll-y" style={{ height:'100%', padding:'16px 16px 8px' }}>

      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:20, fontWeight:900 }}>🏆 التصنيف الأسبوعي</div>
        <div style={{ fontSize:13, color:'var(--text-muted)' }}>يُعاد كل أحد 00:00</div>
      </div>

      {/* حالة الجوائز */}
      <div className="card" style={{
        marginBottom:16,
        borderColor: rewards_active ? 'rgba(37,211,102,0.4)' : 'var(--border)'
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:700 }}>
              {rewards_active ? '🎁 الجوائز مفتوحة!' : '🔒 الجوائز مقفلة'}
            </div>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginTop:2 }}>
              {reward_level === 'high' ? '⭐ مستوى عالي' : reward_level === 'medium' ? '🟡 مستوى متوسط' : '❌ لم يتحقق الحد الأدنى'}
            </div>
          </div>
          <div style={{ fontSize:24 }}>{rewards_active ? '✅' : '⏳'}</div>
        </div>

        {[
          { label:'📺 إعلانات الأسبوع', cur: reward_progress?.currentAds, tgt: reward_progress?.targetAds, pct: reward_progress?.adsProgress },
          { label:'👥 لاعبون نشطون',    cur: reward_progress?.currentUsers, tgt: reward_progress?.targetUsers, pct: reward_progress?.usersProgress },
        ].map(bar => (
          <div key={bar.label} style={{ marginBottom:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between',
              fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>
              <span>{bar.label}</span>
              <span>{bar.cur} / {bar.tgt}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width:`${bar.pct || 0}%` }} />
            </div>
          </div>
        ))}

        {rewards_active && prize_preview && (
          <div style={{ marginTop:10, padding:10, background:'rgba(37,211,102,0.08)', borderRadius:10 }}>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:6 }}>الجوائز الحالية:</div>
            {prize_preview.map((p,i) => (
              <div key={i} style={{ fontSize:13, fontWeight:700 }}>
                {RANK_EMOJI[i]} {p} ₺
              </div>
            ))}
          </div>
        )}
      </div>

      {/* مرتبتك */}
      {user_rank && (
        <div className="card" style={{ marginBottom:16,
          background:'linear-gradient(135deg,rgba(37,211,102,0.1),var(--bg2))' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>مرتبتك</div>
              <div style={{ fontSize:24, fontWeight:900, color:'var(--primary)' }}>#{user_rank}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:13, color:'var(--text-muted)' }}>نقاطك</div>
              {/* ✅ نقاط الأسبوع من الـ context (أحدث من الـ API) */}
              <div style={{ fontSize:18, fontWeight:700 }}>
                {(profile?.user?.weekly_score || user_score || 0).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* القائمة */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {leaderboard?.map((u,i) => (
          <div key={u.user_id} className="card" style={{
            display:'flex', alignItems:'center', gap:12,
            background: u.is_you ? 'rgba(37,211,102,0.08)' : 'var(--bg2)',
            borderColor: u.is_you ? 'rgba(37,211,102,0.4)' : 'var(--border)',
            animation:`fadeInUp ${0.1 + i*0.04}s ease both`
          }}>
            <div style={{ fontSize:22, minWidth:32, textAlign:'center' }}>
              {i < 5 ? RANK_EMOJI[i] : `${i+1}`}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:700, fontSize:15 }}>
                {u.username}{u.is_you && ' 👈'}
              </div>
              {!u.eligible && (
                <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                  ⚠️ لم يصل للحد الأدنى (300 نقطة)
                </div>
              )}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontWeight:900, color:'var(--primary)', fontSize:16 }}>
                {u.score.toLocaleString()}
              </div>
              {rewards_active && prize_preview?.[i] && u.eligible && (
                <div style={{ fontSize:12, color:'var(--gold)' }}>🎁 {prize_preview[i]}₺</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* قواعد */}
      <div style={{ marginTop:16, padding:12, background:'var(--bg3)',
        borderRadius:12, fontSize:12, color:'var(--text-muted)', lineHeight:1.7 }}>
        <div style={{ fontWeight:700, color:'var(--text)', marginBottom:6 }}>📋 قواعد التصنيف</div>
        <div>• الترتيب حسب: <strong style={{color:'var(--text)'}}>مجموع نقاط الأسبوع</strong></div>
        <div>• عند التعادل: الأسبق في النشاط يفوز</div>
        <div>• الحد الأدنى: 300 نقطة للتأهل</div>
        <div>• الترتيب حتمي وقابل للتدقيق 100%</div>
      </div>
    </div>
  );
}
