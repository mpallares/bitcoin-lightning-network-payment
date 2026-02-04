# Running with Docker

Step-by-step guide to run the Lightning Network Payment App with Docker.

## Prerequisites

1. **Docker Desktop** installed and running
2. **Polar** installed ([download here](https://lightningpolar.com/))

## Step 1: Setup Polar Network

1. Open Polar
2. Click **Create Network**
3. Add **2 LND nodes** (Alice and Bob)
4. Add **1 Bitcoin Core** node
5. Click **Start** to launch the network
6. Wait for nodes to sync (green status)

### Open a Channel

1. In Polar, click on **Bob** node
2. Go to **Actions** → **Open Channel**
3. Select **Alice** as destination
4. Set capacity: **1,000,000 sats**
5. Click **Open Channel**
6. Click **Quick Mine** to confirm (mine 6 blocks)

### Verify Channel

- Bob should show outbound capacity: ~1,000,000 sats
- Alice should show inbound capacity: ~1,000,000 sats

## Step 2: Find Your Polar Network ID

Your Polar credentials are stored at:
```
~/.polar/networks/{NETWORK_ID}/volumes/lnd/
```

To find your network ID:
```bash
ls ~/.polar/networks/
```
are
## Step 3: Update Docker Compose (if needed)

If your network ID is NOT `1`, edit `docker-compose.yml`:

```yaml
volumes:
  - ~/.polar/networks/YOUR_ID/volumes/lnd/alice:/lnd/alice:ro
  - ~/.polar/networks/YOUR_ID/volumes/lnd/bob:/lnd/bob:ro
```

## Step 4: Start the App

From the project root directory:

```bash
# Build and start all containers
docker compose up --build
```

This starts:
- **PostgreSQL** on port 5432
- **Server** on port 3001
- **Client** on port 3000

## Step 5: Access the App

Open your browser:
- **App**: http://localhost:3000
- **API**: http://localhost:3001/api/health

## Step 6: Test a Payment

1. **Create Invoice** (Alice receives)
   - Enter amount (e.g., 1000 sats)
   - Click "Generate Invoice"
   - QR code and invoice string appear

2. **Pay Invoice** (Bob sends)
   - Copy the invoice string
   - Paste in "Send Payment" section
   - Click "Pay Invoice"

3. **Verify**
   - Transaction appears in history
   - Status shows "succeeded"
   - Check Polar - channel balances updated

## Commands Reference

```bash
# Start containers
docker compose up

# Start in background
docker compose up -d

# Rebuild after code changes
docker compose up --build

# View logs
docker compose logs -f

# View specific service logs
docker compose logs -f server

# Stop containers
docker compose down

# Stop and remove volumes (deletes database)
docker compose down -v

# Restart a specific service
docker compose restart server
```

## Troubleshooting

### "Cannot connect to LND"

**Cause**: Polar is not running or network not started.

**Fix**:
```bash
# 1. Open Polar
# 2. Start your network
# 3. Restart containers
docker compose restart server
```

### "Connection refused" on localhost:3000

**Cause**: Containers still starting.

**Fix**: Wait 30 seconds, then refresh. Check logs:
```bash
docker compose logs -f client
```

### "Port already in use"

**Cause**: Another process using port 3000, 3001, or 5432.

**Fix**:
```bash
# Find what's using the port
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or change ports in docker-compose.yml
```

### "Volume mount permission denied"

**Cause**: Docker can't read Polar credentials.

**Fix**:
```bash
# Check the path exists
ls ~/.polar/networks/1/volumes/lnd/alice/

# On macOS, ensure Docker Desktop has file sharing access
# Docker Desktop → Settings → Resources → File Sharing
```

### "No route found" when paying

**Cause**: No channel between Bob and Alice, or channel not confirmed.

**Fix**:
1. Open Polar
2. Verify channel exists between Bob → Alice
3. If pending, click **Quick Mine** to confirm
4. Wait for channel to show "Active"

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Docker                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │  Client    │  │  Server    │  │ PostgreSQL │        │
│  │  :3000     │  │  :3001     │  │  :5432     │        │
│  └────────────┘  └─────┬──────┘  └────────────┘        │
└────────────────────────┼───────────────────────────────┘
                         │ host.docker.internal
┌────────────────────────┼───────────────────────────────┐
│                  Host Machine                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │                    Polar                         │   │
│  │   ┌─────────┐              ┌─────────┐          │   │
│  │   │  Alice  │◄────────────►│   Bob   │          │   │
│  │   │ :10001  │   Channel    │ :10002  │          │   │
│  │   └─────────┘              └─────────┘          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

The server connects to Polar via `host.docker.internal`, which resolves to the host machine from inside Docker.
