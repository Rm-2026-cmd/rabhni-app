// src/pages/Rewards.jsx
import { useState } from 'react';

export default function Rewards({ profile }) {
  const [showRules, setShowRules] = useState(false);
  const u = profile?.user;
  const prizes = profile?.prizes || [];

  return (
    <div className="scroll-y" style={{ height:'100%', padding:'16px 16px 8px' }}>
      <div style={{ fontSize:20, fontWeight:900, marginBottom:16 }}>🎁 الجوائز</div>

      {/* Eligibility status */}
      <div className="card" style={{ marginBottom:16, borderColor: u?.eligible_for_prizes ? 'rgba(37,211,102,0.3)' : 'var(--border)' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <div style={{ fontSize:36 }}>{u?.eligible_for_prizes ? '✅' : '🔒'}</div>
          <div>
            <div style={{ fontWeight:700, fontSize:15 }}>
              {u?.eligible_for_prizes ? 'أنت مؤهل للمنافسة!' : 'غير مؤهل بعد'}
            </div>
            <div style={{ fontSize:13, color:'var(--text-muted)' }}>
              نقاطك هذا الأسبوع: <strong style={{ color:'var(--primary)' }}>{(u?.weekly_score||0).toLocaleString()}</strong> / 300 مطلوب
            </div>
            {!u?.eligible_for_prizes && (
              <div style={{ fontSize:12, color:'var(--warning)', marginTop:4 }}>
                تحتاج {Math.max(0, 300 - (u?.weekly_score||0))} نقطة إضافية
              </div>
            )}
          </div>
        </div>
      </div>

      {/* How to win */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>🏆 كيف تفوز بالجوائز؟</div>
        {[
          { emoji:'🎮', text:'العب وحقق أعلى النقاط هذا الأسبوع' },
          { emoji:'📊', text:'احصل على 300+ نقطة للتأهل' },
          { emoji:'🏅', text:'كن في أعلى 5 في نهاية الأسبوع' },
          { emoji:'🎁', text:'استلم جائزتك عبر رسالة خاصة من البوت' },
        ].map((s,i) => (
          <div key={i} style={{ display:'flex', gap:10, marginBottom:10, fontSize:14, color:'var(--text-muted)', alignItems:'flex-start' }}>
            <span style={{ fontSize:18 }}>{s.emoji}</span>
            <span>{s.text}</span>
          </div>
        ))}
        <div style={{ padding:10, background:'rgba(37,211,102,0.08)', borderRadius:10, fontSize:13, color:'var(--primary)', marginTop:8 }}>
          ✅ يمكنك الفوز دون مشاهدة أي إعلانات — المنافسة قائمة على المهارة فقط
        </div>
      </div>

      {/* Prize tiers */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>💰 قيمة الجوائز</div>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:10 }}>تعتمد على نشاط المستخدمين هذا الأسبوع:</div>

        {[
          { label:'مستوى متوسط (5000+ إعلان)', prizes:['50₺','30₺','20₺'], color:'var(--warning)' },
          { label:'مستوى عالي (10000+ إعلان)', prizes:['200₺','100₺','50₺','30₺','20₺'], color:'var(--primary)' },
        ].map((tier, ti) => (
          <div key={ti} style={{ marginBottom:12, padding:12, background:'var(--bg3)', borderRadius:10 }}>
            <div style={{ fontSize:13, fontWeight:700, color:tier.color, marginBottom:8 }}>{tier.label}</div>
            {tier.prizes.map((p,i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
                <span>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]} المركز {i+1}</span>
                <span style={{ fontWeight:700, color:'var(--gold)' }}>{p} Hepsiburada/Trendyol</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Past prizes */}
      {prizes.length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:12 }}>🏆 جوائزك السابقة</div>
          {prizes.map((p, i) => (
            <div key={i} style={{ padding:'10px 0', borderBottom: i < prizes.length-1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:700 }}>المركز {p.rank} — {p.period_key}</div>
                  <div style={{ fontSize:13, color:'var(--text-muted)' }}>{p.prize_type} — {p.prize_value_tl}₺</div>
                </div>
                <div className={`badge ${p.status==='sent' ? 'badge-green' : 'badge-orange'}`}>
                  {p.status === 'sent' ? '✅ تم الإرسال' : '⏳ قيد المعالجة'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Legal rules button */}
      <button className="btn btn-secondary" onClick={() => setShowRules(!showRules)} style={{ marginBottom:16 }}>
        📋 Ödül Kuralları — قواعد الجوائز القانونية
      </button>

      {showRules && (
        <div className="card" style={{ marginBottom:16, fontSize:13, lineHeight:1.8, direction:'ltr' }}>
          <h4 style={{ color:'var(--primary)', marginBottom:10 }}>Ödül Kuralları</h4>
          <p>Ödüller, uygulamanın reklam gelirleriyle finanse edilmektedir.</p>
          <p>Kazananlar tamamen en yüksek puan esasına göre belirlenir (şans esasına dayalı değildir, tamamen skill-based contest'tir).</p>
          <p>Ödüller dijital hediye çeki şeklinde verilir (Trendyol veya Hepsiburada Hediye Çeki).</p>
          <p>Bu kurallar 6502 sayılı Tüketicinin Korunması Hakkında Kanun'a ve Reklam Kurulu düzenlemelerine uygun olarak hazırlanmıştır.</p>
          <p>Ödül miktarı ve türü idare tarafından değiştirilebilir, ancak kazananlar önceden duyurulur.</p>
          <p>Kişisel veriler KVKK'ya uygun olarak işlenir ve sadece ödül teslimi için kullanılır.</p>
          <p>Herhangi bir soru için destek botu ile iletişime geçebilirsiniz.</p>
        </div>
      )}
    </div>
  );
}
