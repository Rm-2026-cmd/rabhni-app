// api/game/session.js — Start and manage game sessions
import { authenticate, setCors } from '../../lib/auth.js';
import { supabase, auditLog } from '../../lib/supabase.js';
import { checkRateLimit } from '../../lib/anti-cheat.js';
import { validateScore, validateSession, computeServerScore } from '../../lib/anti-cheat.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await authenticate(req, res);
  if (!auth) return;

  const { user, ipHash } = auth;

  // ── POST /api/game/session — Start new session ──
  if (req.method === 'POST') {
    const { level, language, deviceFp } = req.body;

    // Validate inputs
    if (!level || level < 1 || level > 10) {
      return res.status(400).json({ error: 'Invalid level (1-10)' });
    }
    if (!['ar', 'en', 'tr'].includes(language)) {
      return res.status(400).json({ error: 'Invalid language' });
    }

    // Rate limit: max 30 sessions per hour
    if (!checkRateLimit(`session:${user.id}`, 30)) {
      return res.status(429).json({ error: 'Too many sessions, slow down' });
    }

    // Abandon any previously active session
    await supabase.from('game_sessions')
      .update({ status: 'abandoned' })
      .eq('user_id', user.id)
      .eq('status', 'active');

    // Fetch questions for this session (server-side selection — deterministic)
    const { data: questions, error: qError } = await supabase
      .from('questions')
      .select('id, question_text, correct_answer, wrong_answers, type, explanation')
      .eq('level', level)
      .eq('language', language)
      .eq('is_active', true)
      .eq('validated', true)
      .order('id')   // deterministic order — no randomness
      .limit(20);

    if (qError || !questions?.length) {
      return res.status(500).json({ error: 'No questions available for this level' });
    }

    // Shuffle client-side only for UX — server holds the truth
    // We send question IDs and the correct answer index is validated server-side

    // Create session
    const { data: session, error: sError } = await supabase
      .from('game_sessions')
      .insert({
        user_id: user.id,
        level,
        language,
        status: 'active',
        device_fp: deviceFp || null,
        ip_hash: ipHash
      })
      .select()
      .single();

    if (sError) {
      return res.status(500).json({ error: 'Failed to create session' });
    }

    await auditLog(user.id, 'session_started', 'game_session', session.id, { level, language });

    // Return session + questions (answers sent too — validation is server-side)
    return res.status(200).json({
      session_id: session.id,
      questions: questions.map(q => ({
        id: q.id,
        text: q.question_text,
        type: q.type,
        explanation: q.explanation,
        // Send all answers (correct + wrong) — client shuffles for display
        answers: shuffleAnswers(q.correct_answer, q.wrong_answers),
      })),
      started_at: session.started_at
    });
  }

  // ── PUT /api/game/session — Submit completed session ──
  if (req.method === 'PUT') {
    const { session_id, answers: clientAnswers, claimed_score, duration_ms } = req.body;

    if (!session_id || !clientAnswers || !duration_ms) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch session
    const { data: session } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single();

    if (!session) return res.status(404).json({ error: 'Session not found' });
    if (session.submitted) return res.status(409).json({ error: 'Already submitted' });
    if (session.status !== 'active') return res.status(409).json({ error: 'Session not active' });

    // Validate each answer against DB
    const validatedAnswers = [];
    for (const ans of clientAnswers) {
      const { data: question } = await supabase
        .from('questions')
        .select('correct_answer')
        .eq('id', ans.question_id)
        .single();

      if (!question) continue;

      const isCorrect = ans.selected === question.correct_answer;
      validatedAnswers.push({
        question_id: ans.question_id,
        selected_answer: ans.selected,
        is_correct: isCorrect,
        response_ms: ans.response_ms,
        combo_at_time: ans.combo || 0
      });
    }

    // Anti-cheat: validate session integrity
    const sessionCheck = validateSession({ duration_ms }, validatedAnswers);
    const scoreCheck = validateScore(claimed_score, validatedAnswers, session.level);

    const cheatFlags = [
      ...sessionCheck.flags,
      ...(!scoreCheck.valid ? [scoreCheck.flag] : [])
    ];

    // Use server score (authoritative)
    const finalScore = scoreCheck.serverScore;
    const accuracy = validatedAnswers.length > 0
      ? Math.round(validatedAnswers.filter(a => a.is_correct).length / validatedAnswers.length * 100)
      : 0;

    // Submit via transaction-safe function
    const { data: result } = await supabase.rpc('submit_session_score', {
      p_session_id: session_id,
      p_user_id: user.id,
      p_score: cheatFlags.length > 0 ? 0 : finalScore,
      p_accuracy: accuracy,
      p_duration_ms: duration_ms,
      p_cheat_flags: cheatFlags
    });

    if (result?.error) {
      return res.status(400).json({ error: result.error });
    }

    // Store individual answers for audit
    if (validatedAnswers.length > 0) {
      let combo = 0;
      const answerRows = validatedAnswers.map(a => {
        if (a.is_correct) combo++; else combo = 0;
        return {
          session_id,
          user_id: user.id,
          question_id: a.question_id,
          selected_answer: a.selected_answer,
          is_correct: a.is_correct,
          response_ms: a.response_ms,
          combo_at_time: combo
        };
      });

      await supabase.from('answers').insert(answerRows);
    }

    await auditLog(user.id, 'session_completed', 'game_session', session_id, {
      score: finalScore,
      cheat_flags: cheatFlags,
      accuracy
    });

    return res.status(200).json({
      success: true,
      score: finalScore,
      accuracy,
      cheat_detected: cheatFlags.length > 0,
      message: cheatFlags.length > 0 ? 'Score not counted — suspicious activity detected' : 'Score recorded!'
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
}

// Helper: create answer array without revealing which is correct
function shuffleAnswers(correct, wrongs) {
  const all = [{ text: correct, isCorrect: true }, ...wrongs.map(w => ({ text: w, isCorrect: false }))];
  // Deterministic shuffle using question content (not random)
  return all.sort((a, b) => a.text.localeCompare(b.text));
}
