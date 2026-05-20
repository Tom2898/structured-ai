import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email mancante.' });

  try {
    // Get subscription ID from Supabase
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('email', email)
      .single();

    if (subError || !sub?.stripe_subscription_id) {
      return res.status(404).json({ error: 'Abbonamento non trovato.' });
    }

    // Cancel at period end (not immediately)
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: true
    });

    // Update Supabase
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelling', updated_at: new Date().toISOString() })
      .eq('email', email);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Cancel error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
