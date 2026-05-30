export class FairValueModel {
  constructor() {
    this.priceHistory = new Map();
    this.volumeHistory = new Map();
    this.HISTORY_LEN = 40;
    this.MOMENTUM_WINDOW = 6;
    this.MEAN_WINDOW = 20;
  }

  update(conditionId, price, volume = 0) {
    if (!this.priceHistory.has(conditionId)) this.priceHistory.set(conditionId, []);
    const ph = this.priceHistory.get(conditionId);
    ph.push(price);
    if (ph.length > this.HISTORY_LEN) ph.shift();

    if (!this.volumeHistory.has(conditionId)) this.volumeHistory.set(conditionId, []);
    const vh = this.volumeHistory.get(conditionId);
    vh.push(volume);
    if (vh.length > this.HISTORY_LEN) vh.shift();
  }

  compute(conditionId, currentPrice) {
    const ph = this.priceHistory.get(conditionId) || [];
    if (ph.length < 5) return currentPrice;
    const windowPrices = ph.slice(-this.MEAN_WINDOW);
    const mean = windowPrices.reduce((a, b) => a + b, 0) / windowPrices.length;
    const momWindow = ph.slice(-this.MOMENTUM_WINDOW);
    const momentum = momWindow[momWindow.length - 1] - momWindow[0];
    const diffs = windowPrices.slice(1).map((p, i) => p - windowPrices[i]);
    const variance = diffs.reduce((a, d) => a + d * d, 0) / diffs.length;
    const vol = Math.sqrt(variance);
    const volDampener = Math.max(0, 1 - vol * 20);
    const fair = mean + momentum * 0.35 * volDampener;
    return Math.max(0.03, Math.min(0.97, +fair.toFixed(5)));
  }

  edge(fair, marketPrice, side) {
    if (side === "YES") return +(fair - marketPrice).toFixed(5);
    return +((1 - fair) - (1 - marketPrice)).toFixed(5);
  }

  kelly(edge, odds, kellyFraction, maxPosPct) {
    const raw = edge / Math.max(odds, 0.01);
    const sized = raw * kellyFraction;
    return Math.max(0, Math.min(maxPosPct, +sized.toFixed(5)));
  }

  hasHistory(conditionId) {
    return (this.priceHistory.get(conditionId) || []).length >= 5;
  }
}
