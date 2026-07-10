// src/controllers/alert.controller.js
import prisma from '../config/db.js';

// --- HELPER FUNCTIONS ---

/**
 * Menghitung rentang tanggal untuk alert (Hari ini s/d H+3)
 */
const getDateRange = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 3);

  return { start: today, end: endDate };
};

/**
 * Menormalisasi input lokasi dari query parameter
 */
const normalizeLocation = (rawLocation) => {
  if (!rawLocation) return null;
  return rawLocation.toString().toUpperCase().trim();
};

/**
 * Memformat data mentah dari DB agar sesuai dengan interface APIAlertResponse FE
 */
const formatAlertResponse = (alerts) => {
  return alerts.map((alert) => ({
    date: alert.prediction_date.toISOString().split('T')[0],
    location: alert.area.name,
    status: alert.risk_status,
    estimated_volume_ton: Number(alert.volume_ton.toFixed(2)),
    message: `Alert: ${alert.risk_status} volume expected at ${alert.area.name}`,
  }));
};

// --- CONTROLLER HANDLER ---

export const getAlerts = async (req, res) => {
  try {
    // 1. Persiapan Parameter Query
    const { start, end } = getDateRange();
    const normalizedLoc = normalizeLocation(req.query.location);

    // 2. Bangun Where Clause secara Dinamis
    const whereClause = {
      prediction_date: { gte: start, lte: end },
      risk_status: { in: ['WARNING', 'CRITICAL'] },
      ...(normalizedLoc && { area: { name: normalizedLoc } }),
    };

    // 3. Fetch Data dari Database
    const alerts = await prisma.predictionLog.findMany({
      where: whereClause,
      include: { area: { select: { name: true } } },
      orderBy: { prediction_date: 'asc' },
    });

    // 4. Format & Return Response
    const formattedAlerts = formatAlertResponse(alerts);

    return res.status(200).json({
      status: 'success',
      alert_count: formattedAlerts.length,
      alerts: formattedAlerts,
      last_updated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get Alerts Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data alerts.',
    });
  }
};