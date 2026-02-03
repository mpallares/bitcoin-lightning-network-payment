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

    let data: ApiResponse<T>;
    try {
      data = await response.json();
    } catch {
      return {
        success: false,
        error: `Invalid response from server (status ${response.status})`,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `Request failed with status ${response.status}`,
      };
    }

    return data;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        error: 'Unable to connect to server. Is the backend running?',
      };
    }
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
  if (!Number.isInteger(amount) || amount <= 0) {
    return { success: false, error: 'Amount must be a positive integer' };
  }
  if (description !== undefined && typeof description !== 'string') {
    return { success: false, error: 'Description must be a string' };
  }

  return fetchApi<Invoice>('/api/invoice', {
    method: 'POST',
    body: JSON.stringify({ amount, description }),
  });
}

export async function getInvoice(
  paymentHash: string
): Promise<ApiResponse<Invoice>> {
  if (!paymentHash || typeof paymentHash !== 'string') {
    return { success: false, error: 'Payment hash is required' };
  }

  return fetchApi<Invoice>(`/api/invoice/${encodeURIComponent(paymentHash)}`);
}

export async function decodeInvoice(
  paymentRequest: string
): Promise<ApiResponse<DecodedInvoice>> {
  if (!paymentRequest || typeof paymentRequest !== 'string') {
    return { success: false, error: 'Payment request is required' };
  }

  return fetchApi<DecodedInvoice>('/api/invoice/decode', {
    method: 'POST',
    body: JSON.stringify({ payment_request: paymentRequest }),
  });
}

// Payment APIs
export async function payInvoice(
  paymentRequest: string
): Promise<ApiResponse<Payment>> {
  if (!paymentRequest || typeof paymentRequest !== 'string') {
    return { success: false, error: 'Payment request is required' };
  }

  return fetchApi<Payment>('/api/payment', {
    method: 'POST',
    body: JSON.stringify({ payment_request: paymentRequest }),
  });
}

export async function getPayment(
  paymentHash: string
): Promise<ApiResponse<Payment>> {
  if (!paymentHash || typeof paymentHash !== 'string') {
    return { success: false, error: 'Payment hash is required' };
  }

  return fetchApi<Payment>(`/api/payment/${encodeURIComponent(paymentHash)}`);
}

// Transaction APIs
export async function getTransactions(
  page: number = 1,
  limit: number = 10
): Promise<
  ApiResponse<{ transactions: Transaction[]; pagination: { page: number; limit: number; total: number; totalPages: number } }>
> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  return fetchApi(`/api/transactions?${params}`);
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
