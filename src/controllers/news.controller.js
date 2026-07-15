// src/controllers/news.controller.js
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path ke file JSON backup/cache
const NEWS_FILE_PATH = join(__dirname, '../../latest_waste_news.json');
const AI_SERVICE_URL = process.env.APP_URL || 'http://localhost:8000';
const AI_NEWS_TIMEOUT = 8000; // 8 detik sesuai docs

/**
 * Membaca berita dari cache lokal (fallback)
 */
 
const readLocalNews = () => {
  try {
    const raw = readFileSync(NEWS_FILE_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('⚠️ Failed to read local news cache:', err.message);
    return [];
  }
};

/**
 * Menulis berita baru ke cache lokal
 */
const writeLocalNews = (data) => {
  try {
    writeFileSync(NEWS_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`📰 News cache updated with ${data.length} articles`);
  } catch (err) {
    console.error('⚠️ Failed to write news cache:', err.message);
  }
};

/**
 * Memanggil AI Service untuk mendapatkan berita terbaru
 * Timeout: 8 detik sesuai Backend Architecture Docs v4.0.0
 */
const fetchAINews = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_NEWS_TIMEOUT);

    const response = await fetch(`${AI_SERVICE_URL}/api/v1/news`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`AI News API returned ${response.status}`);
    }

    const data = await response.json();

    // Validasi struktur response
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('AI News API returned empty or invalid data');
    }

    return data;
  } catch (err) {
    console.warn(`⚠️ AI News fetch failed (${err.message}), falling back to local cache`);
    return null;
  }
};

export const getNews = async (req, res) => {
  try {
    // 1. Coba ambil dari AI Service terlebih dahulu
    const aiNews = await fetchAINews();

    if (aiNews) {
      // ✅ AI sukses → Update cache lokal & kembalikan data baru
      writeLocalNews(aiNews);
      return res.status(200).json(aiNews);
    }

    // 2. AI gagal/timeout → Fallback ke cache lokal
    const localNews = readLocalNews();

    if (localNews.length === 0) {
      return res.status(503).json({
        status: 'error',
        message: 'News service unavailable and no cached data found.'
      });
    }

    return res.status(200).json(localNews);

  } catch (error) {
    console.error('Get News Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data berita.'
    });
  }
};