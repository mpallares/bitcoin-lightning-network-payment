/**
 * Payment Routes
 *
 * Handles payment execution and status checking on Node B (Bob/Sender)
 */

import { Router, Request, Response } from 'express';
import { body, param, header, validationResult } from 'express-validator';
import { prisma } from '../db/database.js';
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
 */
router.post(
  '/',
  [
    body('payment_request')
      .isString()
      .matches(/^ln(bc|tb|bcrt)/)
      .withMessage('Invalid Lightning invoice format'),
    header('x-idempotency-key')
      .optional()
      .isString()
      .isLength({ min: 8, max: 64 })
      .withMessage('Idempotency key must be 8-64 characters'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { payment_request } = req.body;
      const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

      // Check for existing payment with same idempotency key
      if (idempotencyKey) {
        const existingPayment = await prisma.payment.findFirst({
          where: { idempotencyKey },
        });

        if (existingPayment) {
          req.log?.info({ idempotencyKey }, 'Returning cached payment (idempotency)');
          res.status(200).json({
            success: true,
            data: {
              payment_hash: existingPayment.paymentHash,
              status: existingPayment.status,
              preimage: existingPayment.preimage,
              amount: Number(existingPayment.amount),
              fee: Number(existingPayment.fee),
              payment_request: existingPayment.paymentRequest,
              created_at: existingPayment.createdAt,
              cached: true,
            },
          });
          return;
        }
      }

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
      const now = new Date();

      // Map status to payment status enum (payments don't have 'expired')
      const paymentStatus = payment.status === 'expired' ? 'failed' : payment.status;

      // Save to payments table
      await prisma.payment.create({
        data: {
          paymentHash: decoded.payment_hash,
          paymentRequest: payment_request,
          amount: decoded.amount,
          fee: payment.fee || 0,
          status: paymentStatus as 'pending' | 'succeeded' | 'failed',
          description: decoded.description || null,
          preimage: payment.preimage,
          destination: decoded.destination,
          errorMessage: payment.error || null,
          retryCount: 0,
          idempotencyKey: idempotencyKey || null,
          settledAt: payment.status === 'succeeded' ? now : null,
        },
      });

      // If payment succeeded, update the corresponding invoice (if it exists in our db)
      if (payment.status === 'succeeded') {
        await prisma.invoice.updateMany({
          where: { paymentHash: decoded.payment_hash },
          data: {
            status: 'succeeded',
            preimage: payment.preimage,
            settledAt: now,
            updatedAt: now,
          },
        });
      }

      res.status(201).json({
        success: true,
        data: {
          payment_hash: decoded.payment_hash,
          status: payment.status,
          preimage: payment.preimage,
          amount: decoded.amount,
          fee: payment.fee || 0,
          payment_request: payment_request,
          created_at: now,
        },
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
      const dbPayment = await prisma.payment.findUnique({
        where: { paymentHash: payment_hash },
      });

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
        const now = new Date();
        await prisma.payment.update({
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
          payment_hash: dbPayment.paymentHash,
          payment_request: dbPayment.paymentRequest,
          amount: Number(dbPayment.amount),
          fee: Number(dbPayment.fee),
          description: dbPayment.description,
          status: lndStatus.status,
          preimage: lndStatus.preimage,
          destination: dbPayment.destination,
          error_message: dbPayment.errorMessage,
          retry_count: Number(dbPayment.retryCount),
          settled_at: dbPayment.settledAt,
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
