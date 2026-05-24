import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // ── 1. Auth: verify JWT, never trust email from body ─────────────────────────
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Non autenticato.' });

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) return res.status(401).json({ error: 'Token non valido.' });

  const email = authUser.email; // ← from verified JWT, not from req.body

  try {
    // ── 2. Fetch subscription by verified email ───────────────────────────────
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, plan, status')
      .eq('email', email)
      .single();

    if (!sub) return res.status(404).json({ error: 'Nessun abbonamento trovato.' });
    if (sub.status !== 'active') {
      return res.status(400).json({ error: 'Abbonamento non attivo.' });
    }

    // ── 3. Cancel via Stripe ──────────────────────────────────────────────────
    if (sub?.stripe_subscription_id?.startsWith('sub_')) {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true
      });
    }

    // ── 4. Update Supabase (webhook will overwrite with full data shortly) ────
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelling', updated_at: new Date().toISOString() })
      .eq('email', email);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Cancel error:', err.message);
    return res.status(500).json({ error: 'Errore interno. Riprova.' });
  }
}