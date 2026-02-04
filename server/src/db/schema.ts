import {
  pgTable,
  varchar,
  bigint,
  text,
  timestamp,
  pgEnum,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Invoice Status Enum
 */
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'pending',
  'succeeded',
  'expired',
]);

/**
 * Payment Status Enum
 */
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'succeeded',
  'failed',
]);

/**
 * Invoices Table
 *
 * Stores Lightning invoices (receiving payments).
 * Created by Node A (Alice) when generating payment requests.
 */
export const invoices = pgTable(
  'invoices',
  {
    // Payment hash - unique identifier from Lightning Network
    paymentHash: varchar('payment_hash', { length: 64 }).primaryKey(),

    // BOLT11 invoice string (the payment request)
    paymentRequest: text('payment_request').notNull(),

    // Amount in satoshis
    amount: bigint('amount', { mode: 'number' }).notNull(),

    // Current status
    status: invoiceStatusEnum('status').notNull().default('pending'),

    // Human-readable description
    description: text('description'),

    // Payment preimage (revealed when paid - proof of payment)
    preimage: varchar('preimage', { length: 64 }),

    // When the invoice expires
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),

    // When the invoice was settled/paid
    settledAt: timestamp('settled_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    statusIdx: index('idx_invoices_status').on(table.status),
    createdIdx: index('idx_invoices_created').on(table.createdAt),
  })
);

/**
 * Payments Table
 *
 * Stores Lightning payments (sending payments).
 * Created by Node B (Bob) when paying invoices.
 */
export const payments = pgTable(
  'payments',
  {
    // Payment hash - unique identifier from Lightning Network
    paymentHash: varchar('payment_hash', { length: 64 }).primaryKey(),

    // BOLT11 invoice string that was paid
    paymentRequest: text('payment_request').notNull(),

    // Amount paid in satoshis
    amount: bigint('amount', { mode: 'number' }).notNull(),

    // Routing fee paid to intermediate nodes
    fee: bigint('fee', { mode: 'number' }).default(0),

    // Current status
    status: paymentStatusEnum('status').notNull().default('pending'),

    // Human-readable description (from invoice)
    description: text('description'),

    // Payment preimage (proof of payment)
    preimage: varchar('preimage', { length: 64 }),

    // Destination node public key
    destination: varchar('destination', { length: 66 }),

    // Error message if payment failed
    errorMessage: text('error_message'),

    // Number of retry attempts
    retryCount: bigint('retry_count', { mode: 'number' }).default(0),

    // Idempotency key to prevent duplicate payments
    idempotencyKey: varchar('idempotency_key', { length: 64 }),

    // When the payment was settled
    settledAt: timestamp('settled_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    statusIdx: index('idx_payments_status').on(table.status),
    createdIdx: index('idx_payments_created').on(table.createdAt),
    idempotencyIdx: uniqueIndex('idx_payments_idempotency')
      .on(table.idempotencyKey)
      .where(sql`idempotency_key IS NOT NULL`),
  })
);

/**
 * TypeScript Type Inference
 */

// Invoices
export type NewInvoice = typeof invoices.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;

// Payments
export type NewPayment = typeof payments.$inferInsert;
export type Payment = typeof payments.$inferSelect;
