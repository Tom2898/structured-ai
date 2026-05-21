import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLAN_LIMITS = { free: 3, retail: 50, pro: 100, unlimited: Infinity };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt, useWebSearch, email } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt mancante.' });

  // Check and increment usage if email provided (not for ISIN search)
  if (email && !useWebSearch) {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan, usage_count, usage_reset_at')
      .eq('email', email)
      .single();

    const plan = sub?.plan || 'free';
    const limit = PLAN_LIMITS[plan] ?? 3;

    if (limit !== Infinity) {
      // Reset counter if new month
      const resetAt = sub?.usage_reset_at ? new Date(sub.usage_reset_at) : new Date(0);
      const now = new Date();
      const isNewMonth = now.getFullYear() > resetAt.getFullYear() ||
        now.getMonth() > resetAt.getMonth();

      let usageCount = isNewMonth ? 0 : (sub?.usage_count || 0);

      if (usageCount >= limit) {
        return res.status(429).json({ error: 'Limite mensile raggiunto. Fai upgrade per continuare.' });
      }

      // Increment counter
      await supabase.from('subscriptions').update({
        usage_count: usageCount + 1,
        usage_reset_at: isNewMonth ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString() : sub.usage_reset_at,
        updated_at: now.toISOString()
      }).eq('email', email);
    }
  }

  const body = {
    model: 'claude-sonnet-4-20250514',
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
        'anthropic-beta': 'claude-ai-artifact-api-2025-04-25',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('Generate error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}