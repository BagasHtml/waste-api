// src/controllers/news.controller.js

// Data berita statis dari Antara News (di-crawl berkala)
// Di production/hackathon demo, data ini bisa diganti dengan cron job scraper
const NEWS_DATABASE = [
  {
    title: "DKI Uji Coba Penarikan Retribusi Sampah Pelayanan Kebersihan Harian",
    source: "Antara News",
    url: "https://www.antaranews.com/tag/sampah-jakarta",
    date_fetched: "2026-07-10",
    summary: "Pemprov DKI Jakarta merencanakan uji coba penarikan retribusi pelayanan kebersihan/sampah berdasarkan golongan daya listrik..."
  },
  {
    title: "Jakarta Timur Tuntas Bersihkan 45 Ton Sampah di TPS Liar",
    source: "Antara News",
    url: "https://www.antaranews.com/tag/sampah-jakarta",
    date_fetched: "2026-07-10",
    summary: "Pemerintah Kota Jakarta Timur tuntas membersihkan tumpukan 45 ton sampah di area tempat penampungan sementara liar..."
  },
  {
    title: "DPRD DKI Minta DLH Tata Ulang Sistem Pengelolaan Sampah",
    source: "Antara News",
    url: "https://www.antaranews.com/tag/sampah-jakarta",
    date_fetched: "2026-07-09",
    summary: "Ketua Komisi D DPRD DKI Jakarta meminta Dinas Lingkungan Hidup agar menata sistem pengelolaan sampah lebih efisien..."
  },
  {
    title: "Jakarta Barat Fokus Tangani Sampah Organik di Permukiman",
    source: "Antara News",
    url: "https://www.antaranews.com/tag/sampah-jakarta",
    date_fetched: "2026-07-09",
    summary: "Pemkot Jakarta Barat memfokuskan penanganan sampah organik di kawasan permukiman sebagai prioritas utama..."
  },
  {
    title: "Bank Sampah Pintar Kemilau Perkuat Budaya Pilah Sampah di Jaktim",
    source: "Antara News",
    url: "https://www.antaranews.com/tag/sampah-jakarta",
    date_fetched: "2026-07-08",
    summary: "Pemkot Jakarta Timur memperkuat budaya pilah sampah melalui Bank Sampah Pintar Kemilau di kelurahan-kelurahan..."
  }
];

export const getNews = async (req, res) => {
  try {
    return res.status(200).json(NEWS_DATABASE);
  } catch (error) {
    console.error("Get News Error:", error.message);
    return res.status(500).json({ 
      status: "error", 
      message: "Gagal mengambil data berita." 
    });
  }
};