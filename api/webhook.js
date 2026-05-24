import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: false } };

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// ── EMAIL HELPERS ─────────────────────────────────────────────────────────────

const PLAN_LABELS = { free: 'Free', retail: 'Retail', pro: 'Pro', unlimited: 'Unlimited' };
const PLAN_PRICES = { free: '€0/mese', retail: '€19.90/mese', pro: '€49/mese', unlimited: '€199/mese' };
const PLAN_FEATURES = {
  retail: ['50 proposte/mese', 'Tutti i 12 prodotti', 'Export PDF', 'Ricerca ISIN Euronext reali'],
  pro:    ['100 proposte/mese', 'Tutti i 12 prodotti', 'Export PDF con brand', 'Storico proposte', 'Ricerca ISIN Euronext', 'Confronto affiancato'],
  free:   ['3 proposte/mese', 'Accesso base ai prodotti'],
};

function emailShell({ title, preheader, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f4ef;font-family:'Courier New',monospace;">
  <div style="display:none;max-height:0;overflow:hidden;color:#f5f4ef;">${preheader}</div>
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
          ${bodyHtml}
        </td></tr>

        <!-- FOOTER -->
        <tr><td align="center" style="padding-top:28px;font-size:10px;color:#a0a89e;letter-spacing:0.05em;line-height:1.8;">
          StructuredAI · AI · Prodotti Strutturati<br/>
          I contenuti generati hanno finalità esclusivamente illustrativa. Non costituiscono consulenza finanziaria ai sensi della Direttiva MiFID II.<br/>
          <a href="mailto:structuredai@proton.me" style="color:#a0a89e;">structuredai@proton.me</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function featuresHtml(plan) {
  const features = PLAN_FEATURES[plan] || [];
  return features.map(f =>
    `<tr><td style="padding:6px 0;font-size:12px;color:#3a5a3a;border-bottom:1px solid #f0ede6;">✓ &nbsp;${f}</td></tr>`
  ).join('');
}

function welcomeEmail(email, plan) {
  const planLabel = PLAN_LABELS[plan] || plan;
  const planPrice = PLAN_PRICES[plan] || '';
  const appUrl = process.env.VITE_APP_URL || 'https://structured-ai-l4gg.vercel.app';

  const bodyHtml = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:40px;margin-bottom:16px;">🎉</div>
      <div style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#1a3a2a;line-height:1.2;margin-bottom:12px;">Benvenuto su StructuredAI</div>
      <div style="font-size:13px;color:#7a8c7e;line-height:1.6;">Il tuo account è attivo. Inizia a generare proposte strutturate per i tuoi clienti.</div>
    </div>

    <div style="background:#f5f9f2;border:1px solid #c8dfc0;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
      <div style="font-size:10px;color:#7a8c7e;letter-spacing:0.1em;margin-bottom:8px;">PIANO ATTIVO</div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <span style="font-size:20px;font-weight:500;color:#1a3a2a;">${planLabel}</span>
        <span style="font-size:13px;color:#4a7a5a;font-weight:500;">${planPrice}</span>
      </div>
      ${plan !== 'free' ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:14px;">${featuresHtml(plan)}</table>` : ''}
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${appUrl}" style="display:inline-block;background:#1a3a2a;color:#f5f4ef;font-size:13px;font-weight:500;letter-spacing:0.04em;text-decoration:none;padding:14px 36px;border-radius:8px;">Accedi alla piattaforma →</a>
    </div>

    <div style="height:1px;background:#e8e5dc;margin-bottom:20px;"></div>
    <div style="font-size:11px;color:#a0a89e;text-align:center;line-height:1.6;">
      Hai ricevuto questa email perché hai creato un account su StructuredAI.<br/>
      Se non sei stato tu, ignora questa email.
    </div>`;

  return {
    subject: `Benvenuto su StructuredAI — Piano ${planLabel} attivo`,
    html: emailShell({ title: `Benvenuto su StructuredAI`, preheader: `Il tuo piano ${planLabel} è attivo. Inizia subito.`, bodyHtml }),
  };
}

function planChangeEmail(email, oldPlan, newPlan) {
  const oldLabel = PLAN_LABELS[oldPlan] || oldPlan;
  const newLabel = PLAN_LABELS[newPlan] || newPlan;
  const newPrice = PLAN_PRICES[newPlan] || '';
  const isUpgrade = ['free','retail','pro'].indexOf(oldPlan) < ['retail','pro','unlimited'].indexOf(newPlan);
  const appUrl = process.env.VITE_APP_URL || 'https://structured-ai-l4gg.vercel.app';

  const bodyHtml = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:40px;margin-bottom:16px;">${isUpgrade ? '⬆️' : '⬇️'}</div>
      <div style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#1a3a2a;line-height:1.2;margin-bottom:12px;">
        Piano ${isUpgrade ? 'aggiornato' : 'modificato'}
      </div>
      <div style="font-size:13px;color:#7a8c7e;line-height:1.6;">
        Il tuo piano StructuredAI è stato modificato con successo.
      </div>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:28px;justify-content:center;align-items:center;">
      <div style="flex:1;background:#f5f4ef;border:1px solid #e0ddd4;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:10px;color:#a0a89e;letter-spacing:0.1em;margin-bottom:6px;">PRECEDENTE</div>
        <div style="font-size:16px;color:#7a8c7e;font-weight:500;text-decoration:line-through;">${oldLabel}</div>
      </div>
      <div style="font-size:20px;color:#c8d5b9;">→</div>
      <div style="flex:1;background:#f5f9f2;border:1px solid #c8dfc0;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:10px;color:#4a7a5a;letter-spacing:0.1em;margin-bottom:6px;">NUOVO</div>
        <div style="font-size:16px;color:#1a3a2a;font-weight:500;">${newLabel}</div>
        <div style="font-size:11px;color:#4a7a5a;margin-top:2px;">${newPrice}</div>
      </div>
    </div>

    ${newPlan !== 'free' ? `
    <div style="background:#f5f9f2;border:1px solid #c8dfc0;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
      <div style="font-size:10px;color:#7a8c7e;letter-spacing:0.1em;margin-bottom:10px;">FUNZIONALITÀ INCLUSE</div>
      <table width="100%" cellpadding="0" cellspacing="0">${featuresHtml(newPlan)}</table>
    </div>` : `
    <div style="background:#fff8f0;border:1px solid #fcd9a0;border-radius:10px;padding:16px 20px;margin-bottom:28px;font-size:12px;color:#7a5a20;line-height:1.6;">
      Il tuo accesso Retail rimarrà attivo fino alla fine del periodo già pagato, dopodiché passerai automaticamente al piano Free.
    </div>`}

    <div style="text-align:center;margin-bottom:28px;">
      <a href="${appUrl}" style="display:inline-block;background:#1a3a2a;color:#f5f4ef;font-size:13px;font-weight:500;letter-spacing:0.04em;text-decoration:none;padding:14px 36px;border-radius:8px;">Vai alla piattaforma →</a>
    </div>

    <div style="height:1px;background:#e8e5dc;margin-bottom:20px;"></div>
    <div style="font-size:11px;color:#a0a89e;text-align:center;line-height:1.6;">
      Se non hai richiesto questa modifica, contatta subito <a href="mailto:structuredai@proton.me" style="color:#7a8c7e;">structuredai@proton.me</a>
    </div>`;

  return {
    subject: `Piano ${isUpgrade ? 'aggiornato' : 'modificato'}: ${oldLabel} → ${newLabel}`,
    html: emailShell({ title: `Modifica piano StructuredAI`, preheader: `Il tuo piano è passato da ${oldLabel} a ${newLabel}.`, bodyHtml }),
  };
}


function switchToAnnualEmail(email) {
  const appUrl = process.env.VITE_APP_URL || 'https://structured-ai-l4gg.vercel.app';
  const bodyHtml = `
    <div style="text-align:center;margin-bottom:28px;">
      <div style="font-size:40px;margin-bottom:16px;">🗓️</div>
      <div style="font-family:Georgia,serif;font-size:26px;font-weight:300;color:#1a3a2a;line-height:1.2;margin-bottom:12px;">Sei passato al piano annuale</div>
      <div style="font-size:13px;color:#7a8c7e;line-height:1.6;">Il tuo abbonamento Retail è ora fatturato annualmente.</div>
    </div>
    <div style="background:#f5f9f2;border:1px solid #c8dfc0;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
      <div style="font-size:10px;color:#7a8c7e;letter-spacing:0.1em;margin-bottom:10px;">RIEPILOGO</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:6px 0;font-size:12px;color:#3a5a3a;border-bottom:1px solid #f0ede6;">✓ &nbsp;€17.90/mese (€214.80/anno)</td></tr>
        <tr><td style="padding:6px 0;font-size:12px;color:#3a5a3a;border-bottom:1px solid #f0ede6;">✓ &nbsp;Risparmio di €24 rispetto al mensile</td></tr>
        <tr><td style="padding:6px 0;font-size:12px;color:#3a5a3a;">✓ &nbsp;La differenza pro-rata è già stata addebitata</td></tr>
      </table>
    </div>
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${appUrl}" style="display:inline-block;background:#1a3a2a;color:#f5f4ef;font-size:13px;font-weight:500;letter-spacing:0.04em;text-decoration:none;padding:14px 36px;border-radius:8px;">Vai alla piattaforma →</a>
    </div>
    <div style="height:1px;background:#e8e5dc;margin-bottom:20px;"></div>
    <div style="font-size:11px;color:#a0a89e;text-align:center;line-height:1.6;">
      Se non hai richiesto questa modifica, contatta <a href="mailto:structuredai@proton.me" style="color:#7a8c7e;">structuredai@proton.me</a>
    </div>`;
  return {
    subject: 'Abbonamento Retail aggiornato al piano annuale',
    html: emailShell({ title: 'Piano annuale attivo', preheader: 'Ora risparmi €24/anno con il piano annuale.', bodyHtml }),
  };
}

async function sendEmail(to, { subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'StructuredAI <onboarding@resend.dev>',
      to,
      subject,
      html,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error('Resend error:', err);
  }
}

// ── WEBHOOK HANDLER ───────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature error:', err.message);
    return res.status(400).json({ error: err.message });
  }

  // Nuovo abbonamento completato
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email || session.customer_details?.email;
    const subscriptionId = session.subscription;
    const customerId = session.customer;

    // Fetch subscription to get billing interval
    let billingInterval = 'month';
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      billingInterval = sub.items.data[0]?.plan?.interval || 'month';
    } catch(e) { console.error('Sub fetch error:', e.message); }

    const { error } = await supabase.from('subscriptions').upsert({
      email,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      plan: 'retail',
      status: 'active',
      billing_interval: billingInterval,
      updated_at: new Date().toISOString()
    }, { onConflict: 'email' });

    if (error) console.error('Supabase upsert error:', error.message);

    // Email di benvenuto con piano
    if (email) await sendEmail(email, welcomeEmail(email, 'retail'));
  }

  // Abbonamento cancellato (disdetta o fallimento definitivo)
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;

    // Recupera email dal customer Stripe
    let email = null;
    try {
      const customer = await stripe.customers.retrieve(subscription.customer);
      email = customer.email;
    } catch(e) { console.error('Customer fetch error:', e.message); }

    await supabase.from('subscriptions')
      .update({ plan: 'free', status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subscription.id);

    if (email) await sendEmail(email, planChangeEmail(email, 'retail', 'free'));
  }

  // Stato abbonamento aggiornato (es. past_due → active, disdetta, upgrade/downgrade)
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object;
    const status = subscription.status;
    const cancelAtPeriodEnd = subscription.cancel_at_period_end === true;
    const cancelAt = subscription.cancel_at || null; // unix timestamp

    // Se status è active ma cancel_at_period_end è true → l'utente ha disdetto
    // Il piano rimane attivo fino a cancel_at, ma lo segnaliamo nel DB
    const newPlan = status === 'active' ? 'retail' : 'free';
    const previousCancelAtPeriodEnd = subscription.previous_attributes?.cancel_at_period_end;
    const previousStatus = subscription.previous_attributes?.status;

    // Detect billing interval from subscription items
    const interval = subscription.items?.data?.[0]?.plan?.interval || 'month';
    const previousInterval = subscription.previous_attributes?.items?.data?.[0]?.plan?.interval;

    await supabase.from('subscriptions')
      .update({
        plan: newPlan,
        status,
        cancel_at_period_end: cancelAtPeriodEnd,
        cancel_at: cancelAt ? new Date(cancelAt * 1000).toISOString() : null,
        billing_interval: interval,
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscription.id);

    // Send email if user just switched from monthly to annual
    if (interval === 'year' && previousInterval === 'month') {
      let email = null;
      try {
        const customer = await stripe.customers.retrieve(subscription.customer);
        email = customer.email;
      } catch(e) { console.error('Customer fetch error:', e.message); }
      if (email) await sendEmail(email, switchToAnnualEmail(email));
    }

    // Invia email se l'utente ha appena disdetto (cancel_at_period_end è diventato true)
    if (cancelAtPeriodEnd && previousCancelAtPeriodEnd === false) {
      let email = null;
      try {
        const customer = await stripe.customers.retrieve(subscription.customer);
        email = customer.email;
      } catch(e) { console.error('Customer fetch error:', e.message); }

      if (email) await sendEmail(email, planChangeEmail(email, 'retail', 'free'));
    }

    // Invia email se lo status è cambiato (es. past_due → active)
    if (previousStatus && previousStatus !== status && !cancelAtPeriodEnd) {
      let email = null;
      try {
        const customer = await stripe.customers.retrieve(subscription.customer);
        email = customer.email;
      } catch(e) { console.error('Customer fetch error:', e.message); }

      const oldPlan = previousStatus === 'active' ? 'retail' : 'free';
      if (email && oldPlan !== newPlan) {
        await sendEmail(email, planChangeEmail(email, oldPlan, newPlan));
      }
    }
  }

  // Pagamento rinnovo fallito
  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    const subscriptionId = invoice.subscription;
    if (subscriptionId) {
      await supabase.from('subscriptions')
        .update({ status: 'past_due', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscriptionId);
    }
  }

  // Rinnovo andato a buon fine
  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object;
    const subscriptionId = invoice.subscription;
    if (subscriptionId && invoice.billing_reason === 'subscription_cycle') {
      await supabase.from('subscriptions')
        .update({ plan: 'retail', status: 'active', updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscriptionId);
    }
  }

  res.status(200).json({ received: true });
}