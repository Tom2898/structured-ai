import Stripe from 'stripe';

export default async function handler(req, res) {
  // Allow CORS preflight if needed
  if (req.method !== 'POST') return res.status(405).end();

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY non configurata.' });
  }

  const appUrl = process.env.VITE_APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://your-app.vercel.app';

  const stripe = new Stripe(stripeKey);
  const { priceId, email } = req.body;

  if (!priceId) {
    return res.status(400).json({ error: 'priceId mancante.' });
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: email || undefined,
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