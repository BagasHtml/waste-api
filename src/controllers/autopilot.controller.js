import prisma from '../config/db.js';

// Tambahkan ini di bagian atas file, di bawah import
const MAX_REALISTIC_VOLUME_PER_AREA = 600; // Batas maksimal realistis per kecamatan (sesuaikan jika perlu)

export const getAutopilot = async (req, res) => {
  try {
    const areas = await prisma.masterArea.findMany({
      select: { 
        id: true, 
        name: true, 
        city: true, 
        latitude: true, 
        longitude: true, 
        normal_avg: true, 
        warning_threshold: true, 
        critical_threshold: true 
      }
    });

    if (!areas || areas.length === 0) return res.status(503).json({ status: "error", message: "Data kecamatan belum tersedia." });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayLogs = await prisma.predictionLog.findMany({ where: { prediction_date: { gte: today } }, select: { areaId: true, volume_ton: true } });

    const volumeMap = {};
    todayLogs.forEach(log => { volumeMap[log.areaId] = (volumeMap[log.areaId] || 0) + log.volume_ton; });

    let totalVolume = 0, totalTrucks = 0;
    const topKecamatan = [];

    for (const area of areas) {
      // Ambil volume dari log hari ini, jika tidak ada pakai normal_avg
      let volume = volumeMap[area.id] || area.normal_avg;
      
      // 🛡️ SAFETY NET: Cegah angka tidak masuk akal dari AI atau data lama
      if (volume > MAX_REALISTIC_VOLUME_PER_AREA) {
        console.warn(`⚠️ Volume anomali terdeteksi di ${area.name}: ${volume} ton. Dibatasi ke ${MAX_REALISTIC_VOLUME_PER_AREA} ton.`);
        volume = MAX_REALISTIC_VOLUME_PER_AREA;
      }

      const trucks = Math.ceil(volume / 5);
      let status = "SAFE";
      if (volume >= area.critical_threshold) status = "CRITICAL";
      else if (volume >= area.warning_threshold) status = "WARNING";

      totalVolume += volume;
      totalTrucks += trucks;
      topKecamatan.push({ location: area.name, latitude: area.latitude, longitude: area.longitude, volume_ton: Number(volume.toFixed(2)), trucks, status, city: area.city });
    }

    topKecamatan.sort((a, b) => b.volume_ton - a.volume_ton);

    return res.status(200).json({
      status: "success", date: today.toISOString().split('T')[0],
      total_volume_ton: Number(totalVolume.toFixed(2)), total_trucks: totalTrucks,
      top_kecamatan: topKecamatan.slice(0, 10), rainy_regions: 0, event_today: null
    });
  } catch (error) {
    console.error("Autopilot Error:", error.message);
    return res.status(500).json({ status: "error", message: "Gagal memuat data autopilot." });
  }
};