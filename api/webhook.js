import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: err.message });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email || session.customer_details?.email;
    const subscriptionId = session.subscription;
    const customerId = session.customer;

    const { error } = await supabase.from('subscriptions').upsert({
      email,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan: 'retail',
      status: 'active',
      updated_at: new Date().toISOString()
    }, { onConflict: 'email' });

    if (error) console.error('Supabase upsert error:', error.message);
  }

  // Abbonamento cancellato (disdetta o fallimento definitivo)
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    await supabase.from('subscriptions')
      .update({ plan: 'free', status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subscription.id);
  }

  // Stato abbonamento aggiornato (es. past_due, unpaid, active dopo rinnovo)
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    const status = subscription.status; // active | past_due | unpaid | canceled | ...
    const plan = status === 'active' ? 'retail' : 'free';
    await supabase.from('subscriptions')
      .update({ plan, status, updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subscription.id);
  }

  // Pagamento rinnovo fallito — mette lo status in past_due come avviso
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    const subscriptionId = invoice.subscription;
    if (subscriptionId) {
      await supabase.from('subscriptions')
        .update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscriptionId);
    }
  }

  // Rinnovo andato a buon fine — conferma status active
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    const subscriptionId = invoice.subscription;
    if (subscriptionId && invoice.billing_reason === 'subscription_cycle') {
      await supabase.from('subscriptions')
        .update({ plan: 'retail', status: 'active', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscriptionId);
    }
  }

  res.status(200).json({ received: true });
}