import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Limits (keep in sync with App.jsx PLANS) ─────────────────────────────────
const PLAN_LIMITS = { free: 3, retail: 60, pro: 500 };

// ── Input constraints ─────────────────────────────────────────────────────────
const MAX_PROMPT_CHARS = 8000;
const MAX_UNDERLYINGS  = 20;

// ── Sanitize user-supplied text to prevent prompt injection ───────────────────
function sanitize(str, maxLen = 200) {
  if (typeof str !== 'string') return '';
  return str
    .slice(0, maxLen)
    .replace(/[^\w\s.,;:()\-+%€$@]/g, '') // strip special chars that could inject instructions
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // ── 1. Auth: verify JWT from Authorization header, never trust body ──────────
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return res.status(401).json({ error: 'Non autenticato.' });

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) return res.status(401).json({ error: 'Token non valido.' });

  const email = authUser.email;

  // ── 2. Input validation ──────────────────────────────────────────────────────
  const { prompt, useWebSearch } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt mancante.' });
  }
  if (prompt.length > MAX_PROMPT_CHARS) {
    return res.status(400).json({ error: 'Input troppo lungo.' });
  }

  // ── 3. Usage check server-side (only for proposal generation, not ISIN) ──────
  if (!useWebSearch) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status, usage_count, usage_reset_at')
      .eq('user_id', authUser.id)
      .single();

    const plan = sub?.plan || 'free';
    const status = sub?.status || 'free';
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

    // Treat cancelled/past_due as free limit
    const effectiveLimit = (status === 'active') ? limit : PLAN_LIMITS.free;

    const resetAt = sub?.usage_reset_at ? new Date(sub.usage_reset_at) : new Date(0);
    const now = new Date();
    const isNewMonth = now.getFullYear() > resetAt.getFullYear() ||
      now.getMonth() > resetAt.getMonth();

    const usageCount = isNewMonth ? 0 : (sub?.usage_count || 0);

    if (usageCount >= effectiveLimit) {
      return res.status(429).json({ error: 'Limite mensile raggiunto. Fai upgrade per continuare.' });
    }

    // Increment counter
    await supabase.from('subscriptions').update({
      usage_count: usageCount + 1,
      usage_reset_at: isNewMonth
        ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        : sub.usage_reset_at,
      updated_at: now.toISOString()
    }).eq('user_id', authUser.id);
  }

  // ── 4. ISIN search: only allowed for retail/pro ───────────────────────────────
  if (useWebSearch) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status')
      .eq('user_id', authUser.id)
      .single();

    const plan = sub?.plan || 'free';
    const status = sub?.status || '';
    if (plan === 'free' || status !== 'active') {
      return res.status(403).json({ error: 'Ricerca ISIN disponibile solo per piani Retail e Pro.' });
    }
  }

  // ── 5. Call Anthropic API ─────────────────────────────────────────────────────
  const body = {
    model: 'claude-sonnet-4-5',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  };

  if (useWebSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Generate error:', err.message);
    return res.status(500).json({ error: 'Errore interno. Riprova.' });
  }
}