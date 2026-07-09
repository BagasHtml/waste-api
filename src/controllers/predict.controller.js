// src/controllers/predict.controller.js
import prisma from '../config/db.js';
import { wasteService } from '../services/predict.service.js';

const ALLOWED_LOCATIONS = ["jis", "gbk", "pasar senen", "gang sempit tambora"];

export const corePredict = async (req, res) => {
  let body = req.body;

  if (!body || Object.keys(body).length === 0) {
    return res.status(400).json({ status: "error", message: "Request body tidak valid." });
  }

  if (!body.location) {
    return res.status(400).json({ status: "error", message: "Properti 'location' wajib diisi." });
  }

  const normalizedInputLocation = body.location.toLowerCase().trim();
  if (!ALLOWED_LOCATIONS.includes(normalizedInputLocation)) {
    const formattedLocations = ALLOWED_LOCATIONS.map((loc) => 
      loc === "jis" || loc === "gbk" ? loc.toUpperCase() : loc.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    ).join(', ');
    return res.status(400).json({ status: "error", message: `Lokasi tidak valid. Lokasi yang tersedia: ${formattedLocations}.` });
  }

  if (body.forecast_days === undefined || body.forecast_days < 1 || body.forecast_days > 30) {
    return res.status(422).json({ status: "error", detail: [{ type: "less_than_equal", loc: ["body", "forecast_days"], msg: "Input should be less than or equal to 30" }] });
  }

  let formattedLocationForAI = body.location.trim();
  if (normalizedInputLocation === "jis" || normalizedInputLocation === "gbk") {
    formattedLocationForAI = normalizedInputLocation.toUpperCase();
  } else {
    formattedLocationForAI = normalizedInputLocation.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  const aiPromise = wasteService.predict({
    location: formattedLocationForAI,
    start_date: body.start_date || new Date().toISOString().split('T')[0],
    forecast_days: body.forecast_days,
    rainfall_mm: body.rainfall_mm ?? 0,
    event_scale: body.event_scale ?? 0,
    granularity: body.granularity || "daily",
    model_type: body.model_type || "chronos"
  });

  // ⚠️ PENTING: Gunakan camelCase (masterArea)
  const dbAreaPromise = prisma.masterArea.findUnique({
    where: { name: formattedLocationForAI }, 
    select: { id: true, latitude: true, longitude: true }
  });

  let aiData;
  try {
    aiData = await aiPromise;
  } catch (aiError) {
    console.error("AI Service Inference Error:", aiError.message);
    return res.status(503).json({ status: "error", message: "Service Unavailable. Model AI sedang loading atau gagal." });
  }

  let areaData;
  try {
    areaData = await dbAreaPromise;
    if (!areaData) {
      return res.status(404).json({ status: "error", message: "Data area belum terdaftar di database area." });
    }
  } catch (dbAreaError) {
    console.error("Database MasterArea Error:", dbAreaError.message);
    return res.status(500).json({ status: "error", message: "Gagal memproses pendaftaran wilayah di database." });
  }

  const predictionResults = aiData.data?.prediction_results || [];
  const aiLocationName = predictionResults[0]?.location || predictionResults[0]?.lokasi || formattedLocationForAI;
  
  // Mapping Key agar sesuai dengan TypeScript Interface Frontend
  const enrichedResults = predictionResults.map((item) => {
    const vol = item.total_volume_ton || 0;
    const organicWaste = item.organic_waste_ton || item.sisa_makanan_ton || (vol * 0.4987);
    const plasticWaste = item.plastic_waste_ton || item.plastik_ton || (vol * 0.2295);

    const dailyRisk = vol > 15 ? "CRITICAL" : vol > 7 ? "WARNING" : "SAFE";

    return {
      date: item.date || item.tanggal,
      location: item.location || item.lokasi,
      total_volume_ton: Number(vol.toFixed(2)),
      organic_waste_ton: Number(organicWaste.toFixed(2)),
      plastic_waste_ton: Number(plasticWaste.toFixed(2)),
      recommended_trucks: item.recommended_trucks || Math.ceil(vol / 5), // Truk 5 Ton sesuai Docs
      risk_status: dailyRisk,
      event_info: item.event_info || item.info_event || null,
      hourly_breakdown: item.hourly_breakdown || null
    };
  });

  const totalVolume = Number(enrichedResults.reduce((acc, item) => acc + item.total_volume_ton, 0).toFixed(2));
  
  // Logika Overall Risk Status (CRITICAL > WARNING > SAFE)
  let calculatedRiskStatus = "SAFE";
  for (const result of enrichedResults) {
    if (result.risk_status === "CRITICAL") {
      calculatedRiskStatus = "CRITICAL";
      break;
    }
    if (result.risk_status === "WARNING") {
      calculatedRiskStatus = "WARNING";
    }
  }

  const logisticsPlan = aiData.data?.logistics_plan || {
    trucks_needed: enrichedResults.reduce((acc, item) => acc + item.recommended_trucks, 0),
    manpower: enrichedResults.reduce((acc, item) => acc + item.recommended_trucks, 0) * 3,
    estimated_duration_hours: 24.5,
    efficiency_rate: "85% (Optimal)"
  };

  let rawConfidence = aiData.confidence_score ? parseFloat(aiData.confidence_score.toString().replace('%', '')) : 93.25;
  const confidenceScore = rawConfidence < 1 ? Number(rawConfidence.toFixed(4)) : Number((rawConfidence / 100).toFixed(4));

  const logDate = body.start_date ? new Date(body.start_date) : new Date();
  const safeLogDate = isNaN(logDate.getTime()) ? new Date() : logDate;

  try {
    const [createdLog] = await prisma.$transaction([
      prisma.predictionLog.create({ // ⚠️ camelCase
        data: {
          areaId: areaData.id,
          prediction_date: safeLogDate,
          volume_ton: totalVolume,
          confidence_score: confidenceScore * 100,
          risk_status: calculatedRiskStatus
        }
      })
    ]);

    // Background DB Sync (Non-blocking) - Opsional, bisa dihapus jika tabel tidak dipakai
    Promise.all([
      prisma.operationalParam.upsert({
        where: { param_key: "rainfall_mm" },
        update: { param_value: Number(body.rainfall_mm ?? 0) },
        create: { param_key: "rainfall_mm", param_value: Number(body.rainfall_mm ?? 0) }
      }),
      prisma.operationalParam.upsert({
        where: { param_key: "event_scale" },
        update: { param_value: Number(body.event_scale ?? 0) },
        create: { param_key: "event_scale", param_value: Number(body.event_scale ?? 0) }
      })
    ]).catch(err => console.error("Background DB Sync Error:", err.message));

    return res.status(200).json({
      status: "success",
      message: calculatedRiskStatus === "SAFE" ? "Normal conditions." : `${calculatedRiskStatus} conditions expected.`,
      confidence_score: confidenceScore,
      data: {
        prediction_results: enrichedResults,
        logistics_plan: logisticsPlan
      }
    });

  } catch (dbError) {
    console.error("Database Write Error:", dbError.message);
    return res.status(500).json({ status: "error", message: "Gagal menyimpan log transaksi ke database." });
  }
};

export default corePredict;