/**
 * Lightning Network Payment Server
 *
 * Express server that connects to LND nodes via ln-service
 * and provides REST API for creating invoices and making payments.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { testConnection, closeConnection } from './db/database.js';
import { testNodeConnection } from './services/lightning.js';
import invoiceRoutes from './routes/invoice.js';
import paymentRoutes from './routes/payment.js';
import transactionRoutes from './routes/transactions.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// Request logging middleware
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

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
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
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
 * Start Server
 */
async function startServer() {
  console.log('\n🚀 Starting Lightning Network Payment Server...\n');

  // Test database connection
  console.log('📦 Testing database connection...');
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('❌ Cannot start server without database connection');
    process.exit(1);
  }

  // Test Lightning node connections
  console.log('\n⚡ Testing Lightning node connections...');

  try {
    const nodeAConnected = await testNodeConnection('node_a');
    const nodeBConnected = await testNodeConnection('node_b');

    if (!nodeAConnected || !nodeBConnected) {
      console.warn('\n⚠️  Warning: Not all Lightning nodes are connected');
      console.warn('   Make sure Polar is running with your network started\n');
    }
  } catch (error) {
    console.warn('\n⚠️  Warning: Could not connect to Lightning nodes');
    console.warn('   Make sure Polar is running with your network started');
    console.warn('   Error:', error);
  }

  // Start server
  app.listen(PORT, () => {
    console.log(`\n✅ Server running on http://localhost:${PORT}`);
    console.log('\n📚 API Endpoints:');
    console.log('   POST /api/invoice          - Create invoice');
    console.log('   GET  /api/invoice/:hash    - Get invoice status');
    console.log('   POST /api/invoice/decode   - Decode invoice');
    console.log('   POST /api/payment          - Pay invoice');
    console.log('   GET  /api/payment/:hash    - Get payment status');
    console.log('   GET  /api/transactions     - List transactions');
    console.log('   GET  /api/balance          - Get balance');
    console.log('   GET  /api/nodes            - Get node info');
    console.log('   GET  /api/health           - Health check\n');
  });
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\n🛑 Shutting down server...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\n🛑 Shutting down server...');
  await closeConnection();
  process.exit(0);
});

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
