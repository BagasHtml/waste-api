// src/controllers/autopilot.controller.js
import prisma from '../config/db.js';
import { KECAMATAN_DATABASE } from './predict.controller.js';

export const getAutopilot = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ambil prediksi hari ini dari DB
    const todayLogs = await prisma.predictionLog.findMany({
      where: {
        prediction_date: { gte: today }
      },
      include: { area: { select: { name: true } } }
    });

    // Bangun peta volume per lokasi dari DB
    const dbVolumeMap = {};
    todayLogs.forEach(log => {
      const locName = log.area?.name;
      if (locName) {
        dbVolumeMap[locName] = (dbVolumeMap[locName] || 0) + log.volume_ton;
      }
    });

    // Agregasi 44 kecamatan
    let totalVolume = 0;
    let totalTrucks = 0;
    let rainyRegions = 0;
    const topKecamatan = [];

    for (const [name, meta] of Object.entries(KECAMATAN_DATABASE)) {
      // Gunakan data DB jika ada,否则 fallback ke normal_avg
      const volume = dbVolumeMap[name] || meta.normal_avg;
      const trucks = Math.ceil(volume / 5);
      
      let status = "SAFE";
      if (volume >= meta.critical_threshold) status = "CRITICAL";
      else if (volume >= meta.warning_threshold) status = "WARNING";

      totalVolume += volume;
      totalTrucks += trucks;

      topKecamatan.push({
        location: name,
        volume_ton: Number(volume.toFixed(2)),
        trucks,
        status,
        city: meta.city
      });
    }

    // Sortir top kecamatan by volume descending, ambil top 10
    topKecamatan.sort((a, b) => b.volume_ton - a.volume_ton);

    return res.status(200).json({
      status: "success",
      date: today.toISOString().split('T')[0],
      total_volume_ton: Number(totalVolume.toFixed(2)),
      total_trucks: totalTrucks,
      top_kecamatan: topKecamatan.slice(0, 10),
      rainy_regions: rainyRegions,
      event_today: null
    });

  } catch (error) {
    console.error("Autopilot Error:", error.message);
    return res.status(500).json({ status: "error", message: "Gagal memuat data autopilot." });
  }
};