/**
 * Transaction Routes
 *
 * Handles listing transactions and balance calculations
 */

import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { prisma } from '../db/database.js';
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
        const invoiceResults = await prisma.invoice.findMany({
          orderBy: { createdAt: 'desc' },
          take: type === 'invoice' ? limitNum : 1000,
          skip: type === 'invoice' ? offset : 0,
          select: {
            paymentHash: true,
            amount: true,
            status: true,
            description: true,
            createdAt: true,
            settledAt: true,
          },
        });

        results.push(...invoiceResults.map(r => ({
          paymentHash: r.paymentHash,
          type: 'invoice' as const,
          amount: Number(r.amount),
          status: r.status,
          description: r.description,
          createdAt: r.createdAt,
          settledAt: r.settledAt,
        })));
      }

      if (!type || type === 'payment') {
        const paymentResults = await prisma.payment.findMany({
          orderBy: { createdAt: 'desc' },
          take: type === 'payment' ? limitNum : 1000,
          skip: type === 'payment' ? offset : 0,
          select: {
            paymentHash: true,
            amount: true,
            status: true,
            description: true,
            fee: true,
            createdAt: true,
            settledAt: true,
          },
        });

        results.push(...paymentResults.map(r => ({
          paymentHash: r.paymentHash,
          type: 'payment' as const,
          amount: Number(r.amount),
          status: r.status,
          description: r.description,
          fee: Number(r.fee),
          createdAt: r.createdAt,
          settledAt: r.settledAt,
        })));
      }

      // Sort combined results by date
      results.sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      // Get totals
      if (!type) {
        const [invoiceCount, paymentCount] = await Promise.all([
          prisma.invoice.count(),
          prisma.payment.count(),
        ]);
        total = invoiceCount + paymentCount;
        // Apply pagination to combined results
        results = results.slice(offset, offset + limitNum);
      } else if (type === 'invoice') {
        total = await prisma.invoice.count();
      } else {
        total = await prisma.payment.count();
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
    const receivedResult = await prisma.invoice.aggregate({
      _sum: { amount: true },
      where: { status: 'succeeded' },
    });

    // Get total sent (succeeded payments)
    const sentResult = await prisma.payment.aggregate({
      _sum: { amount: true },
      where: { status: 'succeeded' },
    });

    // Get total fees paid
    const feesResult = await prisma.payment.aggregate({
      _sum: { fee: true },
      where: { status: 'succeeded' },
    });

    const totalReceived = Number(receivedResult._sum.amount ?? 0);
    const totalSent = Number(sentResult._sum.amount ?? 0);
    const totalFees = Number(feesResult._sum.fee ?? 0);

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
