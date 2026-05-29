import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Whitelist of valid price IDs — prevents passing arbitrary Stripe prices
const ALLOWED_PRICE_IDS = new Set([
  'price_1TbRXCQk0TtLlDLRAIVkTBeo', // Retail mensile
  'price_1TcCMWQk0TtLlDLRWgbXviCl', // Retail annuale
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // ── 1. Auth: verify JWT — email comes from token, never from body ────────────
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non autenticato.' });

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) return res.status(401).json({ error: 'Token non valido.' });

  // ── 2. Validate priceId ──────────────────────────────────────────────────────
  const { priceId } = req.body;
  if (!priceId) return res.status(400).json({ error: 'priceId mancante' });
  if (!ALLOWED_PRICE_IDS.has(priceId)) {
    return res.status(400).json({ error: 'Piano non valido.' });
  }

  // ── 3. Check user doesn't already have an active subscription ───────────────
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', authUser.id)
    .single();

  if (existingSub?.status === 'active') {
    return res.status(400).json({ error: 'Hai già un abbonamento attivo.' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const appUrl = process.env.VITE_APP_URL || req.headers.origin || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: authUser.email, // ← always from verified JWT
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/?payment=success&plan=retail`,
      cancel_url: `${appUrl}/`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}


