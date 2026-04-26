// src/engine/questionEngine.js — محرك الأسئلة الذكي
// ─ مضاد للتكرار داخل الجلسة
// ─ يولّد 3 أنوع من كل سؤال (كلمة←معنى، معنى←كلمة، سياق)
// ─ خلط حتمي (لا Math.random) يعتمد على seed الجلسة
// ─ مشتتات ذكية (نفس الطول والفئة)

function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = Math.imul(s ^ (s >>> 15), s | 1);
    s ^= s + Math.imul(s ^ (s >>> 7), s | 61);
    const j = (s ^ (s >>> 14)) % (i + 1);
    [a[i], a[Math.abs(j)]] = [a[Math.abs(j)], a[i]];
  }
  return a;
}

export class QuestionEngine {
  constructor(rawQuestions, sessionSeed) {
    this.raw  = rawQuestions;
    this.seed = sessionSeed || Date.now();
    this.used = new Set();      // sourceId المستخدمة
    this.pool = seededShuffle(this._buildPool(), this.seed);
    this.idx  = 0;
  }

  _buildPool() {
    const out = [];
    for (const q of this.raw) {
      out.push(this._makeWordToMeaning(q));
      const rev = this._makeMeaningToWord(q);
      if (rev) out.push(rev);
    }
    return out;
  }

  _makeWordToMeaning(q) {
    return {
      id: `${q.id}_wm`, sourceId: q.id, type: 'word_to_meaning',
      text: q.question_text, correct: q.correct_answer,
      wrongs: q.wrong_answers, explanation: q.explanation,
      level: q.level, language: q.language,
    };
  }

  _makeMeaningToWord(q) {
    // استخرج الكلمة من نمط "ما معنى كلمة 'X'؟"
    const m = q.question_text.match(/['"'"](.*?)['"'"]/);
    if (!m) return null;
    const word = m[1];
    // مشتتات: كلمات من نفس الطول ±2
    const distractors = this.raw
      .filter(r => r.id !== q.id && r.language === q.language)
      .map(r => { const x = r.question_text.match(/['"'"](.*?)['"'"]/); return x ? x[1] : null; })
      .filter(w => w && Math.abs(w.length - word.length) <= 2 && w !== word);
    const wrongs = [...new Set(distractors)].slice(0, 3);
    if (wrongs.length < 2) return null;   // لا يكفي مشتتات
    return {
      id: `${q.id}_mw`, sourceId: q.id, type: 'meaning_to_word',
      text: `ما الكلمة التي تعني: "${q.correct_answer}"؟`,
      correct: word, wrongs, explanation: q.explanation,
      level: q.level, language: q.language,
    };
  }

  next() {
    // ابحث عن أول سؤال غير مستخدم sourceId
    for (let i = 0; i < this.pool.length; i++) {
      const q = this.pool[(this.idx + i) % this.pool.length];
      if (!this.used.has(q.sourceId)) {
        this.used.add(q.sourceId);
        this.idx = (this.pool.indexOf(q) + 1) % this.pool.length;
        return this._format(q);
      }
    }
    // إذا انتهى الـ pool أعد من الأول
    this.used.clear();
    return this._format(this.pool[0]);
  }

  _format(q) {
    const all = [
      { text: q.correct, isCorrect: true },
      ...q.wrongs.map(w => ({ text: w, isCorrect: false }))
    ];
    // خلط حتمي بالـ seed
    const shuffled = seededShuffle(all, this.seed + q.id.charCodeAt(0));
    return {
      id: q.id, text: q.text, type: q.type,
      explanation: q.explanation, answers: shuffled,
      level: q.level, language: q.language,
    };
  }

  getSessionQuestions(n = 10) {
    const qs = [];
    for (let i = 0; i < n; i++) qs.push(this.next());
    return qs;
  }
}

// تُستخدم في Game.jsx — تأخذ أسئلة السيرفر وتُثريها
export function enrichSessionQuestions(serverQuestions, sessionSeed) {
  const raw = serverQuestions.map(q => ({
    id: String(q.id),
    question_text:   q.text,
    correct_answer:  q.answers.find(a => a.isCorrect)?.text || '',
    wrong_answers:   q.answers.filter(a => !a.isCorrect).map(a => a.text),
    explanation:     q.explanation || '',
    level:           1,
    language:        'ar',
  }));
  const engine = new QuestionEngine(raw, sessionSeed);
  return engine.getSessionQuestions(serverQuestions.length);
}

// ─── AccuracyTracker ────────────────────────────────────────────────────────
// يُحل مشكلة الدقة: مرجع mutable — لا stale state
export class AccuracyTracker {
  constructor() { this.total = 0; this.correct = 0; }
  record(isCorrect) { this.total++; if (isCorrect) this.correct++; }
  get percentage() { return this.total ? Math.round((this.correct / this.total) * 100) : 0; }
  get summary()    { return { total: this.total, correct: this.correct, pct: this.percentage }; }
}

// ─── StreakTracker ──────────────────────────────────────────────────────────
export class StreakTracker {
  constructor() { this.current = 0; this.max = 0; }
  record(isCorrect) {
    if (isCorrect) { this.current++; this.max = Math.max(this.max, this.current); }
    else            { this.current = 0; }
  }
  get multiplier() { return Math.min(1 + this.current * 0.1, 2.0); }
  get bonus()      { return this.current >= 10 ? 50 : this.current >= 7 ? 30 : this.current >= 5 ? 20 : this.current >= 3 ? 10 : 0; }
}

// ─── نقاط حتمية (تتطابق مع منطق السيرفر) ──────────────────────────────────
const BASE_POINTS = [0, 10, 15, 20, 30, 50, 60, 80, 100, 120, 150];

export function calculatePoints({ level, responseMs, combo }) {
  const base   = BASE_POINTS[Math.min(level, 10)] || 10;
  const speed  = responseMs < 2000 ? 1.5 : responseMs < 5000 ? 1.2 : 1.0;
  const streak = Math.min(1 + combo * 0.1, 2.0);
  return Math.round(base * speed * streak);
}

export function timePressureBonus(timeLeft, total) {
  const r = timeLeft / total;
  return r > 0.8 ? 20 : r > 0.6 ? 10 : r > 0.4 ? 5 : 0;
}
