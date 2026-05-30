import "dotenv/config";
import logger from "./logger.js";
import { PolymarketClient } from "./client.js";
import { RiskManager } from "./risk.js";
import { Engine } from "./engine.js";
import { StatusServer } from "./server.js";

const config = {
  tickMs:         parseInt(process.env.TICK_MS         || "1500"),
  minEdge:        parseFloat(process.env.MIN_EDGE      || "0.03"),
  spreadBuffer:   parseFloat(process.env.SPREAD_BUFFER || "0.012"),
  kellyFraction:  parseFloat(process.env.KELLY_FRACTION  || "0.25"),
  maxPositionPct: parseFloat(process.env.MAX_POSITION_PCT || "0.15"),
  maxDrawdownPct: parseFloat(process.env.MAX_DRAWDOWN_PCT || "0.20"),
  maxPositions:   parseInt(process.env.MAX_POSITIONS   || "8"),
  bankroll:       parseFloat(process.env.BANKROLL      || "1000"),
};

logger.info("═══════════════════════════════════════════════════════");
logger.info("  POLYBOT BTC HFT ENGINE");
logger.info("═══════════════════════════════════════════════════════");
logger.info(`  Bankroll:     $${config.bankroll}`);
logger.info(`  Tick:         ${config.tickMs}ms`);
logger.info(`  Min edge:     ${(config.minEdge * 100).toFixed(1)}%`);
logger.info(`  Kelly:        ${(config.kellyFraction * 100).toFixed(0)}% fractional`);
logger.info(`  Max position: ${(config.maxPositionPct * 100).toFixed(0)}% of bankroll`);
logger.info(`  Max drawdown: ${(config.maxDrawdownPct * 100).toFixed(0)}%`);
logger.info("═══════════════════════════════════════════════════════");

const client = new PolymarketClient({
  privateKey:    process.env.PRIVATE_KEY,
  relayerApiKey: process.env.RELAYER_API_KEY,
});

const riskManager = new RiskManager({
  bankroll:       config.bankroll,
  maxDrawdownPct: config.maxDrawdownPct,
  maxPositions:   config.maxPositions,
  maxPositionPct: config.maxPositionPct,
});

const engine = new Engine({ client, riskManager, config });
const statusServer = new StatusServer({ engine, riskManager });

statusServer.start();
engine.start().catch(err => {
  logger.error(`Fatal: ${err.message}`);
  process.exit(1);
});

async function shutdown(signal) {
  logger.info(`${signal} received — shutting down...`);
  engine.stop();
  statusServer.stop();
  const openOrders = await client.fetchOpenOrders().catch(() => []);
  if (openOrders.length > 0) {
    logger.info(`Cancelling ${openOrders.length} open orders...`);
    await Promise.allSettled(openOrders.map(o => client.cancelOrder(o.id)));
  }
  process.exit(0);
}

process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", reason => logger.error(`Unhandled rejection: ${reason}`));
process.on("uncaughtException",  err    => logger.error(`Uncaught exception: ${err.message}`));
