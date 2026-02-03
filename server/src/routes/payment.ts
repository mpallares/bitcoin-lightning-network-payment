/**
 * Payment Routes
 *
 * Handles payment execution and status checking on Node B (Bob/Sender)
 */

import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../db/database.js';
import { transactions } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import {
  payInvoice,
  getPaymentStatus,
  decodeInvoice,
} from '../services/lightning.js';

const router = Router();

/**
 * POST /api/payment
 *
 * Pay a Lightning invoice from Node B
 *
 * Body:
 * - payment_request: string (BOLT11 invoice, required)
 */
router.post(
  '/',
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

      // Decode invoice first to get details
      const decoded = await decodeInvoice(payment_request);

      // Check if invoice is expired
      if (new Date(decoded.expires_at) < new Date()) {
        res.status(400).json({
          success: false,
          error: 'Invoice has expired',
        });
        return;
      }

      // Execute payment
      const payment = await payInvoice({ payment_request });

      // Save to database
      await db.insert(transactions).values({
        paymentHash: decoded.payment_hash,
        transactionType: 'payment',
        amount: decoded.amount,
        status: payment.status,
        paymentRequest: payment_request,
        preimage: payment.preimage,
        description: decoded.description || null,
        nodeId: 'node_b',
      });

      // If payment succeeded, update the corresponding invoice record (if it exists in our db)
      if (payment.status === 'succeeded') {
        await db
          .update(transactions)
          .set({
            status: 'succeeded',
            preimage: payment.preimage,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(transactions.paymentHash, decoded.payment_hash),
              eq(transactions.transactionType, 'invoice')
            )
          );
      }

      res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (error: any) {
      req.log?.error({ err: error }, 'Error processing payment');
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to process payment',
      });
    }
  }
);

/**
 * GET /api/payment/:payment_hash
 *
 * Get payment status by payment hash
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

      const dbPayment = dbResult.find((t) => t.transactionType === 'payment');

      if (!dbPayment) {
        res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
        return;
      }

      // Get current status from LND
      const lndStatus = await getPaymentStatus(payment_hash);

      // Update database if status changed
      if (dbPayment.status !== lndStatus.status) {
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
          payment_hash: dbPayment.paymentHash,
          payment_request: dbPayment.paymentRequest,
          amount: dbPayment.amount,
          description: dbPayment.description,
          status: lndStatus.status,
          preimage: lndStatus.preimage,
          created_at: dbPayment.createdAt,
        },
      });
    } catch (error: any) {
      req.log?.error({ err: error }, 'Error getting payment');
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get payment',
      });
    }
  }
);

export default router;
