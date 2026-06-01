import logger from "./logger.js";
import { FairValueModel } from "./model.js";

export class Engine {
  constructor({ client, riskManager, config }) {
    this.client = client;
    this.risk = riskManager;
    this.config = config;
    this.model = new FairValueModel();
    this.markets = [];
    this.prices = new Map();
    this.running = false;
    this.tickCount = 0;
    this.lastStatsLog = 0;
    this.warmupDone = new Set();
    this.WARMUP_TICKS = 6;
    this.warmupCounts = new Map();
  }

  async fetchMarkets() {
    const markets = await this.client.fetchBTCMarkets();
    if (markets.length === 0) { logger.warn("No BTC markets found"); return; }
    this.markets = markets.filter(m => m.active && m.volume > 100);
    logger.info(`Loaded ${this.markets.length} tradeable BTC markets`);
  }

  async refreshPrices() {
    const tasks = this.markets.map(async (m) => {
      try {
        const yesToken = m.tokens?.[0]?.token_id || m.conditionId;
        const noToken  = m.tokens?.[1]?.token_id;
        const [book] = await Promise.all([this.client.fetchOrderBook(yesToken), this.client.fetchSpread(yesToken)]);
        if (!book) return;
        const bestBid  = parseFloat(book.bids?.[0]?.price || 0);
        const bestAsk  = parseFloat(book.asks?.[0]?.price || 1);
        const mid      = (bestBid + bestAsk) / 2;
        const spreadVal = bestAsk - bestBid;
        if (mid <= 0 || mid >= 1) return;
        this.prices.set(m.conditionId, { yes: +mid.toFixed(5), no: +(1 - mid).toFixed(5), bestBid, bestAsk, spread: +spreadVal.toFixed(5), vol: m.volume, yesToken, noToken, book });
        this.model.update(m.conditionId, mid, m.volume);
        const wc = (this.warmupCounts.get(m.conditionId) || 0) + 1;
        this.warmupCounts.set(m.conditionId, wc);
        if (wc >= this.WARMUP_TICKS) this.warmupDone.add(m.conditionId);
      } catch (err) { logger.debug(`Price refresh failed: ${err.message}`); }
    });
    await Promise.allSettled(tasks);
  }

  async evaluateAndTrade() {
    const { minEdge, spreadBuffer, kellyFraction, maxPositionPct } = this.config;
    for (const market of this.markets) {
      const cid = market.conditionId;
      const px  = this.prices.get(cid);
      if (!px || !this.warmupDone.has(cid)) continue;
      const fair = this.model.compute(cid, px.yes);

      const edgeYes = this.model.edge(fair, px.bestAsk, "YES");
      if (edgeYes > minEdge + spreadBuffer) {
        const kellyF = this.model.kelly(edgeYes, px.bestAsk, kellyFraction, maxPositionPct);
        const size   = +(this.risk.bankroll * kellyF).toFixed(2);
        if (this.risk.canTrade(cid, "YES", size)) {
          logger.info(`SIGNAL YES | ${market.question.slice(0, 40)} | edge=${(edgeYes*100).toFixed(2)}% size=$${size}`);
          const order = await this.client.placeOrder({ tokenId: px.yesToken, side: "BUY", price: px.bestAsk, size });
          if (order) this.risk.openPosition({ conditionId: cid, tokenId: px.yesToken, side: "YES", price: px.bestAsk, size, orderId: order.orderID || "DRY_RUN", question: market.question });
        }
      }

      const edgeNo = this.model.edge(fair, px.bestBid, "NO");
      if (edgeNo > minEdge + spreadBuffer) {
        const noAsk  = 1 - px.bestBid;
        const kellyF = this.model.kelly(edgeNo, noAsk, kellyFraction, maxPositionPct);
        const size   = +(this.risk.bankroll * kellyF).toFixed(2);
        if (this.risk.canTrade(cid, "NO", size)) {
          logger.info(`SIGNAL NO  | ${market.question.slice(0, 40)} | edge=${(edgeNo*100).toFixed(2)}% size=$${size}`);
          const order = await this.client.placeOrder({ tokenId: px.noToken || cid, side: "BUY", price: noAsk, size });
          if (order) this.risk.openPosition({ conditionId: cid, tokenId: px.noToken || cid, side: "NO", price: noAsk, size, orderId: order.orderID || "DRY_RUN", question: market.question });
        }
      }

      await this.evaluateExits(market, px, fair);
    }
  }

  async evaluateExits(market, px, fair) {
    const cid = market.conditionId;
    for (const side of ["YES", "NO"]) {
      const pos = this.risk.positions.get(`${cid}_${side}`);
      if (!pos) continue;
      const currentPrice  = side === "YES" ? px.bestBid : 1 - px.bestAsk;
      const unrealized    = pos.shares * (currentPrice - pos.avgCost);
      const unrealizedPct = unrealized / pos.size;
      const heldMin       = (Date.now() - pos.openedAt) / 60000;
      const edgeNow       = (side === "YES" ? fair : 1 - fair) - currentPrice;
      const shouldClose   = unrealizedPct >= 0.06 || unrealizedPct <= -0.04 || (edgeNow < 0 && heldMin > 5) || heldMin > 60;
      if (shouldClose) {
        const reason = unrealizedPct >= 0.06 ? "TAKE_PROFIT" : unrealizedPct <= -0.04 ? "STOP_LOSS" : edgeNow < 0 ? "EDGE_FLIP" : "MAX_HOLD";
        logger.info(`EXIT ${side} | ${reason} | pnl ${unrealized >= 0 ? "+" : ""}$${unrealized.toFixed(2)}`);
        this.risk.closePosition(cid, side, currentPrice);
        if (pos.orderId && pos.orderId !== "DRY_RUN") await this.client.cancelOrder(pos.orderId).catch(() => {});
      }
    }
  }

  logStats() {
    const now = Date.now();
    if (now - this.lastStatsLog < 30000) return;
    this.lastStatsLog = now;
    const s = this.risk.stats(this.prices);
    logger.info(`STATS | bankroll=$${s.bankroll} | pnl=${s.realizedPnl >= 0 ? "+" : ""}$${s.realizedPnl} | positions=${s.openPositions} | trades=${s.totalTrades} | winRate=${(s.winRate*100).toFixed(1)}% | drawdown=${(s.drawdown*100).toFixed(1)}%`);
  }

  async tick() {
    if (!this.running) return;
    this.tickCount++;
    try {
      if (this.tickCount % 300 === 1) await this.fetchMarkets();
      await this.refreshPrices();
      await this.evaluateAndTrade();
      this.logStats();
    } catch (err) { logger.error(`Tick error: ${err.message}`); }
  }

  async start() {
    this.running = true;
    logger.info("HFT Engine starting...");
    await this.fetchMarkets();
    if (this.markets.length === 0) { logger.error("No markets available."); process.exit(1); }
    logger.info(`Tick rate: ${this.config.tickMs}ms`);
    this._interval = setInterval(() => this.tick(), this.config.tickMs);
    await this.tick();
  }

  stop() {
    this.running = false;
    if (this._interval) clearInterval(this._interval);
    const s = this.risk.stats(this.prices);
    logger.info(`Engine stopped | Final PnL: $${s.totalPnl} | Trades: ${s.totalTrades}`);
  }
}
