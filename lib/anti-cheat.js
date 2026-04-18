// lib/anti-cheat.js — Advanced anti-cheat system
import crypto from 'crypto';

// ─────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────
const MIN_ANSWER_MS = 200;       // Impossible to answer faster than this
const MAX_ANSWER_MS = 30000;     // 30 seconds max per question
const MIN_SESSION_MS = 5000;     // Session must last at least 5 seconds
const MAX_PERFECT_STREAK = 50;   // Flag if too many perfect answers
const SUSPICIOUS_SPEED_RATIO = 0.15; // If >85% answers are suspiciously fast

// ─────────────────────────────────────────────────────
// Validate individual answer timing
// ─────────────────────────────────────────────────────
export function validateAnswerTiming(responseMs) {
  if (responseMs < MIN_ANSWER_MS) return { valid: false, flag: 'answer_too_fast' };
  if (responseMs > MAX_ANSWER_MS) return { valid: false, flag: 'answer_timeout' };
  return { valid: true };
}

// ─────────────────────────────────────────────────────
// Validate session integrity
// ─────────────────────────────────────────────────────
export function validateSession(session, answers) {
  const flags = [];

  // 1. Session duration check
  if (session.duration_ms < MIN_SESSION_MS) {
    flags.push('session_too_short');
  }

  // 2. Answer count consistency
  const expectedMin = answers.length * MIN_ANSWER_MS;
  if (session.duration_ms < expectedMin * 0.8) {
    flags.push('duration_answer_mismatch');
  }

  // 3. Speed analysis
  const fastAnswers = answers.filter(a => a.response_ms < 400);
  const fastRatio = fastAnswers.length / answers.length;
  if (fastRatio > SUSPICIOUS_SPEED_RATIO && answers.length >= 5) {
    flags.push('suspicious_speed_pattern');
  }

  // 4. Perfect accuracy on high count
  const correct = answers.filter(a => a.is_correct).length;
  if (correct === answers.length && answers.length >= MAX_PERFECT_STREAK) {
    flags.push('perfect_score_anomaly');
  }

  // 5. Identical response times (bot pattern)
  const uniqueTimes = new Set(answers.map(a => a.response_ms));
  if (answers.length > 5 && uniqueTimes.size < answers.length * 0.3) {
    flags.push('identical_timing_bot_pattern');
  }

  return { valid: flags.length === 0, flags };
}

// ─────────────────────────────────────────────────────
// Hash IP for storage (never store raw IP)
// ─────────────────────────────────────────────────────
export function hashIP(ip) {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip + 'rabahni_salt_2025').digest('hex').slice(0, 16);
}

// ─────────────────────────────────────────────────────
// Rate limit check (server-side)
// ─────────────────────────────────────────────────────
const rateLimitStore = new Map(); // In production, use Redis

export function checkRateLimit(key, maxPerMinute = 60) {
  const now = Date.now();
  const windowMs = 60 * 1000;

  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, []);
  }

  const requests = rateLimitStore.get(key).filter(t => now - t < windowMs);
  requests.push(now);
  rateLimitStore.set(key, requests);

  return requests.length <= maxPerMinute;
}

// ─────────────────────────────────────────────────────
// Detect suspicious device fingerprint patterns
// ─────────────────────────────────────────────────────
export function validateFingerprint(fp) {
  if (!fp || fp.length < 8) return { valid: false, flag: 'invalid_fingerprint' };
  return { valid: true };
}

// ─────────────────────────────────────────────────────
// Score validation: verify server-side scoring
// ─────────────────────────────────────────────────────
export function computeServerScore(answers, level) {
  let score = 0;
  let combo = 0;
  const BASE_POINTS = [0, 10, 15, 20, 30, 50, 60, 80, 100, 120, 150][level] || 10;
  const isPro = level >= 6;

  for (const answer of answers) {
    if (answer.is_correct) {
      combo++;
      // Speed bonus: faster = more points (but deterministic)
      const speedMultiplier = answer.response_ms < 2000 ? 1.5 :
                              answer.response_ms < 5000 ? 1.2 : 1.0;
      const comboMultiplier = Math.min(1 + (combo - 1) * 0.1, 2.0);
      const points = Math.round(BASE_POINTS * speedMultiplier * comboMultiplier);
      score += points;
    } else {
      combo = 0;
      if (isPro) score = Math.max(0, score - Math.round(BASE_POINTS * 0.5));
    }
  }

  return score;
}

// ─────────────────────────────────────────────────────
// Validate submitted score vs server-computed score
// ─────────────────────────────────────────────────────
export function validateScore(clientScore, answers, level) {
  const serverScore = computeServerScore(answers, level);
  const tolerance = 0.05; // Allow 5% difference for rounding
  const diff = Math.abs(clientScore - serverScore) / Math.max(serverScore, 1);

  if (diff > tolerance) {
    return { valid: false, flag: 'score_manipulation', serverScore };
  }

  return { valid: true, serverScore };
}
