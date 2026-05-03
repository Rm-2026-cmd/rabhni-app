/**
 * ربحني معجم — Question Engine v3
 * =====================================
 * Drop-in replacement لـ questionEngine.js الحالي
 *
 * ✅ منع تكرار الأسئلة داخل الجلسة
 * ✅ منع تكرار آخر 200 سؤال عبر الجلسات (localStorage)
 * ✅ عشوائية محددة (seeded) — لا Math.random مباشرة
 * ✅ توازن مواضع الإجابة الصحيحة (لا bias)
 * ✅ خيارات خاطئة ذكية من نفس النوع/المستوى
 * ✅ صعوبة تكيفية حسب أداء المستخدم
 */

// ─────────────────────────────────────────────
// 1. SEEDED RNG — لا Math.random مباشرة
// ─────────────────────────────────────────────

function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed) {
  let s = (typeof seed === 'string' ? hashStr(seed) : seed) >>> 0;
  return {
    next() {
      s |= 0;
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    int(min, max) { return Math.floor(this.next() * (max - min + 1)) + min; },
    pick(arr)     { return arr[Math.floor(this.next() * arr.length)]; },
    shuffle(arr) {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    sample(arr, n) { return this.shuffle(arr).slice(0, Math.min(n, arr.length)); },
  };
}

// ─────────────────────────────────────────────
// 2. ANTI-REPETITION — session + cross-session
// ─────────────────────────────────────────────

const STORAGE_KEY = 'rabhni_seen_v3';
const MAX_HISTORY = 200;

class AntiRepeat {
  constructor() {
    this._session = new Set();
    this._history = this._load();
  }
  _load() {
    try {
      const d = localStorage.getItem(STORAGE_KEY);
      return d ? JSON.parse(d) : [];
    } catch { return []; }
  }
  _save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this._history.slice(-MAX_HISTORY))); }
    catch {}
  }
  markSeen(id) {
    this._session.add(id);
    if (!this._history.includes(id)) {
      this._history.push(id);
      if (this._history.length > MAX_HISTORY) this._history.shift();
      this._save();
    }
  }
  newSession()   { this._session = new Set(); }
  isSeenSession(id) { return this._session.has(id); }

  /**
   * فلترة المجموعة — يزيل المرئية مؤخراً
   * إذا نفدت الأسئلة → يعيد تدوير السجل
   */
  filter(pool) {
    const excludeAll = new Set([...this._session, ...this._history]);
    let result = pool.filter(q => !excludeAll.has(q.id));

    if (result.length === 0) {
      // نضبت المجموعة → امسح السجل العابر للجلسات (احتفظ بالجلسة الحالية فقط)
      console.warn('[AntiRepeat] Pool exhausted — rotating history');
      this._history = [];
      this._save();
      result = pool.filter(q => !this._session.has(q.id));
    }
    return result;
  }

  stats() { return { session: this._session.size, history: this._history.length }; }
}

// ─────────────────────────────────────────────
// 3. QUESTION POOL — indexed by level/type
// ─────────────────────────────────────────────

class Pool {
  constructor(questions) {
    this._all = [];
    this._byLevel = {};
    this._byType  = {};
    this._byId    = {};

    for (const q of questions) {
      if (!q.id || !q.question_text || !q.correct_answer) continue;
      // تنظيف: تأكد أن الإجابة الصحيحة ليست في الخطأ
      q.wrong_answers = (q.wrong_answers || []).filter(w => w !== q.correct_answer);
      if (q.wrong_answers.length === 0) continue;

      this._all.push(q);
      this._byId[q.id] = q;

      const lvl = q.level || 1;
      (this._byLevel[lvl] = this._byLevel[lvl] || []).push(q);

      const typ = q.type || 'general';
      (this._byType[typ] = this._byType[typ] || []).push(q);
    }
    console.log(`[Pool] ${this._all.length} questions loaded`);
  }

  all()           { return this._all; }
  byLevel(l)      { return this._byLevel[l] || []; }
  byType(t)       { return this._byType[t]  || []; }
  getById(id)     { return this._byId[id]; }
  total()         { return this._all.length; }

  /** أسئلة لمجال مستويات معينة */
  forLevels(levels) {
    return levels.flatMap(l => this._byLevel[l] || []);
  }

  /** مرشحات ذكية للخيارات الخاطئة */
  getDistractors(q, n, rng, excludeVals = []) {
    const exclude = new Set([q.correct_answer, ...excludeVals]);
    const candidates = new Set();

    // 1. من نفس النوع + نفس المستوى
    for (const cq of this._byType[q.type] || []) {
      if (cq.id === q.id) continue;
      if (!exclude.has(cq.correct_answer)) candidates.add(cq.correct_answer);
      for (const w of cq.wrong_answers) if (!exclude.has(w)) candidates.add(w);
    }

    // 2. من نفس المستوى إذا احتجنا المزيد
    if (candidates.size < n * 2) {
      for (const cq of this._byLevel[q.level] || []) {
        if (cq.id === q.id) continue;
        if (!exclude.has(cq.correct_answer)) candidates.add(cq.correct_answer);
      }
    }

    return rng.sample([...candidates], n);
  }
}

// ─────────────────────────────────────────────
// 4. ANSWER BALANCER — منع تكتل الإجابة الصحيحة
// ─────────────────────────────────────────────

class Balancer {
  constructor() { this._counts = [0, 0, 0, 0]; this._total = 0; }

  buildOptions(q, distractors, rng) {
    const correct = q.correct_answer;
    let wrongs = [...q.wrong_answers];

    // اكمل لـ 3 إجابات خاطئة من المرشحين
    const need = 3 - wrongs.length;
    if (need > 0) {
      const extras = distractors.filter(d => d !== correct && !wrongs.includes(d));
      wrongs = [...wrongs, ...extras.slice(0, need)];
    }
    while (wrongs.length < 3) wrongs.push(wrongs[0] || '—');
    wrongs = wrongs.slice(0, 3);

    // اختر موضعاً متوازناً
    const pos = this._balancedPos(rng);
    const options = [...wrongs];
    options.splice(pos, 0, correct);

    this._counts[pos]++;
    this._total++;

    return { options: options.slice(0, 4), correctIndex: pos };
  }

  _balancedPos(rng) {
    if (this._total < 8) return rng.int(0, 3);
    // أعطِ وزناً أعلى للمواضع الأقل ظهوراً
    const weights = this._counts.map(c => Math.max(0.05, 0.25 - c / this._total + 0.25));
    const total   = weights.reduce((a, b) => a + b, 0);
    let r = rng.next() * total;
    for (let i = 0; i < 4; i++) { r -= weights[i]; if (r <= 0) return i; }
    return 3;
  }

  reset() { this._counts = [0, 0, 0, 0]; this._total = 0; }
  stats() { return { counts: this._counts, total: this._total }; }
}

// ─────────────────────────────────────────────
// 5. DIFFICULTY ENGINE — صعوبة تكيفية
// ─────────────────────────────────────────────

const BANDS = {
  easy:   { levels:[1,2,3],    timeMs:12000 },
  normal: { levels:[2,3,4,5],  timeMs:10000 },
  hard:   { levels:[4,5,6,7],  timeMs:8000  },
  expert: { levels:[6,7,8,9],  timeMs:6000  },
  master: { levels:[8,9,10],   timeMs:5000  },
};

class Difficulty {
  constructor(startLevel = 1) {
    this._band   = startLevel <= 2 ? 'easy' : startLevel <= 5 ? 'normal' : 'hard';
    this._streak = 0;
    this._log    = [];
  }

  record(correct, responseMs, limitMs) {
    this._log.push({ correct, ratio: responseMs / limitMs });
    if (correct) this._streak++; else this._streak = 0;
    if (this._log.length % 5 === 0) this._adjust();
  }

  _adjust() {
    const last = this._log.slice(-5);
    const acc  = last.filter(l => l.correct).length / last.length;
    const spd  = last.reduce((s, l) => s + l.ratio, 0) / last.length;

    const keys = Object.keys(BANDS);
    const idx  = keys.indexOf(this._band);

    if (acc >= 0.8 && spd < 0.5 && idx < keys.length - 1) this._band = keys[idx + 1];
    else if (acc <= 0.4 && idx > 0)                        this._band = keys[idx - 1];
  }

  setLevels(min, max) {
    // Override band based on explicit level range
    if (min >= 8)      this._band = 'master';
    else if (min >= 6) this._band = 'expert';
    else if (min >= 4) this._band = 'hard';
    else if (min >= 2) this._band = 'normal';
    else               this._band = 'easy';
  }

  getLevels()   { return BANDS[this._band].levels; }
  getTimeMs()   { return BANDS[this._band].timeMs; }
  getStreak()   { return this._streak; }

  getComboMul() {
    if (this._streak >= 10) return 4.0;
    if (this._streak >= 7)  return 3.0;
    if (this._streak >= 5)  return 2.5;
    if (this._streak >= 3)  return 2.0;
    if (this._streak >= 2)  return 1.5;
    return 1.0;
  }

  getBandLabel() {
    return { easy:'سهل', normal:'متوسط', hard:'صعب', expert:'خبير', master:'أسطورة' }[this._band] || '';
  }
}

// ─────────────────────────────────────────────
// 6. MAIN ENGINE — الواجهة العامة
// ─────────────────────────────────────────────

// Global pool (محمّل مرة واحدة فقط)
let _globalPool = null;

/**
 * يجب استدعاؤها مرة واحدة عند تهيئة التطبيق.
 * @param {Array} questions - مصفوفة الأسئلة من questions.json
 */
export function initPool(questions) {
  if (!_globalPool) {
    _globalPool = new Pool(questions);
  }
  return _globalPool;
}

export function getPool() { return _globalPool; }

// ─────────────────────────────────────────────

export class QuestionEngine {
  /**
   * @param {object} opts
   * @param {string}  opts.userId
   * @param {number}  opts.minLevel     - المستوى الأدنى (1-10)
   * @param {number}  opts.maxLevel     - المستوى الأعلى (1-10)
   * @param {number}  [opts.count=10]   - عدد الأسئلة في الجلسة
   */
  constructor({ userId = 'anon', minLevel = 1, maxLevel = 5, count = 10 } = {}) {
    if (!_globalPool) throw new Error('[Engine] يجب استدعاء initPool() أولاً');

    this._userId    = userId;
    this._minLevel  = minLevel;
    this._maxLevel  = maxLevel;
    this._total     = count;

    // Session seed من userId + وقت البدء
    const seed       = `${userId}:${Date.now()}`;
    this._sessionRng = makeRng(seed);
    this._sessionSeed = hashStr(seed);

    this._antiRepeat  = new AntiRepeat();
    this._antiRepeat.newSession();

    this._balancer    = new Balancer();
    this._difficulty  = new Difficulty(minLevel);
    this._difficulty.setLevels(minLevel, maxLevel);

    // حالة الجلسة
    this._queue      = [];
    this._qIndex     = 0;
    this._score      = 0;
    this._lives      = 3;
    this._combo      = 0;
    this._maxCombo   = 0;
    this._correct    = 0;
    this._answered   = 0;
    this._startTime  = Date.now();
    this._questionStartTime = null;
    this._currentQ   = null;

    this._buildQueue();
  }

  // ── Queue ────────────────────────────────────────────────────────────────

  _buildQueue() {
    const levelRange = this._difficulty.getLevels().filter(
      l => l >= this._minLevel && l <= this._maxLevel
    );
    const levelPool  = _globalPool.forLevels(levelRange.length ? levelRange : [this._minLevel]);
    const filtered   = this._antiRepeat.filter(levelPool);
    this._queue      = this._sessionRng.shuffle(filtered);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * أعطِ السؤال التالي.
   * @returns {object|null} السؤال مع options و correctIndex، أو null إذا انتهت الجلسة.
   */
  next() {
    if (this.isDone()) return null;

    // إذا نضب الـ queue → أعد البناء
    if (this._qIndex >= this._queue.length) {
      this._buildQueue();
      this._qIndex = 0;
      if (this._queue.length === 0) return null;
    }

    const raw = this._queue[this._qIndex++];
    this._antiRepeat.markSeen(raw.id);

    // RNG خاص بكل سؤال: sessionSeed + questionId + timestamp
    const qRng = makeRng(`${this._sessionSeed}:${raw.id}:${Date.now()}`);

    // خيارات خاطئة ذكية
    const distractors = _globalPool.getDistractors(raw, 3, qRng);

    // بناء خيارات متوازنة
    const { options, correctIndex } = this._balancer.buildOptions(raw, distractors, qRng);

    this._currentQ = { ...raw, options, correctIndex, timeLimitMs: this._difficulty.getTimeMs() };
    this._questionStartTime = Date.now();

    return this._currentQ;
  }

  /**
   * سجّل إجابة المستخدم.
   * @param {number} selectedIndex - الإجابة المختارة (0-3)
   * @returns {object} نتيجة الإجابة
   */
  answer(selectedIndex) {
    if (!this._currentQ) throw new Error('[Engine] لا يوجد سؤال نشط');

    const responseMs = Date.now() - this._questionStartTime;
    const correct    = selectedIndex === this._currentQ.correctIndex;
    this._answered++;

    this._difficulty.record(correct, responseMs, this._currentQ.timeLimitMs);

    let scoreDelta = 0;
    if (correct) {
      this._correct++;
      this._combo++;
      if (this._combo > this._maxCombo) this._maxCombo = this._combo;

      const base       = 100;
      const speedBonus = responseMs < this._currentQ.timeLimitMs * 0.5 ? 50 : 0;
      scoreDelta       = Math.round((base + speedBonus) * this._difficulty.getComboMul());
      this._score     += scoreDelta;
    } else {
      this._combo = 0;
      this._lives = Math.max(0, this._lives - 1);
      if (this._minLevel >= 6) {
        scoreDelta    = -25;
        this._score   = Math.max(0, this._score + scoreDelta);
      }
    }

    return {
      correct,
      correctIndex:   this._currentQ.correctIndex,
      selectedIndex,
      scoreDelta,
      score:          this._score,
      lives:          this._lives,
      combo:          this._combo,
      comboMul:       this._difficulty.getComboMul(),
      accuracy:       this._answered > 0 ? this._correct / this._answered : 0,
      explanation:    this._currentQ.explanation || '',
      isAlive:        this._lives > 0,
      isDone:         this.isDone(),
    };
  }

  /** إجابة منتهية الوقت — تُعامَل كإجابة خاطئة */
  timeout() { return this.answer(-1); }

  /** استعادة حياة بعد مشاهدة إعلان */
  restoreLife() {
    if (this._lives < 3) { this._lives++; return true; }
    return false;
  }

  /** هل انتهت الجلسة؟ */
  isDone() {
    return this._answered >= this._total || this._lives <= 0;
  }

  /** حالة الجلسة الحالية */
  getState() {
    return {
      score:      this._score,
      lives:      this._lives,
      combo:      this._combo,
      maxCombo:   this._maxCombo,
      accuracy:   this._answered > 0 ? this._correct / this._answered : 0,
      progress:   this._answered,
      total:      this._total,
      bandLabel:  this._difficulty.getBandLabel(),
      timeLimitMs: this._currentQ?.timeLimitMs ?? 10000,
    };
  }

  /** ملخص نهائي لرفعه إلى الـ API */
  getSummary() {
    return {
      score:          this._score,
      accuracy:       this._answered > 0 ? this._correct / this._answered : 0,
      maxCombo:       this._maxCombo,
      totalQuestions: this._answered,
      correctAnswers: this._correct,
      durationMs:     Date.now() - this._startTime,
      minLevel:       this._minLevel,
      maxLevel:       this._maxLevel,
      antiRepeatStats: this._antiRepeat.stats(),
      positionStats:   this._balancer.stats(),
    };
  }

  /** إحصائيات للتصحيح */
  debug() {
    return { ...this.getState(), ...this.getSummary() };
  }
}
