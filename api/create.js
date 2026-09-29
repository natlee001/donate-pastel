import { randomInt } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCode() {
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return 'DN' + suffix;
}

function cleanText(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const sheetsUrl = process.env.SHEETS_WEBAPP_URL;
  const secret = process.env.SHEETS_SECRET;

  if (!sheetsUrl || !secret) {
    return res.status(500).json({ ok: false, error: 'server_not_configured' });
  }

  try {
    const body = typeof req.body === 'string'
      ? JSON.parse(req.body)
      : (req.body || {});

    const name = cleanText(body.name, 40);
    const message = cleanText(body.message, 2000);
    const amount = Number(body.amount);

    if (!name) return res.status(400).json({ ok: false, error: 'name_required' });
    if (!message) return res.status(400).json({ ok: false, error: 'message_required' });
    if (!Number.isInteger(amount) || amount < 1000 || amount > 50000000) {
      return res.status(400).json({ ok: false, error: 'invalid_amount' });
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateCode();

      const upstream = await fetch(sheetsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: secret,
          action: 'create',
          donation: {
            code,
            name,
            message,
            expectedAmount: amount
          }
        })
      });

      const text = await upstream.text();
      let data = null;
      try { data = JSON.parse(text); } catch {}

      if (upstream.ok && data?.ok === true && data?.created === true) {
        return res.status(200).json({
          ok: true,
          code,
          name,
          message,
          amount
        });
      }

      if (data?.error !== 'duplicate_code') {
        console.error('Create donation failed:', data);
        return res.status(502).json({ ok: false, error: 'create_failed' });
      }
    }

    return res.status(503).json({ ok: false, error: 'could_not_create_code' });
  } catch (error) {
    console.error('Create donation error:', error);
    return res.status(500).json({ ok: false, error: 'internal_error' });
  }
}
