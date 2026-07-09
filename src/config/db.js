// src/config/db.js
import { PrismaClient } from '@prisma/client';

// Cegah multiple instances di development (hot-reload)
const globalForPrisma = global;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;