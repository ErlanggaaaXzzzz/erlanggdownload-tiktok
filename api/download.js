// api/download.js
// Endpoint: GET /api/download?url=<link_tiktok>&apikey=<key>
// (atau kirim key lewat header X-API-Key)
//
// API key WAJIB sudah terdaftar di Vercel KV (dibuat lewat POST /api/keys).
// Tidak ada mode demo — key yang tidak terdaftar akan ditolak.

import { kv } from '@vercel/kv';

function getApiKey(req) {
  const headerKey = req.headers['x-api-key'];
  const queryKey = req.query.apikey || req.query.key;
  return headerKey || queryKey || null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Gunakan metode GET.' });
    return;
  }

  const apiKey = getApiKey(req);

  if (!apiKey) {
    res.status(401).json({
      success: false,
      error: 'API key tidak ditemukan. Kirim lewat header X-API-Key atau query ?apikey=. Buat key baru di POST /api/keys.',
    });
    return;
  }

  // ---------- Validasi key ke Vercel KV (wajib terdaftar) ----------
  let keyRecord;
  try {
    keyRecord = await kv.get(`apikey:${apiKey}`);
  } catch (err) {
    res.status(500).json({ success: false, error: 'Gagal memeriksa API key. Pastikan Vercel KV sudah terhubung.' });
    return;
  }

  if (!keyRecord) {
    res.status(403).json({ success: false, error: 'API key tidak dikenali. Buat key baru lewat POST /api/keys.' });
    return;
  }

  if (keyRecord.active === false) {
    res.status(403).json({ success: false, error: 'API key ini sudah dinonaktifkan.' });
    return;
  }

  const targetUrl = req.query.url;

  if (!targetUrl) {
    res.status(400).json({ success: false, error: 'Parameter "url" wajib diisi.' });
    return;
  }

  if (!/tiktok\.com/i.test(targetUrl)) {
    res.status(400).json({ success: false, error: 'URL yang dikirim bukan tautan TikTok.' });
    return;
  }

  try {
    const upstream = await fetch(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ErlanggaBot/1.0)' } }
    );

    if (!upstream.ok) {
      throw new Error(`Layanan sumber merespons dengan status ${upstream.status}`);
    }

    const json = await upstream.json();

    if (json.code !== 0 || !json.data) {
      res.status(404).json({
        success: false,
        error: json.msg || 'Video tidak ditemukan, privat, atau sudah dihapus.',
      });
      return;
    }

    const d = json.data;

    // Catat pemakaian key (best-effort, tidak menggagalkan response kalau error)
    kv.set(`apikey:${apiKey}`, {
      ...keyRecord,
      request_count: (keyRecord.request_count || 0) + 1,
      last_used_at: new Date().toISOString(),
    }).catch(() => {});

    res.status(200).json({
      success: true,
      data: {
        id: d.id,
        title: d.title,
        cover: d.cover,
        duration: d.duration,
        author: d.author ? { nickname: d.author.nickname, unique_id: d.author.unique_id } : null,
        video_hd: d.hdplay || null,
        video_no_watermark: d.play || null,
        video_watermark: d.wmplay || null,
        audio: d.music || null,
        size_bytes: d.size || null,
        size_hd_bytes: d.hd_size || null,
      },
    });
  } catch (err) {
    res.status(502).json({
      success: false,
      error: 'Gagal menghubungi layanan pemroses video. Coba lagi sebentar lagi.',
    });
  }
}
