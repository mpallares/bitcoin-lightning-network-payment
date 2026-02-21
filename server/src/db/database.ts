/**
 * Database Connection with Prisma
 */

import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export const testConnection = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

export const closeConnection = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
};

export default prisma;
