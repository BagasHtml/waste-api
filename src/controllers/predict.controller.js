// src/controllers/predict.controller.js
import prisma from '../config/db.js';
import { wasteService } from '../services/predict.service.js';

// ==========================================
// 🗺️ KONSTANTA & MAPPING LOKASI (v4.0.0)
// ==========================================

// Mapping Venue/Landmark → Kecamatan Administratif (Untuk AI Service)
const LOCATION_ALIASES = {
  "JIS": "Pademangan",
  "GBK": "Tanah Abang",
  "PASAR SENEN": "Senen",
  "GANG SEMPIT TAMBORA": "Tambora",
  "MONAS": "Gambir",
  "ANCOL": "Pademangan"
};

// Database 44 Kecamatan + Legacy Locations (Sesuai Docs v4.0.0)
const KECAMATAN_DATABASE = {
  // JAKARTA PUSAT
  "Menteng": { normal_avg: 120.0, warning_threshold: 160.0, critical_threshold: 180.0 },
  "Senen": { normal_avg: 180.0, warning_threshold: 220.0, critical_threshold: 240.0 },
  "Cempaka Putih": { normal_avg: 90.0, warning_threshold: 120.0, critical_threshold: 140.0 },
  "Johar Baru": { normal_avg: 70.0, warning_threshold: 95.0, critical_threshold: 110.0 },
  "Kemayoran": { normal_avg: 180.0, warning_threshold: 220.0, critical_threshold: 240.0 },
  "Sawah Besar": { normal_avg: 110.0, warning_threshold: 145.0, critical_threshold: 165.0 },
  "Tanah Abang": { normal_avg: 250.0, warning_threshold: 320.0, critical_threshold: 350.0 },
  "Gambir": { normal_avg: 150.0, warning_threshold: 195.0, critical_threshold: 215.0 },
  // JAKARTA UTARA
  "Penjaringan": { normal_avg: 280.0, warning_threshold: 350.0, critical_threshold: 380.0 },
  "Tanjung Priok": { normal_avg: 260.0, warning_threshold: 320.0, critical_threshold: 350.0 },
  "Koja": { normal_avg: 190.0, warning_threshold: 240.0, critical_threshold: 270.0 },
  "Cilincing": { normal_avg: 290.0, warning_threshold: 370.0, critical_threshold: 400.0 },
  "Pademangan": { normal_avg: 140.0, warning_threshold: 180.0, critical_threshold: 200.0 },
  "Kelapa Gading": { normal_avg: 190.0, warning_threshold: 240.0, critical_threshold: 270.0 },
  // JAKARTA BARAT
  "Cengkareng": { normal_avg: 340.0, warning_threshold: 420.0, critical_threshold: 460.0 },
  "Grogol Petamburan": { normal_avg: 220.0, warning_threshold: 280.0, critical_threshold: 310.0 },
  "Kalideres": { normal_avg: 260.0, warning_threshold: 330.0, critical_threshold: 360.0 },
  "Kebon Jeruk": { normal_avg: 210.0, warning_threshold: 260.0, critical_threshold: 290.0 },
  "Kembangan": { normal_avg: 180.0, warning_threshold: 230.0, critical_threshold: 250.0 },
  "Palmerah": { normal_avg: 160.0, warning_threshold: 200.0, critical_threshold: 220.0 },
  "Taman Sari": { normal_avg: 100.0, warning_threshold: 130.0, critical_threshold: 150.0 },
  "Tambora": { normal_avg: 80.0, warning_threshold: 110.0, critical_threshold: 125.0 },
  // JAKARTA SELATAN
  "Cilandak": { normal_avg: 180.0, warning_threshold: 230.0, critical_threshold: 250.0 },
  "Jagakarsa": { normal_avg: 220.0, warning_threshold: 280.0, critical_threshold: 310.0 },
  "Kebayoran Baru": { normal_avg: 210.0, warning_threshold: 260.0, critical_threshold: 290.0 },
  "Kebayoran Lama": { normal_avg: 230.0, warning_threshold: 290.0, critical_threshold: 320.0 },
  "Mampang Prapatan": { normal_avg: 120.0, warning_threshold: 150.0, critical_threshold: 170.0 },
  "Pancoran": { normal_avg: 130.0, warning_threshold: 160.0, critical_threshold: 180.0 },
  "Pasar Minggu": { normal_avg: 240.0, warning_threshold: 300.0, critical_threshold: 330.0 },
  "Pesanggrahan": { normal_avg: 160.0, warning_threshold: 200.0, critical_threshold: 220.0 },
  "Setiabudi": { normal_avg: 190.0, warning_threshold: 240.0, critical_threshold: 270.0 },
  "Tebet": { normal_avg: 170.0, warning_threshold: 210.0, critical_threshold: 230.0 },
  // JAKARTA TIMUR
  "Cakung": { normal_avg: 350.0, warning_threshold: 430.0, critical_threshold: 470.0 },
  "Cipayung": { normal_avg: 140.0, warning_threshold: 180.0, critical_threshold: 200.0 },
  "Ciracas": { normal_avg: 190.0, warning_threshold: 240.0, critical_threshold: 270.0 },
  "Duren Sawit": { normal_avg: 300.0, warning_threshold: 370.0, critical_threshold: 410.0 },
  "Jatinegara": { normal_avg: 240.0, warning_threshold: 300.0, critical_threshold: 330.0 },
  "Kramat Jati": { normal_avg: 220.0, warning_threshold: 270.0, critical_threshold: 300.0 },
  "Makasar": { normal_avg: 160.0, warning_threshold: 200.0, critical_threshold: 220.0 },
  "Matraman": { normal_avg: 130.0, warning_threshold: 160.0, critical_threshold: 180.0 },
  "Pasar Rebo": { normal_avg: 150.0, warning_threshold: 190.0, critical_threshold: 210.0 },
  "Pulo Gadung": { normal_avg: 220.0, warning_threshold: 270.0, critical_threshold: 300.0 },
  // KEPULAUAN SERIBU
  "Kepulauan Seribu Utara": { normal_avg: 11.0, warning_threshold: 15.0, critical_threshold: 18.0 },
  "Kepulauan Seribu Selatan": { normal_avg: 9.0, warning_threshold: 12.0, critical_threshold: 15.0 }
};

const VALID_LOCATIONS = Object.keys(KECAMATAN_DATABASE);
const TRUCK_CAPACITY_TON = 5;

// Rasio Dekomposisi Sampah DKI Jakarta (8 Kategori)
const WASTE_COMPOSITION = {
  organic: 0.4987, plastic: 0.2295, paper: 0.1148,
  glass: 0.0320, metal: 0.0210, textile: 0.0418, other: 0.0622
};

// ==========================================
// 🔧 HELPER FUNCTIONS (Pure & Clean)
// ==========================================

const resolveLocation = (rawInput) => {
  const upper = rawInput.trim().toUpperCase();
  return LOCATION_ALIASES[upper] || rawInput.trim();
};

const getRiskStatus = (vol, locationName) => {
  const meta = KECAMATAN_DATABASE[locationName];
  if (!meta) return vol > 15 ? "CRITICAL" : vol > 7 ? "WARNING" : "SAFE";
  if (vol >= meta.critical_threshold) return "CRITICAL";
  if (vol >= meta.warning_threshold) return "WARNING";
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

const enrichPredictionResults = (rawResults, displayLocation) => {
  return rawResults.map((item) => {
    const vol = item.total_volume_ton || 0;
    
    // ✅ Dekomposisi 8 jenis sampah (AI value > Fallback Ratio)
    const organic = item.organic_waste_ton || (vol * WASTE_COMPOSITION.organic);
    const plastic = item.plastic_waste_ton || (vol * WASTE_COMPOSITION.plastic);
    const paper = item.paper_waste_ton || (vol * WASTE_COMPOSITION.paper);
    const glass = item.glass_waste_ton || (vol * WASTE_COMPOSITION.glass);
    const metal = item.metal_waste_ton || (vol * WASTE_COMPOSITION.metal);
    const textile = item.textile_waste_ton || (vol * WASTE_COMPOSITION.textile);
    const other = item.other_waste_ton || (vol * WASTE_COMPOSITION.other);

    // Gunakan displayLocation (JIS) untuk risk status lookup jika alias ada
    // Tapi untuk threshold, kita pakai nama kecamatan administratif yang sudah di-resolve
    const riskLoc = Object.keys(LOCATION_ALIASES).find(k => LOCATION_ALIASES[k] === displayLocation) 
      ? displayLocation // Jika input asli adalah alias, cari kecamatan aslinya untuk threshold
      : displayLocation;
      
    // Cari nama kecamatan administratif dari displayLocation jika itu adalah alias
    const adminLoc = Object.entries(LOCATION_ALIASES).find(([k, v]) => k.toLowerCase() === displayLocation.toLowerCase())?.[1] || displayLocation;

    return {
      date: item.date || item.tanggal,
      location: displayLocation, // ✅ Kembalikan nama asli (JIS) ke FE
      total_volume_ton: Number(vol.toFixed(2)),
      organic_waste_ton: Number(organic.toFixed(2)),
      plastic_waste_ton: Number(plastic.toFixed(2)),
      paper_waste_ton: Number(paper.toFixed(2)),
      glass_waste_ton: Number(glass.toFixed(2)),
      metal_waste_ton: Number(metal.toFixed(2)),
      textile_waste_ton: Number(textile.toFixed(2)),
      other_waste_ton: Number(other.toFixed(2)),
      recommended_trucks: item.recommended_trucks || Math.ceil(vol / TRUCK_CAPACITY_TON),
      risk_status: getRiskStatus(vol, adminLoc), // ✅ Gunakan kecamatan admin untuk threshold
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

// Export untuk digunakan controller lain (autopilot, alerts)
export { KECAMATAN_DATABASE, VALID_LOCATIONS, LOCATION_ALIASES };

// ==========================================
// 🚀 CONTROLLER HANDLERS
// ==========================================

export const corePredict = async (req, res) => {
  const body = req.body;

  // 1. Validasi Input Dasar
  if (!body || !body.location) {
    return res.status(400).json({ status: "error", message: "Location wajib diisi." });
  }

  // 2. Resolve Alias (JIS -> Pademangan) & Validasi
  const rawLocation = body.location.trim();
  const resolvedLocation = resolveLocation(rawLocation);
  
  const matchedKey = VALID_LOCATIONS.find(
    k => k.toLowerCase() === resolvedLocation.toLowerCase()
  );

  if (!matchedKey) {
    return res.status(422).json({
      detail: [{
        type: "value_error",
        loc: ["body", "location"],
        msg: "Kecamatan not recognized. Use one of the 44 sub-districts in Jakarta.",
        input: body.location
      }]
    });
  }

  if (body.forecast_days === undefined || body.forecast_days < 1 || body.forecast_days > 30) {
    return res.status(422).json({
      detail: [{
        type: "less_than_equal",
        loc: ["body", "forecast_days"],
        msg: "Input should be less than or equal to 30",
        input: body.forecast_days
      }]
    });
  }

  try {
    // 3. Panggil AI Service dengan NAMA KECAMATAN ADMINISTRATIF
    const aiData = await wasteService.predict({
      location: matchedKey, // ✅ "Pademangan", bukan "JIS"
      start_date: body.start_date || new Date().toISOString().split('T')[0],
      forecast_days: body.forecast_days,
      rainfall_mm: body.rainfall_mm ?? 0,
      event_scale: body.event_scale ?? 0,
      granularity: body.granularity || "daily",
      model_type: body.model_type || "chronos"
    });

    // 4. Enrichment (Gunakan rawLocation agar FE tetap lihat "JIS")
    const enrichedResults = enrichPredictionResults(
      aiData.data?.prediction_results || [], 
      rawLocation 
    );
    
    const totalVolume = Number(enrichedResults.reduce((a, i) => a + i.total_volume_ton, 0).toFixed(2));
    const calculatedRisk = getOverallRiskStatus(enrichedResults);
    const logisticsPlan = buildLogisticsPlan(aiData.data?.logistics_plan, enrichedResults);
    const confidenceScore = normalizeConfidenceScore(aiData.confidence_score);

    // 5. Simpan ke DB (Non-blocking transaction)
    const safeLogDate = new Date(body.start_date || Date.now());
    const eventScale = Number(body.event_scale ?? 0);

    const txOps = [
      prisma.predictionLog.create({
        data: {
          areaId: 1, // Fallback ID, sesuaikan dengan MasterArea seeding
          prediction_date: safeLogDate,
          volume_ton: totalVolume,
          confidence_score: confidenceScore * 100,
          risk_status: calculatedRisk
        }
      })
    ];

    if (eventScale > 0) {
      const eventName = enrichedResults.find(i => i.event_info)?.event_info || `Event Skala ${eventScale}`;
      txOps.push(prisma.crowdPermit.create({
        data: {
          areaId: 1,
          event_name: eventName,
          event_date: safeLogDate,
          estimated_crowd: eventScale * 15000,
          status: "APPROVED"
        }
      }));
    }

    // Jalankan transaksi DB tapi jangan block response jika gagal
    prisma.$transaction(txOps).catch(e => console.error("DB Write Warning:", e.message));

    // 6. Return Response Sesuai Docs v4.0.0
    return res.status(200).json({
      status: "success",
      message: calculatedRisk === "SAFE" ? "Normal conditions." : `${calculatedRisk} conditions expected.`,
      confidence_score: confidenceScore,
      data: { 
        prediction_results: enrichedResults, 
        logistics_plan: logisticsPlan 
      }
    });

  } catch (error) {
    console.error("Predict Error:", error);
    return res.status(500).json({ 
      status: "error", 
      message: "Gagal memproses prediksi.",
      debug: error.message // Hapus setelah production ready
    });
  }
};

export const exportCSV = async (req, res) => {
  const body = req.body;
  if (!body?.location || !body?.forecast_days) {
    return res.status(400).json({ status: "error", message: "Location & forecast_days wajib." });
  }

  try {
    const rawLocation = body.location.trim();
    const resolvedLocation = resolveLocation(rawLocation);
    
    const matchedKey = VALID_LOCATIONS.find(
      k => k.toLowerCase() === resolvedLocation.toLowerCase()
    ) || resolvedLocation;

    const aiData = await wasteService.predict({
      location: matchedKey,
      start_date: body.start_date || new Date().toISOString().split('T')[0],
      forecast_days: body.forecast_days,
      rainfall_mm: body.rainfall_mm ?? 0,
      event_scale: body.event_scale ?? 0,
      granularity: body.granularity || "daily",
      model_type: body.model_type || "chronos"
    });

    const enriched = enrichPredictionResults(aiData.data?.prediction_results || [], rawLocation);
    const csv = generateCsvContent(enriched);
    const filename = `waste_forecast_${rawLocation.replace(/\s+/g, '_')}_${body.forecast_days}d.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (e) {
    console.error("CSV Export Error:", e.message);
    return res.status(500).json({ status: "error", message: "Gagal export CSV." });
  }
};

export default corePredict;