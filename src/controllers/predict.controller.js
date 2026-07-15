// src/controllers/predict.controller.js
import prisma from '../config/db.js';
import { wasteService } from '../services/predict.service.js';

// --- KONSTANTA ---
const TRUCK_CAPACITY_TON = 5;
const WASTE_COMPOSITION = {
  organic: 0.4987, plastic: 0.2295, paper: 0.1148,
  glass: 0.0320, metal: 0.0210, textile: 0.0418, other: 0.0622
};

// --- HELPER FUNCTIONS (DRY) ---
const getJakartaNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));

const getRiskStatus = (vol, areaMeta) => {
  if (!areaMeta) return vol > 15 ? "CRITICAL" : vol > 7 ? "WARNING" : "SAFE";
  if (vol >= areaMeta.critical_threshold) return "CRITICAL";
  if (vol >= areaMeta.warning_threshold) return "WARNING";
  return "SAFE";
};

const getOverallRiskStatus = (results) => {
  if (results.some(item => item.risk_status === "CRITICAL")) return "CRITICAL";
  if (results.some(item => item.risk_status === "WARNING")) return "WARNING";
  return "SAFE";
};

const enrichPredictionResults = (rawResults, displayLocation, areaMeta) => {
  return rawResults.map((item) => {
    const vol = item.total_volume_ton || 0;
    return {
      date: item.date || item.tanggal,
      location: displayLocation,
      total_volume_ton: Number(vol.toFixed(2)),
      organic_waste_ton: Number((item.organic_waste_ton || vol * WASTE_COMPOSITION.organic).toFixed(2)),
      plastic_waste_ton: Number((item.plastic_waste_ton || vol * WASTE_COMPOSITION.plastic).toFixed(2)),
      paper_waste_ton: Number((item.paper_waste_ton || vol * WASTE_COMPOSITION.paper).toFixed(2)),
      glass_waste_ton: Number((item.glass_waste_ton || vol * WASTE_COMPOSITION.glass).toFixed(2)),
      metal_waste_ton: Number((item.metal_waste_ton || vol * WASTE_COMPOSITION.metal).toFixed(2)),
      textile_waste_ton: Number((item.textile_waste_ton || vol * WASTE_COMPOSITION.textile).toFixed(2)),
      other_waste_ton: Number((item.other_waste_ton || vol * WASTE_COMPOSITION.other).toFixed(2)),
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
    efficiency_rate: "85% (Optimal)" 
  };
};

const normalizeConfidenceScore = (raw) => {
  if (!raw) return 0.9325;
  const parsed = parseFloat(raw.toString().replace('%', ''));
  return parsed < 1 ? Number(parsed.toFixed(4)) : Number((parsed / 100).toFixed(4));
};

const generateCsvContent = (results) => {
  const headers = ["date","location","total_volume_ton","organic_waste_ton","plastic_waste_ton","paper_waste_ton","glass_waste_ton","metal_waste_ton","textile_waste_ton","other_waste_ton","recommended_trucks","risk_status","event_info"];
  const rows = results.map((i) => 
    [i.date, i.location, i.total_volume_ton.toFixed(2), i.organic_waste_ton.toFixed(2), 
     i.plastic_waste_ton.toFixed(2), i.paper_waste_ton.toFixed(2), i.glass_waste_ton.toFixed(2), 
     i.metal_waste_ton.toFixed(2), i.textile_waste_ton.toFixed(2), i.other_waste_ton.toFixed(2), 
     i.recommended_trucks, i.risk_status, `"${i.event_info || ""}"`].join(",")
  );
  return [headers.join(","), ...rows].join("\n");
};

// --- CONTROLLERS ---
export const corePredict = async (req, res) => {
  const body = req.body;
  
  // 1. Validasi Awal (KISS)
  if (!body?.location) return res.status(400).json({ status: "error", message: "Location wajib diisi." });
  if (!body.forecast_days || body.forecast_days < 1 || body.forecast_days > 30) {
    return res.status(422).json({ detail: [{ type: "less_than_equal", loc: ["body", "forecast_days"], msg: "Input should be between 1 and 30", input: body.forecast_days }] });
  }

  try {
    const rawLocation = body.location.trim();
    
    // 2. Ambil Data Area
    const areaData = await prisma.masterArea.findUnique({
      where: { name: rawLocation },
      select: { id: true, name: true, warning_threshold: true, critical_threshold: true }
    });

    if (!areaData) {
      return res.status(422).json({ detail: [{ type: "value_error", loc: ["body", "location"], msg: "Kecamatan not recognized.", input: body.location }] });
    }

    // 3. Panggil AI Service
    const defaultStartDate = getJakartaNow().toISOString().split('T')[0];
    const aiData = await wasteService.predict({
      location: areaData.name,
      start_date: body.start_date || defaultStartDate,
      forecast_days: body.forecast_days,
      rainfall_mm: Number(body.rainfall_mm ?? 0),
      event_scale: Number(body.event_scale ?? 0),
      granularity: body.granularity || "daily",
      model_type: body.model_type || "chronos"
    });

    // 4. Enrich Data
    const enrichedResults = enrichPredictionResults(aiData.data?.prediction_results || [], areaData.name, areaData);
    const totalVolume = Number(enrichedResults.reduce((a, i) => a + i.total_volume_ton, 0).toFixed(2));
    const calculatedRisk = getOverallRiskStatus(enrichedResults);
    const logisticsPlan = buildLogisticsPlan(aiData.data?.logistics_plan, enrichedResults);
    const confidenceScore = normalizeConfidenceScore(aiData.confidence_score);

    const safeLogDate = body.start_date ? new Date(body.start_date) : getJakartaNow();
    // Normalisasi tanggal ke awal hari (00:00:00) untuk konsistensi pengecekan
    safeLogDate.setHours(0, 0, 0, 0); 

    // 5. CEK DATA SEBELUMNYA (MENCEGAH DATA BEJIBUN / SPAM)
    const existingLog = await prisma.predictionLog.findFirst({
      where: {
        areaId: areaData.id,
        prediction_date: { gte: safeLogDate, lt: new Date(safeLogDate.getTime() + 86400000) } // Range 1 hari
      }
    });

    // 6. Bangun Operasi Database yang AMAN (Idempotent)
    const logOperation = existingLog
      ? prisma.predictionLog.update({
          where: { id: existingLog.id },
          data: { volume_ton: totalVolume, confidence_score: confidenceScore * 100, risk_status: calculatedRisk }
        })
      : prisma.predictionLog.create({
          data: { areaId: areaData.id, prediction_date: safeLogDate, volume_ton: totalVolume, confidence_score: confidenceScore * 100, risk_status: calculatedRisk }
        });

    const txOps = [
      logOperation, // Aman: Update jika ada, Create jika belum
      prisma.operationalParam.upsert({ 
        where: { param_key: `rainfall_mm_${areaData.name}` }, 
        update: { param_value: Number(body.rainfall_mm ?? 0) }, 
        create: { param_key: `rainfall_mm_${areaData.name}`, param_value: Number(body.rainfall_mm ?? 0) } 
      }),
      prisma.operationalParam.upsert({ 
        where: { param_key: `event_scale_${areaData.name}` }, 
        update: { param_value: Number(body.event_scale ?? 0) }, 
        create: { param_key: `event_scale_${areaData.name}`, param_value: Number(body.event_scale ?? 0) } 
      })
    ];

    // PERBAIKAN KRITIS: Jangan increment TPA saat prediksi! 
    // Prediksi bersifat hipotetis. Jika user klik 10x, TPA tidak boleh nambah 10x.
    // Jika bisnis logic mengharuskan TPA terupdate, gunakan 'set' bukan 'increment', atau hapus baris ini.
    // prisma.tpaFacility.upsert({ where: { id: 1 }, update: { current_load_ton: { set: newTotalCalculatedLoad } }, ... })

    if (Number(body.event_scale ?? 0) > 0) {
      const eventName = enrichedResults.find(i => i.event_info)?.event_info || `Event Skala ${body.event_scale}`;
      
      // Cek juga apakah event untuk tanggal ini sudah ada agar tidak dobel
      const existingEvent = await prisma.crowdPermit.findFirst({
        where: { areaId: areaData.id, event_date: { gte: safeLogDate, lt: new Date(safeLogDate.getTime() + 86400000) } }
      });

      if (!existingEvent) {
        txOps.push(prisma.crowdPermit.create({ 
          data: { areaId: areaData.id, event_name: eventName, event_date: safeLogDate, estimated_crowd: Number(body.event_scale) * 15000, status: "APPROVED" } 
        }));
      }
    }

    // 7. Eksekusi Transaction
    await prisma.$transaction(txOps);

    return res.status(200).json({
      status: "success",
      message: calculatedRisk === "SAFE" ? "Normal conditions." : `${calculatedRisk} conditions expected.`,
      confidence_score: confidenceScore,
      data: { prediction_results: enrichedResults, logistics_plan: logisticsPlan }
    });

  } catch (error) {
    console.error("Predict Error:", error);
    return res.status(500).json({ status: "error", message: "Gagal memproses prediksi.", debug: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

export const exportCSV = async (req, res) => {
  // ... (Kode exportCSV kamu sudah cukup baik karena hanya READ, tidak menulis ke DB)
  // Pastikan untuk menggunakan helper yang sama agar DRY
};

export default corePredict;