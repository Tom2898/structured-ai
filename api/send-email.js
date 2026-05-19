import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, name, plan } = req.body;

  const planNames = { free: 'Free', retail: 'Retail' };
  const planFeatures = {
    free: '3 proposte/mese · Tutti i 12 prodotti · Export PDF',
    retail: '20 proposte/mese · Tutti i 12 prodotti · Export PDF · Ricerca ISIN Euronext'
  };

  try {
    await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: `Benvenuto su StructuredAI — Piano ${planNames[plan] || plan}`,
      html: '<div style="font-family:monospace;max-width:520px;margin:0 auto;padding:40px 20px"><h2>StructuredAI</h2><p>Ciao ' + name + ',</p><p>Benvenuto! Il tuo account piano <strong>' + (planNames[plan] || plan) + '</strong> è attivo.</p><p>' + (planFeatures[plan] || '') + '</p><p>© 2025 StructuredAI</p></div>'
    });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}