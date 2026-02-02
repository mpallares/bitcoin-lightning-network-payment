/**
 * Database Connection with Drizzle ORM
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
import dotenv from 'dotenv';

dotenv.config();

const connectionString =
  process.env.DATABASE_URL ||
  `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'lightning_payments'}`;

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 2,
  onnotice: () => {},
});

export const db = drizzle(client, { schema });

export const testConnection = async (): Promise<boolean> => {
  try {
    await client`SELECT NOW()`;
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
};

export const closeConnection = async (): Promise<void> => {
  try {
    await client.end();
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error closing database connections:', error);
  }
};

export { client };
export default db;
