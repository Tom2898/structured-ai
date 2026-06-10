import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function sanitize(str, maxLen = 20) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLen).replace(/[^\w.^-]/g, '').trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non autenticato.' });

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) return res.status(401).json({ error: 'Token non valido.' });

  // ── Input validation ──────────────────────────────────────────────────────
  const { tickers } = req.body;
  if (!Array.isArray(tickers) || tickers.length === 0) return res.status(400).json({ error: 'Tickers mancanti.' });
  if (tickers.length > 20) return res.status(400).json({ error: 'Troppi tickers.' });

  const safeTickers = tickers.map(t => sanitize(t)).filter(Boolean);
  if (safeTickers.length === 0) return res.status(400).json({ error: 'Tickers non validi.' });

  // ── Prompt ────────────────────────────────────────────────────────────────
  const prompt = `You are a financial data assistant. For each of the following stock/index tickers, find the most recent data from Yahoo Finance, Investing.com, Borsa Italiana, or similar sources:

Tickers: ${safeTickers.join(', ')}

For each ticker return:
- vol1Y: annualised implied volatility for 1-year options (as decimal, e.g. 0.28 for 28%). If IV not available, estimate from 52-week price range: vol ≈ (high - low) / (low × 1.6)
- divYield: trailing 12-month dividend yield (as decimal, e.g. 0.035 for 3.5%). Use 0 if none.
- spot: current or most recent closing price (number only, in local currency)
- name: full official company or index name

Respond ONLY with valid JSON, no markdown, no text outside:
{"marketData":{"<TICKER>":{"vol1Y":0.00,"divYield":0.00,"spot":0.00,"name":"<name>"}}}`;

  // ── Call Anthropic with web search ────────────────────────────────────────
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('retry-after') || '10';
      return res.status(429).json({ error: 'rate_limit', retryAfter: parseInt(retryAfter, 10) });
    }

    const data = await response.json();

    // Extract last text block (after web search tool use)
    const textBlocks = (data.content || []).filter(b => b.type === 'text' && b.text);
    const rawText = textBlocks.length > 0 ? textBlocks[textBlocks.length - 1].text : '';
    const stripped = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = stripped.match(/\{[\s\S]*"marketData"[\s\S]*\}/);

    if (!jsonMatch) {
      console.warn('market-data: no JSON in response:', rawText.slice(0, 200));
      // Return empty market data — generation will fall back to static vol estimates
      return res.status(200).json({ marketData: {} });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch (err) {
    console.error('market-data error:', err.message);
    // Soft fail — generation continues with static estimates
    return res.status(200).json({ marketData: {} });
  }
}
