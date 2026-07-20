# Erlangga — Download TikTok

Web downloader TikTok (video HD tanpa watermark, versi watermark, audio MP3) + API publik dengan sistem API key **beneran** (tersimpan di server lewat Vercel KV, bukan simulasi di browser).

## Struktur folder

```
erlangga-tiktok/
├─ public/
│  └─ index.html      → halaman utama (statis, HTML/CSS/JS murni, tanpa build step)
├─ api/
│  ├─ download.js      → endpoint utama, GET /api/download
│  └─ keys.js           → endpoint pembuatan & pengecekan API key
├─ vercel.json          → konfigurasi header CORS
├─ package.json
└─ README.md
```

## Langkah deploy (WAJIB diikuti semua, key tidak akan jalan tanpa KV)

### 1. Push ke GitHub, import ke Vercel
- Push folder ini ke repo GitHub kamu.
- Buka [vercel.com](https://vercel.com) → **Add New Project** → import repo tersebut.
- Vercel otomatis mendeteksi `public/` sebagai static output dan `api/` sebagai serverless functions.
- Deploy sekali dulu (nanti akan gagal connect KV sampai langkah 2 selesai — itu wajar).

### 2. Aktifkan Vercel KV (database penyimpan API key)
- Di dashboard project → tab **Storage** → **Create Database** → pilih **KV**.
- Beri nama (bebas, mis. `erlangga-kv`) → **Create**.
- Setelah dibuat, klik **Connect Project** → pilih project `erlangga-tiktok` kamu → centang semua environment (Production, Preview, Development).
- Vercel otomatis menambahkan env var `KV_REST_API_URL`, `KV_REST_API_TOKEN`, dll ke project — kamu tidak perlu isi manual apa pun.

### 3. Redeploy
- Kembali ke tab **Deployments** → klik titik tiga pada deployment terakhir → **Redeploy**.
- Setelah selesai, endpoint API key sudah aktif dan tersambung ke database.

## Cara kerja sistem API key

Tidak ada mode demo. Alurnya:

1. User (lewat tombol di web, atau langsung lewat `curl`) memanggil `POST /api/keys`.
2. Server membuat key baru berformat `ERL-xxxxxxxxxx`, menyimpannya di Vercel KV, lalu mengembalikannya sekali — **simpan baik-baik**, tidak ditampilkan ulang oleh server.
3. Key itu dipakai di setiap request ke `/api/download` lewat header `X-API-Key` atau query `?apikey=`.
4. `/api/download` mengecek keberadaan key di KV setiap kali dipanggil. Key yang tidak terdaftar akan ditolak dengan status `403`.
5. Setiap pemakaian yang berhasil menaikkan `request_count` pada key tersebut — bisa dicek lewat `GET /api/keys?key=...`.

### Menonaktifkan key tertentu
Saat ini penonaktifan key dilakukan manual lewat Vercel KV dashboard (tab **Storage → KV → Data Browser**): cari key dengan nama `apikey:ERL-xxxx`, ubah field `active` jadi `false`. Kalau butuh ini otomatis dari UI (misalnya panel admin), bilang saja — bisa ditambahkan endpoint `DELETE /api/keys`.

## Cara pakai API

### Membuat API key
```bash
curl -X POST "https://erlanggdownload-tiktok.vercel.app/api/keys"
```
Response:
```json
{
  "success": true,
  "data": {
    "api_key": "ERL-3f9a8b2c1d",
    "created_at": "2026-07-21T10:00:00.000Z"
  }
}
```

### Mengecek status key
```bash
curl "https://erlanggdownload-tiktok.vercel.app/api/keys?key=ERL-3f9a8b2c1d"
```

### Download video
```bash
curl "https://erlanggdownload-tiktok.vercel.app/api/download?url=https://vt.tiktok.com/xxxxx/" \
  -H "X-API-Key: ERL-3f9a8b2c1d"
```
Response:
```json
{
  "success": true,
  "data": {
    "title": "...",
    "cover": "https://...",
    "duration": 18,
    "author": { "nickname": "...", "unique_id": "..." },
    "video_hd": "https://...",
    "video_no_watermark": "https://...",
    "video_watermark": "https://...",
    "audio": "https://...",
    "size_bytes": 1234567,
    "size_hd_bytes": 2345678
  }
}
```

Semua error (key salah, url kosong, video privat, dll) juga selalu balik JSON dengan format `{ "success": false, "error": "..." }` dan status HTTP yang sesuai (400/401/403/404/405/502).

## Sumber data

Endpoint ini adalah wrapper di atas [tikwm.com](https://www.tikwm.com/api/), layanan pihak ketiga yang tidak berafiliasi dengan TikTok. Ketersediaan dan kestabilannya bergantung pada layanan tersebut.
