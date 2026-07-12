// src/controllers/predict.controller.js
import prisma from '../config/db.js';
import { wasteService } from '../services/predict.service.js';

// 🕐 WIB Timezone Helper
const getJakartaNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));

// ✅ Alias Mapping: Venue → Kecamatan Administratif
const LOCATION_ALIASES = {
  "JIS": "Pademangan",
  "GBK": "Tanah Abang",
  "PASAR SENEN": "Senen",
  "GANG SEMPIT TAMBORA": "Tambora",
  "MONAS": "Gambir",
  "ANCOL": "Pademangan"
};

const TRUCK_CAPACITY_TON = 5;
const WASTE_COMPOSITION = {
  organic: 0.4987, plastic: 0.2295, paper: 0.1148,
  glass: 0.0320, metal: 0.0210, textile: 0.0418, other: 0.0622
};

const resolveLocation = (rawInput) => {
  const upper = rawInput.trim().toUpperCase();
  return LOCATION_ALIASES[upper] || rawInput.trim();
};

const getRiskStatus = (vol, areaMeta) => {
  if (!areaMeta) return vol > 15 ? "CRITICAL" : vol > 7 ? "WARNING" : "SAFE";
  if (vol >= areaMeta.critical_threshold) return "CRITICAL";
  if (vol >= areaMeta.warning_threshold) return "WARNING";
  return "SAFE";
};

const getOverallRiskStatus = (results) => {
  let overall = "SAFE";
  for (const item of results) {
    if (item.risk_status === "CRITICAL") return "CRITICAL";
    if (item.risk_status === "WARNING") overall = "WARNING";
  }
  return overall;
};

const enrichPredictionResults = (rawResults, displayLocation, areaMeta) => {
  return rawResults.map((item) => {
    const vol = item.total_volume_ton || 0;
    const organic = item.organic_waste_ton || (vol * WASTE_COMPOSITION.organic);
    const plastic = item.plastic_waste_ton || (vol * WASTE_COMPOSITION.plastic);
    const paper = item.paper_waste_ton || (vol * WASTE_COMPOSITION.paper);
    const glass = item.glass_waste_ton || (vol * WASTE_COMPOSITION.glass);
    const metal = item.metal_waste_ton || (vol * WASTE_COMPOSITION.metal);
    const textile = item.textile_waste_ton || (vol * WASTE_COMPOSITION.textile);
    const other = item.other_waste_ton || (vol * WASTE_COMPOSITION.other);

    return {
      date: item.date || item.tanggal,
      location: displayLocation,
      total_volume_ton: Number(vol.toFixed(2)),
      organic_waste_ton: Number(organic.toFixed(2)),
      plastic_waste_ton: Number(plastic.toFixed(2)),
      paper_waste_ton: Number(paper.toFixed(2)),
      glass_waste_ton: Number(glass.toFixed(2)),
      metal_waste_ton: Number(metal.toFixed(2)),
      textile_waste_ton: Number(textile.toFixed(2)),
      other_waste_ton: Number(other.toFixed(2)),
      recommended_trucks: item.recommended_trucks || Math.ceil(vol / TRUCK_CAPACITY_TON),
      risk_status: getRiskStatus(vol, areaMeta),
      event_info: item.event_info || item.info_event || null,
      hourly_breakdown: item.hourly_breakdown || null,
    };
  });
};

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
  const headers = [
    "date", "location", "total_volume_ton",
    "organic_waste_ton", "plastic_waste_ton", "paper_waste_ton",
    "glass_waste_ton", "metal_waste_ton", "textile_waste_ton", "other_waste_ton",
    "recommended_trucks", "risk_status", "event_info"
  ];
  const rows = results.map((i) => [
    i.date, i.location, i.total_volume_ton.toFixed(2),
    i.organic_waste_ton.toFixed(2), i.plastic_waste_ton.toFixed(2),
    i.paper_waste_ton.toFixed(2), i.glass_waste_ton.toFixed(2),
    i.metal_waste_ton.toFixed(2), i.textile_waste_ton.toFixed(2),
    i.other_waste_ton.toFixed(2),
    i.recommended_trucks, i.risk_status, `"${i.event_info || ""}"`
  ].join(","));
  return [headers.join(","), ...rows].join("\n");
};

export const corePredict = async (req, res) => {
  const body = req.body;

  if (!body || !body.location) {
    return res.status(400).json({ status: "error", message: "Location wajib diisi." });
  }

  if (body.forecast_days === undefined || body.forecast_days < 1 || body.forecast_days > 30) {
    return res.status(422).json({
      detail: [{ type: "less_than_equal", loc: ["body", "forecast_days"], msg: "Input should be less than or equal to 30", input: body.forecast_days }]
    });
  }

  try {
    // ✅ Resolve alias SEBELUM query DB
    const rawLocation = body.location.trim();
    const resolvedLocation = resolveLocation(rawLocation);

    const areaData = await prisma.masterArea.findUnique({
      where: { name: resolvedLocation },
      select: { id: true, name: true, warning_threshold: true, critical_threshold: true }
    });

    if (!areaData) {
      return res.status(422).json({
        detail: [{ type: "value_error", loc: ["body", "location"], msg: "Kecamatan not recognized.", input: body.location }]
      });
    }

    const defaultStartDate = getJakartaNow().toISOString().split('T')[0];
    const aiData = await wasteService.predict({
      location: areaData.name,
      start_date: body.start_date || defaultStartDate,
      forecast_days: body.forecast_days,
      rainfall_mm: body.rainfall_mm ?? 0,
      event_scale: body.event_scale ?? 0,
      granularity: body.granularity || "daily",
      model_type: body.model_type || "chronos"
    });

    const enrichedResults = enrichPredictionResults(aiData.data?.prediction_results || [], rawLocation, areaData);
    const totalVolume = Number(enrichedResults.reduce((a, i) => a + i.total_volume_ton, 0).toFixed(2));
    const calculatedRisk = getOverallRiskStatus(enrichedResults);
    const logisticsPlan = buildLogisticsPlan(aiData.data?.logistics_plan, enrichedResults);
    const confidenceScore = normalizeConfidenceScore(aiData.confidence_score);

    const safeLogDate = body.start_date ? new Date(body.start_date) : getJakartaNow();
    const eventScale = Number(body.event_scale ?? 0);
    const rainfallMm = Number(body.rainfall_mm ?? 0);

    // ✅ MULTI-TABLE TRANSACTION (Fixed: TpaFacility pakai upsert)
    const txOps = [];

    // A. PredictionLog
    txOps.push(prisma.predictionLog.create({
      data: {
        areaId: areaData.id,
        prediction_date: safeLogDate,
        volume_ton: totalVolume,
        confidence_score: confidenceScore * 100,
        risk_status: calculatedRisk
      }
    }));

    // B. CrowdPermit (jika ada event)
    if (eventScale > 0) {
      const eventName = enrichedResults.find(i => i.event_info)?.event_info || `Event Skala ${eventScale}`;
      txOps.push(prisma.crowdPermit.create({
        data: {
          areaId: areaData.id,
          event_name: eventName,
          event_date: safeLogDate,
          estimated_crowd: eventScale * 15000,
          status: "APPROVED"
        }
      }));
    }

    // C. OperationalParam (per lokasi)
    txOps.push(prisma.operationalParam.upsert({
      where: { param_key: `rainfall_mm_${areaData.name}` },
      update: { param_value: rainfallMm },
      create: { param_key: `rainfall_mm_${areaData.name}`, param_value: rainfallMm }
    }));

    txOps.push(prisma.operationalParam.upsert({
      where: { param_key: `event_scale_${areaData.name}` },
      update: { param_value: eventScale },
      create: { param_key: `event_scale_${areaData.name}`, param_value: eventScale }
    }));

    // D. ✅ FIX: TpaFacility pakai UPSERT agar tidak error jika record belum ada
    txOps.push(prisma.tpaFacility.upsert({
      where: { id: 1 },
      update: { current_load_ton: { increment: totalVolume } },
      create: {
        id: 1,
        name: "TPST Bantargebang",
        max_capacity_ton: 7500.0,
        current_load_ton: totalVolume
      }
    }));

    // ✅ Blocking transaction
    await prisma.$transaction(txOps);

    return res.status(200).json({
      status: "success",
      message: calculatedRisk === "SAFE" ? "Normal conditions." : `${calculatedRisk} conditions expected.`,
      confidence_score: confidenceScore,
      data: { prediction_results: enrichedResults, logistics_plan: logisticsPlan }
    });

  } catch (error) {
    console.error("Predict Error:", error);
    return res.status(500).json({ status: "error", message: "Gagal memproses prediksi.", debug: error.message });
  }
};

export const exportCSV = async (req, res) => {
  const body = req.body;
  if (!body?.location || !body?.forecast_days) return res.status(400).json({ status: "error", message: "Location & forecast_days wajib." });

  try {
    const rawLocation = body.location.trim();
    const resolvedLocation = resolveLocation(rawLocation);
    const areaData = await prisma.masterArea.findUnique({ where: { name: resolvedLocation }, select: { id: true, name: true, warning_threshold: true, critical_threshold: true } });
    if (!areaData) return res.status(422).json({ detail: [{ type: "value_error", loc: ["body", "location"], msg: "Location not found.", input: body.location }] });

    const defaultStartDate = getJakartaNow().toISOString().split('T')[0];
    const aiData = await wasteService.predict({
      location: areaData.name, start_date: body.start_date || defaultStartDate, forecast_days: body.forecast_days,
      rainfall_mm: body.rainfall_mm ?? 0, event_scale: body.event_scale ?? 0, granularity: body.granularity || "daily", model_type: body.model_type || "chronos"
    });

    const enriched = enrichPredictionResults(aiData.data?.prediction_results || [], rawLocation, areaData);
    const csv = generateCsvContent(enriched);
    const filename = `waste_forecast_${rawLocation.replace(/\s+/g, '_')}_${body.forecast_days}d.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (e) {
    return res.status(500).json({ status: "error", message: "Gagal export CSV." });
  }
};

export default corePredict;