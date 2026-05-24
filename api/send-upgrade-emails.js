import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const APP_URL = process.env.VITE_APP_URL || 'https://structured-ai-l4gg.vercel.app';

function upgradeEmailHtml(name) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Passa a Retail — StructuredAI</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f4ef;font-family:'Courier New',monospace;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:48px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- LOGO -->
        <tr><td align="center" style="padding-bottom:32px;">
          <table cellpadding="0" cellspacing="0"><tr>
            <td style="background:#1a3a2a;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;font-size:16px;font-weight:500;color:#c8d5b9;">S</td>
            <td style="padding-left:12px;">
              <div style="font-size:15px;font-weight:500;color:#1a3a2a;letter-spacing:-0.3px;">StructuredAI</div>
              <div style="font-size:9px;color:#7a8c7e;letter-spacing:0.12em;margin-top:1px;">AI · PRODOTTI STRUTTURATI</div>
            </td>
          </tr></table>
        </td></tr>

        <!-- CARD -->
        <tr><td style="background:#fff;border-radius:16px;border:1px solid #e0ddd4;padding:48px;box-shadow:0 2px 12px rgba(26,58,42,0.06);">

          <div style="text-align:center;margin-bottom:28px;">
            <div style="font-size:40px;margin-bottom:16px;">📈</div>
            <div style="font-family:Georgia,serif;font-size:24px;font-weight:300;color:#1a3a2a;line-height:1.3;margin-bottom:12px;">
              Ciao ${name || 'utente'},<br/>stai sfruttando StructuredAI?
            </div>
            <div style="font-size:13px;color:#7a8c7e;line-height:1.7;">
              Con il piano <strong>Free</strong> hai accesso a 3 proposte/mese.<br/>
              Passa a <strong>Retail</strong> per fare molto di più.
            </div>
          </div>

          <!-- Confronto piani -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td width="48%" style="background:#f5f4ef;border:1px solid #e0ddd4;border-radius:10px;padding:16px;vertical-align:top;">
                <div style="font-size:10px;color:#a0a89e;letter-spacing:0.1em;margin-bottom:8px;">PIANO ATTUALE</div>
                <div style="font-size:18px;font-weight:500;color:#7a8c7e;margin-bottom:10px;">Free</div>
                <div style="font-size:11px;color:#a0a89e;line-height:1.8;">
                  ✓ 3 proposte/mese<br/>
                  ✓ 12 prodotti<br/>
                  ✓ Export PDF<br/>
                  – Ricerca ISIN<br/>
                  – Storico proposte
                </div>
              </td>
              <td width="4%"></td>
              <td width="48%" style="background:#f5f9f2;border:2px solid #1a3a2a;border-radius:10px;padding:16px;vertical-align:top;">
                <div style="font-size:10px;color:#4a7a5a;letter-spacing:0.1em;margin-bottom:8px;">RETAIL</div>
                <div style="font-size:18px;font-weight:500;color:#1a3a2a;margin-bottom:4px;">€17.90<span style="font-size:12px;font-weight:400;">/mese</span></div>
                <div style="font-size:10px;color:#4a7a5a;margin-bottom:10px;">annuale · risparmia €24/anno</div>
                <div style="font-size:11px;color:#3a5a3a;line-height:1.8;">
                  ✓ 100 proposte/mese<br/>
                  ✓ 12 prodotti<br/>
                  ✓ Export PDF<br/>
                  ✓ Ricerca ISIN Euronext<br/>
                  ✓ Storico proposte
                </div>
              </td>
            </tr>
          </table>

          <div style="text-align:center;margin-bottom:28px;">
            <a href="${APP_URL}" style="display:inline-block;background:#1a3a2a;color:#f5f4ef;font-size:13px;font-weight:500;letter-spacing:0.04em;text-decoration:none;padding:14px 36px;border-radius:8px;">
              Passa a Retail →
            </a>
            <div style="margin-top:10px;font-size:11px;color:#a0a89e;">Puoi cancellare in qualsiasi momento.</div>
          </div>

          <div style="height:1px;background:#e8e5dc;margin-bottom:20px;"></div>
          <div style="font-size:11px;color:#a0a89e;text-align:center;line-height:1.6;">
            Ricevi questa email perché hai un account Free su StructuredAI.<br/>
            Per assistenza: <a href="mailto:structuredai@proton.me" style="color:#7a8c7e;">structuredai@proton.me</a>
          </div>

        </td></tr>

        <!-- FOOTER -->
        <tr><td align="center" style="padding-top:28px;font-size:10px;color:#a0a89e;letter-spacing:0.05em;line-height:1.8;">
          StructuredAI · AI · Prodotti Strutturati<br/>
          I contenuti generati hanno finalità esclusivamente illustrativa. Non costituiscono consulenza finanziaria ai sensi della Direttiva MiFID II.
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).end();

  // ── Verify cron secret to prevent unauthorized calls ────────────────────────
  const authHeader = req.headers['authorization'] || '';
  const secret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!secret || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Non autorizzato.' });
  }

  try {
    // ── Fetch all free users from subscriptions table ────────────────────────
    const { data: freeSubs, error } = await supabase
      .from('subscriptions')
      .select('email, plan')
      .eq('plan', 'free')
      .eq('status', 'free'); // only confirmed free users, not cancelled paid

    if (error) throw error;

    // ── Also get users with no subscription row (registered but never paid) ──
    const { data: { users: allAuthUsers } } = await supabase.auth.admin.listUsers();
    const emailsInSubs = new Set((freeSubs || []).map(s => s.email));

    // Combine: free subs + auth users without any sub row
    const freeEmails = [
      ...(freeSubs || []).map(s => ({ email: s.email })),
      ...allAuthUsers
        .filter(u => u.email && !emailsInSubs.has(u.email))
        .map(u => ({ email: u.email, name: u.user_metadata?.name })),
    ];

    if (freeEmails.length === 0) {
      return res.status(200).json({ sent: 0, message: 'Nessun utente free trovato.' });
    }

    // ── Send emails via Resend ───────────────────────────────────────────────
    let sent = 0;
    let failed = 0;

    for (const { email, name } of freeEmails) {
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'StructuredAI <onboarding@resend.dev>',
            to: email,
            subject: 'Ottieni 100 proposte/mese con StructuredAI Retail',
            html: upgradeEmailHtml(name),
          }),
        });

        if (emailRes.ok) {
          sent++;
        } else {
          const err = await emailRes.text();
          console.error(`Failed to send to ${email}:`, err);
          failed++;
        }

        // Small delay to avoid Resend rate limits
        await new Promise(r => setTimeout(r, 100));

      } catch (e) {
        console.error(`Error sending to ${email}:`, e.message);
        failed++;
      }
    }

    return res.status(200).json({ sent, failed, total: freeEmails.length });

  } catch (err) {
    console.error('send-upgrade-emails error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}