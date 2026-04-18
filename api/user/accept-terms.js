// api/user/accept-terms.js
import { authenticate, setCors } from '../../lib/auth.js';
import { supabase, auditLog } from '../../lib/supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await authenticate(req, res);
  if (!auth) return;

  const { user } = auth;

  await supabase.from('users').update({
    agreed_to_terms: true,
    agreed_at: new Date().toISOString()
  }).eq('id', user.id);

  await auditLog(user.id, 'terms_accepted', 'user', user.id);

  return res.status(200).json({ success: true });
}
