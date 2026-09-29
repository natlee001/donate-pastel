export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const code = String(req.query?.code || '').trim().toUpperCase();

    if (!/^DN[A-Z0-9]{6}$/.test(code)) {
      return res.status(400).json({ ok: false, error: 'invalid_code' });
    }

    const base = process.env.SHEETS_WEBAPP_URL;
    const secret = process.env.SHEETS_SECRET;

    if (!base || !secret) {
      return res.status(500).json({ ok: false, error: 'server_not_configured' });
    }

    const url =
      base +
      '?token=' + encodeURIComponent(secret) +
      '&action=status&code=' + encodeURIComponent(code) +
      '&ts=' + Date.now();

    const upstream = await fetch(url, { method: 'GET', cache: 'no-store' });
    const text = await upstream.text();

    res.setHeader('Cache-Control', 'no-store');

    try {
      return res.status(upstream.status).json(JSON.parse(text));
    } catch {
      return res.status(upstream.status).send(text);
    }
  } catch (error) {
    console.error('Status error:', error);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
}
