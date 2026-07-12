# 📚 Aeterna AI - Frontend Integration Guide (v4.0.0)
**Sistem Prediksi Manajemen Sampah DKI Jakarta 2026**

Dokumen ini berisi panduan integrasi antara Backend API (Node.js Gateway) dan Frontend Dashboard. Seluruh endpoint telah distandarisasi mengikuti prinsip *Clean Architecture*, *Database-First Validation*, dan *Type-Safe Contract*.

## 🔐 Autentikasi & Keamanan
Seluruh endpoint bisnis dilindungi menggunakan **API Key Authentication**.
-   **Header Name:** `x-api-key`
-   **Cakupan:** Wajib untuk semua endpoint di bawah `/api/v1/*`
-   **Pengecualian:** Endpoint `/status` bersifat **PUBLIK** (tidak memerlukan API Key) untuk keperluan health check monitoring.
-   **Response Gagal:** `401 Unauthorized` jika key tidak valid/hilang.

> ⚠️ **Security Notice:** Jangan pernah menuliskan API Key secara *hardcoded* di source code frontend. Selalu gunakan environment variable (misal: `VITE_API_KEY`).

---

## 🌐 Base URL & Environment

| Environment | Base URL | Keterangan |
| :--- | :--- | :--- |
| **Local Dev** | `http://localhost:8001` | Server lokal backend (Node.js) |
| **Production** | `https://waste-api-seven.vercel.app/` | Deployment Vercel Serverless |
| **AI Engine** | *(Internal)* | Diakses via backend gateway, tidak langsung dari FE |

---

## 🗺️ Konstanta Wilayah & Logistik
Backend kini mendukung **44 Kecamatan DKI Jakarta** + 4 Venue Legacy. Gunakan konstanta berikut untuk rendering peta (Leaflet.js) dan info rute.

```typescript
// Koordinat Lokasi Pengamatan (Venue + Perwakilan Kecamatan)
export const LOCATION_COORDINATES = {
  "GBK": { latitude: -6.2183, longitude: 106.8022 },
  "JIS": { latitude: -6.1244, longitude: 106.8622 },
  "Pasar Senen": { latitude: -6.1744, longitude: 106.8444 },
  "Gang Sempit Tambora": { latitude: -6.1500, longitude: 106.8000 },
  // ... tambahkan koordinat 44 kecamatan sesuai kebutuhan UI
};

// Koordinat TPST Bantargebang (Tujuan Akhir)
export const BANTARGEBANG_COORDS = { latitude: -6.3477, longitude: 106.9939 };

// Profil Rute Logistik
export const LOGISTICS_ROUTING_PROFILES = {
  "JIS": { distance: "41.2 km", travelTime: "1.5 Jam" },
  "GBK": { distance: "38.5 km", travelTime: "1.8 Jam" },
  "Pasar Senen": { distance: "34.8 km", travelTime: "1.4 Jam" },
  "Gang Sempit Tambora": { distance: "43.5 km", travelTime: "2.1 Jam" }
};
```

> 💡 **Alias Mapping:** Backend secara otomatis menerjemahkan input `"JIS"` → `"Pademangan"`, `"GBK"` → `"Tanah Abang"`, dll. Frontend **tetap boleh** mengirim nama venue lama (`JIS`, `GBK`) tanpa error. Response akan mengembalikan nama asli yang dikirim FE agar UI tidak rusak.

---

## 📡 Referensi Endpoint API

### 1. Health Check (Publik)
Memverifikasi status server dan kesiapan model AI.
-   **URL:** `/status`
-   **Method:** `GET`
-   **Auth:** ❌ Tidak Perlu
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
-   **Request Body:**
    ```json
    {
      "location": "JIS",
      "forecast_days": 7,
      "start_date": "2026-07-10",
      "rainfall_mm": 15.5,
      "event_scale": 2,
      "granularity": "daily",
      "model_type": "chronos"
    }
    ```
-   **Field Validation:**
    -   `location`: String. Mendukung 44 kecamatan + alias (`JIS`, `GBK`, `Pasar Senen`, `Gang Sempit Tambora`)
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
            "location": "JIS",
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
-   **Request Body:** Sama dengan `/predict`
-   **Response:** Binary stream (`text/csv`)
-   **⚠️ Penting untuk FE:** Wajib set `responseType: 'blob'` di Axios/Fetch.

### 4. Berita Sampah Harian
Mengambil database berita seputar persampahan DKI Jakarta yang diperbarui berkala.
-   **URL:** `/api/v1/news`
-   **Method:** `GET`
-   **Auth:** 🔒 `x-api-key`
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

### 5. Autopilot Dashboard
Mengambil prediksi otonom agregat untuk seluruh kecamatan DKI Jakarta hari ini.
-   **URL:** `/api/v1/autopilot`
-   **Method:** `GET`
-   **Auth:** 🔒 `x-api-key`
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
-   **Query Params:** `location` (opsional, filter per lokasi)
-   **Response Success (200):**
    ```json
    {
      "status": "success",
      "alert_count": 1,
      "alerts": [
        {
          "date": "2026-07-11",
          "location": "GBK",
          "status": "CRITICAL",
          "estimated_volume_ton": 18.50,
          "message": "Alert: CRITICAL volume expected at GBK"
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

---

## ⚠️ Error Handling

| HTTP Code | Meaning | FE Action |
| :--- | :--- | :--- |
| `400` | Bad Request / Validasi Gagal | Tampilkan pesan error dari field `message` |
| `401` | Unauthorized | Cek konfigurasi API Key di env frontend |
| `422` | Unprocessable Entity | Input tidak valid (format Pydantic v2: `detail[]`) |
| `429` | Too Many Requests | Rate limit terlampaui. Tampilkan countdown/retry |
| `503` | Service Unavailable | Model AI sedang loading. Tampilkan spinner |
| `500` | Internal Server Error | Tampilkan toast error generik |

---

## 👨‍💻 Developer Contact
**System Architect:** BagasHtml (@BagasHtml)
**AI & Backend Lead:** Faril Putra Pratama (@FARILtau72)

*Last Updated: July 2026 | Waste Intelligence Hackathon Project*
