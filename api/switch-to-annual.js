import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verify auth token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorizzato' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorizzato' });

  const { priceIdAnnual } = req.body;
  if (!priceIdAnnual) return res.status(400).json({ error: 'priceIdAnnual mancante' });

  // Whitelist: only the known annual price ID is accepted
  const ALLOWED_ANNUAL_PRICE_IDS = new Set(['price_1TbRXiQk0TtLlDLRuRYpb1ho']);
  if (!ALLOWED_ANNUAL_PRICE_IDS.has(priceIdAnnual)) {
    return res.status(400).json({ error: 'Piano non valido.' });
  }

  try {
    // Get subscription from Supabase
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, billing_interval')
      .eq('email', user.email)
      .single();

    if (subError || !sub?.stripe_subscription_id) {
      return res.status(404).json({ error: 'Abbonamento non trovato' });
    }

    if (sub.billing_interval === 'year') {
      return res.status(400).json({ error: 'Sei già sul piano annuale' });
    }

    // Retrieve current subscription from Stripe
    const subscription = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
    const currentItemId = subscription.items.data[0]?.id;

    if (!currentItemId) {
      return res.status(500).json({ error: 'Errore nel recupero abbonamento Stripe' });
    }

    // Switch to annual price — Stripe calculates and charges the pro-rata difference immediately
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      items: [{ id: currentItemId, price: priceIdAnnual }],
      proration_behavior: 'always_invoice', // charges the pro-rata difference immediately
      billing_cycle_anchor: 'now',          // restart billing cycle from today
    });

    // Supabase will be updated by the webhook (customer.subscription.updated)
    // but we optimistically update here too for instant UI feedback
    await supabase
      .from('subscriptions')
      .update({ billing_interval: 'year', updated_at: new Date().toISOString() })
      .eq('email', user.email);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('switch-to-annual error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}