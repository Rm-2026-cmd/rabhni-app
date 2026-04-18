// lib/supabase.js — Server-side Supabase client (service role)
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  throw new Error('Missing Supabase credentials');
}

// Service role client — backend only, never expose to frontend
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
});

// ─────────────────────────────────────────────────────
// User helpers
// ─────────────────────────────────────────────────────

export async function getOrCreateUser(telegramUser) {
  const { id, username, first_name, last_name, language_code } = telegramUser;

  const { data: existing } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();

  if (existing) {
    // Update last active
    await supabase.from('users').update({
      username, first_name, last_name, last_active: new Date().toISOString()
    }).eq('id', id);
    return existing;
  }

  const { data: created, error } = await supabase
    .from('users')
    .insert({ id, username, first_name, last_name, language_code: language_code || 'ar' })
    .select()
    .single();

  if (error) throw error;
  return created;
}

export async function getUserById(userId) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────
// Economy helpers
// ─────────────────────────────────────────────────────

export async function getEconomySettings() {
  const { data, error } = await supabase
    .from('economy_settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) throw error;
  return data;
}

export async function incrementWeeklyAds(count = 1) {
  const { error } = await supabase.rpc('increment_weekly_ads', { inc: count });
  // Fallback if RPC not exists:
  if (error) {
    const settings = await getEconomySettings();
    await supabase.from('economy_settings').update({
      current_week_ads: settings.current_week_ads + count
    }).eq('id', 1);
  }
}

// ─────────────────────────────────────────────────────
// Audit logging
// ─────────────────────────────────────────────────────

export async function auditLog(userId, action, entityType, entityId, data = {}) {
  await supabase.from('audit_log').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: String(entityId),
    data
  });
}
