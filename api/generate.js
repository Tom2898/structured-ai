import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Limits (keep in sync with App.jsx PLANS) ─────────────────────────────────
const PLAN_LIMITS = { free: 3, retail: 20, pro: 300 };

// ── Turnstile verification ────────────────────────────────────────────────────
async function verifyTurnstile(token, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) { console.warn('TURNSTILE_SECRET_KEY not set'); return true; }
  if (!token) return false;
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ secret, response: token, ...(ip ? { remoteip: ip } : {}) }),
  });
  const data = await res.json();
  return data.success === true;
}

// ── Input constraints ─────────────────────────────────────────────────────────
const MAX_PROMPT_CHARS = 16000;
const MAX_UNDERLYINGS  = 20;

// ── Sanitize user-supplied text to prevent prompt injection ───────────────────
function sanitize(str, maxLen = 200) {
  if (typeof str !== 'string') return '';
  return str
    .slice(0, maxLen)
    .replace(/[^\w\s.,;:()\-+%€$@]/g, '')
    .trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // ── 1. Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non autenticato.' });

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) return res.status(401).json({ error: 'Token non valido.' });

  const email = authUser.email;

  // ── 1b. Turnstile ────────────────────────────────────────────────────────────
  const turnstileToken = req.headers['x-turnstile-token'] || '';
  const clientIp = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '';
  const turnstileOk = await verifyTurnstile(turnstileToken, clientIp);
  // Only block if Turnstile is configured AND verification fails with a non-empty token
  // If token is empty but user is authenticated via JWT, let it through
  if (!turnstileOk && turnstileToken) {
    return res.status(403).json({ error: 'Verifica di sicurezza fallita. Ricarica la pagina e riprova.' });
  }

  // ── 2. Input validation ──────────────────────────────────────────────────────
  const { prompt, useWebSearch, skipUsage } = req.body;
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Prompt mancante.' });
  if (prompt.length > MAX_PROMPT_CHARS) return res.status(400).json({ error: 'Input troppo lungo.' });

  // ── 3. Usage check (proposals only) ─────────────────────────────────────────
  if (!useWebSearch && !skipUsage) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status, usage_count, usage_reset_at')
      .eq('user_id', authUser.id)
      .single();

    const plan = sub?.plan || 'free';
    const status = sub?.status || 'free';
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
    const effectiveLimit = (status === 'active') ? limit : PLAN_LIMITS.free;
    const resetAt = sub?.usage_reset_at ? new Date(sub.usage_reset_at) : new Date(0);
    const now = new Date();
    const isNewMonth = now.getFullYear() > resetAt.getFullYear() || now.getMonth() > resetAt.getMonth();
    const usageCount = isNewMonth ? 0 : (sub?.usage_count || 0);

    if (usageCount >= effectiveLimit) {
      return res.status(429).json({ error: 'Limite mensile raggiunto. Fai upgrade per continuare.' });
    }

    await supabase.from('subscriptions').update({
      usage_count: usageCount + 1,
      usage_reset_at: isNewMonth ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString() : sub.usage_reset_at,
      updated_at: now.toISOString()
    }).eq('user_id', authUser.id);
  }

  // ── 4. ISIN search checks ────────────────────────────────────────────────────
  if (useWebSearch) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, status, isin_analysis_count, isin_analysis_reset_at, isin_last_search_at')
      .eq('user_id', authUser.id)
      .single();

    const plan = sub?.plan || 'free';
    const status = sub?.status || '';
    if (plan === 'free' || status !== 'active') {
      return res.status(403).json({ error: 'Ricerca ISIN disponibile solo per piani Retail e Pro.' });
    }

    // Per-user cooldown via Supabase (works across Vercel serverless instances)
    const lastSearchAt = sub?.isin_last_search_at ? new Date(sub.isin_last_search_at).getTime() : 0;
    const secondsSinceLast = (Date.now() - lastSearchAt) / 1000;
    if (secondsSinceLast < 3) {
      return res.status(429).json({ error: 'rate_limit', retryAfter: Math.ceil(3 - secondsSinceLast) });
    }
    // Update last search timestamp immediately
    await supabase.from('subscriptions').update({ isin_last_search_at: new Date().toISOString() }).eq('user_id', authUser.id);

    if (plan === 'retail') {
      const now2 = new Date();
      const resetAt = sub?.isin_analysis_reset_at ? new Date(sub.isin_analysis_reset_at) : new Date(0);
      const isNewMonth = now2.getFullYear() > resetAt.getFullYear() || now2.getMonth() > resetAt.getMonth();
      const count = isNewMonth ? 0 : (sub?.isin_analysis_count || 0);

      if (count >= 5) {
        return res.status(429).json({ error: 'Hai esaurito le 5 analisi ISIN disponibili questo mese. Rinnovo il mese prossimo.' });
      }

      await supabase.from('subscriptions').update({
        isin_analysis_count: count + 1,
        isin_analysis_reset_at: isNewMonth ? new Date(now2.getFullYear(), now2.getMonth(), 1).toISOString() : sub.isin_analysis_reset_at,
        updated_at: now2.toISOString()
      }).eq('user_id', authUser.id);
    }
  }

  // ── 5. Call Anthropic ────────────────────────────────────────────────────────
  const body = {
    model: 'claude-sonnet-4-5',
    // Web search needs less output tokens — ISIN JSON is compact; lower limit reduces TPM usage
    max_tokens: useWebSearch ? 2500 : 2000,
    messages: [{ role: 'user', content: prompt }],
  };
  if (useWebSearch) {
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
  }

  const MAX_RETRIES = 3;
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  try {
    let lastData;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      lastData = await response.json();

      if (response.status !== 429) {
        return res.status(response.status).json(lastData);
      }

      // Anthropic 429 — backoff and retry
      const retryAfterHeader = response.headers.get('retry-after');
      const waitMs = retryAfterHeader
        ? parseInt(retryAfterHeader, 10) * 1000
        : (attempt + 1) * 10000; // 10s, 20s, 30s
      console.warn(`Anthropic 429 (attempt ${attempt + 1}/${MAX_RETRIES}), waiting ${waitMs}ms`);
      if (attempt < MAX_RETRIES - 1) await sleep(waitMs);
    }

    // All retries exhausted — propagate 429 to client
    const retryAfter = lastData?.error?.message?.match(/try again in (\d+)/)?.[1] || '30';
    return res.status(429).json({ error: 'rate_limit', retryAfter: parseInt(retryAfter, 10) });

  } catch (err) {
    console.error('Generate error:', err.message);
    return res.status(500).json({ error: 'Errore interno. Riprova.' });
  }
}
