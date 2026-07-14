// skrip-delete.js
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // 1. Hapus dulu data di tabel anak yang merujuk ke areaId
  await prisma.wasteTransaction.deleteMany({})
  await prisma.user.deleteMany({})

  // 2. Baru hapus data di MasterArea
  const deleteAreas = await prisma.masterArea.deleteMany({})
  console.log('Berhasil menghapus area:', deleteAreas)
}

main()