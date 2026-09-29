export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false });
  }

  const expected = process.env.SEPAY_API_KEY;
  const auth = req.headers.authorization || '';

  if (!expected || auth !== `Apikey ${expected}`) {
    return res.status(401).json({ success: false });
  }

  const sheetsUrl = process.env.SHEETS_WEBAPP_URL;
  const sheetsSecret = process.env.SHEETS_SECRET;

  if (!sheetsUrl || !sheetsSecret) {
    console.error('Missing Sheets environment variables');
    return res.status(500).json({ success: false });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : (req.body || {});

    const response = await fetch(sheetsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: sheetsSecret,
        transaction: body
      })
    });

    const text = await response.text();
    let result = null;
    try { result = JSON.parse(text); } catch {}

    if (!response.ok || result?.ok !== true) {
      console.error('Sheets gateway rejected webhook:', {
        status: response.status,
        result
      });
      return res.status(502).json({ success: false });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('SePay webhook error:', error);
    return res.status(500).json({ success: false });
  }
}
