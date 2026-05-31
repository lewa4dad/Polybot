import "dotenv/config";
import logger from "./logger.js";
import { PolymarketClient } from "./client.js";
import { RiskManager } from "./risk.js";
import { Engine } from "./engine.js";
import { StatusServer } from "./server.js";

const config = {
  tickMs:         parseInt(process.env.TICK_MS          || "1500"),
  minEdge:        parseFloat(process.env.MIN_EDGE       || "0.03"),
  spreadBuffer:   parseFloat(process.env.SPREAD_BUFFER  || "0.012"),
  kellyFraction:  parseFloat(process.env.KELLY_FRACTION || "0.25"),
  maxPositionPct: parseFloat(process.env.MAX_POSITION_PCT || "0.15"),
  maxDrawdownPct: parseFloat(process.env.MAX_DRAWDOWN_PCT || "0.20"),
  maxPositions:   parseInt(process.env.MAX_POSITIONS    || "8"),
  bankroll:       parseFloat(process.env.BANKROLL       || "1000"),
};

logger.info("═══════════════════════════════════════════════════════");
logger.info("  POLYBOT BTC HFT ENGINE");
logger.info("═══════════════════════════════════════════════════════");
logger.info(`  Bankroll: $${config.bankroll} | Tick: ${config.tickMs}ms | Min edge: ${(config.minEdge*100).toFixed(1)}%`);
logger.info("═══════════════════════════════════════════════════════");

const client = new PolymarketClient({
  privateKey:    process.env.PRIVATE_KEY,
  relayerApiKey: process.env.RELAYER_API_KEY,
});

const riskManager = new RiskManager({
  bankroll: config.bankroll, maxDrawdownPct: config.maxDrawdownPct,
  maxPositions: config.maxPositions, maxPositionPct: config.maxPositionPct,
});

const engine = new Engine({ client, riskManager, config });
const statusServer = new StatusServer({ engine, riskManager });

statusServer.start();
engine.start().catch(err => { logger.error(`Fatal: ${err.message}`); process.exit(1); });

async function shutdown(signal) {
  logger.info(`${signal} — shutting down...`);
  engine.stop();
  statusServer.stop();
  const open = await client.fetchOpenOrders().catch(() => []);
  await Promise.allSettled(open.map(o => client.cancelOrder(o.id)));
  process.exit(0);
}

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", r => logger.error(`Unhandled: ${r}`));
process.on("uncaughtException",  e => logger.error(`Uncaught: ${e.message}`));
