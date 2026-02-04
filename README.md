# Lightning Network Payment App

A full-stack application for sending and receiving Bitcoin payments over the Lightning Network using two LND nodes.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                              Client                                  │
│                         (Next.js + React)                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │   Receive   │  │    Send     │  │    Transaction History      │  │
│  │   Invoice   │  │   Payment   │  │                             │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ HTTP/REST
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│                              Server                                  │
│                         (Express + Node.js)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────┐  │
│  │  /invoice   │  │  /payment   │  │  /transactions  /balance    │  │
│  │   routes    │  │   routes    │  │       routes                │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────────┬──────────────┘  │
│         │                │                        │                  │
│         ▼                ▼                        ▼                  │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    Lightning Service                         │    │
│  │                      (ln-service)                            │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                             │                                        │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    PostgreSQL (Drizzle ORM)                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ gRPC (TLS + Macaroon Auth)
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Polar (Local Dev)                           │
│                                                                     │
│   ┌───────────────┐         Channel          ┌───────────────┐     │
│   │   Node A      │◄────────────────────────►│   Node B      │     │
│   │   (Alice)     │       1,000,000 sats     │   (Bob)       │     │
│   │   Receiver    │                          │   Sender      │     │
│   └───────────────┘                          └───────────────┘     │
│                              │                                      │
│                              ▼                                      │
│                    ┌─────────────────┐                             │
│                    │  Bitcoin Core   │                             │
│                    │    (regtest)    │                             │
│                    └─────────────────┘                             │
└─────────────────────────────────────────────────────────────────────┘
```

## How Lightning Payments Work

### Payment Flow

1. **Alice creates an invoice** (Node A)
   - Generates a random `preimage` (32 bytes)
   - Computes `payment_hash = SHA256(preimage)`
   - Creates BOLT11 invoice containing: amount, payment_hash, expiry, destination

2. **Bob pays the invoice** (Node B)
   - Decodes the invoice to verify amount and destination
   - Routes payment through channel to Alice
   - Payment is locked with HTLC (Hash Time-Locked Contract)

3. **Alice reveals preimage**
   - Alice reveals `preimage` to claim the payment
   - Bob receives `preimage` as proof of payment
   - Channel balances are updated

### Key Concepts

| Term | Description |
|------|-------------|
| **Payment Hash** | SHA256 hash that uniquely identifies a payment |
| **Preimage** | Secret that proves payment was completed |
| **BOLT11** | Standard invoice format (starts with `lnbc`, `lntb`, or `lnbcrt`) |
| **Channel** | Payment pathway between two nodes with locked funds |
| **Satoshi** | Smallest Bitcoin unit (1 BTC = 100,000,000 sats) |

## Tech Stack

### Server
- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL + Drizzle ORM
- **Lightning**: ln-service (LND wrapper)
- **Validation**: express-validator
- **Logging**: pino (structured JSON logs with request tracing)

### Client
- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Data Fetching**: TanStack Query (React Query)

### Development
- **Lightning Network**: Polar (local regtest environment)
- **Database**: PostgreSQL (via Postgres.app or Docker)
- **Testing**: Vitest
- **CI**: GitHub Actions

## Project Structure

```
bitcoin-lightning-network-payment/
├── .github/
│   └── workflows/
│       └── test.yml          # CI pipeline
│
├── client/                    # Next.js frontend
│   ├── src/
│   │   ├── __tests__/        # Client tests
│   │   │   └── api-validation.test.ts
│   │   ├── app/              # App router pages
│   │   ├── components/       # React components
│   │   │   ├── ReceiveInvoice.tsx
│   │   │   ├── SendPayment.tsx
│   │   │   └── TransactionHistory.tsx
│   │   └── lib/              # Utilities
│   │       ├── api.ts        # API client
│   │       ├── socket.ts     # WebSocket client
│   │       └── query-provider.tsx
│   └── package.json
│
├── server/                    # Express backend
│   ├── src/
│   │   ├── __tests__/        # Test files
│   │   │   └── api.test.ts
│   │   ├── db/
│   │   │   ├── database.ts   # Drizzle connection
│   │   │   └── schema.ts     # Database schema
│   │   ├── lib/
│   │   │   └── logger.ts     # Pino logger
│   │   ├── middleware/
│   │   │   └── requestLogger.ts  # Request ID + logging
│   │   ├── routes/
│   │   │   ├── invoice.ts
│   │   │   ├── payment.ts
│   │   │   └── transactions.ts
│   │   ├── services/
│   │   │   └── lightning.ts  # LND service wrapper
│   │   └── index.ts          # Entry point
│   ├── .env.example
│   └── package.json
│
├── docker-compose.yml         # Docker setup
├── docker-setup.md                  # Docker instructions
└── README.md
```

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL
- [Polar](https://lightningpolar.com/) for local Lightning Network

### 1. Polar Setup

1. Download and install [Polar](https://lightningpolar.com/)
2. Create a new network with:
   - 2 LND nodes (Alice and Bob)
   - 1 Bitcoin Core node
3. Start the network
4. Open a channel from Bob → Alice with 1,000,000 sats
5. Mine some blocks to confirm the channel

### 2. Database Setup

```bash
# Create the database
createdb lightning_payments
```

### 3. Server Setup

```bash
cd server

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your Polar node credentials:
# - LND_A_* = Alice's credentials (receiver)
# - LND_B_* = Bob's credentials (sender)
# Find credentials in ~/.polar/networks/1/volumes/lnd/

# Push database schema
npm run db:push

# Start server
npm run dev
```

### 4. Client Setup

```bash
cd client

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start client
npm run dev
```

### 5. Access the App

- Client: http://localhost:3000
- Server: http://localhost:3001

## API Endpoints

### Create Invoice

```bash
POST /api/invoice
Content-Type: application/json

{ "amount": 1000, "description": "Coffee" }
```

Returns BOLT11 invoice string and payment hash.

### Pay Invoice

```bash
POST /api/payment
Content-Type: application/json
X-Idempotency-Key: <uuid>

{ "payment_request": "lnbcrt1000n..." }
```

Idempotency key prevents duplicate payments on retry.

### Other Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoice/:payment_hash` | Get invoice status |
| POST | `/api/invoice/decode` | Decode BOLT11 without paying |
| GET | `/api/payment/:payment_hash` | Get payment status |
| GET | `/api/transactions` | List all transactions (paginated) |
| GET | `/api/balance` | Get balance summary |
| GET | `/api/nodes` | Get node info |


## Real-time Updates

This app uses **WebSocket + LND subscriptions** for real-time invoice status updates.

### How It Works

```
┌────────────┐    gRPC stream       ┌────────────┐    WebSocket    ┌────────────┐
│    LND     │ ────────────────────►│   Server   │ ───────────────►│   Client   │
│  (Alice)   │  subscribeToInvoices │  Socket.IO │   push update   │   React    │
│            │                      │            │                 │            │
│ invoice    │  "invoice X paid!"   │            │  invoice:updated│  UI updates│
│ gets paid  │                      │            │                 │  instantly │
└────────────┘                      └────────────┘                 └────────────┘
```

### Implementation

**Server** (`server/src/index.ts`):
- Creates Socket.IO server alongside Express
- Subscribes to LND invoice updates via `subscribeToInvoices()`
- Emits `invoice:updated` event to all connected clients when invoice status changes

**Client** (`client/src/lib/socket.ts`):
- Connects to Socket.IO server
- Listens for `invoice:updated` events
- Updates invoice status in real-time without manual refresh

### Benefits

- **Instant feedback**: Alice sees payment confirmation immediately when Bob pays
- **No polling**: Efficient - only sends data when something changes
- **Production-ready**: Same pattern used by real Lightning apps

## Database Schema

```
invoices                          payments
├── payment_hash (PK)             ├── payment_hash (PK)
├── payment_request               ├── payment_request
├── amount                        ├── amount
├── status                        ├── fee
├── description                   ├── status
├── preimage                      ├── preimage
├── expires_at                    ├── destination
├── settled_at                    ├── error_message
└── created_at                    ├── idempotency_key (unique)
                                  ├── settled_at
                                  └── created_at
```

Payments include `idempotency_key` to prevent duplicates - client sends `X-Idempotency-Key` header.


## Testing

### Server Tests

```bash
cd server
npm test
```

Integration tests verify API input validation:

- **Invoice creation** - Rejects invalid amounts (negative, zero, decimals)
- **Invoice decode** - Rejects malformed BOLT11 strings
- **Payments** - Rejects invalid payment requests

### Client Tests

```bash
cd client
npm test
```

Validation tests (no mocking - real logic):

- **createInvoice** - Rejects zero, negative, decimal amounts
- **payInvoice** - Requires idempotency key
- **decodeInvoice** - Rejects empty input


## Logging

Structured logging with [pino](https://github.com/pinojs/pino) for production observability.

**Features:**
- Request IDs for tracing requests through logs
- Log levels (info, warn, error, fatal)
- Pretty output in development, JSON in production
- Automatic request/response logging with duration


## CI/CD

GitHub Actions runs on every push to `main`:

| Job | Description |
|-----|-------------|
| `test-server` | Server Vitest tests |
| `test-client` | Client Vitest tests |
| `lint-client` | ESLint |
| `build` | Builds server and client |

## Known Limitations & Future Work

This is a demo application. For production:

### Critical

- **Idempotency race condition** - Current check-then-insert has a small window for duplicates. Fix: insert pending record first (uses DB constraint as lock) or use Redis `SETNX` for distributed systems.

- **No HTTPS** - API communicates over plain HTTP. Use TLS termination (nginx/Caddy) or cloud load balancer.

- **Macaroon Security**: Use a secrets manager instead of file paths

- **Watchtowers**: Set up watchtower for channel monitoring when offline

- **Open API** - No authentication; anyone can create invoices or trigger payments. Add API keys or restrict to internal network.

- **Backups**: Regularly backup LND channel state (`channel.backup`)


### Nice to Have

- **Wallet integration** - Let users connect their own wallets via WebLN or LNURL instead of shared nodes.

- **Rate limiting** - Add express-rate-limit to prevent abuse.

- **Channel liquidity** - Monitor and rebalance channels; payments fail when liquidity is exhausted.

- **Monitoring** - Add Prometheus metrics and alerting beyond logs.

- **E2E tests** - Add Playwright tests for automated payment flow testing.

