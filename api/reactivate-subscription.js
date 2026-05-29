import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorizzato' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorizzato' });

  try {
    // Get subscription id from Supabase — lookup by user_id, never by email
    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, cancel_at_period_end, status')
      .eq('user_id', user.id)
      .single();

    if (subError || !sub?.stripe_subscription_id) {
      return res.status(404).json({ error: 'Abbonamento non trovato' });
    }

    // Only allow reactivation if actually pending cancellation
    if (!sub.cancel_at_period_end) {
      return res.status(400).json({ error: 'Abbonamento non in disdetta.' });
    }

    if (sub.status !== 'active' && sub.status !== 'cancelling') {
      return res.status(400).json({ error: 'Abbonamento non riattivabile.' });
    }

    // Reactivate by setting cancel_at_period_end = false
    await stripe.subscriptions.update(sub.stripe_subscription_id, {
      cancel_at_period_end: false,
    });

    // Update Supabase immediately (webhook will confirm)
    await supabase
      .from('subscriptions')
      .update({
        cancel_at_period_end: false,
        cancel_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('reactivate-subscription error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}