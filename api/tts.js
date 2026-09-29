import { EdgeTTS } from 'node-edge-tts';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const VOICE = 'vi-VN-HoaiMyNeural';
const MAX_TEXT = 2000;
const RATE = '-5%';

// Lightweight per-instance rate limit to reduce accidental/automated abuse.
const buckets = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

function getClientKey(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.socket?.remoteAddress || 'unknown');
}

function allowed(req) {
  const now = Date.now();
  const key = getClientKey(req);
  const item = buckets.get(key);

  if (!item || now - item.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return true;
  }

  item.count += 1;
  return item.count <= MAX_REQUESTS_PER_WINDOW;
}

function getText(req) {
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    return typeof body.text === 'string' ? body.text : '';
  }

  return typeof req.query?.text === 'string' ? req.query.text : '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  if (!allowed(req)) {
    return res.status(429).json({ ok: false, error: 'rate_limited' });
  }

  let text;
  try {
    text = String(getText(req) || '').trim();
  } catch {
    return res.status(400).json({ ok: false, error: 'invalid_body' });
  }

  if (!text) {
    return res.status(400).json({ ok: false, error: 'text_required' });
  }

  if (text.length > MAX_TEXT) {
    return res.status(413).json({ ok: false, error: 'text_too_long', maxLength: MAX_TEXT });
  }

  const filename = path.join(os.tmpdir(), `donate-tts-${crypto.randomUUID()}.mp3`);

  try {
    const tts = new EdgeTTS({
      voice: VOICE,
      lang: 'vi-VN',
      outputFormat: 'audio-24khz-96kbitrate-mono-mp3',
      rate: RATE,
      timeout: 10000
    });

    await tts.ttsPromise(text, filename);
    const audio = await fs.readFile(filename);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(audio.length));
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res.end(audio);
  } catch (error) {
    console.error('TTS generation failed:', error);
    return res.status(502).json({ ok: false, error: 'tts_generation_failed' });
  } finally {
    try { await fs.unlink(filename); } catch {}
  }
}
