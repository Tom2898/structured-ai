export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { isin } = req.body;
  if (!isin) return res.status(400).json({ error: 'ISIN mancante.' });

  try {
    const prompt = `Cerca online il certificato strutturato con ISIN ${isin} su certificatiederivati.it, simpletoolsforinvestors.eu, o altre fonti italiane specializzate in certificati.

Estrai e restituisci SOLO questo JSON, nessun testo fuori:
{
  "scheda": "<testo con: nome prodotto, emittente, tipo prodotto, sottostanti con ticker e strike, data emissione, data scadenza, valore nominale>",
  "barriere": "<testo con: livello barriera capitale (% e valore assoluto), livello barriera cedola se presente, tipo barriera europea/americana>",
  "rilevamento": "<testo con: date di osservazione cedole, importo cedola per periodo, eventuale memoria cedola, date autocall e livello autocall>"
}

Se non trovi dati su una sezione specifica scrivi "Non disponibile" per quel campo.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      }),
    });

    const data = await response.json();
    const textBlocks = (data.content || []).filter(b => b.type === 'text' && b.text);
    const rawText = textBlocks.length > 0 ? textBlocks[textBlocks.length - 1].text : '';
    const stripped = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const jsonMatch = stripped.match(/\{[\s\S]*"scheda"[\s\S]*\}/);
    if (!jsonMatch) return res.status(200).json({ error: 'Dati non trovati.' });

    return res.status(200).json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    console.error('CED error:', err.message);
    return res.status(500).json({ error: 'Errore nel recupero dati CED.' });
  }
}
