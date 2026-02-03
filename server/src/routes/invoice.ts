/**
 * Invoice Routes
 *
 * Handles invoice creation and status checking on Node A (Alice/Receiver)
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../db/database.js';
import { transactions } from '../db/schema.js';
import { eq } from 'drizzle-orm';
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
 *
 * Body:
 * - amount: number (satoshis, required)
 * - description: string (optional)
 * - expiry: number (seconds, optional, default 3600)
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
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { amount, description, expiry } = req.body;

      // Create invoice on LND
      const invoice = await createInvoice({ amount, description, expiry });

      // Save to database
      await db.insert(transactions).values({
        paymentHash: invoice.payment_hash,
        transactionType: 'invoice',
        amount: amount,
        status: 'pending',
        paymentRequest: invoice.payment_request,
        description: description || null,
        nodeId: 'node_a',
        expiresAt: invoice.expires_at,
      });

      res.status(201).json({
        success: true,
        data: invoice,
      });
    } catch (error: any) {
      console.error('Error creating invoice:', error);
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
      const dbResult = await db
        .select()
        .from(transactions)
        .where(eq(transactions.paymentHash, payment_hash));

      if (dbResult.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Invoice not found',
        });
        return;
      }

      const dbInvoice = dbResult[0];

      // Get current status from LND
      const lndStatus = await getInvoiceStatus(payment_hash);

      // Update database if status changed
      if (dbInvoice.status !== lndStatus.status) {
        await db
          .update(transactions)
          .set({
            status: lndStatus.status,
            preimage: lndStatus.preimage,
            updatedAt: new Date(),
          })
          .where(eq(transactions.paymentHash, payment_hash));
      }

      res.json({
        success: true,
        data: {
          payment_hash: dbInvoice.paymentHash,
          payment_request: dbInvoice.paymentRequest,
          amount: dbInvoice.amount,
          description: dbInvoice.description,
          status: lndStatus.status,
          settled: lndStatus.settled,
          preimage: lndStatus.preimage,
          expires_at: dbInvoice.expiresAt,
          created_at: dbInvoice.createdAt,
        },
      });
    } catch (error: any) {
      console.error('Error getting invoice:', error);
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
      console.error('Error decoding invoice:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to decode invoice',
      });
    }
  }
);

export default router;
