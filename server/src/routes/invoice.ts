/**
 * Invoice Routes
 *
 * Handles invoice creation and status checking on Node A (Alice/Receiver)
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { prisma } from '../db/database.js';
import {
  createInvoice,
  getInvoiceStatus,
  decodeInvoice,
} from '../services/lightning.js';

const router = Router();

/**
 * POST /api/invoice
 *
 * Create a new Lightning invoice on Node A
 */
router.post(
  '/',
  [
    body('amount')
      .isInt({ min: 1 })
      .withMessage('Amount must be a positive integer (satoshis)'),
    body('description')
      .optional()
      .isString()
      .isLength({ max: 256 })
      .withMessage('Description must be less than 256 characters'),
    body('expiry')
      .optional()
      .isInt({ min: 60, max: 86400 })
      .withMessage('Expiry must be between 60 and 86400 seconds'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { amount, description, expiry } = req.body;

      // Create invoice on LND
      const invoice = await createInvoice({ amount, description, expiry });

      // Save to invoices table
      await prisma.invoice.create({
        data: {
          paymentHash: invoice.payment_hash,
          paymentRequest: invoice.payment_request,
          amount: amount,
          status: 'pending',
          description: description || null,
          expiresAt: invoice.expires_at,
        },
      });

      res.status(201).json({
        success: true,
        data: invoice,
      });
    } catch (error: any) {
      req.log?.error({ err: error }, 'Error creating invoice');
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create invoice',
      });
    }
  }
);

/**
 * GET /api/invoice/:payment_hash
 *
 * Get invoice status by payment hash
 */
router.get(
  '/:payment_hash',
  [
    param('payment_hash')
      .isHexadecimal()
      .isLength({ min: 64, max: 64 })
      .withMessage('Payment hash must be a 64-character hex string'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { payment_hash } = req.params;

      // Get from database
      const dbInvoice = await prisma.invoice.findUnique({
        where: { paymentHash: payment_hash },
      });

      if (!dbInvoice) {
        res.status(404).json({
          success: false,
          error: 'Invoice not found',
        });
        return;
      }

      // Get current status from LND
      const lndStatus = await getInvoiceStatus(payment_hash);

      // Update database if status changed
      if (dbInvoice.status !== lndStatus.status) {
        const now = new Date();
        await prisma.invoice.update({
          where: { paymentHash: payment_hash },
          data: {
            status: lndStatus.status,
            preimage: lndStatus.preimage,
            settledAt: lndStatus.status === 'succeeded' ? now : null,
            updatedAt: now,
          },
        });
      }

      res.json({
        success: true,
        data: {
          payment_hash: dbInvoice.paymentHash,
          payment_request: dbInvoice.paymentRequest,
          amount: Number(dbInvoice.amount),
          description: dbInvoice.description,
          status: lndStatus.status,
          settled: lndStatus.settled,
          preimage: lndStatus.preimage,
          settled_at: dbInvoice.settledAt,
          expires_at: dbInvoice.expiresAt,
          created_at: dbInvoice.createdAt,
        },
      });
    } catch (error: any) {
      req.log?.error({ err: error }, 'Error getting invoice');
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get invoice',
      });
    }
  }
);

/**
 * POST /api/invoice/decode
 *
 * Decode a BOLT11 invoice string without paying it
 */
router.post(
  '/decode',
  [
    body('payment_request')
      .isString()
      .matches(/^ln(bc|tb|bcrt)/)
      .withMessage('Invalid Lightning invoice format'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { payment_request } = req.body;

      const decoded = await decodeInvoice(payment_request);

      res.json({
        success: true,
        data: decoded,
      });
    } catch (error: any) {
      req.log?.error({ err: error }, 'Error decoding invoice');
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to decode invoice',
      });
    }
  }
);

export default router;
