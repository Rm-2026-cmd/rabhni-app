// src/pages/Game.jsx — Full game loop
import { useState, useEffect, useRef, useCallback } from 'react';
import { useApi } from '../hooks/useApi';
import { useAds } from '../hooks/useAds';
import { useTelegram } from '../hooks/useTelegram';

const QUESTION_TIME = 15; // seconds
const INTERSTITIAL_EVERY = 4; // sessions

export default function Game({ config, onExit }) {
  const api = useApi();
  const ads = useAds();
  const { haptic } = useTelegram();

  const [phase, setPhase] = useState('loading'); // loading|playing|result|gameover
  const [session, setSession] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [feedback, setFeedback] = useState(null); // null|'correct'|'wrong'
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [sessionStart] = useState(Date.now());
  const [adLoading, setAdLoading] = useState(false);
  const [comboFlash, setComboFlash] = useState(false);

  const timerRef = useRef(null);
  const questionStart = useRef(Date.now());

  useEffect(() => {
    startSession();
  }, []);

  async function startSession() {
    try {
      const data = await api.post('/game/session', {
        level: config.level,
        language: config.language,
        deviceFp: getDeviceFingerprint()
      });
      setSession(data);
      setQuestions(data.questions);
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
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleTimeout();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function stopTimer() { clearInterval(timerRef.current); }

  function handleTimeout() {
    haptic.error();
    handleWrongAnswer(null);
  }

  function handleAnswer(answer) {
    if (feedback !== null) return; // already answered
    stopTimer();

    const responseMs = Date.now() - questionStart.current;
    const q = questions[qIndex];
    const correct = answer === q.answers.find(a => a.isCorrect)?.text;

    setSelectedAnswer(answer);
    setFeedback(correct ? 'correct' : 'wrong');

    // Compute score increment
    let points = 0;
    if (correct) {
      const basePoints = [0,10,15,20,30,50,60,80,100,120,150][config.level] || 10;
      const speedMult = responseMs < 2000 ? 1.5 : responseMs < 5000 ? 1.2 : 1.0;
      const newCombo = combo + 1;
      const comboMult = Math.min(1 + (newCombo - 1) * 0.1, 2.0);
      points = Math.round(basePoints * speedMult * comboMult);

      setCombo(newCombo);
      setMaxCombo(m => Math.max(m, newCombo));
      setScore(s => s + points);

      if (newCombo >= 3) {
        setComboFlash(true);
        setTimeout(() => setComboFlash(false), 600);
      }
      haptic.success();
    } else {
      const newLives = lives - 1;
      setLives(newLives);
      setCombo(0);
      if (config.level >= 6) setScore(s => Math.max(0, s - Math.round([0,10,15,20,30,50,60,80,100,120,150][config.level]/2)));
      haptic.error();
    }

    // Record answer
    setAnswers(prev => [...prev, {
      question_id: q.id,
      selected: answer,
      is_correct: correct,
      response_ms: responseMs,
      combo: combo + (correct ? 1 : 0),
      score_delta: points
    }]);

    // Check if game over
    const newLivesVal = correct ? lives : lives - 1;
    if (!correct && newLivesVal <= 0) {
      setTimeout(() => setPhase('gameover'), 1200);
      return;
    }

    // Next question after delay
    setTimeout(() => {
      setFeedback(null);
      setSelectedAnswer(null);
      setShowExplanation(false);

      if (qIndex + 1 >= questions.length) {
        finishSession();
      } else {
        setQIndex(i => i + 1);
        startTimer();
      }
    }, correct ? 800 : 1500);
  }

  async function finishSession() {
    stopTimer();
    setPhase('result');
    try {
      await api.put('/game/session', {
        session_id: session.session_id,
        answers,
        claimed_score: score,
        duration_ms: Date.now() - sessionStart
      });
    } catch (e) { console.error('Submit failed:', e); }
  }

  async function handleRevive() {
    setAdLoading(true);
    const result = await ads.showRewarded('revive', session?.session_id);
    setAdLoading(false);
    if (result.success) {
      setLives(3);
      setPhase('playing');
      startTimer();
    } else {
      alert('الإعلان غير متاح حالياً. حاول لاحقاً.');
    }
  }

  const q = questions[qIndex];
  const progress = questions.length > 0 ? ((qIndex) / questions.length) * 100 : 0;

  if (phase === 'loading') return (
    <div style={{ height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:40, animation:'pulse 1s infinite' }}>📚</div>
      <div style={{ color:'var(--text-muted)' }}>جاري تحميل الأسئلة...</div>
    </div>
  );

  if (phase === 'gameover') return (
    <GameOver score={score} combo={maxCombo} onRevive={handleRevive} onExit={onExit} adLoading={adLoading} />
  );

  if (phase === 'result') return (
    <Result score={score} answers={answers} questions={questions} combo={maxCombo} level={config.level} onExit={onExit} />
  );

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', padding:16 }}>
      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
        <button onClick={onExit} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:20, padding:4 }}>✕</button>

        {/* Lives */}
        <div style={{ display:'flex', gap:4 }}>
          {[1,2,3].map(i => (
            <span key={i} style={{ fontSize:20, opacity: lives >= i ? 1 : 0.2, transition:'opacity 0.3s', animation: lives < i ? 'heartLose 0.4s ease' : 'none' }}>❤️</span>
          ))}
        </div>

        <div style={{ flex:1 }} />

        {/* Score */}
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:20, fontWeight:900, color:'var(--primary)' }}>{score.toLocaleString()}</div>
          <div style={{ fontSize:11, color:'var(--text-muted)' }}>نقطة</div>
        </div>

        {/* Combo */}
        {combo > 1 && (
          <div style={{ background:'var(--bg3)', borderRadius:10, padding:'4px 10px', animation: comboFlash ? 'comboFlash 0.5s ease' : 'none' }}>
            <div style={{ fontSize:13, fontWeight:900, color:'var(--gold)' }}>🔥 ×{combo}</div>
          </div>
        )}
      </div>

      {/* Progress */}
      <div className="progress-bar" style={{ marginBottom:16 }}>
        <div className="progress-fill" style={{ width:`${progress}%` }} />
      </div>

      {/* Timer */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
        <div style={{ flex:1, height:6, background:'var(--bg3)', borderRadius:99, overflow:'hidden' }}>
          <div style={{
            height:'100%', borderRadius:99,
            background: timeLeft > 8 ? 'var(--primary)' : timeLeft > 4 ? 'var(--warning)' : 'var(--danger)',
            width: `${(timeLeft/QUESTION_TIME)*100}%`,
            transition:'width 1s linear, background 0.3s'
          }} />
        </div>
        <div style={{ fontSize:16, fontWeight:900, color: timeLeft <= 4 ? 'var(--danger)' : 'var(--text)', minWidth:28, textAlign:'center' }}>{timeLeft}</div>
      </div>

      {/* Question */}
      {q && (
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:12 }}>
          <div className="card" style={{ marginBottom:4, padding:'18px 16px', textAlign:'center', animation:'fadeInUp 0.3s ease' }}>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>
              سؤال {qIndex+1} / {questions.length}
            </div>
            <div style={{ fontSize:18, fontWeight:700, color:'var(--text)', lineHeight:1.6 }}>
              {q.text}
            </div>
          </div>

          {/* Answers — moving animation for UX */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {q.answers.map((ans, idx) => {
              const isSelected = selectedAnswer === ans.text;
              const isCorrect = ans.isCorrect;
              let bg = 'var(--bg3)';
              let border = 'var(--border)';
              let color = 'var(--text)';

              if (feedback !== null) {
                if (isCorrect) { bg='rgba(37,211,102,0.15)'; border='var(--primary)'; color='var(--primary)'; }
                else if (isSelected && !isCorrect) { bg='rgba(255,92,92,0.15)'; border='var(--danger)'; color='var(--danger)'; }
              }

              const movingAnim = feedback === null && (idx % 2 === 0 ? 'moveLeft 3s ease infinite' : 'moveRight 3s ease infinite');

              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(ans.text)}
                  disabled={feedback !== null}
                  style={{
                    padding:'14px 16px', borderRadius:12,
                    border:`2px solid ${border}`,
                    background: bg, color,
                    fontFamily:'Cairo,sans-serif', fontSize:15, fontWeight:600,
                    textAlign:'right', cursor: feedback !== null ? 'default' : 'pointer',
                    transition:'all 0.2s', outline:'none',
                    animation: movingAnim || 'none',
                    transform: isSelected ? 'scale(0.97)' : 'scale(1)',
                  }}
                >
                  {ans.text}
                  {feedback !== null && isCorrect && <span style={{float:'left'}}>✅</span>}
                  {feedback !== null && isSelected && !isCorrect && <span style={{float:'left'}}>❌</span>}
                </button>
              );
            })}
          </div>

          {/* Explanation button */}
          {feedback === 'wrong' && q.explanation && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowExplanation(!showExplanation)}
              style={{ marginTop:4, alignSelf:'center' }}
            >
              💡 {showExplanation ? 'إخفاء الشرح' : 'شرح الإجابة'}
            </button>
          )}
          {showExplanation && q.explanation && (
            <div className="card" style={{ fontSize:13, color:'var(--text-muted)', animation:'fadeInUp 0.2s ease' }}>
              {q.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GameOver({ score, combo, onRevive, onExit, adLoading }) {
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20, padding:24, textAlign:'center' }}>
      <div style={{ fontSize:60 }}>💔</div>
      <div style={{ fontSize:22, fontWeight:900 }}>انتهت حياتك!</div>
      <div style={{ fontSize:16, color:'var(--text-muted)' }}>النقاط: <span style={{ color:'var(--primary)', fontWeight:700 }}>{score.toLocaleString()}</span></div>

      <div className="card" style={{ width:'100%', padding:20 }}>
        <div style={{ fontSize:14, color:'var(--text-muted)', marginBottom:14 }}>
          🎁 شاهد إعلاناً قصيراً للحصول على فرصة ثانية وإعادة القلوب الثلاثة
        </div>
        <button className="btn btn-primary" onClick={onRevive} disabled={adLoading} style={{ marginBottom:10 }}>
          {adLoading ? '⏳ جاري تحميل الإعلان...' : '📺 شاهد إعلاناً — فرصة ثانية'}
        </button>
        <button className="btn btn-secondary" onClick={onExit}>❌ الخروج</button>
      </div>

      <div style={{ fontSize:12, color:'var(--text-muted)', maxWidth:280 }}>
        يمكنك أيضاً الخروج والبدء من جديد في أي وقت — مجاناً تماماً.
      </div>
    </div>
  );
}

function Result({ score, answers, questions, combo, level, onExit }) {
  const correct = answers.filter(a => a.is_correct).length;
  const accuracy = answers.length > 0 ? Math.round(correct / answers.length * 100) : 0;

  return (
    <div className="scroll-y" style={{ height:'100%', padding:20 }}>
      <div style={{ textAlign:'center', marginBottom:24, animation:'fadeInUp 0.4s ease' }}>
        <div style={{ fontSize:60, marginBottom:8 }}>{accuracy >= 80 ? '🏆' : accuracy >= 60 ? '⭐' : '📚'}</div>
        <div style={{ fontSize:24, fontWeight:900, color:'var(--primary)', marginBottom:4 }}>
          {score.toLocaleString()} نقطة
        </div>
        <div style={{ fontSize:14, color:'var(--text-muted)' }}>تمت الجلسة!</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:20 }}>
        {[
          { label:'الدقة', value:`${accuracy}%`, emoji:'🎯' },
          { label:'أعلى كومبو', value:`×${combo}`, emoji:'🔥' },
          { label:'الإجابات', value:`${correct}/${answers.length}`, emoji:'✅' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign:'center', padding:'12px 8px' }}>
            <div style={{ fontSize:22 }}>{s.emoji}</div>
            <div style={{ fontSize:16, fontWeight:900 }}>{s.value}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <button className="btn btn-primary" onClick={onExit} style={{ marginBottom:10 }}>
        🏠 العودة للرئيسية
      </button>
    </div>
  );
}

function getDeviceFingerprint() {
  const parts = [
    navigator.userAgent.length,
    screen.width, screen.height,
    navigator.language,
    new Date().getTimezoneOffset(),
  ];
  return btoa(parts.join('-')).slice(0, 20);
}
