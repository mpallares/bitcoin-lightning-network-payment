import {
  Invoice,
  DecodedInvoice,
  Payment,
  Transaction,
  Balance,
  NodeInfo,
  ApiResponse,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// Invoice APIs
export async function createInvoice(
  amount: number,
  description?: string
): Promise<ApiResponse<Invoice>> {
  return fetchApi<Invoice>('/api/invoice', {
    method: 'POST',
    body: JSON.stringify({ amount, description }),
  });
}

export async function getInvoice(
  paymentHash: string
): Promise<ApiResponse<Invoice>> {
  return fetchApi<Invoice>(`/api/invoice/${paymentHash}`);
}

export async function decodeInvoice(
  paymentRequest: string
): Promise<ApiResponse<DecodedInvoice>> {
  return fetchApi<DecodedInvoice>('/api/invoice/decode', {
    method: 'POST',
    body: JSON.stringify({ payment_request: paymentRequest }),
  });
}

// Payment APIs
export async function payInvoice(
  paymentRequest: string
): Promise<ApiResponse<Payment>> {
  return fetchApi<Payment>('/api/payment', {
    method: 'POST',
    body: JSON.stringify({ payment_request: paymentRequest }),
  });
}

export async function getPayment(
  paymentHash: string
): Promise<ApiResponse<Payment>> {
  return fetchApi<Payment>(`/api/payment/${paymentHash}`);
}

// Transaction APIs
export async function getTransactions(): Promise<
  ApiResponse<{ transactions: Transaction[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>
> {
  return fetchApi('/api/transactions');
}

// Balance API
export async function getBalance(): Promise<ApiResponse<Balance>> {
  return fetchApi<Balance>('/api/balance');
}

// Nodes API
export async function getNodes(): Promise<
  ApiResponse<{ node_a: NodeInfo; node_b: NodeInfo }>
> {
  return fetchApi('/api/nodes');
}
