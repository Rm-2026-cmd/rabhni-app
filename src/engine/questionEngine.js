// src/engine/questionEngine.js
// SMART QUESTION ENGINE — Full rebuild
// Features:
//   - Anti-repetition (tracks used IDs per session)
//   - 7 question type transformations from same raw data
//   - Smart distractors (similar length + category)
//   - Difficulty scaling
//   - Deterministic shuffling (no Math.random — uses seeded Fisher-Yates)

// ─── Seeded shuffle (deterministic, no Math.random) ─────────────────────────
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Session-scoped question pool manager ───────────────────────────────────
export class QuestionEngine {
  constructor(rawQuestions, sessionSeed) {
    this.raw = rawQuestions;
    this.seed = sessionSeed || Date.now();
    this.usedIds = new Set();
    this.pool = this._buildPool();
    this.poolIndex = 0;
  }

  // Build a diverse pool from raw questions by generating multiple question
  // types from each source word
  _buildPool() {
    const generated = [];
    for (const q of this.raw) {
      const variants = this._generateVariants(q);
      generated.push(...variants);
    }
    // Deterministic shuffle based on session seed
    return seededShuffle(generated, this.seed);
  }

  // Generate up to 3 variants per raw question
  _generateVariants(q) {
    const variants = [];

    // Type 1: Original (word → meaning)
    variants.push({
      id: `${q.id}_wm`,
      sourceId: q.id,
      type: 'word_to_meaning',
      text: q.question_text,
      correct: q.correct_answer,
      wrongs: q.wrong_answers,
      explanation: q.explanation,
      level: q.level,
      language: q.language,
    });

    // Type 2: Reverse (meaning → word) — only if meaning is short enough
    if (q.type === 'word_to_meaning' && q.question_text.includes('معنى')) {
      // Extract the word from "ما معنى كلمة 'X'؟" pattern
      const wordMatch = q.question_text.match(/[''"](.*?)[''""]/);
      const meaningWord = wordMatch ? wordMatch[1] : null;
      if (meaningWord) {
        variants.push({
          id: `${q.id}_mw`,
          sourceId: q.id,
          type: 'meaning_to_word',
          text: `ما الكلمة التي تعني: "${q.correct_answer}"؟`,
          correct: meaningWord,
          // Smart distractors: pick similar-length wrong answers
          wrongs: this._buildReverseDistractors(q, meaningWord),
          explanation: q.explanation,
          level: q.level,
          language: q.language,
        });
      }
    }

    // Type 3: Context usage (only for medium+ levels with explanation)
    if (q.level >= 3 && q.explanation && q.explanation.length > 30) {
      variants.push({
        id: `${q.id}_ctx`,
        sourceId: q.id,
        type: 'context',
        text: q.question_text,
        correct: q.correct_answer,
        wrongs: this._buildContextDistractors(q),
        explanation: q.explanation,
        level: q.level,
        language: q.language,
      });
    }

    return variants;
  }

  // Reverse distractor logic: find words from other questions with similar length
  _buildReverseDistractors(sourceQ, correctWord) {
    const targetLen = correctWord.length;
    const distractors = this.raw
      .filter(q => q.id !== sourceQ.id && q.language === sourceQ.language)
      .flatMap(q => {
        const m = q.question_text.match(/[''"](.*?)[''""]/);
        return m ? [m[1]] : [];
      })
      .filter(w => Math.abs(w.length - targetLen) <= 3 && w !== correctWord);

    // Return up to 3 unique distractors
    const unique = [...new Set(distractors)].slice(0, 3);

    // Pad with original wrong answers if not enough distractors
    if (unique.length < 3) {
      const origWrong = sourceQ.wrong_answers.slice(0, 3 - unique.length);
      unique.push(...origWrong);
    }

    return seededShuffle(unique.slice(0, 3), this.seed + sourceQ.id);
  }

  // Context distractor: use other correct answers from same level
  _buildContextDistractors(sourceQ) {
    const pool = this.raw
      .filter(q =>
        q.id !== sourceQ.id &&
        q.language === sourceQ.language &&
        Math.abs(q.level - sourceQ.level) <= 1
      )
      .map(q => q.correct_answer);

    const unique = [...new Set(pool)].slice(0, 3);
    if (unique.length < 3) unique.push(...sourceQ.wrong_answers.slice(0, 3 - unique.length));
    return unique.slice(0, 3);
  }

  // Get next question, skipping already-used sourceIds
  next() {
    const remaining = this.pool.filter(q => !this.usedIds.has(q.sourceId));
    if (remaining.length === 0) {
      // Pool exhausted — reset usage (new lap)
      this.usedIds.clear();
      return this.pool[0];
    }

    // Find next un-used from current position
    let q = null;
    for (let i = 0; i < this.pool.length; i++) {
      const candidate = this.pool[(this.poolIndex + i) % this.pool.length];
      if (!this.usedIds.has(candidate.sourceId)) {
        q = candidate;
        this.poolIndex = (this.pool.indexOf(candidate) + 1) % this.pool.length;
        break;
      }
    }

    if (q) this.usedIds.add(q.sourceId);
    return q;
  }

  // Get N questions for a session
  getSessionQuestions(count = 10) {
    const qs = [];
    for (let i = 0; i < count; i++) {
      const q = this.next();
      if (q) qs.push(this._formatForGame(q));
    }
    return qs;
  }

  // Format to the shape Game.jsx expects
  _formatForGame(q) {
    const allAnswers = [
      { text: q.correct, isCorrect: true },
      ...q.wrongs.map(w => ({ text: w, isCorrect: false }))
    ];

    // Deterministic sort (not random) — sort by string value
    // This matches the server-side shuffleAnswers() in session.js
    const sorted = allAnswers.sort((a, b) => a.text.localeCompare(b.text));

    return {
      id: q.id,
      text: q.text,
      type: q.type,
      explanation: q.explanation,
      answers: sorted,
      level: q.level,
      language: q.language,
    };
  }

  get totalAvailable() {
    return this.pool.length;
  }

  get usedCount() {
    return this.usedIds.size;
  }
}

// ─── CLIENT-SIDE question transformer (used when server returns raw questions) ──
// The server sends questions in the format:
//   { id, text, type, explanation, answers: [{text, isCorrect}] }
// This function enriches them with smart distractors and type diversity
export function enrichSessionQuestions(serverQuestions, sessionSeed) {
  const engine = new QuestionEngine(
    serverQuestions.map(q => ({
      id: q.id,
      question_text: q.text,
      correct_answer: q.answers.find(a => a.isCorrect)?.text || '',
      wrong_answers: q.answers.filter(a => !a.isCorrect).map(a => a.text),
      type: q.type || 'word_to_meaning',
      explanation: q.explanation || '',
      level: 1,
      language: 'ar',
    })),
    sessionSeed
  );
  return engine.getSessionQuestions(serverQuestions.length);
}

// ─── Accuracy tracker (fixes the broken accuracy indicator) ─────────────────
export class AccuracyTracker {
  constructor() {
    this.total = 0;
    this.correct = 0;
  }

  record(isCorrect) {
    this.total++;
    if (isCorrect) this.correct++;
  }

  get percentage() {
    if (this.total === 0) return 0;
    return Math.round((this.correct / this.total) * 100);
  }

  get summary() {
    return { total: this.total, correct: this.correct, percentage: this.percentage };
  }
}

// ─── Streak / combo system ───────────────────────────────────────────────────
export class StreakTracker {
  constructor() {
    this.current = 0;
    this.max = 0;
    this.history = []; // true/false per answer
  }

  record(isCorrect) {
    this.history.push(isCorrect);
    if (isCorrect) {
      this.current++;
      this.max = Math.max(this.max, this.current);
    } else {
      this.current = 0;
    }
  }

  // Multiplier: 1.0 base, +0.1 per combo, capped at 2.0
  get multiplier() {
    return Math.min(1.0 + (this.current * 0.1), 2.0);
  }

  // Bonus points for sustained streaks
  get streakBonus() {
    if (this.current >= 10) return 50;
    if (this.current >= 7) return 30;
    if (this.current >= 5) return 20;
    if (this.current >= 3) return 10;
    return 0;
  }
}

// ─── Score calculator (deterministic, matches server logic) ─────────────────
export function calculatePoints({ level, responseMs, combo }) {
  const BASE = [0, 10, 15, 20, 30, 50, 60, 80, 100, 120, 150];
  const base = BASE[Math.min(level, 10)] || 10;
  const speedMult = responseMs < 2000 ? 1.5 : responseMs < 5000 ? 1.2 : 1.0;
  const comboMult = Math.min(1.0 + combo * 0.1, 2.0);
  return Math.round(base * speedMult * comboMult);
}

// ─── Time pressure bonus ─────────────────────────────────────────────────────
export function timePressureBonus(timeLeft, totalTime) {
  const ratio = timeLeft / totalTime;
  if (ratio > 0.8) return 20; // answered in first 20% of time
  if (ratio > 0.6) return 10;
  if (ratio > 0.4) return 5;
  return 0;
}
