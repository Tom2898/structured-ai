export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { isin } = req.body;
  if (!isin) return res.status(400).json({ error: 'ISIN mancante.' });
  try {
    const response = await fetch('https://api.openfigi.com/v3/mapping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ idType: 'ID_ISIN', idValue: isin }]),
    });
    const data = await response.json();
    const result = data?.[0]?.data?.[0];
    if (!result) return res.status(200).json({ error: 'Non trovato.' });
    return res.status(200).json({
      name: result.name,
      exchCode: result.exchCode,
      securityType: result.securityType,
      securityType2: result.securityType2,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Errore OpenFIGI.' });
  }
}
