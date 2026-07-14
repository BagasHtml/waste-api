# 📚 Aeterna AI - Frontend Integration Guide (v4.2.0)
**Sistem Prediksi Manajemen Sampah DKI Jakarta 2026**

Dokumen ini berisi panduan integrasi antara Backend API (Node.js Gateway) dan Frontend Dashboard. Seluruh endpoint telah distandarisasi mengikuti prinsip *Clean Architecture*, *Database-First Validation*, dan *Type-Safe Contract*.

## 🔐 Autentikasi & Keamanan
Seluruh endpoint bisnis dilindungi menggunakan **API Key Authentication**.
-   **Header Name:** `x-api-key`
-   **Cakupan:** Wajib untuk semua endpoint di bawah `/api/v1/*`
-   **Pengecualian:** Endpoint `/status` bersifat **PUBLIK** (tidak memerlukan API Key).
-   **Response Gagal:** `401 Unauthorized` jika key tidak valid/hilang.

> ⚠️ **Security Notice:** Jangan pernah menuliskan API Key secara *hardcoded* di source code frontend. Selalu gunakan environment variable (misal: `VITE_API_KEY`).

---

## 🌐 Base URL & Environment

| Environment | Base URL | Keterangan |
| :--- | :--- | :--- |
| **Local Dev** | `http://localhost:8001` | Server lokal backend (Node.js) |
| **Production** | `https://waste-api-seven.vercel.app` | Deployment Vercel Serverless |
| **AI Engine** | *(Internal)* | Diakses via backend gateway, tidak langsung dari FE |

---

## 🗺️ Konstanta Wilayah & Logistik
Backend **hanya** mendukung **44 Kecamatan Administratif DKI Jakarta**. Venue/landmark (JIS, GBK, dll.) **tidak lagi didukung**.

Gunakan konstanta berikut untuk rendering peta (Leaflet.js) dan info rute:

```typescript
// Koordinat TPST Bantargebang (Tujuan Akhir)
export const BANTARGEBANG_COORDS = { latitude: -6.3477, longitude: 106.9939 };

// Contoh Koordinat Kecamatan (lengkapi sesuai kebutuhan UI)
export const KECAMATAN_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  "Menteng": { latitude: -6.1950, longitude: 106.8322 },
  "Senen": { latitude: -6.1822, longitude: 106.8452 },
  "Cempaka Putih": { latitude: -6.1802, longitude: 106.8686 },
  "Tanah Abang": { latitude: -6.2104, longitude: 106.8122 },
  "Pademangan": { latitude: -6.1328, longitude: 106.8422 },
  "Cakung": { latitude: -6.1828, longitude: 106.9482 },
  // ... 38 kecamatan lainnya tersedia via endpoint /api/v1/autopilot
};

// Profil Rute Logistik (contoh)
export const LOGISTICS_ROUTING_PROFILES: Record<string, { distance: string; travelTime: string }> = {
  "Menteng": { distance: "35.2 km", travelTime: "1.3 Jam" },
  "Senen": { distance: "34.8 km", travelTime: "1.4 Jam" },
  "Tanah Abang": { distance: "38.5 km", travelTime: "1.8 Jam" },
  "Pademangan": { distance: "41.2 km", travelTime: "1.5 Jam" },
  "Cakung": { distance: "45.0 km", travelTime: "2.0 Jam" },
  // ... lengkapi sesuai data rute aktual
};
```

> 💡 **Tip:** Endpoint `/api/v1/autopilot` kini mengembalikan `latitude` dan `longitude` untuk setiap kecamatan. FE bisa langsung menggunakan data tersebut untuk render marker di peta tanpa bergantung pada konstanta hardcoded.

---

## 📡 Referensi Endpoint API

### 1. Health Check (Publik)
Memverifikasi status server dan kesiapan model AI.
-   **URL:** `/status`
-   **Method:** `GET`
-   **Auth:** ❌ Tidak Perlu
-   **Rate Limit:** 60 req/min
-   **Response Success (200):**
    ```json
    {
      "status": "Online",
      "model_chronos": "Chronos-T5 Tiny",
      "model_gbr": "Gradient Boosting Regressor",
      "calibrated": true
    }
    ```

### 2. Prediksi AI (Core Engine)
Endpoint utama untuk forecasting volume sampah, dekomposisi 8 jenis sampah, dan perencanaan logistik.
-   **URL:** `/api/v1/predict`
-   **Method:** `POST`
-   **Auth:** 🔒 `x-api-key`
-   **Rate Limit:** 10 req/min
-   **Request Body:**
    ```json
    {
      "location": "Pademangan",
      "forecast_days": 7,
      "start_date": "2026-07-10",
      "rainfall_mm": 15.5,
      "event_scale": 2,
      "granularity": "daily",
      "model_type": "chronos"
    }
    ```
-   **Field Validation:**
    -   `location`: String. **Hanya menerima nama 44 kecamatan administratif DKI Jakarta** (case-sensitive, harus persis dengan nama di database)
    -   `forecast_days`: Integer 1–30
    -   `granularity`: `'daily'` (default) | `'hourly'`
    -   `model_type`: `'chronos'` (default) | `'gradient_boosting'`

-   **Response Success (200):**
    ```json
    {
      "status": "success",
      "message": "WARNING conditions expected.",
      "confidence_score": 0.9325,
      "data": {
        "prediction_results": [
          {
            "date": "2026-07-10",
            "location": "Pademangan",
            "total_volume_ton": 12.45,
            "organic_waste_ton": 6.21,
            "plastic_waste_ton": 2.86,
            "paper_waste_ton": 1.43,
            "glass_waste_ton": 0.40,
            "metal_waste_ton": 0.26,
            "textile_waste_ton": 0.52,
            "other_waste_ton": 0.77,
            "recommended_trucks": 3,
            "risk_status": "WARNING",
            "event_info": "Event Skala 2",
            "hourly_breakdown": null
          }
        ],
        "logistics_plan": {
          "trucks_needed": 3,
          "manpower": 9,
          "estimated_duration_hours": 24.5,
          "efficiency_rate": "85% (Optimal)"
        }
      }
    }
    ```

### 3. Export CSV
Mengunduh hasil prediksi dalam format file `.csv`.
-   **URL:** `/api/v1/predict/csv`
-   **Method:** `POST`
-   **Auth:** 🔒 `x-api-key`
-   **Rate Limit:** 10 req/min
-   **Request Body:** Sama dengan `/predict`
-   **Response:** Binary stream (`text/csv`)
-   **⚠️ Penting untuk FE:** Wajib set `responseType: 'blob'` di Axios/Fetch.

### 4. Berita Sampah Harian (Dynamic + Fallback)
Mengambil berita persampahan DKI Jakarta. Sistem menggunakan mekanisme **AI-First with Local Fallback** untuk menjamin zero downtime.
-   **URL:** `/api/v1/news`
-   **Method:** `GET`
-   **Auth:** 🔒 `x-api-key`
-   **Rate Limit:** 30 req/min
-   **Response Success (200):**
    ```json
    [
      {
        "title": "DKI Uji Coba Penarikan Retribusi Sampah Pelayanan Kebersihan Harian",
        "source": "Antara News",
        "url": "https://www.antaranews.com/tag/sampah-jakarta",
        "date_fetched": "2026-07-10",
        "summary": "Pemprov DKI Jakarta merencanakan uji coba penarikan retribusi..."
      }
    ]
    ```
> 💡 **Catatan FE:** Jika AI Service gagal/timeout (>8 detik), backend otomatis mengembalikan data cache lokal tanpa error. FE tidak perlu menangani fallback secara manual.

### 5. Autopilot Dashboard (With Coordinates)
Mengambil prediksi otonom agregat untuk seluruh 44 kecamatan DKI Jakarta hari ini. **Menyertakan koordinat** untuk rendering peta langsung.
-   **URL:** `/api/v1/autopilot`
-   **Method:** `GET`
-   **Auth:** 🔒 `x-api-key`
-   **Rate Limit:** 30 req/min
-   **Response Success (200):**
    ```json
    {
      "status": "success",
      "date": "2026-07-10",
      "total_volume_ton": 8105.42,
      "total_trucks": 1640,
      "top_kecamatan": [
        {
          "location": "Cakung",
          "latitude": -6.1828,
          "longitude": 106.9482,
          "volume_ton": 355.20,
          "trucks": 72,
          "status": "SAFE",
          "city": "Jakarta Timur"
        }
      ],
      "rainy_regions": 0,
      "event_today": null
    }
    ```

### 6. Alerts Operasional
Mengambil daftar lokasi dengan status WARNING/CRITICAL dalam 3 hari ke depan.
-   **URL:** `/api/v1/alerts`
-   **Method:** `GET`
-   **Auth:** 🔒 `x-api-key`
-   **Rate Limit:** 30 req/min
-   **Query Params:** `location` (opsional, filter per kecamatan)
-   **Response Success (200):**
    ```json
    {
      "status": "success",
      "alert_count": 1,
      "alerts": [
        {
          "date": "2026-07-11",
          "location": "Tanah Abang",
          "status": "CRITICAL",
          "estimated_volume_ton": 18.50,
          "message": "Alert: CRITICAL volume expected at Tanah Abang"
        }
      ],
      "last_updated": "2026-07-10T08:30:00.000Z"
    }
    ```

---

## 🎨 Panduan Mapping UI

### Risk Status Badge Color
Backend mengembalikan string murni tanpa emoji. Gunakan mapping warna berikut:

| Status | Warna | Hex Code |
| :--- | :--- | :--- |
| `SAFE` | Hijau Terang | `#00E676` |
| `WARNING` | Kuning Neon | `#FFD600` |
| `CRITICAL` | Merah Menyala | `#FF1744` |

### Dekomposisi Sampah (8 Kategori)
Untuk Progress Bar atau Donut Chart:
```javascript
const categories = ['organic', 'plastic', 'paper', 'glass', 'metal', 'textile', 'other'];
const totalVol = result.total_volume_ton;

categories.forEach(cat => {
  const pct = totalVol > 0 ? (result[`${cat}_waste_ton`] / totalVol) * 100 : 0;
  // Render ke UI
});
```

### Confidence Score
Nilai `confidence_score` berada dalam skala **0.0 – 1.0**. Untuk tampilan persentase: `(score * 100).toFixed(1) + '%'`

### Rendering Peta Autopilot
Karena response `/autopilot` menyertakan `latitude` dan `longitude`, FE bisa langsung render marker tanpa join manual:
```javascript
// Contoh Leaflet.js
data.top_kecamatan.forEach(item => {
  L.marker([item.latitude, item.longitude])
    .bindPopup(`${item.location}: ${item.volume_ton} ton (${item.status})`)
    .addTo(map);
});
```

---

## ⚠️ Error Handling & Rate Limiting

| HTTP Code | Meaning | FE Action |
| :--- | :--- | :--- |
| `400` | Bad Request / Validasi Gagal | Tampilkan pesan error dari field `message` |
| `401` | Unauthorized | Cek konfigurasi API Key di env frontend |
| `422` | Unprocessable Entity | Input tidak valid (format Pydantic v2: `detail[]`) |
| `429` | Too Many Requests | Rate limit terlampaui. Tampilkan countdown/retry |
| `503` | Service Unavailable | Model AI sedang loading. Tampilkan spinner |
| `500` | Internal Server Error | Tampilkan toast error generik |

### 🚦 Rate Limit Tiers
| Endpoint Group | Limit | Alasan |
| :--- | :--- | :--- |
| `/predict`, `/predict/csv` | 10 req/min | AI inference berat & mahal |
| `/alerts`, `/news`, `/autopilot` | 30 req/min | DB query ringan |
| `/status` | 60 req/min | Health check monitoring |

> 💡 **Tips FE:** Gunakan debouncing/throttling pada tombol prediksi dan implementasi retry logic dengan exponential backoff saat menerima `429`.

---

## 👨‍💻 Developer Contact
**System Architect:** BagasHtml (@BagasHtml)
**AI & Backend Lead:** Faril Putra Pratama (@FARILtau72)
