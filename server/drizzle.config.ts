/**
 * Drizzle Kit Configuration
 *
 * This file configures Drizzle Kit, the CLI tool for:
 * - Generating migrations
 * - Pushing schema changes directly to database
 * - Running Drizzle Studio (visual database browser)
 *
 * Commands:
 * - npm run db:generate  → Generate SQL migration files from schema changes
 * - npm run db:migrate   → Apply migrations to the database
 * - npm run db:push      → Push schema directly (skip migrations, good for dev)
 * - npm run db:studio    → Open Drizzle Studio in browser
 */

import type { Config } from 'drizzle-kit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export default {
  // Database dialect (postgres, mysql, or sqlite)
  dialect: 'postgresql',

  // Where your schema file(s) are located
  // Drizzle reads these to understand your database structure
  schema: './src/db/schema.ts',

  // Where to output generated migration files
  out: './drizzle',

  // Database connection details
  dbCredentials: {
    // Connection string (recommended for production)
    url:
      process.env.DATABASE_URL ||
      `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'postgres'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'lightning_payments'}`,
  },

  // Verbose logging for debugging
  verbose: true,

  // Strict mode: fail on warnings
  strict: true,
} satisfies Config;
