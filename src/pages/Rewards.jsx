// src/pages/Rewards.jsx — Fixed: ProfileContext (weekly_score دائماً fresh)
import { useState } from 'react';
import { useProfile } from '../context/ProfileContext';

export default function Rewards() {
  const { profile } = useProfile();  // ✅ من الـ context
  const [showRules, setShowRules] = useState(false);
  const u       = profile?.user;
  const prizes  = profile?.prizes || [];
  // ✅ FIX weekly_score
  const weekly  = u?.weekly_score || 0;
  const TARGET  = 300;
  const eligible = weekly >= TARGET;
  const pct     = Math.min(100, Math.round((weekly / TARGET) * 100));

  return (
    <div className="scroll-y" style={{ height:'100%', padding:'16px 16px 8px' }}>

      <div style={{ fontSize:20, fontWeight:900, marginBottom:16 }}>🎁 الجوائز</div>

      {/* Eligibility — ✅ FIX: weekly_score دائماً fresh */}
      <div className="card" style={{
        marginBottom:16,
        borderColor: eligible ? 'rgba(37,211,102,0.35)' : 'var(--border)',
        background:  eligible ? 'rgba(37,211,102,0.05)' : 'var(--bg2)'
      }}>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <div style={{ fontSize:36 }}>{eligible ? '✅' : '🔒'}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:15 }}>
              {eligible ? 'أنت مؤهل للمنافسة!' : 'غير مؤهل بعد'}
            </div>
            <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:8 }}>
              نقاطك هذا الأسبوع:{' '}
              <strong style={{ color:'var(--primary)' }}>{weekly.toLocaleString()}</strong>
              {' '}/ {TARGET}
            </div>
            <div style={{ height:5, background:'var(--bg3)', borderRadius:99, overflow:'hidden' }}>
              <div style={{
                height:'100%', borderRadius:99,
                background: eligible ? 'var(--primary)' : 'linear-gradient(90deg,#2196F3,var(--primary))',
                width:`${pct}%`, transition:'width 0.8s ease'
              }} />
            </div>
            {!eligible && (
              <div style={{ fontSize:12, color:'var(--warning)', marginTop:5 }}>
                تحتاج {TARGET - weekly} نقطة إضافية للتأهل
              </div>
            )}
          </div>
        </div>
      </div>

      {/* كيف تفوز */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>🏆 كيف تفوز بالجوائز؟</div>
        {[
          { e:'🎮', t:'العب وحقق أعلى النقاط هذا الأسبوع' },
          { e:'📊', t:`احصل على ${TARGET}+ نقطة للتأهل` },
          { e:'🏅', t:'كن في أعلى 5 في نهاية الأسبوع' },
          { e:'🎁', t:'استلم جائزتك عبر رسالة خاصة من البوت' },
        ].map((s,i) => (
          <div key={i} style={{
            display:'flex', gap:10, marginBottom:10,
            fontSize:14, color:'var(--text-muted)', alignItems:'flex-start'
          }}>
            <span style={{ fontSize:18 }}>{s.e}</span>
            <span>{s.t}</span>
          </div>
        ))}
        <div style={{
          padding:10, background:'rgba(37,211,102,0.08)',
          borderRadius:10, fontSize:13, color:'var(--primary)', marginTop:8
        }}>
          ✅ يمكنك الفوز بدون مشاهدة أي إعلانات — المنافسة قائمة على المهارة فقط
        </div>
      </div>

      {/* الجوائز */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>💰 قيمة الجوائز</div>
        {[
          { label:'مستوى متوسط (5000+ إعلان)', prizes:['50₺','30₺','20₺'], color:'var(--warning)' },
          { label:'مستوى عالي (10000+ إعلان)', prizes:['200₺','100₺','50₺','30₺','20₺'], color:'var(--primary)' },
        ].map((tier,ti) => (
          <div key={ti} style={{ marginBottom:12, padding:12, background:'var(--bg3)', borderRadius:10 }}>
            <div style={{ fontSize:13, fontWeight:700, color:tier.color, marginBottom:8 }}>
              {tier.label}
            </div>
            {tier.prizes.map((p,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between',
                fontSize:13, marginBottom:4 }}>
                <span>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]} المركز {i+1}</span>
                <span style={{ fontWeight:700, color:'var(--gold)' }}>
                  {p} Hepsiburada/Trendyol
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* جوائز سابقة */}
      {prizes.length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>🏆 جوائزك السابقة</div>
          {prizes.map((p,i) => (
            <div key={i} style={{
              padding:'10px 0',
              borderBottom: i < prizes.length-1 ? '1px solid var(--border)' : 'none'
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:700 }}>المركز {p.rank} — {p.period_key}</div>
                  <div style={{ fontSize:13, color:'var(--text-muted)' }}>
                    {p.prize_type} — {p.prize_value_tl}₺
                  </div>
                </div>
                <div style={{
                  fontSize:12, fontWeight:700, padding:'3px 10px', borderRadius:99,
                  background: p.status==='sent' ? 'rgba(37,211,102,0.15)' : 'rgba(255,184,0,0.15)',
                  color: p.status==='sent' ? 'var(--primary)' : 'var(--warning)'
                }}>
                  {p.status === 'sent' ? '✅ تم الإرسال' : '⏳ قيد المعالجة'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-secondary"
        onClick={() => setShowRules(v => !v)} style={{ marginBottom:16 }}>
        📋 Ödül Kuralları — قواعد الجوائز القانونية
      </button>

      {showRules && (
        <div className="card" style={{ marginBottom:16, fontSize:13, lineHeight:1.9, direction:'ltr' }}>
          <h4 style={{ color:'var(--primary)', marginBottom:10 }}>Ödül Kuralları</h4>
          <p style={{ marginBottom:8 }}>Ödüller, uygulamanın reklam gelirleriyle finanse edilmektedir.</p>
          <p style={{ marginBottom:8 }}>Kazananlar tamamen en yüksek puan esasına göre belirlenir — şans değil, beceri yarışmasıdır.</p>
          <p style={{ marginBottom:8 }}>Ödüller dijital hediye çeki şeklinde verilir (Trendyol veya Hepsiburada).</p>
          <p style={{ marginBottom:8 }}>6502 sayılı Kanun'a ve KVKK'ya uygun olarak hazırlanmıştır.</p>
        </div>
      )}
    </div>
  );
}
