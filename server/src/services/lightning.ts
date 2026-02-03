/**
 * Lightning Network Service
 *
 * This service provides methods to interact with LND nodes using ln-service.
 */

import lnService from 'ln-service';
import {
  getNodeAConfig,
  getNodeBConfig,
  LightningNodeConfig,
} from '../config/lightning.js';
import {
  CreateInvoiceRequest,
  InvoiceResponse,
  DecodedInvoice,
  PayInvoiceRequest,
  PaymentResponse,
  BalanceResponse,
  NodeInfo,
} from '../types/lightning.js';
import QRCode from 'qrcode';
import { logger } from '../lib/logger.js';

/**
 * Authenticated LND Object
 */
interface AuthenticatedLnd {
  lnd: unknown;
}

/**
 * Create Authenticated LND Instance
 *
 * @param config - Node configuration (host, cert, macaroon)
 * @returns Authenticated LND instance
 */
const createLndInstance = (config: LightningNodeConfig): AuthenticatedLnd => {
  const { lnd } = lnService.authenticatedLndGrpc({
    socket: config.host,
    cert: config.cert.toString('base64'),
    macaroon: config.macaroon.toString('hex'),
  });

  return { lnd };
};

/**
 * Get Node A (Receiver/Alice) LND Instance
 */
export const getNodeALnd = (): AuthenticatedLnd => {
  const config = getNodeAConfig();
  return createLndInstance(config);
};

/**
 * Get Node B (Sender/Bob) LND Instance
 */
export const getNodeBLnd = (): AuthenticatedLnd => {
  const config = getNodeBConfig();
  return createLndInstance(config);
};

/**
 * Create Invoice on Node A (Alice)
 *
 * @param request - Invoice parameters (amount, description, expiry)
 * @returns Invoice details including payment_request string and QR code
 */
export const createInvoice = async (
  request: CreateInvoiceRequest
): Promise<InvoiceResponse> => {
  const { lnd } = getNodeALnd();

  const expirySeconds = request.expiry || 3600; // Default 1 hour

  const invoice = await lnService.createInvoice({
    lnd,
    tokens: request.amount,
    description: request.description || 'Lightning Payment',
    expires_at: new Date(Date.now() + expirySeconds * 1000).toISOString(),
  });

  // Generate QR code
  const qrCode = await QRCode.toDataURL(invoice.request, {
    width: 300,
    margin: 2,
  });

  return {
    payment_hash: invoice.id,
    payment_request: invoice.request,
    amount: request.amount,
    description: request.description || null,
    expires_at: new Date(Date.now() + expirySeconds * 1000),
    created_at: new Date(),
    qr_code: qrCode,
  };
};

/**
 * Decode Invoice
 *
 * Parses a BOLT11 invoice string to extract payment details.
 *
 * @param paymentRequest - BOLT11 invoice string
 * @returns Decoded invoice details
 */
export const decodeInvoice = async (
  paymentRequest: string
): Promise<DecodedInvoice> => {
  const { lnd } = getNodeBLnd();

  const decoded = await lnService.decodePaymentRequest({
    lnd,
    request: paymentRequest,
  });

  return {
    payment_hash: decoded.id,
    amount: decoded.tokens,
    description: decoded.description || '',
    expires_at: new Date(decoded.expires_at),
    destination: decoded.destination,
    timestamp: new Date(decoded.created_at).getTime(),
  };
};

/**
 * Pay Invoice from Node B (Bob)
 *
 * @param request - Payment parameters (invoice string)
 * @returns Payment result including preimage
 */
export const payInvoice = async (
  request: PayInvoiceRequest
): Promise<PaymentResponse> => {
  const { lnd } = getNodeBLnd();

  try {
    const decoded = await decodeInvoice(request.payment_request);

    const payment = await lnService.pay({
      lnd,
      request: request.payment_request,
    });

    return {
      payment_hash: payment.id,
      status: 'succeeded',
      preimage: payment.secret,
      amount: decoded.amount,
      fee: payment.fee || 0,
      payment_request: request.payment_request,
      created_at: new Date(),
    };
  } catch (error: any) {
    const errorMessage = error.message || 'Payment failed';

    // Try to get payment hash from decoded invoice
    let paymentHash = '';
    try {
      const decoded = await decodeInvoice(request.payment_request);
      paymentHash = decoded.payment_hash;
    } catch {
      // Ignore decode errors
    }

    return {
      payment_hash: paymentHash,
      status: 'failed',
      preimage: null,
      amount: 0,
      fee: 0,
      payment_request: request.payment_request,
      created_at: new Date(),
      error: errorMessage,
    };
  }
};

/**
 * Get Invoice Status from Node A
 *
 * @param paymentHash - The payment hash identifying the invoice
 * @returns Invoice status
 */
export const getInvoiceStatus = async (
  paymentHash: string
): Promise<{
  status: 'pending' | 'succeeded' | 'expired';
  settled: boolean;
  preimage: string | null;
}> => {
  const { lnd } = getNodeALnd();

  const invoice = await lnService.getInvoice({
    lnd,
    id: paymentHash,
  });

  let status: 'pending' | 'succeeded' | 'expired' = 'pending';

  if (invoice.is_confirmed) {
    status = 'succeeded';
  } else if (new Date(invoice.expires_at) < new Date()) {
    status = 'expired';
  }

  return {
    status,
    settled: invoice.is_confirmed,
    preimage: invoice.secret || null,
  };
};

/**
 * Get Payment Status from Node B
 *
 * @param paymentHash - The payment hash identifying the payment
 * @returns Payment status
 */
export const getPaymentStatus = async (
  paymentHash: string
): Promise<{
  status: 'pending' | 'succeeded' | 'failed';
  preimage: string | null;
}> => {
  const { lnd } = getNodeBLnd();

  try {
    const payment = await lnService.getPayment({
      lnd,
      id: paymentHash,
    });

    let status: 'pending' | 'succeeded' | 'failed' = 'pending';

    if (payment.is_confirmed) {
      status = 'succeeded';
    } else if (payment.is_failed) {
      status = 'failed';
    }

    return {
      status,
      preimage: payment.payment?.secret || null,
    };
  } catch {
    return {
      status: 'pending',
      preimage: null,
    };
  }
};

/**
 * Get Node Balance
 *
 * @param node - Which node ('node_a' or 'node_b')
 * @returns Balance details
 */
export const getNodeBalance = async (
  node: 'node_a' | 'node_b'
): Promise<BalanceResponse> => {
  const { lnd } = node === 'node_a' ? getNodeALnd() : getNodeBLnd();

  const chainBalance = await lnService.getChainBalance({ lnd });
  const channelBalance = await lnService.getChannelBalance({ lnd });

  return {
    total_balance: chainBalance.chain_balance + channelBalance.channel_balance,
    confirmed_balance: chainBalance.chain_balance,
    unconfirmed_balance: 0,
    channel_balance: channelBalance.channel_balance,
    pending_channel_balance: channelBalance.pending_balance || 0,
  };
};

/**
 * Get Node Info
 *
 * @param node - Which node ('node_a' or 'node_b')
 * @returns Node information
 */
export const getNodeInfo = async (
  node: 'node_a' | 'node_b'
): Promise<NodeInfo> => {
  const { lnd } = node === 'node_a' ? getNodeALnd() : getNodeBLnd();

  const info = await lnService.getWalletInfo({ lnd });

  return {
    identity_pubkey: info.public_key,
    alias: info.alias || 'Unknown',
    num_active_channels: info.active_channels_count,
    num_pending_channels: info.pending_channels_count,
    synced_to_chain: info.is_synced_to_chain,
    block_height: info.current_block_height,
    version: info.version || 'Unknown',
  };
};

/**
 * Test Node Connection
 *
 * @param node - Which node to test
 * @returns true if connection successful
 */
export const testNodeConnection = async (
  node: 'node_a' | 'node_b'
): Promise<boolean> => {
  try {
    const info = await getNodeInfo(node);
    logger.info(
      { node, alias: info.alias, pubkey: info.identity_pubkey.slice(0, 16) },
      'Connected to Lightning node'
    );
    return true;
  } catch (error) {
    logger.error({ node, error }, 'Failed to connect to Lightning node');
    return false;
  }
};

/**
 * Subscribe to Invoice Updates on Node A (Alice)
 *
 * Returns an EventEmitter that emits 'invoice_updated' events
 * when invoices are created, updated, or paid.
 *
 * @returns EventEmitter subscription
 */
export const subscribeToInvoiceUpdates = () => {
  const { lnd } = getNodeALnd();
  return lnService.subscribeToInvoices({ lnd });
};
