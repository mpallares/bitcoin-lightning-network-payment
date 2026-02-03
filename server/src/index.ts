/**
 * Lightning Network Payment Server
 *
 * Express server that connects to LND nodes via ln-service
 * and provides REST API for creating invoices and making payments.
 * Uses Socket.IO for real-time invoice status updates.
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, closeConnection } from './db/database.js';
import { testNodeConnection, subscribeToInvoiceUpdates } from './services/lightning.js';
import invoiceRoutes from './routes/invoice.js';
import paymentRoutes from './routes/payment.js';
import transactionRoutes from './routes/transactions.js';
import { logger } from './lib/logger.js';
import { requestLogger } from './middleware/requestLogger.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3001;

// Socket.IO setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(requestLogger);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/invoice', invoiceRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api', transactionRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  req.log?.error({ err }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
  });
});

/**
 * Setup Socket.IO connections and LND invoice subscription
 */
function setupWebSocket() {
  // Track connected clients
  io.on('connection', (socket) => {
    logger.info({ socketId: socket.id }, 'Client connected');

    socket.on('disconnect', () => {
      logger.info({ socketId: socket.id }, 'Client disconnected');
    });
  });

  // Subscribe to LND invoice updates
  try {
    const invoiceSub = subscribeToInvoiceUpdates();

    invoiceSub.on('invoice_updated', (invoice: any) => {
      logger.info(
        { paymentHash: invoice.id, status: invoice.is_confirmed ? 'PAID' : 'pending' },
        'Invoice updated'
      );

      // Emit to all connected clients
      io.emit('invoice:updated', {
        payment_hash: invoice.id,
        status: invoice.is_confirmed ? 'succeeded' : invoice.is_canceled ? 'expired' : 'pending',
        amount: invoice.tokens,
        preimage: invoice.secret || null,
        settled_at: invoice.confirmed_at || null,
      });
    });

    invoiceSub.on('error', (err: any) => {
      logger.error({ err }, 'Invoice subscription error');
    });

    logger.info('Subscribed to LND invoice updates');
  } catch (error) {
    logger.warn({ error }, 'Could not subscribe to invoice updates');
  }
}

/**
 * Start Server
 */
async function startServer() {
  logger.info('Starting Lightning Network Payment Server');

  // Test database connection
  logger.info('Testing database connection...');
  const dbConnected = await testConnection();
  if (!dbConnected) {
    logger.fatal('Cannot start server without database connection');
    process.exit(1);
  }

  // Test Lightning node connections
  logger.info('Testing Lightning node connections...');

  try {
    const nodeAConnected = await testNodeConnection('node_a');
    const nodeBConnected = await testNodeConnection('node_b');

    if (!nodeAConnected || !nodeBConnected) {
      logger.warn('Not all Lightning nodes connected - ensure Polar is running');
    }
  } catch (error) {
    logger.warn({ error }, 'Could not connect to Lightning nodes - ensure Polar is running');
  }

  // Setup WebSocket and LND subscription
  setupWebSocket();

  // Start HTTP server (Express + Socket.IO)
  httpServer.listen(PORT, () => {
    logger.info({ port: PORT }, 'Server running');
    logger.info('WebSocket ready for real-time updates');
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down server (SIGINT)');
  await closeConnection();
  io.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down server (SIGTERM)');
  await closeConnection();
  io.close();
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  logger.fatal({ error }, 'Failed to start server');
  process.exit(1);
});
