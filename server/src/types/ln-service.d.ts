declare module 'ln-service' {
  interface AuthenticatedLndGrpcArgs {
    socket: string;
    cert: string;
    macaroon: string;
  }

  interface AuthenticatedLnd {
    lnd: any;
  }

  interface CreateInvoiceArgs {
    lnd: any;
    tokens: number;
    description?: string;
    expires_at?: string;
  }

  interface CreateInvoiceResult {
    id: string;
    request: string;
    secret: string;
  }

  interface DecodePaymentRequestArgs {
    lnd: any;
    request: string;
  }

  interface DecodePaymentRequestResult {
    id: string;
    tokens: number;
    description: string;
    expires_at: string;
    destination: string;
    created_at: string;
  }

  interface PayArgs {
    lnd: any;
    request: string;
    tokens?: number;
  }

  interface PayResult {
    id: string;
    secret: string;
    fee: number;
  }

  interface GetInvoiceArgs {
    lnd: any;
    id: string;
  }

  interface GetInvoiceResult {
    is_confirmed: boolean;
    secret: string;
    expires_at: string;
  }

  interface GetPaymentArgs {
    lnd: any;
    id: string;
  }

  interface GetPaymentResult {
    is_confirmed: boolean;
    is_failed: boolean;
    payment?: {
      secret: string;
    };
  }

  interface GetChainBalanceArgs {
    lnd: any;
  }

  interface GetChainBalanceResult {
    chain_balance: number;
  }

  interface GetChannelBalanceArgs {
    lnd: any;
  }

  interface GetChannelBalanceResult {
    channel_balance: number;
    pending_balance: number;
  }

  interface GetWalletInfoArgs {
    lnd: any;
  }

  interface GetWalletInfoResult {
    public_key: string;
    alias: string;
    active_channels_count: number;
    pending_channels_count: number;
    is_synced_to_chain: boolean;
    current_block_height: number;
    version: string;
  }

  interface SubscribeToInvoicesArgs {
    lnd: any;
  }

  interface InvoiceSubscription {
    on(event: 'invoice_updated', listener: (invoice: InvoiceUpdate) => void): this;
    on(event: 'error', listener: (error: Error) => void): this;
    removeAllListeners(): this;
  }

  interface InvoiceUpdate {
    id: string;
    is_confirmed: boolean;
    is_canceled: boolean;
    tokens: number;
    secret: string | null;
    confirmed_at: string | null;
  }

  export function authenticatedLndGrpc(args: AuthenticatedLndGrpcArgs): AuthenticatedLnd;
  export function createInvoice(args: CreateInvoiceArgs): Promise<CreateInvoiceResult>;
  export function decodePaymentRequest(args: DecodePaymentRequestArgs): Promise<DecodePaymentRequestResult>;
  export function pay(args: PayArgs): Promise<PayResult>;
  export function getInvoice(args: GetInvoiceArgs): Promise<GetInvoiceResult>;
  export function getPayment(args: GetPaymentArgs): Promise<GetPaymentResult>;
  export function getChainBalance(args: GetChainBalanceArgs): Promise<GetChainBalanceResult>;
  export function getChannelBalance(args: GetChannelBalanceArgs): Promise<GetChannelBalanceResult>;
  export function getWalletInfo(args: GetWalletInfoArgs): Promise<GetWalletInfoResult>;
  export function subscribeToInvoices(args: SubscribeToInvoicesArgs): InvoiceSubscription;
}
