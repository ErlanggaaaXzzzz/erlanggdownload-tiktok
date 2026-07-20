// api/keys.js
// POST /api/keys           → buat API key baru, simpan di Vercel KV, balikin key-nya
// GET  /api/keys?key=ERL-x → cek apakah sebuah key valid & aktif
//
// Butuh Vercel KV terpasang di project (Vercel Dashboard → Storage → Create → KV,
// lalu Connect ke project ini). Env var KV_REST_API_URL & KV_REST_API_TOKEN
// otomatis terisi setelah itu — tidak perlu diisi manual.

import { kv } from '@vercel/kv';

function generateKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `ERL-${hex}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  // ---------- Buat key baru ----------
  if (req.method === 'POST') {
    try {
      const key = generateKey();
      const record = {
        created_at: new Date().toISOString(),
        active: true,
        request_count: 0,
      };
      await kv.set(`apikey:${key}`, record);

      res.status(201).json({
        success: true,
        data: {
          api_key: key,
          created_at: record.created_at,
          note: 'Simpan key ini baik-baik — pakai lewat header X-API-Key atau query ?apikey=',
        },
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: 'Gagal membuat API key. Pastikan Vercel KV sudah terhubung ke project ini.',
      });
    }
    return;
  }

  // ---------- Cek status key ----------
  if (req.method === 'GET') {
    const key = req.query.key || req.headers['x-api-key'];

    if (!key) {
      res.status(400).json({ success: false, error: 'Parameter "key" wajib diisi.' });
      return;
    }

    try {
      const record = await kv.get(`apikey:${key}`);

      if (!record) {
        res.status(404).json({ success: false, error: 'API key tidak ditemukan.' });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          api_key: key,
          active: record.active,
          created_at: record.created_at,
          request_count: record.request_count || 0,
        },
      });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Gagal memeriksa API key.' });
    }
    return;
  }

  res.status(405).json({ success: false, error: 'Gunakan metode GET atau POST.' });
}
