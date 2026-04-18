// src/components/TermsModal.jsx — Turkish legal compliance modal
import { useState } from 'react';

export default function TermsModal({ onAccept }) {
  const [checked, setChecked] = useState(false);
  const [tab, setTab] = useState('tr'); // Show Turkish first (legal requirement)

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:9999,
      background:'rgba(0,0,0,0.85)',
      display:'flex', alignItems:'flex-end',
    }}>
      <div style={{
        width:'100%', maxHeight:'88vh',
        background:'var(--bg2)',
        borderRadius:'20px 20px 0 0',
        display:'flex', flexDirection:'column',
        padding:'0 0 24px',
        animation:'fadeInUp 0.3s ease both'
      }}>
        {/* Handle */}
        <div style={{ width:40, height:4, background:'var(--bg4)', borderRadius:99, margin:'12px auto 0' }} />

        {/* Header */}
        <div style={{ padding:'16px 20px 0', borderBottom:'1px solid var(--border)', marginBottom:0 }}>
          <div style={{ fontSize:18, fontWeight:900, color:'var(--text)', marginBottom:12 }}>📋 Ödül Kuralları / قواعد الجوائز</div>

          {/* Language tabs */}
          <div style={{ display:'flex', gap:8, marginBottom:0 }}>
            {['tr','ar'].map(l => (
              <button key={l} onClick={() => setTab(l)} style={{
                padding:'6px 16px', borderRadius:20, border:'none', cursor:'pointer',
                background: tab===l ? 'var(--primary)' : 'var(--bg3)',
                color: tab===l ? '#000' : 'var(--text-muted)',
                fontWeight:700, fontSize:13, fontFamily:'Cairo,sans-serif'
              }}>
                {l === 'tr' ? 'Türkçe' : 'العربية'}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="scroll-y" style={{ flex:1, padding:'16px 20px', overflowY:'auto', maxHeight:'52vh' }}>
          {tab === 'tr' ? (
            <div style={{ fontSize:14, lineHeight:1.8, color:'var(--text)', direction:'ltr' }}>
              <h3 style={{ color:'var(--primary)', marginBottom:12 }}>Ödül Kuralları</h3>

              <p style={{ marginBottom:10 }}>Ödüller, uygulamanın reklam gelirleriyle finanse edilmektedir.</p>

              <p style={{ marginBottom:10 }}>Kazananlar tamamen en yüksek puan esasına göre belirlenir (şans esasına dayalı değildir, tamamen skill-based contest'tir).</p>

              <p style={{ marginBottom:10 }}>Ödüller dijital hediye çeki şeklinde verilir (Trendyol veya Hepsiburada Hediye Çeki).</p>

              <p style={{ marginBottom:10 }}>Bu kurallar 6502 sayılı Tüketicinin Korunması Hakkında Kanun'a ve Reklam Kurulu düzenlemelerine uygun olarak hazırlanmıştır.</p>

              <p style={{ marginBottom:10 }}>Ödül miktarı ve türü idare tarafından değiştirilebilir, ancak kazananlar önceden duyurulur.</p>

              <p style={{ marginBottom:10 }}>Kişisel veriler KVKK'ya uygun olarak işlenir ve sadece ödül teslimi için kullanılır.</p>

              <p style={{ marginBottom:10 }}>Herhangi bir soru için destek botu ile iletişime geçebilirsiniz.</p>

              <div style={{ marginTop:16, padding:12, background:'rgba(37,211,102,0.1)', borderRadius:10, border:'1px solid rgba(37,211,102,0.2)', fontSize:13 }}>
                ✅ <strong>Oyuncular reklam izlemeden de oyunu oynayabilir, puan toplayabilir ve ödül kazanabilir. Reklamlar yalnızca ek avantaj sağlar ve zorunlu değildir.</strong>
              </div>
            </div>
          ) : (
            <div style={{ fontSize:14, lineHeight:1.8, color:'var(--text)', direction:'rtl' }}>
              <h3 style={{ color:'var(--primary)', marginBottom:12 }}>قواعد الجوائز</h3>

              <p style={{ marginBottom:10 }}>تُموَّل الجوائز من عائدات الإعلانات في التطبيق.</p>

              <p style={{ marginBottom:10 }}>يُحدَّد الفائزون بناءً على أعلى النقاط فقط — لا يوجد حظ أو عشوائية، هذه منافسة مهارية بحتة.</p>

              <p style={{ marginBottom:10 }}>تُمنح الجوائز على شكل قسائم هدايا رقمية (Trendyol أو Hepsiburada).</p>

              <p style={{ marginBottom:10 }}>تم إعداد هذه القواعد وفقاً للقانون رقم 6502 (حماية المستهلك) ولوائح مجلس الإعلان في تركيا.</p>

              <p style={{ marginBottom:10 }}>يحق للإدارة تغيير قيمة الجوائز أو نوعها، مع الإعلان المسبق للفائزين.</p>

              <p style={{ marginBottom:10 }}>تُعالَج البيانات الشخصية وفقاً لقانون KVKK ولا تُستخدم إلا لتسليم الجوائز.</p>

              <p style={{ marginBottom:10 }}>للاستفسار، تواصل مع بوت الدعم.</p>

              <div style={{ marginTop:16, padding:12, background:'rgba(37,211,102,0.1)', borderRadius:10, border:'1px solid rgba(37,211,102,0.2)', fontSize:13 }}>
                ✅ <strong>يمكن للاعبين اللعب وجمع النقاط والفوز بالجوائز دون مشاهدة أي إعلانات. الإعلانات اختيارية فقط.</strong>
              </div>
            </div>
          )}
        </div>

        {/* Accept */}
        <div style={{ padding:'12px 20px 0', borderTop:'1px solid var(--border)' }}>
          <label style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16, cursor:'pointer' }}>
            <div
              onClick={() => setChecked(!checked)}
              style={{
                width:22, height:22, borderRadius:6, flexShrink:0,
                background: checked ? 'var(--primary)' : 'var(--bg3)',
                border: `2px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                display:'flex', alignItems:'center', justifyContent:'center',
                transition:'all 0.15s', cursor:'pointer'
              }}
            >
              {checked && <span style={{ color:'#000', fontSize:13, fontWeight:900 }}>✓</span>}
            </div>
            <span style={{ fontSize:13, color:'var(--text-muted)', lineHeight:1.5 }}>
              أوافق على الشروط والأحكام / Şartları kabul ediyorum
            </span>
          </label>

          <button
            className="btn btn-primary"
            disabled={!checked}
            onClick={onAccept}
            style={{ opacity: checked ? 1 : 0.4, cursor: checked ? 'pointer' : 'not-allowed' }}
          >
            ✅ ابدأ اللعبة / Oynamaya Başla
          </button>
        </div>
      </div>
    </div>
  );
}
