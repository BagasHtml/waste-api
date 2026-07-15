import prisma from './src/config/db.js';

async function auditDatabase() {
  console.log("MEMULAI AUDIT DATABASE...\n");

  const areas = await prisma.masterArea.findMany({
    select: { name: true, normal_avg: true, warning_threshold: true, critical_threshold: true }
  });
  
  console.log("1. CEK NORMAL AVG (Mencari nilai > 800 ton):");
  const suspiciousAreas = areas.filter(a => a.normal_avg > 800);
  if (suspiciousAreas.length > 0) {
    suspiciousAreas.forEach(a => console.log(`   - ${a.name}: ${a.normal_avg} ton`));
  } else {
    console.log("   Aman. Semua normal_avg di bawah 800 ton.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayLogs = await prisma.predictionLog.findMany({
    where: {
      prediction_date: { gte: today, lt: tomorrow }
    },
    include: { area: { select: { name: true } } }
  });

  console.log(`\n2. CEK DUPLIKASI HARI INI:`);
  console.log(`   Total entri ditemukan: ${todayLogs.length} (Maksimal 44)`);
  
  if (todayLogs.length > 44) {
    console.log("   TERDETEKSI DUPLIKASI! Ada area yang tercatat lebih dari 1 kali hari ini.");
    const counts = {};
    todayLogs.forEach(log => {
      counts[log.area.name] = (counts[log.area.name] || 0) + 1;
    });
    Object.entries(counts).forEach(([name, count]) => {
      if (count > 1) console.log(`      -> ${name}: tercatat ${count} kali`);
    });
  } else {
    console.log("   Aman. Tidak ada duplikasi entri hari ini.");
  }

  await prisma.$disconnect();
}

auditDatabase().catch(console.error);