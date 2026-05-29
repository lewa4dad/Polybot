# PolyBot BTC HFT

A production-grade high-frequency trading bot for Polymarket BTC prediction markets.

## Architecture

```
src/
├── index.js      — Entry point, wiring, graceful shutdown
├── client.js     — Polymarket CLOB + Gamma API client (EIP-712 order signing)
├── engine.js     — HFT execution loop, signal generation, exit logic
├── model.js      — Fair value model (momentum + mean reversion + vol)
├── risk.js       — Risk manager (Kelly sizing, drawdown, position limits)
└── logger.js     — Winston logger (console + rotating files)
```

## Strategy

1. **Market Discovery** — Scans Polymarket Gamma API for active BTC markets with >$5K volume
2. **Price Feed** — Polls CLOB order books every tick, builds mid/spread per market
3. **Fair Value** — Blends 65% mean reversion + 35% momentum, damped by realized volatility
4. **Edge Detection** — Fires when `fair_value - best_ask > MIN_EDGE + SPREAD_BUFFER`
5. **Position Sizing** — Fractional Kelly criterion (default 25%) capped at MAX_POSITION_PCT
6. **Exits** — Take profit 6%, stop loss 4%, edge flip + time, or max hold 60 min
7. **Risk** — Per-position caps, max drawdown halt, max concurrent positions

---

## Prerequisites

- Node.js 18+
- A funded Polymarket account (USDC on Polygon)
- Polymarket CLOB API key (from polymarket.com → Profile → API Keys)
- A VPS or cloud server (DigitalOcean, Hetzner, Fly.io, etc.)

---

## Local Setup

```bash
git clone <your-repo>
cd polybot-btc-hft

npm install

# Copy and fill in your credentials
cp .env.example .env
nano .env
```

Fill in `.env`:
```
PRIVATE_KEY=0xYOUR_WALLET_PRIVATE_KEY
CLOB_API_KEY=your_api_key
CLOB_API_SECRET=your_api_secret
CLOB_API_PASSPHRASE=your_passphrase
BANKROLL=1000
```

```bash
# Test run (uses DRY RUN mode if no valid key set)
npm start
```

---

## VPS Deployment (Ubuntu/Debian)

### 1. Provision a server

Minimum specs: 1 vCPU, 512MB RAM, 10GB SSD  
Recommended: DigitalOcean $6/mo Droplet or Hetzner CX11

### 2. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # should be 20.x
```

### 3. Install PM2

```bash
sudo npm install -g pm2
```

### 4. Clone and configure

```bash
git clone <your-repo> ~/polybot
cd ~/polybot
npm install
cp .env.example .env
nano .env   # fill in your keys
```

### 5. Start with PM2

```bash
# Start the bot (auto-restarts on crash)
pm2 start ecosystem.config.cjs

# Save PM2 process list (survives server reboots)
pm2 save

# Set PM2 to start on boot
pm2 startup
# Follow the command it prints

# Check status
pm2 status

# Live logs
pm2 logs polybot

# Stop
pm2 stop polybot

# Restart
pm2 restart polybot
```

### 6. Monitor

```bash
# Real-time dashboard
pm2 monit

# Tail logs
tail -f logs/polybot.log

# Trade log only
tail -f logs/trades.log
```

---

## Docker Deployment

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "src/index.js"]
```

```bash
docker build -t polybot .
docker run -d \
  --name polybot \
  --restart always \
  --env-file .env \
  polybot
```

---

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `PRIVATE_KEY` | — | Wallet private key for order signing |
| `CLOB_API_KEY` | — | Polymarket CLOB API key |
| `CLOB_API_SECRET` | — | API secret |
| `CLOB_API_PASSPHRASE` | — | API passphrase |
| `BANKROLL` | 1000 | Starting USDC bankroll |
| `TICK_MS` | 1500 | Polling interval in milliseconds |
| `MIN_EDGE` | 0.03 | Minimum edge to fire a trade (3%) |
| `SPREAD_BUFFER` | 0.012 | Extra buffer on top of MIN_EDGE |
| `KELLY_FRACTION` | 0.25 | Fractional Kelly multiplier |
| `MAX_POSITION_PCT` | 0.15 | Max % of bankroll per position |
| `MAX_POSITIONS` | 8 | Max simultaneous open positions |
| `MAX_DRAWDOWN_PCT` | 0.20 | Halt bot if drawdown exceeds this |

---

## Risk Warnings

- **This is real money.** Start with a small bankroll and monitor closely.
- Prediction markets are illiquid — slippage can be significant.
- The fair value model is simple; it can and will lose in trending markets.
- Never risk more than you can afford to lose.
- The bot runs in **DRY RUN** mode (logs orders but doesn't place them) if no valid API key is set.

---

## Getting Polymarket API Keys

1. Go to [polymarket.com](https://polymarket.com)
2. Connect your wallet
3. Profile → API Keys → Create Key
4. Copy the API Key, Secret, and Passphrase into `.env`

Your wallet private key is used for EIP-712 signing of orders on Polygon. Keep it safe.

---

## License

MIT
