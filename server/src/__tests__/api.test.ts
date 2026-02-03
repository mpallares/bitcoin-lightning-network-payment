import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';

/**
 * Integration tests for API routes.
 * Tests actual Express middleware and validation.
 */

// Create minimal test app with real routes
const createTestApp = async () => {
  const app = express();
  app.use(express.json());

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Import real validation middleware
  const { default: invoiceRoutes } = await import('../routes/invoice.js');
  const { default: paymentRoutes } = await import('../routes/payment.js');

  app.use('/api/invoice', invoiceRoutes);
  app.use('/api/payment', paymentRoutes);

  return app;
};

describe('Health Check', () => {
  it('GET /api/health returns ok', async () => {
    const app = await createTestApp();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Invoice API Validation', () => {
  it('POST /api/invoice rejects missing amount', async () => {
    const app = await createTestApp();
    const res = await request(app)
      .post('/api/invoice')
      .send({});

    expect(res.status).toBe(400);
  });

  it('POST /api/invoice rejects negative amount', async () => {
    const app = await createTestApp();
    const res = await request(app)
      .post('/api/invoice')
      .send({ amount: -100 });

    expect(res.status).toBe(400);
  });

  it('POST /api/invoice rejects zero amount', async () => {
    const app = await createTestApp();
    const res = await request(app)
      .post('/api/invoice')
      .send({ amount: 0 });

    expect(res.status).toBe(400);
  });

  it('POST /api/invoice rejects non-integer amount', async () => {
    const app = await createTestApp();
    const res = await request(app)
      .post('/api/invoice')
      .send({ amount: 10.5 });

    expect(res.status).toBe(400);
  });

  it('POST /api/invoice/decode rejects invalid invoice format', async () => {
    const app = await createTestApp();
    const res = await request(app)
      .post('/api/invoice/decode')
      .send({ payment_request: 'not-a-valid-invoice' });

    expect(res.status).toBe(400);
  });

  it('POST /api/invoice/decode rejects missing payment_request', async () => {
    const app = await createTestApp();
    const res = await request(app)
      .post('/api/invoice/decode')
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('Payment API Validation', () => {
  it('POST /api/payment rejects missing payment_request', async () => {
    const app = await createTestApp();
    const res = await request(app)
      .post('/api/payment')
      .send({});

    expect(res.status).toBe(400);
  });

  it('POST /api/payment rejects invalid invoice format', async () => {
    const app = await createTestApp();
    const res = await request(app)
      .post('/api/payment')
      .send({ payment_request: 'invalid' });

    expect(res.status).toBe(400);
  });
});
