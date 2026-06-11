export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { isin } = req.body;
  if (!isin) return res.status(400).json({ error: 'ISIN mancante.' });

  try {
    const url = `https://www.certificatiederivati.it/db_bs_scheda_certificato.asp?isin=${encodeURIComponent(isin)}`;
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'it-IT,it;q=0.9',
      }
    });

    if (!pageRes.ok) return res.status(200).json({ error: 'Pagina non raggiungibile.' });
    const html = await pageRes.text();

    // Extract table rows as key-value pairs
    function extractTablePairs(html) {
      const rows = [];
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let trMatch;
      while ((trMatch = trRegex.exec(html)) !== null) {
        const cells = [];
        const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let tdMatch;
        while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
          const text = tdMatch[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
          if (text) cells.push(text);
        }
        if (cells.length >= 2) rows.push(cells.join(': '));
        else if (cells.length === 1 && cells[0].length > 2) rows.push(cells[0]);
      }
      return rows;
    }

    const rows = extractTablePairs(html);
    const fullText = rows.join('\n');

    // Extract underlyings section specifically
    const underlyingsMatch = html.match(/Scheda Sottostante[\s\S]*?<\/table>/i);
    let underlyingsText = '';
    if (underlyingsMatch) {
      underlyingsText = underlyingsMatch[0].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Extract product type (h3 tags)
    const h3Matches = [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)];
    const productType = h3Matches.map(m => m[1].replace(/<[^>]+>/g,'').trim()).filter(Boolean).join(' - ');

    const scheda = [productType, fullText.slice(0, 3000)].filter(Boolean).join('\n');

    return res.status(200).json({
      scheda: scheda || 'Non disponibile',
      barriere: 'Dato caricato dinamicamente - vedi analisi AI',
      rilevamento: 'Dato caricato dinamicamente - vedi analisi AI',
      source: url,
    });

  } catch (err) {
    console.error('CED scrape error:', err.message);
    return res.status(500).json({ error: 'Errore scraping CED.' });
  }
}
