// lib/auth.js — API authentication middleware
import { validateTelegramAuth } from './telegram.js';
import { getOrCreateUser } from './supabase.js';
import { checkRateLimit, hashIP } from './anti-cheat.js';

const ADMIN_ID = parseInt(process.env.ADMIN_TELEGRAM_ID || '8079733623');

// ─────────────────────────────────────────────────────
// Main auth middleware
// ─────────────────────────────────────────────────────
export async function authenticate(req, res) {
  const initData = req.headers['x-telegram-init-data'] || req.body?.initData;

  if (!initData) {
    res.status(401).json({ error: 'Missing Telegram auth' });
    return null;
  }

  // Rate limit by IP
  const ip = req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || 'unknown';
  const ipHash = hashIP(ip);

  if (!checkRateLimit(`auth:${ipHash}`, 100)) {
    res.status(429).json({ error: 'Too many requests' });
    return null;
  }

  // Validate Telegram signature
  const telegramUser = validateTelegramAuth(initData);
  if (!telegramUser) {
    res.status(401).json({ error: 'Invalid Telegram auth' });
    return null;
  }

  // Get or create user in database
  const user = await getOrCreateUser(telegramUser);

  if (user.is_banned) {
    res.status(403).json({ error: 'Account suspended' });
    return null;
  }

  return { user, telegramUser, ipHash };
}

// ─────────────────────────────────────────────────────
// Admin-only middleware
// ─────────────────────────────────────────────────────
export async function authenticateAdmin(req, res) {
  const auth = await authenticate(req, res);
  if (!auth) return null;

  if (auth.user.id !== ADMIN_ID) {
    res.status(403).json({ error: 'Admin access required' });
    return null;
  }

  return auth;
}

// ─────────────────────────────────────────────────────
// CORS headers
// ─────────────────────────────────────────────────────
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || 'https://rabhni-app.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-telegram-init-data');
}
