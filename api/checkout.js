import Stripe from 'stripe';

// Whitelist of valid price IDs — prevents passing arbitrary Stripe prices
const ALLOWED_PRICE_IDS = new Set([
  'price_1TbRXCQk0TtLlDLRAIVkTBeo', // Retail mensile
  'price_1TbRXiQk0TtLlDLRuRYpb1ho', // Retail annuale
]);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const { priceId, email } = req.body;

  if (!priceId) return res.status(400).json({ error: 'priceId mancante' });

  // ── Validate priceId against whitelist ───────────────────────────────────────
  if (!ALLOWED_PRICE_IDS.has(priceId)) {
    return res.status(400).json({ error: 'Piano non valido.' });
  }

  try {
    const appUrl = process.env.VITE_APP_URL
      || (req.headers.origin)
      || 'http://localhost:5173';

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


