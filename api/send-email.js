import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // ── Auth: only authenticated users can trigger emails ───────────────────────
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non autenticato.' });

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) return res.status(401).json({ error: 'Token non valido.' });

  // Always send to the verified email, ignore any email in body
  const email = authUser.email;
  const { name, plan } = req.body;

  const planNames = { free: 'Free', retail: 'Retail' };
  const planFeatures = {
    free: '3 proposte/mese · Tutti i 12 prodotti · Export PDF',
    retail: '100 proposte/mese · Tutti i 12 prodotti · Export PDF · Ricerca ISIN Euronext'
  };

  try {
    await resend.emails.send({
      from: 'StructuredAI <onboarding@resend.dev>',
      to: email,
      subject: `Benvenuto su StructuredAI — Piano ${planNames[plan] || 'Free'}`,
      html: '<div style="font-family:monospace;max-width:520px;margin:0 auto;padding:40px 20px"><h2>StructuredAI</h2><p>Ciao ' + (name || '') + ',</p><p>Benvenuto! Il tuo account piano <strong>' + (planNames[plan] || plan) + '</strong> è attivo.</p><p>' + (planFeatures[plan] || '') + '</p><p>© 2025 StructuredAI</p></div>'
    });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('send-email error:', err.message);
    res.status(500).json({ error: err.message });
  }
}