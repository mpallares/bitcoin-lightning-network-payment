/**
 * Transaction Routes
 *
 * Handles listing transactions and balance calculations
 */

import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { db } from '../db/database.js';
import { invoices, payments } from '../db/schema.js';
import { desc, eq, sql } from 'drizzle-orm';
import { getNodeBalance, getNodeInfo } from '../services/lightning.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * GET /api/transactions
 *
 * List all transactions (invoices and payments combined)
 */
router.get(
  '/transactions',
  [
    query('type')
      .optional()
      .isIn(['invoice', 'payment'])
      .withMessage('Type must be "invoice" or "payment"'),
    query('page')
      .optional()
      .isInt({ min: 1 })
      .toInt()
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .toInt()
      .withMessage('Limit must be between 1 and 100'),
  ],
  async (req: Request, res: Response): Promise<void> => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ errors: errors.array() });
        return;
      }

      const { type, page = 1, limit = 20 } = req.query as {
        type?: 'invoice' | 'payment';
        page?: number;
        limit?: number;
      };

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      // Query based on type filter
      let results: any[] = [];
      let total = 0;

      if (!type || type === 'invoice') {
        const invoiceResults = await db
          .select({
            paymentHash: invoices.paymentHash,
            type: sql<string>`'invoice'`,
            amount: invoices.amount,
            status: invoices.status,
            description: invoices.description,
            createdAt: invoices.createdAt,
            settledAt: invoices.settledAt,
          })
          .from(invoices)
          .orderBy(desc(invoices.createdAt))
          .limit(type === 'invoice' ? limitNum : 1000)
          .offset(type === 'invoice' ? offset : 0);

        results.push(...invoiceResults.map(r => ({ ...r, type: 'invoice' })));
      }

      if (!type || type === 'payment') {
        const paymentResults = await db
          .select({
            paymentHash: payments.paymentHash,
            type: sql<string>`'payment'`,
            amount: payments.amount,
            status: payments.status,
            description: payments.description,
            fee: payments.fee,
            createdAt: payments.createdAt,
            settledAt: payments.settledAt,
          })
          .from(payments)
          .orderBy(desc(payments.createdAt))
          .limit(type === 'payment' ? limitNum : 1000)
          .offset(type === 'payment' ? offset : 0);

        results.push(...paymentResults.map(r => ({ ...r, type: 'payment' })));
      }

      // Sort combined results by date
      results.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Get totals
      if (!type) {
        const invoiceCount = await db.select({ count: sql<number>`count(*)` }).from(invoices);
        const paymentCount = await db.select({ count: sql<number>`count(*)` }).from(payments);
        total = Number(invoiceCount[0].count) + Number(paymentCount[0].count);
        // Apply pagination to combined results
        results = results.slice(offset, offset + limitNum);
      } else if (type === 'invoice') {
        const countResult = await db.select({ count: sql<number>`count(*)` }).from(invoices);
        total = Number(countResult[0].count);
      } else {
        const countResult = await db.select({ count: sql<number>`count(*)` }).from(payments);
        total = Number(countResult[0].count);
      }

      res.json({
        success: true,
        data: {
          transactions: results,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      req.log?.error({ err: error }, 'Error listing transactions');
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to list transactions',
      });
    }
  }
);

/**
 * GET /api/balance
 *
 * Get balance information
 */
router.get('/balance', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get total received (succeeded invoices)
    const receivedResult = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(invoices)
      .where(eq(invoices.status, 'succeeded'));

    // Get total sent (succeeded payments)
    const sentResult = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(payments)
      .where(eq(payments.status, 'succeeded'));

    // Get total fees paid
    const feesResult = await db
      .select({ total: sql<number>`COALESCE(SUM(fee), 0)` })
      .from(payments)
      .where(eq(payments.status, 'succeeded'));

    const totalReceived = Number(receivedResult[0].total);
    const totalSent = Number(sentResult[0].total);
    const totalFees = Number(feesResult[0].total);

    // Also get live balances from nodes
    let nodeABalance, nodeBBalance;
    try {
      nodeABalance = await getNodeBalance('node_a');
      nodeBBalance = await getNodeBalance('node_b');
    } catch (error) {
      logger.warn({ error }, 'Could not fetch live node balances');
    }

    res.json({
      success: true,
      data: {
        recorded: {
          total_received: totalReceived,
          total_sent: totalSent,
          total_fees: totalFees,
          net_balance: totalReceived - totalSent - totalFees,
        },
        node_a: nodeABalance || null,
        node_b: nodeBBalance || null,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting balance');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get balance',
    });
  }
});

/**
 * GET /api/nodes
 *
 * Get information about both Lightning nodes
 */
router.get('/nodes', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [nodeA, nodeB] = await Promise.all([
      getNodeInfo('node_a'),
      getNodeInfo('node_b'),
    ]);

    res.json({
      success: true,
      data: {
        node_a: nodeA,
        node_b: nodeB,
      },
    });
  } catch (error: any) {
    logger.error({ err: error }, 'Error getting node info');
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get node info',
    });
  }
});

export default router;
