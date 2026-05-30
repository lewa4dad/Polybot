/**
 * Fair Value Model
 * Blends momentum, mean reversion, and volume-weighted signals
 * to produce a fair value estimate for each market's YES token.
 */

export class FairValueModel {
  constructor() {
    // Per-market price history ring buffers
    this.priceHistory = new Map(); // conditionId -> number[]
    this.volumeHistory = new Map(); // conditionId -> number[]
    this.HISTORY_LEN = 40;
    this.MOMENTUM_WINDOW = 6;
    this.MEAN_WINDOW = 20;
  }

  update(conditionId, price, volume = 0) {
    // Price history
    if (!this.priceHistory.has(conditionId)) {
      this.priceHistory.set(conditionId, []);
    }
    const ph = this.priceHistory.get(conditionId);
    ph.push(price);
    if (ph.length > this.HISTORY_LEN) ph.shift();

    // Volume history
    if (!this.volumeHistory.has(conditionId)) {
      this.volumeHistory.set(conditionId, []);
    }
    const vh = this.volumeHistory.get(conditionId);
    vh.push(volume);
    if (vh.length > this.HISTORY_LEN) vh.shift();
  }

  /**
   * Compute fair value for a YES token.
   * Returns a number in (0, 1).
   */
  compute(conditionId, currentPrice) {
    const ph = this.priceHistory.get(conditionId) || [];

    if (ph.length < 5) return currentPrice; // not enough data yet

    // ── Mean reversion component ──────────────────────────────────────────
    const windowPrices = ph.slice(-this.MEAN_WINDOW);
    const mean = windowPrices.reduce((a, b) => a + b, 0) / windowPrices.length;

    // ── Momentum component ────────────────────────────────────────────────
    const momWindow = ph.slice(-this.MOMENTUM_WINDOW);
    const momentum = momWindow[momWindow.length - 1] - momWindow[0];

    // ── Volatility (used to dampen momentum in choppy markets) ────────────
    const diffs = windowPrices.slice(1).map((p, i) => p - windowPrices[i]);
    const variance = diffs.reduce((a, d) => a + d * d, 0) / diffs.length;
    const vol = Math.sqrt(variance);
    const volDampener = Math.max(0, 1 - vol * 20); // damp momentum when vol > 5%

    // ── Blend: 65% mean reversion, 35% momentum (vol-damped) ─────────────
    const fair = mean + momentum * 0.35 * volDampener;

    // ── Clamp to (0.03, 0.97) — markets near 0/1 have asymmetric risk ────
    return Math.max(0.03, Math.min(0.97, +fair.toFixed(5)));
  }

  /**
   * Compute edge for a given side.
   * Returns positive if there's an exploitable discrepancy.
   */
  edge(fair, marketPrice, side) {
    if (side === "YES") return +(fair - marketPrice).toFixed(5);
    return +((1 - fair) - (1 - marketPrice)).toFixed(5);
  }

  /**
   * Fractional Kelly position size as a fraction of bankroll.
   */
  kelly(edge, odds, kellyFraction, maxPosPct) {
    // f* = edge / odds
    const raw = edge / Math.max(odds, 0.01);
    const sized = raw * kellyFraction;
    return Math.max(0, Math.min(maxPosPct, +sized.toFixed(5)));
  }

  hasHistory(conditionId) {
    return (this.priceHistory.get(conditionId) || []).length >= 5;
  }
}
