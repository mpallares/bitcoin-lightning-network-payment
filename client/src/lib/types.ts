export interface Invoice {
  payment_hash: string;
  payment_request: string;
  amount: number;
  description: string | null;
  status: 'pending' | 'succeeded' | 'expired';
  expires_at: string;
  created_at: string;
  qr_code?: string;
  settled?: boolean;
  preimage?: string | null;
}

export interface DecodedInvoice {
  payment_hash: string;
  amount: number;
  description: string;
  expires_at: string;
  destination: string;
  timestamp: number;
}

export interface Payment {
  payment_hash: string;
  status: 'pending' | 'succeeded' | 'failed';
  preimage: string | null;
  amount: number;
  fee: number;
  payment_request: string;
  created_at: string;
  error?: string;
}

export interface Transaction {
  paymentHash: string;
  transactionType: 'invoice' | 'payment';
  amount: number;
  status: 'pending' | 'succeeded' | 'failed' | 'expired';
  paymentRequest: string | null;
  preimage: string | null;
  description: string | null;
  nodeId: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Balance {
  recorded: {
    total_received: number;
    total_sent: number;
    net_balance: number;
  };
  node_a: NodeBalance | null;
  node_b: NodeBalance | null;
}

export interface NodeBalance {
  total_balance: number;
  confirmed_balance: number;
  unconfirmed_balance: number;
  channel_balance: number;
  pending_channel_balance: number;
}

export interface NodeInfo {
  identity_pubkey: string;
  alias: string;
  num_active_channels: number;
  num_pending_channels: number;
  synced_to_chain: boolean;
  block_height: number;
  version: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
