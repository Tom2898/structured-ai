import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email mancante.' });

  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('email', email)
      .single();

    // If real Stripe subscription exists, cancel via Stripe
    if (sub?.stripe_subscription_id?.startsWith('sub_')) {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        cancel_at_period_end: true
      });
    }

    // Always update Supabase
    await supabase
      .from('subscriptions')
      .update({ status: 'cancelling', plan: 'free', updated_at: new Date().toISOString() })
      .eq('email', email);

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Cancel error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}