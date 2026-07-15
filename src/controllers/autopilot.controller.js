import prisma from '../config/db.js';

const TRUCK_CAPACITY_TON = 5;
const TOP_KECAMATAN_LIMIT = 10;
const CACHE_TTL_MS = 60 * 1000;

let cachedAutopilotData = null;
let cacheExpiryTime = 0;

const determineStatus = (volume, warningThreshold, criticalThreshold) => {
  if (volume >= criticalThreshold) return "CRITICAL";
  if (volume >= warningThreshold) return "WARNING";
  return "SAFE";
};

export const getAutopilot = async (req, res) => {
  try {
    const now = Date.now();

    if (cachedAutopilotData && now < cacheExpiryTime) {
      return res.status(200).json(cachedAutopilotData);
    }

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

    if (!areas || areas.length === 0) {
      return res.status(503).json({ status: "error", message: "Data kecamatan belum tersedia." });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayLogs = await prisma.predictionLog.findMany({ 
      where: { prediction_date: { gte: today } }, 
      select: { areaId: true, volume_ton: true } 
    });

    const volumeMap = todayLogs.reduce((acc, log) => {
      acc[log.areaId] = (acc[log.areaId] || 0) + log.volume_ton;
      return acc;
    }, {});

    let totalVolume = 0;
    let totalTrucks = 0;

    const processedAreas = areas.map(area => {
      const volume = volumeMap[area.id] ?? area.normal_avg;
      const trucks = Math.ceil(volume / TRUCK_CAPACITY_TON);
      const status = determineStatus(volume, area.warning_threshold, area.critical_threshold);

      totalVolume += volume;
      totalTrucks += trucks;

      return {
        location: area.name,
        city: area.city,
        latitude: area.latitude,
        longitude: area.longitude,
        volume_ton: Number(volume.toFixed(2)),
        trucks,
        status
      };
    });

    processedAreas.sort((a, b) => b.volume_ton - a.volume_ton);
    const topKecamatan = processedAreas.slice(0, TOP_KECAMATAN_LIMIT);

    const responseData = {
      status: "success",
      date: today.toISOString().split('T')[0],
      total_volume_ton: Number(totalVolume.toFixed(2)),
      total_trucks: totalTrucks,
      top_kecamatan: topKecamatan,
      rainy_regions: 0,  
      event_today: null  
    };

    cachedAutopilotData = responseData;
    cacheExpiryTime = now + CACHE_TTL_MS;

    return res.status(200).json(responseData);

  } catch (error) {
    console.error("Autopilot Error:", error.message);
    return res.status(500).json({ status: "error", message: "Gagal memuat data autopilot." });
  }
};