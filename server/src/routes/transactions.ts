/**
 * Transaction Routes
 *
 * Handles listing transactions and balance calculations
 */

import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { db } from '../db/database.js';
import { transactions } from '../db/schema.js';
import { desc, eq, sql, and } from 'drizzle-orm';
import { getNodeBalance, getNodeInfo } from '../services/lightning.js';
import { logger } from '../lib/logger.js';

const router = Router();

/**
 * GET /api/transactions
 *
 * List all transactions with optional filtering and pagination
 *
 * Query params:
 * - type: 'invoice' | 'payment' (optional)
 * - status: 'pending' | 'succeeded' | 'failed' | 'expired' (optional)
 * - node: 'node_a' | 'node_b' (optional)
 * - page: number (default 1)
 * - limit: number (default 20, max 100)
 */
router.get(
  '/transactions',
  [
    query('type')
      .optional()
      .isIn(['invoice', 'payment'])
      .withMessage('Type must be "invoice" or "payment"'),
    query('status')
      .optional()
      .isIn(['pending', 'succeeded', 'failed', 'expired'])
      .withMessage('Invalid status'),
    query('node')
      .optional()
      .isIn(['node_a', 'node_b'])
      .withMessage('Node must be "node_a" or "node_b"'),
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

      const {
        type,
        status,
        node,
        page = 1,
        limit = 20,
      } = req.query as {
        type?: 'invoice' | 'payment';
        status?: string;
        node?: string;
        page?: number;
        limit?: number;
      };

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      // Apply filters using where conditions
      const conditions = [];

      if (type) {
        conditions.push(eq(transactions.transactionType, type));
      }
      if (status) {
        conditions.push(eq(transactions.status, status as any));
      }
      if (node) {
        conditions.push(eq(transactions.nodeId, node));
      }

      // Execute query
      let results;
      if (conditions.length > 0) {
        results = await db
          .select()
          .from(transactions)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(transactions.createdAt))
          .limit(limitNum)
          .offset(offset);
      } else {
        results = await db
          .select()
          .from(transactions)
          .orderBy(desc(transactions.createdAt))
          .limit(limitNum)
          .offset(offset);
      }

      // Get total count
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(transactions);
      const total = Number(countResult[0].count);

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
 * Get balance information from recorded transactions
 * Shows: total received (invoices) - total sent (payments)
 */
router.get('/balance', async (_req: Request, res: Response): Promise<void> => {
  try {
    // Get total received (succeeded invoices)
    const receivedResult = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(transactions)
      .where(
        sql`${transactions.transactionType} = 'invoice' AND ${transactions.status} = 'succeeded'`
      );

    // Get total sent (succeeded payments)
    const sentResult = await db
      .select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(transactions)
      .where(
        sql`${transactions.transactionType} = 'payment' AND ${transactions.status} = 'succeeded'`
      );

    const totalReceived = Number(receivedResult[0].total);
    const totalSent = Number(sentResult[0].total);
    const netBalance = totalReceived - totalSent;

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
        // From database records
        recorded: {
          total_received: totalReceived,
          total_sent: totalSent,
          net_balance: netBalance,
        },
        // Live from nodes (if available)
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
