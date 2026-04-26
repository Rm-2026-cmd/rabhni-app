// api/game/session.js — Fixed: returns updated user object after submit
import { authenticate, setCors } from '../../lib/auth.js';
import { supabase, auditLog } from '../../lib/supabase.js';
import { checkRateLimit, validateScore, validateSession } from '../../lib/anti-cheat.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await authenticate(req, res);
  if (!auth) return;
  const { user, ipHash } = auth;

  // ── POST — بدء جلسة جديدة ────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { level, language, deviceFp } = req.body;

    if (!level || level < 1 || level > 10)
      return res.status(400).json({ error: 'Invalid level (1-10)' });
    if (!['ar', 'en', 'tr'].includes(language))
      return res.status(400).json({ error: 'Invalid language' });
    if (!checkRateLimit(`session:${user.id}`, 30))
      return res.status(429).json({ error: 'Too many sessions, slow down' });

    // إلغاء أي جلسة نشطة سابقة
    await supabase.from('game_sessions')
      .update({ status: 'abandoned' })
      .eq('user_id', user.id)
      .eq('status', 'active');

    // جلب الأسئلة (ترتيب حتمي — لا عشوائية)
    // نقبل is_active=true بغض النظر عن validated
    // لأن validated=FALSE بشكل افتراضي وقد لا تكون الأسئلة مراجعة بعد
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('id, question_text, correct_answer, wrong_answers, type, explanation')
      .eq('level', level)
      .eq('language', language)
      .eq('is_active', true)
      .order('id')
      .limit(20);

    if (qError || !questions?.length)
      return res.status(500).json({ 
        error: qError 
          ? `DB error: ${qError.message}` 
          : `No questions found for level=${level} language=${language}. Please add questions in Supabase first.`
      });

    const { data: newSession, error: sesError } = await supabase
      .from('game_sessions')
      .insert({
        user_id: user.id, level, language,
        device_fp: deviceFp, ip_hash: ipHash, status: 'active',
        session_data: { question_ids: questions.map(q => q.id) }
      })
      .select('id')
      .single();

    if (sesError)
      return res.status(500).json({ error: 'Failed to create session' });

    const gameQuestions = questions.map(q => ({
      id: q.id,
      text: q.question_text,
      type: q.type || 'word_to_meaning',
      explanation: q.explanation,
      answers: shuffleAnswers(q.correct_answer, q.wrong_answers)
    }));

    await auditLog(user.id, 'session_started', 'game_session', newSession.id, { level, language });

    return res.status(200).json({ session_id: newSession.id, questions: gameQuestions });
  }

  // ── PUT — تسليم الجلسة ────────────────────────────────────────────────────
  if (req.method === 'PUT') {
    const { session_id, answers: clientAnswers, claimed_score, duration_ms } = req.body;

    if (!session_id || !Array.isArray(clientAnswers))
      return res.status(400).json({ error: 'Invalid request' });

    const { data: session } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (!session)           return res.status(404).json({ error: 'Session not found' });
    if (session.submitted)  return res.status(409).json({ error: 'Already submitted' });
    if (session.status !== 'active') return res.status(409).json({ error: 'Session not active' });

    // تحقق من كل إجابة مقارنةً بالـ DB
    const validatedAnswers = [];
    for (const ans of clientAnswers) {
      const { data: question } = await supabase
        .from('questions')
        .select('correct_answer')
        .eq('id', ans.question_id)
        .single();
      if (!question) continue;
      validatedAnswers.push({
        question_id: ans.question_id,
        selected_answer: ans.selected,
        is_correct: ans.selected === question.correct_answer,
        response_ms: ans.response_ms,
        combo_at_time: ans.combo || 0
      });
    }

    const sessionCheck = validateSession({ duration_ms }, validatedAnswers);
    const scoreCheck   = validateScore(claimed_score, validatedAnswers, session.level);
    const cheatFlags   = [
      ...sessionCheck.flags,
      ...(!scoreCheck.valid ? [scoreCheck.flag] : [])
    ];
    const finalScore = cheatFlags.length > 0 ? 0 : scoreCheck.serverScore;
    const accuracy   = validatedAnswers.length > 0
      ? Math.round(validatedAnswers.filter(a => a.is_correct).length / validatedAnswers.length * 100)
      : 0;

    // حفظ حتمي في DB
    const { data: result } = await supabase.rpc('submit_session_score', {
      p_session_id: session_id,
      p_user_id: user.id,
      p_score: finalScore,
      p_accuracy: accuracy,
      p_duration_ms: duration_ms,
      p_cheat_flags: cheatFlags
    });

    if (result?.error) return res.status(400).json({ error: result.error });

    // حفظ الإجابات للتدقيق
    if (validatedAnswers.length > 0) {
      let combo = 0;
      await supabase.from('answers').insert(
        validatedAnswers.map(a => {
          if (a.is_correct) combo++; else combo = 0;
          return {
            session_id, user_id: user.id,
            question_id: a.question_id,
            selected_answer: a.selected_answer,
            is_correct: a.is_correct,
            response_ms: a.response_ms,
            combo_at_time: combo
          };
        })
      );
    }

    await auditLog(user.id, 'session_completed', 'game_session', session_id, {
      score: finalScore, cheat_flags: cheatFlags, accuracy
    });

    // ✅ CRITICAL FIX — جلب المستخدم المحدَّث وإرجاعه
    // users.id = telegram_id (Primary Key)
    const { data: updatedUser } = await supabase
      .from('users')
      .select('weekly_score, total_score, games_played, coins')
      .eq('id', user.id)
      .single();

    return res.status(200).json({
      success: true,
      score: finalScore,
      accuracy,
      cheat_detected: cheatFlags.length > 0,
      message: cheatFlags.length > 0
        ? 'Score not counted — suspicious activity'
        : 'Score recorded!',
      // ✅ هذا هو المفتاح — بدونه لا يتحدث weekly_score
      user: updatedUser || {
        weekly_score: 0, total_score: 0, games_played: 0, coins: 0
      }
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

function shuffleAnswers(correct, wrongs) {
  const all = [
    { text: correct, isCorrect: true },
    ...wrongs.map(w => ({ text: w, isCorrect: false }))
  ];
  return all.sort((a, b) => a.text.localeCompare(b.text));
}
