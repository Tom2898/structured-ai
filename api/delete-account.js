import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // ── 1. Auth: verify JWT — user can only delete their own account ─────────────
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non autenticato.' });

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) return res.status(401).json({ error: 'Token non valido.' });

  try {
    // ── 2. Cancel Stripe subscription if active ──────────────────────────────
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, status')
      .eq('email', authUser.email)
      .single();

    if (sub?.stripe_subscription_id?.startsWith('sub_') && sub.status === 'active') {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      try {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
      } catch (e) {
        console.error('Stripe cancel on delete error:', e.message);
      }
    }

    // ── 3. Delete from Supabase Auth (uses verified user id, not email from body) ──
    const { error: deleteError } = await supabase.auth.admin.deleteUser(authUser.id);
    if (deleteError) throw deleteError;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Delete account error:', err.message);
    return res.status(500).json({ error: 'Errore interno. Riprova.' });
  }
}