// src/pages/Game.jsx — Production — كل المشاكل محلولة
// ✅ weekly_score: patchScore() + syncFromServer()
// ✅ accuracy:     AccuracyTracker ref — لا stale state
// ✅ referral:     tg.openTelegramLink
// ✅ questions:    enrichSessionQuestions — لا تكرار + أنواع متعددة
// ✅ streak:       StreakTracker + combo flash + time bonus

import { useState, useEffect, useRef, useCallback } from 'react';
import { useApi }       from '../hooks/useApi';
import { useAds }       from '../hooks/useAds';
import { useTelegram }  from '../hooks/useTelegram';
import { useProfile }   from '../context/ProfileContext';
import {
  enrichSessionQuestions,
  AccuracyTracker, StreakTracker,
  calculatePoints, timePressureBonus
} from '../engine/questionEngine';

const QUESTION_TIME     = 15;
const INTERSTITIAL_EVERY = 4;

export default function Game({ config, onExit }) {
  const api = useApi();
  const ads = useAds();
  const { haptic, tg, user } = useTelegram();
  const { patchScore, syncFromServer, patchAccuracy } = useProfile();

  // ─── UI state ────────────────────────────────────────────────────────────
  const [phase, setPhase]             = useState('loading');
  const [questions, setQuestions]     = useState([]);
  const [qIndex, setQIndex]           = useState(0);
  const [score, setScore]             = useState(0);
  const [lives, setLives]             = useState(3);
  const [timeLeft, setTimeLeft]       = useState(QUESTION_TIME);
  const [feedback, setFeedback]       = useState(null);   // 'correct'|'wrong'|null
  const [selected, setSelected]       = useState(null);
  const [showExp, setShowExp]         = useState(false);
  const [adLoading, setAdLoading]     = useState(false);
  const [comboFlash, setComboFlash]   = useState(false);
  const [tpFlash, setTpFlash]         = useState(false);  // time-pressure
  const [popup, setPopup]             = useState(null);   // floating +pts
  const [isDailyChallenge, setIsDaily] = useState(false);
  const [displayAcc, setDisplayAcc]   = useState(0);
  const [displayCombo, setDisplayCombo] = useState(0);
  const [maxCombo, setMaxCombo]       = useState(0);

  // ─── Refs (لتجنب stale closures في callbacks) ────────────────────────────
  const accRef     = useRef(new AccuracyTracker());
  const streakRef  = useRef(new StreakTracker());
  const timerRef   = useRef(null);
  const qStartRef  = useRef(Date.now());
  const retryRef   = useRef(0);
  const livesRef   = useRef(3);
  const qIdxRef    = useRef(0);
  const qsRef      = useRef([]);
  const scoreRef   = useRef(0);
  const answersRef = useRef([]);
  const sessionRef = useRef(null);
  const startedAt  = useRef(Date.now());

  // Sync refs with state
  useEffect(() => { livesRef.current = lives; },    [lives]);
  useEffect(() => { qIdxRef.current  = qIndex; },   [qIndex]);
  useEffect(() => { qsRef.current    = questions; }, [questions]);
  useEffect(() => { scoreRef.current = score; },    [score]);

  // ─── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const last = localStorage.getItem('lastDaily');
    if (last !== new Date().toDateString()) setIsDaily(true);
    startSession();
  }, []); // eslint-disable-line

  async function startSession() {
    try {
      const data = await api.post('/game/session', {
        level: config.level, language: config.language,
        deviceFp: getDeviceFp()
      });
      const seed = Date.now() + (user?.id || 0);
      const enriched = enrichSessionQuestions(data.questions, seed);
      sessionRef.current = data;
      setQuestions(enriched);
      qsRef.current = enriched;
      setPhase('playing');
      startTimer();
    } catch (e) {
      console.error('[Game] startSession error:', e);
      const msg = e?.message || 'خطأ غير معروف';
      alert(`فشل تحميل الأسئلة\n\nالسبب: ${msg}\n\nحاول مجدداً.`);
      onExit();
    }
  }

  // ─── Timer ────────────────────────────────────────────────────────────────
  function startTimer() {
    qStartRef.current = Date.now();
    setTimeLeft(QUESTION_TIME);
    setTpFlash(false);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleTimeout(); return 0; }
        if (t === 5) setTpFlash(true);
        return t - 1;
      });
    }, 1000);
  }

  function stopTimer() { clearInterval(timerRef.current); }

  // ─── Timeout ──────────────────────────────────────────────────────────────
  const handleTimeout = useCallback(() => {
    stopTimer();
    haptic.error();
    setTpFlash(false);
    // FIX accuracy — timeout = خطأ
    accRef.current.record(false);
    streakRef.current.record(false);
    setDisplayAcc(accRef.current.percentage);
    setDisplayCombo(streakRef.current.current);

    const nl = livesRef.current - 1;
    livesRef.current = nl;
    setLives(nl);
    setFeedback('wrong');

    const q = qsRef.current[qIdxRef.current];
    answersRef.current.push({
      question_id: q?.id, selected: null,
      is_correct: false, response_ms: 15000, combo: 0, score_delta: 0
    });

    if (nl <= 0) { setTimeout(() => setPhase('gameover'), 1200); return; }

    setTimeout(() => {
      setFeedback(null); setSelected(null); setShowExp(false);
      if (retryRef.current < 1) { retryRef.current++; startTimer(); }
      else { retryRef.current = 0; advanceQ(); }
    }, 1400);
  }, []); // eslint-disable-line

  // ─── Advance ──────────────────────────────────────────────────────────────
  function advanceQ() {
    const next = qIdxRef.current + 1;
    if (next >= qsRef.current.length) { finishSession(); return; }
    setQIndex(next); qIdxRef.current = next; startTimer();
  }

  // ─── Answer ───────────────────────────────────────────────────────────────
  function handleAnswer(text) {
    if (feedback !== null) return;
    stopTimer();
    setTpFlash(false);
    const ms = Date.now() - qStartRef.current;
    const q  = qsRef.current[qIdxRef.current];
    const ok = text === q.answers.find(a => a.isCorrect)?.text;

    setSelected(text);
    setFeedback(ok ? 'correct' : 'wrong');

    // ✅ FIX accuracy — يسجّل كل إجابة
    accRef.current.record(ok);
    streakRef.current.record(ok);
    setDisplayAcc(accRef.current.percentage);
    setDisplayCombo(streakRef.current.current);
    setMaxCombo(m => Math.max(m, streakRef.current.max));
    // حفظ الدقة في الـ context
    patchAccuracy(accRef.current.percentage);

    let pts = 0;
    if (ok) {
      retryRef.current = 0;
      pts = calculatePoints({ level: config.level, responseMs: ms, combo: streakRef.current.current - 1 });
      pts += timePressureBonus(timeLeft, QUESTION_TIME);
      if (streakRef.current.current >= 3) {
        setComboFlash(true);
        setTimeout(() => setComboFlash(false), 600);
      }
      setPopup(pts);
      setTimeout(() => setPopup(null), 900);
      setScore(s => { scoreRef.current = s + pts; return s + pts; });
      haptic.success();
    } else {
      const nl = livesRef.current - 1;
      livesRef.current = nl;
      setLives(nl);
      if (config.level >= 6) {
        // Pro mode: عقوبة على الخطأ
        const pen = Math.round(calculatePoints({ level: config.level, responseMs: 15000, combo: 0 }) * 0.5);
        setScore(s => { const n = Math.max(0, s - pen); scoreRef.current = n; return n; });
      }
      haptic.error();
    }

    answersRef.current.push({
      question_id: q.id, selected: text,
      is_correct: ok, response_ms: ms,
      combo: streakRef.current.current, score_delta: pts
    });

    if (!ok && livesRef.current <= 0) {
      setTimeout(() => setPhase('gameover'), 1200);
      return;
    }
    setTimeout(() => {
      setFeedback(null); setSelected(null); setShowExp(false); advanceQ();
    }, ok ? 700 : 1400);
  }

  // ─── Finish ───────────────────────────────────────────────────────────────
  async function finishSession() {
    stopTimer();
    setPhase('result');

    // ✅ FIX weekly_score — خطوة 1: تحديث فوري optimistic
    patchScore(scoreRef.current);

    if (isDailyChallenge)
      localStorage.setItem('lastDaily', new Date().toDateString());

    try {
      // خطوة 2: إرسال للسيرفر
      const response = await api.put('/game/session', {
        session_id: sessionRef.current?.session_id,
        answers: answersRef.current,
        claimed_score: scoreRef.current,
        duration_ms: Date.now() - startedAt.current
      });

      // ✅ FIX weekly_score — خطوة 3: مزامنة من القيم الحقيقية في DB
      if (response?.user) {
        syncFromServer(response.user);
      }
    } catch (e) {
      console.error('[Game] submit failed:', e);
    }

    // Interstitial ad كل N جلسات
    const n = parseInt(localStorage.getItem('sessCount') || '0') + 1;
    localStorage.setItem('sessCount', n);
    if (n % INTERSTITIAL_EVERY === 0) setTimeout(() => ads.showInterstitial(), 2000);
  }

  // ─── Revive ───────────────────────────────────────────────────────────────
  async function handleRevive() {
    setAdLoading(true);
    const r = await ads.showRewarded('revive', sessionRef.current?.session_id);
    setAdLoading(false);
    if (r.success) {
      livesRef.current = 3; setLives(3);
      setPhase('playing'); startTimer();
    } else {
      alert('الإعلان غير متاح حالياً. حاول لاحقاً.');
    }
  }

  // ─── Share (✅ FIX referral) ──────────────────────────────────────────────
  function handleShare() {
    const code = user?.id ? `ref${user.id}` : 'share';
    const link = `https://t.me/Rabahni_Bot?start=${code}`;
    const text = `🎮 العب ربحني معجم واربح جوائز حقيقية!\n🏆 نقاطي: ${scoreRef.current.toLocaleString()}\nمجاني 100% — مهارة فقط`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
    } else if (navigator.share) {
      navigator.share({ text: `${text}\n${link}` });
    } else {
      navigator.clipboard?.writeText(`${text}\n${link}`);
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  const q        = questions[qIndex];
  const progress = questions.length ? (qIndex / questions.length) * 100 : 0;

  if (phase === 'loading') return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:16 }}>
      <div style={{ fontSize:44, animation:'pulse 1s infinite' }}>📚</div>
      <div style={{ color:'var(--text-muted)', fontSize:15 }}>جاري تحميل الأسئلة...</div>
    </div>
  );

  if (phase === 'gameover') return (
    <GameOverScreen score={score} combo={maxCombo} accuracy={displayAcc}
      onRevive={handleRevive} onExit={onExit} onShare={handleShare}
      adLoading={adLoading} />
  );

  if (phase === 'result') return (
    <ResultScreen score={score} answers={answersRef.current} questions={questions}
      combo={maxCombo} accuracy={displayAcc} level={config.level}
      onExit={onExit} onShare={handleShare} isDailyChallenge={isDailyChallenge} />
  );

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column',
      padding:16, position:'relative', overflow:'hidden' }}>

      {/* Daily challenge banner */}
      {isDailyChallenge && (
        <div style={{
          background:'linear-gradient(90deg,#FFB800,#FF6B35)',
          borderRadius:10, padding:'6px 12px', marginBottom:10,
          fontSize:12, fontWeight:700, color:'#000',
          display:'flex', alignItems:'center', gap:6,
          animation:'slideDown 0.4s ease'
        }}>
          ⚡ تحدي يومي — أكمل الجلسة واكسب مكافأة مضاعفة!
        </div>
      )}

      {/* Header: ✕ + قلوب + دقة + نقاط + combo */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <button onClick={onExit} style={{ background:'none', border:'none',
          color:'var(--text-muted)', cursor:'pointer', fontSize:22,
          padding:'4px 6px', lineHeight:1 }}>✕</button>

        {/* قلوب */}
        <div style={{ display:'flex', gap:3 }}>
          {[1,2,3].map(i => (
            <span key={i} style={{
              fontSize:18,
              opacity: lives >= i ? 1 : 0.2,
              transition:'opacity 0.3s, transform 0.3s',
              display:'inline-block',
              transform: lives < i ? 'scale(0.5)' : 'scale(1)'
            }}>❤️</span>
          ))}
        </div>

        {/* ✅ FIX accuracy — يتحدث بعد كل إجابة */}
        <div style={{
          background:'var(--bg3)', borderRadius:8, padding:'2px 8px',
          fontSize:11, fontWeight:700, color: displayAcc >= 70 ? 'var(--primary)' : 'var(--warning)'
        }}>
          🎯 {displayAcc}%
        </div>

        <div style={{ flex:1 }} />

        {/* نقاط */}
        <div style={{ textAlign:'right', position:'relative' }}>
          <div style={{
            fontSize:20, fontWeight:900, color:'var(--primary)',
            transition:'transform 0.15s',
            transform: popup ? 'scale(1.15)' : 'scale(1)'
          }}>
            {score.toLocaleString()}
          </div>
          <div style={{ fontSize:10, color:'var(--text-muted)' }}>نقطة</div>
          {popup != null && (
            <div style={{
              position:'absolute', top:-22, right:0,
              color:'var(--primary)', fontWeight:900, fontSize:14,
              animation:'floatUp 0.9s ease forwards',
              pointerEvents:'none', whiteSpace:'nowrap'
            }}>+{popup}</div>
          )}
        </div>

        {/* Combo badge */}
        {displayCombo > 1 && (
          <div style={{
            background: displayCombo >= 5
              ? 'linear-gradient(135deg,#FF6B35,#FFB800)'
              : 'var(--bg3)',
            borderRadius:10, padding:'3px 10px',
            animation: comboFlash ? 'comboFlash 0.5s ease' : 'none',
            boxShadow: displayCombo >= 5 ? '0 0 14px rgba(255,107,53,0.5)' : 'none'
          }}>
            <span style={{
              fontSize:12, fontWeight:900,
              color: displayCombo >= 5 ? '#fff' : 'var(--gold)'
            }}>
              {displayCombo >= 5 ? '🌟' : '🔥'} ×{displayCombo}
            </span>
          </div>
        )}
      </div>

      {/* شريط التقدم */}
      <div style={{
        height:4, background:'var(--bg3)', borderRadius:99,
        marginBottom:10, overflow:'hidden'
      }}>
        <div style={{
          height:'100%', borderRadius:99,
          background:'linear-gradient(90deg,var(--primary-dk),var(--primary))',
          width:`${progress}%`, transition:'width 0.4s ease'
        }} />
      </div>

      {/* شريط الوقت */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <div style={{
          flex:1, height:6, background:'var(--bg3)',
          borderRadius:99, overflow:'hidden'
        }}>
          <div style={{
            height:'100%', borderRadius:99,
            background: timeLeft > 8 ? 'var(--primary)'
              : timeLeft > 4 ? 'var(--warning)' : 'var(--danger)',
            width:`${(timeLeft / QUESTION_TIME) * 100}%`,
            transition:'width 1s linear, background 0.4s',
            animation: tpFlash ? 'timerPulse 0.4s ease infinite' : 'none'
          }} />
        </div>
        <div style={{
          fontSize:16, fontWeight:900, minWidth:24, textAlign:'center',
          color: timeLeft <= 4 ? 'var(--danger)'
            : timeLeft <= 8 ? 'var(--warning)' : 'var(--text)',
          transition:'color 0.3s'
        }}>
          {timeLeft}
        </div>
      </div>

      {/* سؤال + إجابات */}
      {q && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:9, overflow:'hidden' }}>

          {/* نوع السؤال + رقم */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <QuestionTag type={q.type} />
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>
              {qIndex + 1} / {questions.length}
            </span>
          </div>

          {/* نص السؤال */}
          <div className="card" style={{
            padding:'16px', textAlign:'center',
            animation:'fadeInDown 0.25s ease',
            borderColor:'var(--bg4)'
          }}>
            <div style={{
              fontSize: q.text.length > 60 ? 15 : 18,
              fontWeight:700, lineHeight:1.7
            }}>
              {q.text}
            </div>
          </div>

          {/* أزرار الإجابات */}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {q.answers.map((ans, i) => {
              const isSel = selected === ans.text;
              const isOk  = ans.isCorrect;
              let bg = 'var(--bg3)', bd = 'var(--border)', cl = 'var(--text)';

              if (feedback !== null) {
                if (isOk)         { bg='rgba(37,211,102,0.15)'; bd='var(--primary)'; cl='var(--primary)'; }
                else if (isSel)   { bg='rgba(255,92,92,0.12)';  bd='var(--danger)';  cl='var(--danger)'; }
              }
              // إظهار الإجابة الصحيحة عند انتهاء الوقت
              if (feedback === 'wrong' && !selected && isOk) {
                bg='rgba(37,211,102,0.15)'; bd='var(--primary)'; cl='var(--primary)';
              }

              const anim = feedback === null
                ? (i % 2 === 0 ? 'moveLeft 4s ease-in-out infinite'
                               : 'moveRight 4s ease-in-out infinite')
                : 'none';

              return (
                <button key={i}
                  onClick={() => handleAnswer(ans.text)}
                  disabled={feedback !== null}
                  style={{
                    padding:'13px 16px', borderRadius:12,
                    border:`2px solid ${bd}`, background:bg, color:cl,
                    fontFamily:'Cairo,sans-serif', fontSize:14, fontWeight:600,
                    textAlign:'right', cursor: feedback !== null ? 'default' : 'pointer',
                    transition:'all 0.2s', outline:'none',
                    animation: anim,
                    display:'flex', justifyContent:'space-between', alignItems:'center',
                    boxShadow: feedback !== null && isOk ? '0 0 14px rgba(37,211,102,0.3)' : 'none',
                  }}>
                  <span>{ans.text}</span>
                  {feedback !== null && isOk      && <span>✅</span>}
                  {feedback !== null && isSel && !isOk && <span>❌</span>}
                </button>
              );
            })}
          </div>

          {/* زر الشرح */}
          {feedback === 'wrong' && q.explanation && (
            <button className="btn btn-secondary btn-sm"
              onClick={() => setShowExp(v => !v)}
              style={{ alignSelf:'center', marginTop:4 }}>
              💡 {showExp ? 'إخفاء الشرح' : 'شرح الإجابة'}
            </button>
          )}
          {showExp && q.explanation && (
            <div className="card" style={{
              fontSize:13, color:'var(--text-muted)', lineHeight:1.7,
              animation:'fadeInUp 0.2s ease',
              borderColor:'rgba(37,211,102,0.2)'
            }}>
              {q.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function QuestionTag({ type }) {
  const m = {
    word_to_meaning: ['كلمة → معنى', '#4CAF50'],
    meaning_to_word: ['معنى → كلمة', '#2196F3'],
    context:         ['سياق',         '#FF9800'],
  };
  const [label, color] = m[type] || [type, 'var(--text-muted)'];
  return (
    <span style={{
      fontSize:10, fontWeight:700, color,
      background:`${color}18`, padding:'3px 8px', borderRadius:99
    }}>{label}</span>
  );
}

function GameOverScreen({ score, combo, accuracy, onRevive, onExit, onShare, adLoading }) {
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center', gap:18, padding:24, textAlign:'center' }}>

      <div style={{ fontSize:64, animation:'shake 0.5s ease' }}>💔</div>
      <div style={{ fontSize:22, fontWeight:900 }}>انتهت حياتك!</div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, width:'100%' }}>
        {[
          { e:'⭐', v: score.toLocaleString(), l:'النقاط' },
          { e:'🎯', v: `${accuracy}%`,         l:'الدقة' },
          { e:'🔥', v: `×${combo}`,             l:'أعلى كومبو' },
        ].map(s => (
          <div key={s.l} className="card" style={{ textAlign:'center', padding:'10px 4px' }}>
            <div style={{ fontSize:22 }}>{s.e}</div>
            <div style={{ fontSize:15, fontWeight:900 }}>{s.v}</div>
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>{s.l}</div>
          </div>
        ))}
      </div>

      <div className="card" style={{ width:'100%', padding:20 }}>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:14 }}>
          🎁 شاهد إعلاناً قصيراً للحصول على فرصة ثانية مع 3 قلوب كاملة
        </div>
        <button className="btn btn-primary" onClick={onRevive}
          disabled={adLoading} style={{ marginBottom:10 }}>
          {adLoading ? '⏳ جاري التحميل...' : '📺 شاهد إعلاناً — فرصة ثانية'}
        </button>
        <button className="btn btn-secondary" onClick={onExit}>❌ الخروج</button>
      </div>

      <button className="btn btn-secondary btn-sm" onClick={onShare}
        style={{ width:'auto', padding:'10px 24px' }}>
        📤 شارك نتيجتك
      </button>
    </div>
  );
}

function ResultScreen({ score, answers, questions, combo, accuracy, level, onExit, onShare, isDailyChallenge }) {
  const correct   = answers.filter(a => a.is_correct).length;
  const isPerfect = correct === answers.length && answers.length > 0;
  const trophy    = accuracy >= 90 ? '🏆' : accuracy >= 70 ? '⭐' : '📚';

  return (
    <div className="scroll-y" style={{ height:'100%', padding:20 }}>

      {/* Header */}
      <div style={{ textAlign:'center', marginBottom:20, animation:'bounceIn 0.5s ease' }}>
        <div style={{ fontSize:64, marginBottom:8 }}>{trophy}</div>
        <div style={{ fontSize:26, fontWeight:900, color:'var(--primary)', marginBottom:4 }}>
          {score.toLocaleString()}
          <span style={{ fontSize:14, color:'var(--text-muted)', fontWeight:400, marginRight:6 }}>نقطة</span>
        </div>
        {isPerfect && (
          <div style={{
            background:'linear-gradient(135deg,#FFD700,#FF6B35)',
            borderRadius:12, padding:'6px 16px',
            display:'inline-block', fontSize:13, fontWeight:900, color:'#000'
          }}>
            🌟 إجابات مثالية بدون أخطاء!
          </div>
        )}
        {isDailyChallenge && (
          <div style={{
            marginTop:8, fontSize:12, color:'var(--primary)',
            background:'rgba(37,211,102,0.1)',
            border:'1px solid rgba(37,211,102,0.25)',
            borderRadius:10, padding:'5px 14px', display:'inline-block'
          }}>
            ✅ أكملت التحدي اليومي!
          </div>
        )}
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
        {[
          { e:'🎯', v:`${accuracy}%`,                   l:'الدقة' },
          { e:'🔥', v:`×${combo}`,                      l:'أعلى كومبو' },
          { e:'✅', v:`${correct}/${answers.length}`,   l:'الإجابات' },
          { e:'🏅', v:`${level}`,                       l:'المستوى' },
        ].map(s => (
          <div key={s.l} className="card" style={{ textAlign:'center', padding:'14px 10px' }}>
            <div style={{ fontSize:24 }}>{s.e}</div>
            <div style={{ fontSize:18, fontWeight:900 }}>{s.v}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* تفاصيل الجلسة */}
      {answers.length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:10 }}>📊 تفاصيل الجلسة</div>
          {answers.slice(0, 5).map((a, i) => {
            const q = questions[i];
            return (
              <div key={i} style={{
                display:'flex', alignItems:'center', gap:8, fontSize:12,
                padding:'6px 0',
                borderBottom: i < Math.min(4, answers.length - 1) ? '1px solid var(--border)' : 'none'
              }}>
                <span>{a.is_correct ? '✅' : '❌'}</span>
                <span style={{
                  flex:1, color:'var(--text-muted)',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'
                }}>{q?.text || '...'}</span>
                <span style={{ color:'var(--primary)', fontWeight:700, flexShrink:0 }}>
                  {a.is_correct ? `+${a.score_delta}` : '—'}
                </span>
              </div>
            );
          })}
          {answers.length > 5 && (
            <div style={{ fontSize:11, color:'var(--text-muted)', textAlign:'center', paddingTop:8 }}>
              +{answers.length - 5} سؤال آخر
            </div>
          )}
        </div>
      )}

      <button className="btn btn-primary" onClick={onShare} style={{ marginBottom:10 }}>
        📤 شارك نتيجتك وتحدَّ أصدقاءك
      </button>
      <button className="btn btn-secondary" onClick={onExit}>
        🏠 العودة للرئيسية
      </button>
    </div>
  );
}

function getDeviceFp() {
  try {
    return btoa([
      navigator.userAgent.length,
      screen.width, screen.height,
      navigator.language,
      new Date().getTimezoneOffset()
    ].join('|')).slice(0, 20);
  } catch { return 'unknown'; }
}
