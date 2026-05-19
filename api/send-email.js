import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, name, plan } = req.body;

  const planNames = {
    free: 'Free',
    retail: 'Retail'
  };

  const planFeatures = {
    free: '3 proposte/mese · Tutti i 12 prodotti · Export PDF',
    retail: '20 proposte/mese · Tutti i 12 prodotti · Export PDF · Ricerca ISIN Euronext'
  };

  try {
    await resend.emails.send({
      from: 'StructuredAI <onboarding@resend.dev>',
      to: email,
      subject: `Benvenuto su StructuredAI — Piano ${planNames[plan] || plan}`,
      html: `
        <div style="font-family: monospace; max-width: 520px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
          <div style="font-size: 22px; font-weight: bold; margin-bottom: 8px;">StructuredAI</div>
          <div style="font-size: 11px; color: #888; letter-spacing: 0.1em; margin-bottom: 32px;">AI · PRODOTTI STRUTTURATI</div>
          
          <p style="font-size: 15px;">Ciao ${name},</p>
          <p style="font-size: 14px; color: #444; line-height: 1.6;">
            Benvenuto su StructuredAI! Il tuo account è stato creato con successo.
          </p>

          <div style="background: #f5f5f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <div style="font-size: 11px; color: #888; letter-spacing: 0.08em; margin-bottom: 8px;">IL TUO PIANO</div>
            <div style="font-size: 18px; font-weight: bold; margin-bottom: 6px;">${planNames[plan] || plan}</div>
            <div style="font-size: 12px; color: #666;">${planFeatures[plan] || ''}</div>
          </div>

          <p style="font-size: 14px; color: #444; line-height: 1.6;">
            Accedi ora e inizia a generare proposte strutturate per i tuoi clienti.
          </p>

          <a href="${process.env.VITE_APP_URL}" 
             style="display: inline-block; background: #1a3a2a; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-size: 13px; margin-top: 8px;">
            Accedi a StructuredAI →
          </a>

          <p style="font-size: 11px; color: #aaa; margin-top: 40px; border-top: 1px solid #eee; padding-top: 20px;">
            © 2025 StructuredAI · Solo a scopo informativo · Non costituisce consulenza finanziaria
          </p>
        </div>
      `
    });

    res.status(200).json({ success: true });
} catch (err) {
    res.status(500).json({ error: err.message });
  }
}