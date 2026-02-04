import { describe, it, expect } from 'vitest';
import { createInvoice, decodeInvoice, payInvoice, getInvoice, getPayment } from '../lib/api';

/**
 * API Client Validation Tests
 * The API functions validate inputs and return errors BEFORE making any network call.
 * This prevents invalid data from ever reaching the server.
 */
describe('createInvoice validation', () => {
  it('rejects zero amount', async () => {
    const result = await createInvoice(0);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Amount must be a positive integer');
  });

  it('rejects negative amount', async () => {
    const result = await createInvoice(-100);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Amount must be a positive integer');
  });

  it('rejects decimal amount (satoshis must be whole numbers)', async () => {
    const result = await createInvoice(10.5);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Amount must be a positive integer');
  });

  it('rejects non-string description', async () => {
    const result = await createInvoice(1000, 123 as unknown as string);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Description must be a string');
  });
});

describe('decodeInvoice validation', () => {
  it('rejects empty string', async () => {
    const result = await decodeInvoice('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Payment request is required');
  });

  it('rejects null', async () => {
    const result = await decodeInvoice(null as unknown as string);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Payment request is required');
  });
});

describe('payInvoice validation', () => {
  it('rejects empty payment request', async () => {
    const result = await payInvoice('', 'valid-key');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Payment request is required');
  });

  it('rejects empty idempotency key', async () => {
    const result = await payInvoice('lnbcrt1000n...', '');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Idempotency key is required');
  });

  it('rejects null idempotency key', async () => {
    const result = await payInvoice('lnbcrt1000n...', null as unknown as string);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Idempotency key is required');
  });

  it('rejects undefined idempotency key', async () => {
    const result = await payInvoice('lnbcrt1000n...', undefined as unknown as string);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Idempotency key is required');
  });
});

describe('getInvoice validation', () => {
  it('rejects empty payment hash', async () => {
    const result = await getInvoice('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Payment hash is required');
  });
});

describe('getPayment validation', () => {
  it('rejects empty payment hash', async () => {
    const result = await getPayment('');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Payment hash is required');
  });
});
