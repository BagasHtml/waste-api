import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const LOCATIONS = [
  { name: "JIS", latitude: -6.1244, longitude: 106.8622, city: "Jakarta Utara", normal_avg: 140, warning_threshold: 180, critical_threshold: 200 },
  { name: "GBK", latitude: -6.2183, longitude: 106.8022, city: "Jakarta Pusat", normal_avg: 250, warning_threshold: 320, critical_threshold: 350 },
  { name: "Pasar Senen", latitude: -6.1744, longitude: 106.8444, city: "Jakarta Pusat", normal_avg: 180, warning_threshold: 220, critical_threshold: 240 },
  { name: "Gang Sempit Tambora", latitude: -6.1500, longitude: 106.8000, city: "Jakarta Barat", normal_avg: 80, warning_threshold: 110, critical_threshold: 125 },
  { name: "Menteng", latitude: -6.1950, longitude: 106.8322, city: "Jakarta Pusat", normal_avg: 120, warning_threshold: 160, critical_threshold: 180 },
  { name: "Senen", latitude: -6.1822, longitude: 106.8452, city: "Jakarta Pusat", normal_avg: 180, warning_threshold: 220, critical_threshold: 240 },
  { name: "Cempaka Putih", latitude: -6.1802, longitude: 106.8686, city: "Jakarta Pusat", normal_avg: 90, warning_threshold: 120, critical_threshold: 140 },
  { name: "Johar Baru", latitude: -6.1866, longitude: 106.8572, city: "Jakarta Pusat", normal_avg: 70, warning_threshold: 95, critical_threshold: 110 },
  { name: "Kemayoran", latitude: -6.1628, longitude: 106.8438, city: "Jakarta Pusat", normal_avg: 180, warning_threshold: 220, critical_threshold: 240 },
  { name: "Sawah Besar", latitude: -6.1554, longitude: 106.8322, city: "Jakarta Pusat", normal_avg: 110, warning_threshold: 145, critical_threshold: 165 },
  { name: "Tanah Abang", latitude: -6.2104, longitude: 106.8122, city: "Jakarta Pusat", normal_avg: 250, warning_threshold: 320, critical_threshold: 350 },
  { name: "Gambir", latitude: -6.1764, longitude: 106.8190, city: "Jakarta Pusat", normal_avg: 150, warning_threshold: 195, critical_threshold: 215 },
  { name: "Penjaringan", latitude: -6.1264, longitude: 106.7822, city: "Jakarta Utara", normal_avg: 280, warning_threshold: 350, critical_threshold: 380 },
  { name: "Tanjung Priok", latitude: -6.1322, longitude: 106.8722, city: "Jakarta Utara", normal_avg: 260, warning_threshold: 320, critical_threshold: 350 },
  { name: "Koja", latitude: -6.1214, longitude: 106.9133, city: "Jakarta Utara", normal_avg: 190, warning_threshold: 240, critical_threshold: 270 },
  { name: "Cilincing", latitude: -6.1288, longitude: 106.9452, city: "Jakarta Utara", normal_avg: 290, warning_threshold: 370, critical_threshold: 400 },
  { name: "Pademangan", latitude: -6.1328, longitude: 106.8422, city: "Jakarta Utara", normal_avg: 140, warning_threshold: 180, critical_threshold: 200 },
  { name: "Kelapa Gading", latitude: -6.1552, longitude: 106.9022, city: "Jakarta Utara", normal_avg: 190, warning_threshold: 240, critical_threshold: 270 },
  { name: "Cengkareng", latitude: -6.1528, longitude: 106.7322, city: "Jakarta Barat", normal_avg: 340, warning_threshold: 420, critical_threshold: 460 },
  { name: "Grogol Petamburan", latitude: -6.1622, longitude: 106.7882, city: "Jakarta Barat", normal_avg: 220, warning_threshold: 280, critical_threshold: 310 },
  { name: "Kalideres", latitude: -6.1428, longitude: 106.7022, city: "Jakarta Barat", normal_avg: 260, warning_threshold: 330, critical_threshold: 360 },
  { name: "Kebon Jeruk", latitude: -6.1922, longitude: 106.7722, city: "Jakarta Barat", normal_avg: 210, warning_threshold: 260, critical_threshold: 290 },
  { name: "Kembangan", latitude: -6.1828, longitude: 106.7382, city: "Jakarta Barat", normal_avg: 180, warning_threshold: 230, critical_threshold: 250 },
  { name: "Palmerah", latitude: -6.2028, longitude: 106.7882, city: "Jakarta Barat", normal_avg: 160, warning_threshold: 200, critical_threshold: 220 },
  { name: "Taman Sari", latitude: -6.1454, longitude: 106.8182, city: "Jakarta Barat", normal_avg: 100, warning_threshold: 130, critical_threshold: 150 },
  { name: "Tambora", latitude: -6.1500, longitude: 106.8000, city: "Jakarta Barat", normal_avg: 80, warning_threshold: 110, critical_threshold: 125 },
  { name: "Cilandak", latitude: -6.2928, longitude: 106.7922, city: "Jakarta Selatan", normal_avg: 180, warning_threshold: 230, critical_threshold: 250 },
  { name: "Jagakarsa", latitude: -6.3328, longitude: 106.8222, city: "Jakarta Selatan", normal_avg: 220, warning_threshold: 280, critical_threshold: 310 },
  { name: "Kebayoran Baru", latitude: -6.2422, longitude: 106.7982, city: "Jakarta Selatan", normal_avg: 210, warning_threshold: 260, critical_threshold: 290 },
  { name: "Kebayoran Lama", latitude: -6.2488, longitude: 106.7722, city: "Jakarta Selatan", normal_avg: 230, warning_threshold: 290, critical_threshold: 320 },
  { name: "Mampang Prapatan", latitude: -6.2522, longitude: 106.8182, city: "Jakarta Selatan", normal_avg: 120, warning_threshold: 150, critical_threshold: 170 },
  { name: "Pancoran", latitude: -6.2622, longitude: 106.8382, city: "Jakarta Selatan", normal_avg: 130, warning_threshold: 160, critical_threshold: 180 },
  { name: "Pasar Minggu", latitude: -6.2828, longitude: 106.8438, city: "Jakarta Selatan", normal_avg: 240, warning_threshold: 300, critical_threshold: 330 },
  { name: "Pesanggrahan", latitude: -6.2588, longitude: 106.7588, city: "Jakarta Selatan", normal_avg: 160, warning_threshold: 200, critical_threshold: 220 },
  { name: "Setiabudi", latitude: -6.2228, longitude: 106.8282, city: "Jakarta Selatan", normal_avg: 190, warning_threshold: 240, critical_threshold: 270 },
  { name: "Tebet", latitude: -6.2288, longitude: 106.8482, city: "Jakarta Selatan", normal_avg: 170, warning_threshold: 210, critical_threshold: 230 },
  { name: "Cakung", latitude: -6.1828, longitude: 106.9482, city: "Jakarta Timur", normal_avg: 350, warning_threshold: 430, critical_threshold: 470 },
  { name: "Cipayung", latitude: -6.3128, longitude: 106.9022, city: "Jakarta Timur", normal_avg: 140, warning_threshold: 180, critical_threshold: 200 },
  { name: "Ciracas", latitude: -6.3228, longitude: 106.8782, city: "Jakarta Timur", normal_avg: 190, warning_threshold: 240, critical_threshold: 270 },
  { name: "Duren Sawit", latitude: -6.2228, longitude: 106.9282, city: "Jakarta Timur", normal_avg: 300, warning_threshold: 370, critical_threshold: 410 },
  { name: "Jatinegara", latitude: -6.2222, longitude: 106.8682, city: "Jakarta Timur", normal_avg: 240, warning_threshold: 300, critical_threshold: 330 },
  { name: "Kramat Jati", latitude: -6.2722, longitude: 106.8682, city: "Jakarta Timur", normal_avg: 220, warning_threshold: 270, critical_threshold: 300 },
  { name: "Makasar", latitude: -6.2622, longitude: 106.8782, city: "Jakarta Timur", normal_avg: 160, warning_threshold: 200, critical_threshold: 220 },
  { name: "Matraman", latitude: -6.2022, longitude: 106.8582, city: "Jakarta Timur", normal_avg: 130, warning_threshold: 160, critical_threshold: 180 },
  { name: "Pasar Rebo", latitude: -6.3122, longitude: 106.8522, city: "Jakarta Timur", normal_avg: 150, warning_threshold: 190, critical_threshold: 210 },
  { name: "Pulo Gadung", latitude: -6.1922, longitude: 106.8922, city: "Jakarta Timur", normal_avg: 220, warning_threshold: 270, critical_threshold: 300 },
  { name: "Kepulauan Seribu Utara", latitude: -5.5722, longitude: 106.5522, city: "Kepulauan Seribu", normal_avg: 11, warning_threshold: 15, critical_threshold: 18 },
  { name: "Kepulauan Seribu Selatan", latitude: -5.7722, longitude: 106.6522, city: "Kepulauan Seribu", normal_avg: 9, warning_threshold: 12, critical_threshold: 15 },
];

async function main() {
  console.log('🌱 Seeding 44 Kecamatan + Venue Aliases...');
  for (const loc of LOCATIONS) {
    await prisma.masterArea.upsert({ where: { name: loc.name }, update: loc, create: loc });
  }
  console.log(`✅ ${LOCATIONS.length} locations seeded successfully!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());