import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Whitelist of valid price IDs
const ALLOWED_PRICE_IDS = new Set([
  'price_1TbRXCQk0TtLlDLRAIVkTBeo', // Retail mensile
  'price_1TcCMWQk0TtLlDLRWgbXviCl', // Retail annuale
]);

// ── In-memory rate limiter (per IP, max 5 requests/10 min) ───────────────────
const rateLimitMap = new Map();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  if (entry.count >= RATE_LIMIT) return true;
  entry.count++;
  rateLimitMap.set(ip, entry);
  return false;
}

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGIN = process.env.VITE_APP_URL || 'https://www.structuredai.live';

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (origin === ALLOWED_ORIGIN || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // ── Rate limiting ────────────────────────────────────────────────────────────
  const ip = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Troppe richieste. Riprova tra qualche minuto.' });
  }

  // ── Auth: verify JWT — email always from token, never from body ──────────────
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non autenticato.' });

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) return res.status(401).json({ error: 'Token non valido.' });

  // ── Validate priceId ─────────────────────────────────────────────────────────
  const { priceId } = req.body;
  if (!priceId) return res.status(400).json({ error: 'priceId mancante' });
  if (!ALLOWED_PRICE_IDS.has(priceId)) {
    return res.status(400).json({ error: 'Piano non valido.' });
  }

  // ── Check no active paid subscription already ───────────────────────────────
  const { data: existingSub } = await supabase
    .from('subscriptions')
    .select('status, plan')
    .eq('user_id', authUser.id)
    .single();

  if (existingSub?.status === 'active' && existingSub?.plan !== 'free') {
    return res.status(400).json({ error: 'Hai già un abbonamento attivo.' });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const appUrl = process.env.VITE_APP_URL || req.headers.origin || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: authUser.email,
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
