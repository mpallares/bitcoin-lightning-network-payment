/**
 * Lightning Network Type Definitions
 *
 * This file contains TypeScript interfaces and types for Lightning Network
 * operations.
 */

/**
 * Transaction Type
 *
 * Represents whether this is an invoice (receiving) or payment (sending) transaction.
 */
export type TransactionType = 'invoice' | 'payment';

/**
 * Transaction Status
 *
 * Tracks the current state of a Lightning transaction:
 * - pending: Invoice created but not yet paid, or payment initiated but not confirmed
 * - succeeded: Payment completed successfully, funds transferred
 * - failed: Payment attempt failed (insufficient funds, route not found, etc.)
 * - expired: Invoice expired before being paid (Lightning invoices have time limits)
 */
export type TransactionStatus = 'pending' | 'succeeded' | 'failed' | 'expired';

/**
 * Node Identifier
 *
 * Identifies which Lightning node the transaction belongs to:
 * - node_a: Receiver node (generates invoices)
 * - node_b: Sender node (makes payments)
 */
export type NodeId = 'node_a' | 'node_b';

/**
 * Transaction Database Record
 *
 * Represents a complete transaction record as stored in PostgreSQL.
 * This matches the structure of the 'transactions' table.
 */
export interface Transaction {
  payment_hash: string; // Unique identifier for the payment (32-byte hex string)
  transaction_type: TransactionType; // 'invoice' or 'payment'
  amount: number; // Amount in satoshis
  status: TransactionStatus; // Current status
  payment_request: string | null; // BOLT11 invoice string (null for payments)
  preimage: string | null; // Payment proof (null until payment completes)
  description: string | null; // Optional payment description
  node_id: NodeId; // Which node this transaction belongs to
  expires_at: Date | null; // Invoice expiration time
  created_at: Date; // When record was created
  updated_at: Date; // When record was last updated
}

/**
 * Create Invoice Request
 *
 * Parameters needed to generate a new Lightning invoice.
 *
 * Example usage:
 * ```typescript
 * const request: CreateInvoiceRequest = {
 *   amount: 10000, // 10,000 satoshis = 0.0001 BTC
 *   description: 'Coffee payment',
 *   expiry: 3600 // 1 hour
 * };
 * ```
 */
export interface CreateInvoiceRequest {
  amount: number; // Amount in satoshis (must be positive)
  description?: string; // Optional description (shown to payer)
  expiry?: number; // Expiry time in seconds (default: 3600 = 1 hour)
}

/**
 * Invoice Response
 *
 * Data returned after successfully creating an invoice.
 * This is sent back to the frontend for display.
 */
export interface InvoiceResponse {
  payment_hash: string; // Unique payment identifier
  payment_request: string; // BOLT11 invoice string (what the payer needs)
  amount: number; // Amount in satoshis
  description: string | null; // Payment description
  expires_at: Date; // When this invoice expires
  created_at: Date; // When invoice was created
  qr_code?: string; // Base64-encoded QR code image (optional)
}

/**
 * Decoded Invoice Information
 *
 * Details extracted from a BOLT11 invoice string.
 * Used to show payment details before confirming payment.
 *
 * BOLT11 is the Lightning invoice format specification.
 * An invoice encodes:
 * - Amount (can be any amount, or 0 for user-specified amount)
 * - Payment hash (ensures payment goes to correct recipient)
 * - Expiry time
 * - Route hints (helps find path to recipient)
 * - Description/memo
 */
export interface DecodedInvoice {
  payment_hash: string; // What you're paying for
  amount: number; // Amount in satoshis (0 if no amount specified)
  description: string; // Payment description
  expires_at: Date; // When invoice expires
  destination: string; // Public key of the recipient node
  timestamp: number; // When invoice was created (Unix timestamp)
}

/**
 * Pay Invoice Request
 *
 * Parameters needed to pay a Lightning invoice.
 */
export interface PayInvoiceRequest {
  payment_request: string; // BOLT11 invoice string to pay
  amount?: number; // Optional: specify amount for zero-amount invoices
}

/**
 * Payment Response
 *
 * Result of a payment attempt.
 */
export interface PaymentResponse {
  payment_hash: string; // Identifier for this payment
  status: TransactionStatus; // 'pending', 'succeeded', or 'failed'
  preimage: string | null; // Proof of payment (only present if succeeded)
  amount: number; // Amount paid in satoshis
  fee: number; // Routing fee paid in satoshis
  payment_request: string; // Original invoice that was paid
  created_at: Date; // When payment was initiated
  error?: string; // Error message if payment failed
}

/**
 * Transaction List Response
 *
 * Response containing a list of transactions with optional pagination.
 */
export interface TransactionListResponse {
  transactions: Transaction[]; // Array of transaction records
  total: number; // Total number of transactions (for pagination)
  page: number; // Current page number
  limit: number; // Number of items per page
}

/**
 * Balance Information
 *
 * Node balance details showing available funds.
 */
export interface BalanceResponse {
  total_balance: number; // Total balance in satoshis
  confirmed_balance: number; // On-chain confirmed balance
  unconfirmed_balance: number; // On-chain unconfirmed balance
  channel_balance: number; // Balance in Lightning channels (available for instant payments)
  pending_channel_balance: number; // Balance in pending/opening channels
}

/**
 * Node Info
 *
 * Information about a Lightning node.
 */
export interface NodeInfo {
  identity_pubkey: string; // Node's public key (unique identifier)
  alias: string; // Human-readable node name
  num_active_channels: number; // Number of active payment channels
  num_pending_channels: number; // Number of channels being opened
  synced_to_chain: boolean; // Whether node is synced with blockchain
  block_height: number; // Current blockchain height the node knows about
  version: string; // LND software version
}

/**
 * Error Response
 *
 * Standardized error response format for API endpoints.
 */
export interface ErrorResponse {
  error: string; // Error message
  code?: string; // Error code (e.g., 'INSUFFICIENT_BALANCE')
  details?: any; // Additional error details
}

/**
 * LND API Invoice (from LND's gRPC/REST API)
 *
 * Structure of invoice data returned by LND.
 * Note: LND uses different field names and formats than our database.
 */
export interface LndInvoice {
  r_hash: Buffer | Uint8Array; // Payment hash (binary format)
  r_preimage?: Buffer | Uint8Array; // Preimage (only if paid)
  payment_request: string; // BOLT11 invoice string
  value: string; // Amount in satoshis (string format in LND)
  value_msat: string; // Amount in millisatoshis
  settled: boolean; // Whether invoice has been paid
  creation_date: string; // Unix timestamp
  expiry: string; // Expiry duration in seconds
  memo: string; // Invoice description
  state: string; // OPEN, SETTLED, CANCELED, ACCEPTED
}

/**
 * LND API Payment (from LND's gRPC/REST API)
 *
 * Structure of payment data returned by LND.
 */
export interface LndPayment {
  payment_hash: string; // Payment identifier
  payment_preimage: string; // Proof of payment (if successful)
  value: string; // Amount in satoshis
  value_msat: string; // Amount in millisatoshis
  fee: string; // Routing fee paid
  fee_msat: string; // Routing fee in millisatoshis
  status: string; // IN_FLIGHT, SUCCEEDED, FAILED
  failure_reason: string; // Reason if payment failed
  payment_request: string; // Original invoice
  creation_date: string; // Unix timestamp
}
