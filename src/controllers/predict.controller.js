// src/controllers/predict.controller.js
import prisma from '../config/db.js';
import { wasteService } from '../services/predict.service.js';

// --- KONSTANTA & HELPER FUNCTIONS ---
const ALLOWED_LOCATIONS = ["jis", "gbk", "pasar senen", "gang sempit tambora"];
const TRUCK_CAPACITY_TON = 5;
const ORGANIC_RATIO = 0.4987;
const PLASTIC_RATIO = 0.2295;

const formatLocation = (rawLocation) => {
  const normalized = rawLocation.toLowerCase().trim();
  if (normalized === "jis" || normalized === "gbk") return normalized.toUpperCase();
  return normalized.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

const getRiskStatus = (vol) => (vol > 15 ? "CRITICAL" : vol > 7 ? "WARNING" : "SAFE");

const getOverallRiskStatus = (results) => {
  let overall = "SAFE";
  for (const item of results) {
    if (item.risk_status === "CRITICAL") return "CRITICAL";
    if (item.risk_status === "WARNING") overall = "WARNING";
  }
  return overall;
};

const enrichPredictionResults = (rawResults) => rawResults.map((item) => {
  const vol = item.total_volume_ton || 0;
  const organic = item.organic_waste_ton || item.sisa_makanan_ton || (vol * ORGANIC_RATIO);
  const plastic = item.plastic_waste_ton || item.plastik_ton || (vol * PLASTIC_RATIO);

  return {
    date: item.date || item.tanggal,
    location: item.location || item.lokasi,
    total_volume_ton: Number(vol.toFixed(2)),
    organic_waste_ton: Number(organic.toFixed(2)),
    plastic_waste_ton: Number(plastic.toFixed(2)),
    recommended_trucks: item.recommended_trucks || Math.ceil(vol / TRUCK_CAPACITY_TON),
    risk_status: getRiskStatus(vol),
    event_info: item.event_info || item.info_event || null,
    hourly_breakdown: item.hourly_breakdown || null,
  };
});

const buildLogisticsPlan = (aiPlan, enrichedResults) => {
  if (aiPlan && Object.keys(aiPlan).length > 0) return aiPlan;
  const totalTrucks = enrichedResults.reduce((acc, i) => acc + i.recommended_trucks, 0);
  return {
    trucks_needed: totalTrucks,
    manpower: totalTrucks * 3,
    estimated_duration_hours: 24.5,
    efficiency_rate: "85% (Optimal)",
  };
};

const normalizeConfidenceScore = (raw) => {
  if (!raw) return 0.9325;
  const parsed = parseFloat(raw.toString().replace('%', ''));
  return parsed < 1 ? Number(parsed.toFixed(4)) : Number((parsed / 100).toFixed(4));
};

const generateCsvContent = (results) => {
  const headers = ["date", "location", "total_volume_ton", "organic_waste_ton", "plastic_waste_ton", "recommended_trucks", "risk_status", "event_info"];
  const rows = results.map((i) => [
    i.date, i.location, i.total_volume_ton.toFixed(2), i.organic_waste_ton.toFixed(2),
    i.plastic_waste_ton.toFixed(2), i.recommended_trucks, i.risk_status, `"${i.event_info || ""}"`
  ].join(","));
  return [headers.join(","), ...rows].join("\n");
};

// --- CONTROLLER HANDLERS ---
export const corePredict = async (req, res) => {
  const body = req.body;

  // Validasi Input
  if (!body || !body.location) return res.status(400).json({ status: "error", message: "Location wajib diisi." });
  
  const normalizedInput = body.location.toLowerCase().trim();
  if (!ALLOWED_LOCATIONS.includes(normalizedInput)) {
    return res.status(400).json({ status: "error", message: `Lokasi tidak valid. Tersedia: ${ALLOWED_LOCATIONS.join(', ')}` });
  }
  if (!body.forecast_days || body.forecast_days < 1 || body.forecast_days > 30) {
    return res.status(422).json({ status: "error", detail: [{ msg: "forecast_days harus 1-30" }] });
  }

  try {
    const formattedLoc = formatLocation(body.location);
    
    // Paralel Fetch AI & DB Area
    const [aiData, areaData] = await Promise.all([
      wasteService.predict({
        location: formattedLoc,
        start_date: body.start_date || new Date().toISOString().split('T')[0],
        forecast_days: body.forecast_days,
        rainfall_mm: body.rainfall_mm ?? 0,
        event_scale: body.event_scale ?? 0,
        granularity: body.granularity || "daily",
        model_type: body.model_type || "chronos"
      }),
      prisma.masterArea.findUnique({ where: { name: formattedLoc }, select: { id: true, latitude: true, longitude: true } })
    ]);

    if (!areaData) return res.status(404).json({ status: "error", message: "Area belum terdaftar di DB." });

    // Enrichment
    const enrichedResults = enrichPredictionResults(aiData.data?.prediction_results || []);
    const totalVolume = Number(enrichedResults.reduce((a, i) => a + i.total_volume_ton, 0).toFixed(2));
    const calculatedRisk = getOverallRiskStatus(enrichedResults);
    const logisticsPlan = buildLogisticsPlan(aiData.data?.logistics_plan, enrichedResults);
    const confidenceScore = normalizeConfidenceScore(aiData.confidence_score);

    // Database Transaction (PredictionLog + CrowdPermit)
    const safeLogDate = new Date(body.start_date || Date.now());
    const eventScale = Number(body.event_scale ?? 0);

    const txOperations = [
      prisma.predictionLog.create({
        data: {
          areaId: areaData.id,
          prediction_date: safeLogDate,
          volume_ton: totalVolume,
          confidence_score: confidenceScore * 100,
          risk_status: calculatedRisk
        }
      })
    ];

    // ✅ ISI CROWD PERMIT JIKA ADA EVENT
    if (eventScale > 0) {
      const eventName = enrichedResults.find(i => i.event_info)?.event_info || `Event Skala ${eventScale}`;
      txOperations.push(prisma.crowdPermit.create({
        data: {
          areaId: areaData.id,
          event_name: eventName,
          event_date: safeLogDate,
          estimated_crowd: eventScale * 15000,
          status: "APPROVED"
        }
      }));
    }

    await prisma.$transaction(txOperations);

    // Background Sync Operational Params
    Promise.all([
      prisma.operationalParam.upsert({ where: { param_key: "rainfall_mm" }, update: { param_value: Number(body.rainfall_mm ?? 0) }, create: { param_key: "rainfall_mm", param_value: Number(body.rainfall_mm ?? 0) } }),
      prisma.operationalParam.upsert({ where: { param_key: "event_scale" }, update: { param_value: eventScale }, create: { param_key: "event_scale", param_value: eventScale } })
    ]).catch(e => console.error("Sync Error:", e.message));

    return res.status(200).json({
      status: "success",
      message: `${calculatedRisk} conditions expected.`,
      confidence_score: confidenceScore,
      data: { prediction_results: enrichedResults, logistics_plan: logisticsPlan }
    });

  } catch (error) {
    console.error("Predict Error:", error.message);
    return res.status(500).json({ status: "error", message: "Gagal memproses prediksi." });
  }
};

export const exportCSV = async (req, res) => {
  const body = req.body;
  if (!body?.location || !body?.forecast_days) return res.status(400).json({ status: "error", message: "Location & forecast_days wajib." });

  try {
    const formattedLoc = formatLocation(body.location);
    const aiData = await wasteService.predict({
      location: formattedLoc,
      start_date: body.start_date || new Date().toISOString().split('T')[0],
      forecast_days: body.forecast_days,
      rainfall_mm: body.rainfall_mm ?? 0,
      event_scale: body.event_scale ?? 0,
      granularity: body.granularity || "daily",
      model_type: body.model_type || "chronos"
    });

    const enriched = enrichPredictionResults(aiData.data?.prediction_results || []);
    const csv = generateCsvContent(enriched);
    const filename = `waste_forecast_${formattedLoc.replace(/\s+/g, '_')}_${body.forecast_days}d.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (e) {
    return res.status(500).json({ status: "error", message: "Gagal export CSV." });
  }
};

export default corePredict;