import logger from "./logger.js";

export class RiskManager {
  constructor({ bankroll, maxDrawdownPct, maxPositions, maxPositionPct }) {
    this.startingBankroll = bankroll;
    this.bankroll = bankroll;
    this.maxDrawdownPct = maxDrawdownPct;
    this.maxPositions = maxPositions;
    this.maxPositionPct = maxPositionPct;
    this.positions = new Map();
    this.openOrders = new Map();
    this.pnl = 0;
    this.realizedPnl = 0;
    this.trades = [];
    this.halted = false;
    this.haltReason = "";
  }

  canTrade(conditionId, side, size) {
    if (this.halted) { logger.warn(`Bot halted: ${this.haltReason}`); return false; }
    const drawdown = (this.startingBankroll - this.bankroll) / this.startingBankroll;
    if (drawdown >= this.maxDrawdownPct) { this.halt(`Max drawdown reached: ${(drawdown * 100).toFixed(1)}%`); return false; }
    if (this.positions.size >= this.maxPositions) { logger.debug(`Max positions reached`); return false; }
    const key = `${conditionId}_${side}`;
    if (this.positions.has(key)) {
      const existing = this.positions.get(key);
      if ((existing.size + size) / this.bankroll > this.maxPositionPct * 2) return false;
    }
    if (size < 2) return false;
    if (size > this.bankroll * this.maxPositionPct) return false;
    return true;
  }

  openPosition({ conditionId, tokenId, side, price, size, orderId, question }) {
    const key = `${conditionId}_${side}`;
    const shares = size / price;
    if (this.positions.has(key)) {
      const pos = this.positions.get(key);
      const totalShares = pos.shares + shares;
      const totalSize = pos.size + size;
      pos.avgCost = totalSize / totalShares;
      pos.shares = totalShares;
      pos.size = totalSize;
    } else {
      this.positions.set(key, { conditionId, tokenId, side, avgCost: price, shares, size, openedAt: Date.now(), orderId, question });
    }
    this.bankroll -= size;
    const trade = { ts: new Date().toISOString(), conditionId, side, price, size, shares, question: question?.slice(0, 60), type: "OPEN", orderId };
    this.trades.push(trade);
    logger.info(`OPEN  ${side.padEnd(3)} | ${question?.slice(0, 35).padEnd(35)} | ${shares.toFixed(2)} sh @ ${price.toFixed(4)} | cost $${size.toFixed(2)}`);
    return trade;
  }

  closePosition(conditionId, side, closePrice) {
    const key = `${conditionId}_${side}`;
    const pos = this.positions.get(key);
    if (!pos) return null;
    const proceeds = pos.shares * closePrice;
    const pnl = proceeds - pos.size;
    this.realizedPnl += pnl;
    this.bankroll += proceeds;
    this.pnl = this.realizedPnl;
    this.positions.delete(key);
    const trade = { ts: new Date().toISOString(), conditionId, side, closePrice, openCost: pos.avgCost, shares: pos.shares, pnl, question: pos.question, type: "CLOSE", holdMs: Date.now() - pos.openedAt };
    this.trades.push(trade);
    logger.info(`CLOSE ${side.padEnd(3)} | ${pos.question?.slice(0, 35).padEnd(35)} | pnl ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}`);
    return trade;
  }

  unrealizedPnl(prices) {
    let total = 0;
    for (const [key, pos] of this.positions) {
      const px = prices.get(pos.conditionId);
      if (!px) continue;
      const currentPrice = pos.side === "YES" ? px.yes : px.no;
      total += pos.shares * (currentPrice - pos.avgCost);
    }
    return +total.toFixed(2);
  }

  halt(reason) { this.halted = true; this.haltReason = reason; logger.error(`RISK HALT: ${reason}`); }
  resume() { this.halted = false; this.haltReason = ""; logger.info("Bot resumed"); }

  stats(currentPrices) {
    const closedTrades = this.trades.filter(t => t.type === "CLOSE");
    const wins = closedTrades.filter(t => t.pnl > 0).length;
    const losses = closedTrades.filter(t => t.pnl <= 0).length;
    const winRate = closedTrades.length > 0 ? wins / closedTrades.length : 0;
    const totalPnl = closedTrades.reduce((a, t) => a + t.pnl, 0);
    const avgWin = wins > 0 ? closedTrades.filter(t => t.pnl > 0).reduce((a, t) => a + t.pnl, 0) / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(closedTrades.filter(t => t.pnl <= 0).reduce((a, t) => a + t.pnl, 0) / losses) : 0;
    const unrealized = this.unrealizedPnl(currentPrices);
    return {
      bankroll: +this.bankroll.toFixed(2), realizedPnl: +totalPnl.toFixed(2), unrealizedPnl: unrealized,
      totalPnl: +(totalPnl + unrealized).toFixed(2), openPositions: this.positions.size,
      totalTrades: closedTrades.length, wins, losses, winRate: +winRate.toFixed(4),
      avgWin: +avgWin.toFixed(2), avgLoss: +avgLoss.toFixed(2),
      profitFactor: avgLoss > 0 ? +(avgWin / avgLoss).toFixed(2) : 0,
      drawdown: +((this.startingBankroll - this.bankroll) / this.startingBankroll).toFixed(4),
      halted: this.halted,
    };
  }
}
