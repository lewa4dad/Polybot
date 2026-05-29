/**
 * PolyBot BTC HFT — Main Entry Point
 *
 * Usage:
 *   cp .env.example .env        # fill in your keys
 *   npm install
 *   npm start                   # run directly
 *   npm run pm2                 # run via PM2 (persistent)
 */

import "dotenv/config";
import logger from "./logger.js";
import { PolymarketClient } from "./client.js";
import { RiskManager } from "./risk.js";
import { Engine } from "./engine.js";
import { StatusServer } from "./server.js";

// ── Config from env ───────────────────────────────────────────────────────────
const config = {
  tickMs:        parseInt(process.env.TICK_MS || "1500"),
  minEdge:       parseFloat(process.env.MIN_EDGE || "0.03"),
  spreadBuffer:  parseFloat(process.env.SPREAD_BUFFER || "0.012"),
  kellyFraction: parseFloat(process.env.KELLY_FRACTION || "0.25"),
  maxPositionPct:parseFloat(process.env.MAX_POSITION_PCT || "0.15"),
  maxDrawdownPct:parseFloat(process.env.MAX_DRAWDOWN_PCT || "0.20"),
  maxPositions:  parseInt(process.env.MAX_POSITIONS || "8"),
  bankroll:      parseFloat(process.env.BANKROLL || "1000"),
};

// ── Startup banner ────────────────────────────────────────────────────────────
logger.info("═══════════════════════════════════════════════════════");
logger.info("  POLYBOT BTC HFT ENGINE");
logger.info("═══════════════════════════════════════════════════════");
logger.info(`  Bankroll:     $${config.bankroll}`);
logger.info(`  Tick:         ${config.tickMs}ms`);
logger.info(`  Min edge:     ${(config.minEdge * 100).toFixed(1)}%`);
logger.info(`  Kelly:        ${(config.kellyFraction * 100).toFixed(0)}% fractional`);
logger.info(`  Max position: ${(config.maxPositionPct * 100).toFixed(0)}% of bankroll`);
logger.info(`  Max drawdown: ${(config.maxDrawdownPct * 100).toFixed(0)}%`);
logger.info(`  Max positions:${config.maxPositions}`);
logger.info("═══════════════════════════════════════════════════════");

// ── Wire up components ────────────────────────────────────────────────────────
const client = new PolymarketClient({
  privateKey:     process.env.PRIVATE_KEY,
  apiKey:         process.env.CLOB_API_KEY,
  apiSecret:      process.env.CLOB_API_SECRET,
  apiPassphrase:  process.env.CLOB_API_PASSPHRASE,
});

const riskManager = new RiskManager({
  bankroll:       config.bankroll,
  maxDrawdownPct: config.maxDrawdownPct,
  maxPositions:   config.maxPositions,
  maxPositionPct: config.maxPositionPct,
});

const engine = new Engine({ client, riskManager, config });

// ── Start ─────────────────────────────────────────────────────────────────────
const statusServer = new StatusServer({ engine, riskManager });
statusServer.start();

engine.start().catch((err) => {
  logger.error(`Fatal startup error: ${err.message}`);
  process.exit(1);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`\nReceived ${signal} — shutting down gracefully...`);
  engine.stop();
  statusServer.stop();

  // Cancel all open orders on shutdown
  const openOrders = await client.fetchOpenOrders().catch(() => []);
  if (openOrders.length > 0) {
    logger.info(`Cancelling ${openOrders.length} open orders...`);
    await Promise.allSettled(openOrders.map((o) => client.cancelOrder(o.id)));
  }

  process.exit(0);
}

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// ── Unhandled rejections (don't crash the bot) ────────────────────────────────
process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});
process.on("uncaughtException", (err) => {
  logger.error(`Uncaught exception: ${err.message}`);
  // Don't exit — keep the bot alive unless it's truly fatal
});
