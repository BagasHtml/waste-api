// src/controllers/autopilot.controller.js
import prisma from '../config/db.js';

export const getAutopilot = async (req, res) => {
  try {
    // ✅ Ambil semua area langsung dari Database (Single Source of Truth)
    const areas = await prisma.masterArea.findMany({
      select: { 
        id: true, 
        name: true, 
        city: true, 
        normal_avg: true, 
        warning_threshold: true, 
        critical_threshold: true 
      }
    });

    if (!areas || areas.length === 0) {
      return res.status(503).json({ 
        status: "error", 
        message: "Data kecamatan belum tersedia. Jalankan seed-locations.js terlebih dahulu." 
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Ambil prediksi hari ini dari DB
    const todayLogs = await prisma.predictionLog.findMany({
      where: { prediction_date: { gte: today } },
      select: { areaId: true, volume_ton: true }
    });

    // Buat map volume per areaId untuk lookup cepat
    const volumeMap = {};
    todayLogs.forEach(log => { 
      volumeMap[log.areaId] = (volumeMap[log.areaId] || 0) + log.volume_ton; 
    });

    let totalVolume = 0;
    let totalTrucks = 0;
    const topKecamatan = [];

    for (const area of areas) {
      // Gunakan data prediksi hari ini jika ada, fallback ke normal_avg dari DB
      const volume = volumeMap[area.id] || area.normal_avg;
      const trucks = Math.ceil(volume / 5);
      
      let status = "SAFE";
      if (volume >= area.critical_threshold) status = "CRITICAL";
      else if (volume >= area.warning_threshold) status = "WARNING";

      totalVolume += volume;
      totalTrucks += trucks;
      
      topKecamatan.push({ 
        location: area.name, 
        volume_ton: Number(volume.toFixed(2)), 
        trucks, 
        status, 
        city: area.city 
      });
    }

    // Sortir berdasarkan volume tertinggi, ambil top 10
    topKecamatan.sort((a, b) => b.volume_ton - a.volume_ton);

    return res.status(200).json({
      status: "success",
      date: today.toISOString().split('T')[0],
      total_volume_ton: Number(totalVolume.toFixed(2)),
      total_trucks: totalTrucks,
      top_kecamatan: topKecamatan.slice(0, 10),
      rainy_regions: 0,
      event_today: null
    });

  } catch (error) {
    console.error("Autopilot Error:", error.message);
    return res.status(500).json({ 
      status: "error", 
      message: "Gagal memuat data autopilot." 
    });
  }
};