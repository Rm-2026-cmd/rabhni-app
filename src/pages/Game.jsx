// src/pages/Game.jsx — Full production upgrade
// FIXES: weekly_score (patchScore), accuracy (AccuracyTracker), referral (Telegram SDK), smart questions
import { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAds } from '../hooks/useAds';
import { useTelegram } from '../hooks/useTelegram';
import { useProfile } from '../context/ProfileContext';
import { enrichSessionQuestions, AccuracyTracker, StreakTracker, calculatePoints, timePressureBonus } from '../engine/questionEngine';

const QUESTION_TIME = 15;
const INTERSTITIAL_EVERY = 4;

export default function Game({ config, onExit }) {
  const api = useApi();
  const ads = useAds();
  const { haptic, tg, user } = useTelegram();
  const { patchScore } = useProfile();

  const [phase, setPhase] = useState('loading');
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [feedback, setFeedback] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [adLoading, setAdLoading] = useState(false);
  const [comboFlash, setComboFlash] = useState(false);
  const [timePressureFlash, setTimePressureFlash] = useState(false);
  const [pointsPopup, setPointsPopup] = useState(null);
  const [dailyChallenge, setDailyChallenge] = useState(false);

  // Tracker instances — mutable, no re-render needed
  const accuracyRef = useRef(new AccuracyTracker());
  const streakRef   = useRef(new StreakTracker());

  // Derived display values
  const [displayAccuracy, setDisplayAccuracy] = useState(0);
  const [displayCombo, setDisplayCombo]       = useState(0);
  const [displayMaxCombo, setDisplayMaxCombo] = useState(0);

  // Refs for stale-closure safety
  const timerRef        = useRef(null);
  const questionStart   = useRef(Date.now());
  const retryCountRef   = useRef(0);
  const livesRef        = useRef(3);
  const qIndexRef       = useRef(0);
  const questionsRef    = useRef([]);
  const scoreRef        = useRef(0);
  const answersRef      = useRef([]);
  const sessionRef      = useRef(null);
  const sessionStartRef = useRef(Date.now());

  useEffect(() => { livesRef.current = lives; }, [lives]);
  useEffect(() => { qIndexRef.current = qIndex; }, [qIndex]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => { startSession(); }, []); // eslint-disable-line

  useEffect(() => {
    const last = localStorage.getItem('lastDailyChallenge');
    if (last !== new Date().toDateString()) setDailyChallenge(true);
  }, []);

  async function startSession() {
    try {
      const data = await api.post('/game/session', {
        level: config.level,
        language: config.language,
        deviceFp: getDeviceFingerprint()
      });
      const seed = Date.now() + (user?.id || 0);
      const enriched = enrichSessionQuestions(data.questions, seed);
      sessionRef.current = data;
      setSession(data);
      setQuestions(enriched);
      questionsRef.current = enriched;
      setPhase('playing');
      startTimer();
    } catch (e) {
      alert('فشل تحميل الأسئلة. حاول مجدداً.');
      onExit();
    }
  }

  function startTimer() {
    questionStart.current = Date.now();
    setTimeLeft(QUESTION_TIME);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleTimeout(); return 0; }
        if (t === 4) setTimePressureFlash(true);
        return t - 1;
      });
    }, 1000);
  }

  function stopTimer() { clearInterval(timerRef.current); }

  const handleTimeout = useCallback(() => {
    haptic.error();
    stopTimer();
    accuracyRef.current.record(false);
    streakRef.current.record(false);
    setDisplayAccuracy(accuracyRef.current.percentage);
    setDisplayCombo(streakRef.current.current);
    setTimePressureFlash(false);
    const newLives = livesRef.current - 1;
    livesRef.current = newLives;
    setLives(newLives);
    setFeedback('wrong');
    const q = questionsRef.current[qIndexRef.current];
    answersRef.current = [...answersRef.current, {
      question_id: q?.id, selected: null, is_correct: false, response_ms: 15000, combo: 0, score_delta: 0
    }];
    if (newLives <= 0) { setTimeout(() => setPhase('gameover'), 1200); return; }
    setTimeout(() => {
      setFeedback(null); setSelectedAnswer(null); setShowExplanation(false);
      if (retryCountRef.current < 1) { retryCountRef.current++; startTimer(); }
      else { retryCountRef.current = 0; advanceQuestion(); }
    }, 1500);
  }, []); // eslint-disable-line

  function advanceQuestion() {
    const next = qIndexRef.current + 1;
    if (next >= questionsRef.current.length) { finishSession(); return; }
    setQIndex(next); qIndexRef.current = next; startTimer();
  }

  function handleAnswer(answer) {
    if (feedback !== null) return;
    stopTimer();
    setTimePressureFlash(false);
    const responseMs = Date.now() - questionStart.current;
    const q = questionsRef.current[qIndexRef.current];
    const correct = answer === q.answers.find(a => a.isCorrect)?.text;

    setSelectedAnswer(answer);
    setFeedback(correct ? 'correct' : 'wrong');

    // FIX accuracy — record every answer
    accuracyRef.current.record(correct);
    streakRef.current.record(correct);
    setDisplayAccuracy(accuracyRef.current.percentage);
    setDisplayCombo(streakRef.current.current);
    setDisplayMaxCombo(m => Math.max(m, streakRef.current.max));

    let points = 0;
    if (correct) {
      retryCountRef.current = 0;
      points = calculatePoints({ level: config.level, responseMs, combo: streakRef.current.current - 1 });
      points += timePressureBonus(timeLeft, QUESTION_TIME);
      if (streakRef.current.current >= 3) { setComboFlash(true); setTimeout(() => setComboFlash(false), 600); }
      setPointsPopup({ value: points });
      setTimeout(() => setPointsPopup(null), 900);
      setScore(s => { scoreRef.current = s + points; return s + points; });
      haptic.success();
    } else {
      const newLives = livesRef.current - 1;
      livesRef.current = newLives;
      setLives(newLives);
      if (config.level >= 6) {
        const penalty = calculatePoints({ level: config.level, responseMs: 15000, combo: 0 });
        setScore(s => { const n = Math.max(0, s - Math.round(penalty * 0.5)); scoreRef.current = n; return n; });
      }
      haptic.error();
    }

    answersRef.current = [...answersRef.current, {
      question_id: q.id, selected: answer, is_correct: correct,
      response_ms: responseMs, combo: streakRef.current.current, score_delta: points
    }];

    if (!correct && livesRef.current <= 0) { setTimeout(() => setPhase('gameover'), 1200); return; }
    setTimeout(() => {
      setFeedback(null); setSelectedAnswer(null); setShowExplanation(false); advanceQuestion();
    }, correct ? 700 : 1400);
  }

  async function finishSession() {
    stopTimer();
    setPhase('result');

    // FIX weekly_score — optimistic patch immediately
    patchScore(scoreRef.current);

    if (dailyChallenge) localStorage.setItem('lastDailyChallenge', new Date().toDateString());

    try {
      await api.put('/game/session', {
        session_id: sessionRef.current?.session_id,
        answers: answersRef.current,
        claimed_score: scoreRef.current,
        duration_ms: Date.now() - sessionStartRef.current
      });
    } catch (e) { console.error('Submit failed:', e); }

    const sessCount = parseInt(localStorage.getItem('sessCount') || '0') + 1;
    localStorage.setItem('sessCount', sessCount);
    if (sessCount % INTERSTITIAL_EVERY === 0) setTimeout(() => ads.showInterstitial(), 2000);
  }

  async function handleRevive() {
    setAdLoading(true);
    const result = await ads.showRewarded('revive', session?.session_id);
    setAdLoading(false);
    if (result.success) { livesRef.current = 3; setLives(3); setPhase('playing'); startTimer(); }
    else alert('الإعلان غير متاح حالياً. حاول لاحقاً.');
  }

  // FIX referral — uses Telegram WebApp SDK correctly
  function handleShare() {
    const refCode = user?.id ? `ref${user.id}` : 'share';
    const text = `🎮 العب ربحني معجم واربح جوائز حقيقية!\n🏆 نقاطي: ${scoreRef.current.toLocaleString()}\nمجاني 100% — مهارة فقط`;
    const link = `https://t.me/Rabahni_Bot?start=${refCode}`;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`);
    } else if (navigator.share) {
      navigator.share({ text: `${text}\n${link}` });
    } else {
      navigator.clipboard?.writeText(`${text}\n${link}`);
    }
  }

  const q = questions[qIndex];
  const progress = questions.length > 0 ? (qIndex / questions.length) * 100 : 0;

  if (phase === 'loading') return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
      flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:44, animation:'pulse 1s infinite' }}>📚</div>
      <div style={{ color:'var(--text-muted)' }}>جاري تحميل الأسئلة...</div>
    </div>
  );

  if (phase === 'gameover') return (
    <GameOver score={score} combo={displayMaxCombo} accuracy={displayAccuracy}
      answers={answersRef.current} onRevive={handleRevive} onExit={onExit}
      onShare={handleShare} adLoading={adLoading} />
  );

  if (phase === 'result') return (
    <Result score={score} answers={answersRef.current} questions={questions}
      combo={displayMaxCombo} accuracy={displayAccuracy} level={config.level}
      onExit={onExit} onShare={handleShare} dailyChallenge={dailyChallenge} />
  );

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', padding:16, position:'relative' }}>

      {dailyChallenge && (
        <div style={{ background:'linear-gradient(90deg,#FFB800,#FF6B35)', borderRadius:10,
          padding:'6px 12px', marginBottom:10, fontSize:12, fontWeight:700, color:'#000',
          animation:'slideDown 0.4s ease', display:'flex', alignItems:'center', gap:6 }}>
          ⚡ تحدي يومي نشط — العب الآن واكسب مكافأة مضاعفة!
        </div>
      )}

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
        <button onClick={onExit} style={{ background:'none', border:'none',
          color:'var(--text-muted)', cursor:'pointer', fontSize:20, padding:4, lineHeight:1 }}>✕</button>

        <div style={{ display:'flex', gap:3 }}>
          {[1,2,3].map(i => (
            <span key={i} style={{ fontSize:18, opacity: lives >= i ? 1 : 0.2,
              transition:'opacity 0.3s, transform 0.3s',
              display:'inline-block',
              transform: lives < i ? 'scale(0.5)' : 'scale(1)' }}>❤️</span>
          ))}
        </div>

        {/* FIX accuracy display */}
        <div style={{ background:'var(--bg3)', borderRadius:8, padding:'2px 8px', fontSize:11, fontWeight:700 }}>
          🎯 {displayAccuracy}%
        </div>

        <div style={{ flex:1 }} />

        <div style={{ textAlign:'right', position:'relative' }}>
          <div style={{ fontSize:20, fontWeight:900, color:'var(--primary)',
            transition:'transform 0.15s', transform: pointsPopup ? 'scale(1.1)' : 'scale(1)' }}>
            {score.toLocaleString()}
          </div>
          <div style={{ fontSize:10, color:'var(--text-muted)' }}>نقطة</div>
          {pointsPopup && (
            <div style={{ position:'absolute', top:-20, right:0, color:'var(--primary)',
              fontWeight:900, fontSize:14, animation:'floatUp 0.9s ease forwards', pointerEvents:'none',
              whiteSpace:'nowrap' }}>
              +{pointsPopup.value}
            </div>
          )}
        </div>

        {displayCombo > 1 && (
          <div style={{
            background: displayCombo >= 5 ? 'linear-gradient(135deg,#FF6B35,#FFB800)' : 'var(--bg3)',
            borderRadius:10, padding:'3px 10px',
            animation: comboFlash ? 'comboFlash 0.5s ease' : 'none',
            boxShadow: displayCombo >= 5 ? '0 0 12px rgba(255,107,53,0.5)' : 'none' }}>
            <div style={{ fontSize:12, fontWeight:900,
              color: displayCombo >= 5 ? '#fff' : 'var(--gold)' }}>
              {displayCombo >= 5 ? '🌟' : '🔥'} ×{displayCombo}
            </div>
          </div>
        )}
      </div>

      {/* Progress */}
      <div style={{ height:4, background:'var(--bg3)', borderRadius:99, marginBottom:12, overflow:'hidden' }}>
        <div style={{ height:'100%', borderRadius:99,
          background:'linear-gradient(90deg,var(--primary-dk),var(--primary))',
          width:`${progress}%`, transition:'width 0.4s ease' }} />
      </div>

      {/* Timer */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
        <div style={{ flex:1, height:6, background:'var(--bg3)', borderRadius:99, overflow:'hidden' }}>
          <div style={{
            height:'100%', borderRadius:99,
            background: timeLeft > 8 ? 'var(--primary)' : timeLeft > 4 ? 'var(--warning)' : 'var(--danger)',
            width:`${(timeLeft/QUESTION_TIME)*100}%`,
            transition:'width 1s linear, background 0.4s',
            animation: timePressureFlash ? 'timerPulse 0.5s ease infinite' : 'none'
          }} />
        </div>
        <div style={{ fontSize:15, fontWeight:900, minWidth:24, textAlign:'center',
          color: timeLeft <= 4 ? 'var(--danger)' : timeLeft <= 8 ? 'var(--warning)' : 'var(--text)',
          transition:'color 0.3s' }}>
          {timeLeft}
        </div>
      </div>

      {/* Question + answers */}
      {q && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:9 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <QuestionTypeTag type={q.type} />
            <span style={{ fontSize:11, color:'var(--text-muted)' }}>{qIndex+1}/{questions.length}</span>
          </div>

          <div className="card" style={{ padding:'16px', textAlign:'center',
            animation:'fadeInDown 0.3s ease', borderColor:'var(--bg4)' }}>
            <div style={{ fontSize: q.text.length > 60 ? 15 : 18, fontWeight:700,
              color:'var(--text)', lineHeight:1.7 }}>
              {q.text}
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {q.answers.map((ans, idx) => {
              const isSelected = selectedAnswer === ans.text;
              const isCorrect = ans.isCorrect;
              let bg = 'var(--bg3)', border = 'var(--border)', color = 'var(--text)';
              if (feedback !== null) {
                if (isCorrect) { bg='rgba(37,211,102,0.15)'; border='var(--primary)'; color='var(--primary)'; }
                else if (isSelected) { bg='rgba(255,92,92,0.12)'; border='var(--danger)'; color='var(--danger)'; }
              }
              if (feedback === 'wrong' && !selectedAnswer && isCorrect) {
                bg='rgba(37,211,102,0.15)'; border='var(--primary)'; color='var(--primary)';
              }
              const movingAnim = feedback === null
                ? (idx % 2 === 0 ? 'moveLeft 4s ease-in-out infinite' : 'moveRight 4s ease-in-out infinite')
                : 'none';
              return (
                <button key={idx} onClick={() => handleAnswer(ans.text)}
                  disabled={feedback !== null}
                  style={{ padding:'13px 16px', borderRadius:12,
                    border:`2px solid ${border}`, background:bg, color,
                    fontFamily:'Cairo,sans-serif', fontSize:14, fontWeight:600,
                    textAlign:'right', cursor:feedback!==null?'default':'pointer',
                    transition:'all 0.2s', outline:'none', animation: movingAnim,
                    transform: isSelected ? 'scale(0.97)' : 'scale(1)',
                    boxShadow: feedback !== null && isCorrect ? '0 0 12px rgba(37,211,102,0.3)' : 'none',
                    display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span>{ans.text}</span>
                  {feedback !== null && isCorrect && <span>✅</span>}
                  {feedback !== null && isSelected && !isCorrect && <span>❌</span>}
                </button>
              );
            })}
          </div>

          {feedback === 'wrong' && q.explanation && (
            <button className="btn btn-secondary btn-sm"
              onClick={() => setShowExplanation(v => !v)} style={{ alignSelf:'center', marginTop:4 }}>
              💡 {showExplanation ? 'إخفاء الشرح' : 'شرح الإجابة'}
            </button>
          )}
          {showExplanation && q.explanation && (
            <div className="card" style={{ fontSize:13, color:'var(--text-muted)',
              animation:'fadeInUp 0.2s ease', borderColor:'rgba(37,211,102,0.2)' }}>
              {q.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionTypeTag({ type }) {
  const map = {
    word_to_meaning: { label:'كلمة → معنى', color:'#4CAF50' },
    meaning_to_word: { label:'معنى → كلمة', color:'#2196F3' },
    context:         { label:'سياق',         color:'#FF9800' },
    synonym:         { label:'مرادف',        color:'#9C27B0' },
    antonym:         { label:'مضاد',         color:'#F44336' },
    translation:     { label:'ترجمة',        color:'#00BCD4' },
  };
  const tag = map[type] || { label: type, color:'var(--text-muted)' };
  return (
    <div style={{ fontSize:10, fontWeight:700, color: tag.color,
      background:`${tag.color}18`, padding:'3px 8px', borderRadius:99 }}>
      {tag.label}
    </div>
  );
}

function GameOver({ score, combo, accuracy, answers, onRevive, onExit, onShare, adLoading }) {
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', gap:18, padding:24, textAlign:'center' }}>
      <div style={{ fontSize:64, animation:'shake 0.5s ease' }}>💔</div>
      <div style={{ fontSize:22, fontWeight:900 }}>انتهت حياتك!</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, width:'100%' }}>
        {[
          { label:'النقاط',     value: score.toLocaleString(), emoji:'⭐' },
          { label:'الدقة',      value: `${accuracy}%`,         emoji:'🎯' },
          { label:'أعلى كومبو', value: `×${combo}`,            emoji:'🔥' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign:'center', padding:'10px 6px' }}>
            <div style={{ fontSize:20 }}>{s.emoji}</div>
            <div style={{ fontSize:15, fontWeight:900 }}>{s.value}</div>
            <div style={{ fontSize:10, color:'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div className="card" style={{ width:'100%', padding:20 }}>
        <div style={{ fontSize:13, color:'var(--text-muted)', marginBottom:14 }}>
          🎁 شاهد إعلاناً قصيراً للحصول على فرصة ثانية وإعادة القلوب الثلاثة
        </div>
        <button className="btn btn-primary" onClick={onRevive} disabled={adLoading} style={{ marginBottom:10 }}>
          {adLoading ? '⏳ جاري تحميل الإعلان...' : '📺 شاهد إعلاناً — فرصة ثانية'}
        </button>
        <button className="btn btn-secondary" onClick={onExit}>❌ الخروج</button>
      </div>
      <button className="btn btn-secondary btn-sm" onClick={onShare} style={{ width:'auto', padding:'10px 24px' }}>
        📤 شارك نتيجتك وتحدَّ أصدقاءك
      </button>
    </div>
  );
}

function Result({ score, answers, questions, combo, accuracy, level, onExit, onShare, dailyChallenge }) {
  const correct = answers.filter(a => a.is_correct).length;
  const isPerfect = correct === answers.length && answers.length > 0;
  const trophy = accuracy >= 90 ? '🏆' : accuracy >= 70 ? '⭐' : '📚';
  return (
    <div className="scroll-y" style={{ height:'100%', padding:20 }}>
      <div style={{ textAlign:'center', marginBottom:20, animation:'bounceIn 0.5s ease' }}>
        <div style={{ fontSize:64, marginBottom:8 }}>{trophy}</div>
        <div style={{ fontSize:26, fontWeight:900, color:'var(--primary)', marginBottom:4 }}>
          {score.toLocaleString()} <span style={{ fontSize:14, color:'var(--text-muted)' }}>نقطة</span>
        </div>
        {isPerfect && (
          <div style={{ background:'linear-gradient(135deg,#FFD700,#FF6B35)', borderRadius:12,
            padding:'6px 16px', display:'inline-block', fontSize:13, fontWeight:900, color:'#000' }}>
            🌟 إجابات مثالية!
          </div>
        )}
        {dailyChallenge && (
          <div style={{ background:'rgba(37,211,102,0.15)', border:'1px solid var(--primary)',
            borderRadius:10, padding:'6px 14px', marginTop:8, fontSize:12, color:'var(--primary)' }}>
            ✅ أكملت التحدي اليومي!
          </div>
        )}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
        {[
          { label:'الدقة',      value:`${accuracy}%`,                emoji:'🎯' },
          { label:'أعلى كومبو', value:`×${combo}`,                   emoji:'🔥' },
          { label:'الإجابات',   value:`${correct}/${answers.length}`, emoji:'✅' },
          { label:'المستوى',    value:`${level}`,                     emoji:'🏅' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign:'center', padding:'14px 10px' }}>
            <div style={{ fontSize:24 }}>{s.emoji}</div>
            <div style={{ fontSize:18, fontWeight:900 }}>{s.value}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>
      {answers.length > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div style={{ fontSize:14, fontWeight:700, marginBottom:10 }}>📊 تفاصيل الجلسة</div>
          {answers.slice(0, 5).map((a, i) => {
            const q = questions[i];
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8,
                padding:'6px 0', borderBottom: i < 4 ? '1px solid var(--border)' : 'none', fontSize:12 }}>
                <span>{a.is_correct ? '✅' : '❌'}</span>
                <span style={{ flex:1, color:'var(--text-muted)', overflow:'hidden',
                  textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{q?.text || '...'}</span>
                <span style={{ color:'var(--primary)', fontWeight:700, flexShrink:0 }}>
                  {a.is_correct ? `+${a.score_delta}` : '—'}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <button className="btn btn-primary" onClick={onShare} style={{ marginBottom:10 }}>
        📤 شارك نتيجتك وتحدَّ أصدقاءك
      </button>
      <button className="btn btn-secondary" onClick={onExit}>🏠 العودة للرئيسية</button>
    </div>
  );
}

function getDeviceFingerprint() {
  const parts = [navigator.userAgent.length, screen.width, screen.height,
    navigator.language, new Date().getTimezoneOffset()];
  return btoa(parts.join('-')).slice(0, 20);
}
