import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Non autenticato.' });

  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authUser) return res.status(401).json({ error: 'Token non valido.' });

  const email = authUser.email;
  const { name } = req.body;

  // ── Plan comes from DB, never from body ──────────────────────────────────────
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', authUser.id)
    .single();

  const plan = sub?.plan || 'free';
  const ALLOWED_PLANS = ['free', 'retail', 'pro'];
  const safePlan = ALLOWED_PLANS.includes(plan) ? plan : 'free';
  const safeName = typeof name === 'string' ? name.slice(0, 100).replace(/[<>]/g, '') : '';

  const planNames = { free: 'Free', retail: 'Retail' };

  const planFeatures = {
    free: [
      '3 proposte / mese',
      'Tutti i 12 prodotti strutturati',
      'Export PDF',
      'Caratteristiche del sottostante',
    ],
    retail: [
      '100 proposte / mese',
      'Tutti i 12 prodotti strutturati',
      'Export PDF',
      'Caratteristiche del sottostante',
      'Ricerca ISIN Euronext reali',
    ],
  };

  const planLabel = planNames[safePlan] || 'Free';
  const features = planFeatures[safePlan] || planFeatures.free;
  const featuresHtml = features
    .map(f => `
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #ede9e0;font-size:13px;color:#1a1a18;">
          <span style="display:inline-block;width:20px;color:#1a3a2a;font-weight:bold;">✓</span>${f}
        </td>
      </tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f7f5f0;font-family:'Courier New',Courier,monospace;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f0;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;border:1px solid rgba(0,0,0,0.09);overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:#1a3a2a;padding:32px 40px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="width:36px;height:36px;border:1.5px solid rgba(255,255,255,0.4);border-radius:8px;text-align:center;vertical-align:middle;">
                  <span style="color:#fff;font-size:18px;font-family:Georgia,serif;">S</span>
                </td>
                <td style="padding-left:10px;">
                  <span style="color:#fff;font-size:20px;font-family:Georgia,serif;font-weight:400;letter-spacing:0.02em;">StructuredAI</span>
                </td>
              </tr>
            </table>
            <p style="color:rgba(255,255,255,0.55);font-size:11px;letter-spacing:0.1em;margin:16px 0 0;">AI · PRODOTTI STRUTTURATI</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px 40px 32px;">
            <p style="font-size:11px;letter-spacing:0.1em;color:#1a3a2a;margin:0 0 12px;">BENVENUTO</p>
            <h1 style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#1a1a18;margin:0 0 16px;line-height:1.3;">
              Ciao ${safeName || 'utente'},<br><em style="font-style:italic;color:#2d5c40;">il tuo account è attivo.</em>
            </h1>
            <p style="font-size:13px;color:#6b6b65;line-height:1.8;margin:0 0 32px;">
              Sei ora su <strong style="color:#1a1a18;">StructuredAI</strong> con il piano <strong style="color:#1a3a2a;">${planLabel}</strong>. Puoi già iniziare a generare proposte strutturate per i tuoi clienti.
            </p>

            <!-- Plan box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f0;border-radius:10px;border:1px solid rgba(0,0,0,0.09);margin-bottom:32px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="font-size:10px;letter-spacing:0.1em;color:#6b6b65;margin:0 0 4px;">PIANO ATTIVO</p>
                  <p style="font-size:20px;font-family:Georgia,serif;color:#1a1a18;margin:0 0 16px;">${planLabel}</p>
                  <table width="100%" cellpadding="0" cellspacing="0">
                    ${featuresHtml}
                  </table>
                </td>
              </tr>
            </table>

            <!-- CTA -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:#1a3a2a;border-radius:8px;">
                  <a href="https://www.structuredai.live" style="display:inline-block;padding:12px 28px;color:#fff;font-size:13px;text-decoration:none;letter-spacing:0.04em;">
                    Accedi alla piattaforma →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 40px;border-top:1px solid rgba(0,0,0,0.07);">
            <p style="font-size:10px;color:#6b6b65;line-height:1.7;margin:0;">
              © 2025 StructuredAI · Uso esclusivo dell'intermediario finanziario destinatario.<br>
              Le proposte non costituiscono consulenza finanziaria ai sensi MiFID II.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: 'StructuredAI <support@structuredai.live>',
      to: email,
      subject: `Benvenuto su StructuredAI — Piano ${planLabel}`,
      html,
    });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('send-email error:', err.message);
    res.status(500).json({ error: err.message });
  }
}