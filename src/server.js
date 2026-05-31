import { WebSocketServer } from "ws";
import http from "http";
import crypto from "crypto";
import logger from "./logger.js";

const PORT = parseInt(process.env.DASHBOARD_PORT || "3001");
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN || "changeme";

export class StatusServer {
  constructor({ engine, riskManager }) {
    this.engine = engine;
    this.risk = riskManager;
    this.clients = new Set();
  }

  _snapshot() {
    const s = this.risk.stats(this.engine.prices);
    const positions = [];
    for (const [key, pos] of this.risk.positions) {
      const px = this.engine.prices.get(pos.conditionId);
      const currentPrice = pos.side === "YES" ? px?.bestBid : px ? 1 - px.bestAsk : pos.avgCost;
      positions.push({ key, question: pos.question, side: pos.side, shares: +pos.shares.toFixed(2), avgCost: +pos.avgCost.toFixed(4), currentPrice: +(currentPrice || pos.avgCost).toFixed(4), size: +pos.size.toFixed(2), unrealizedPnl: +(pos.shares * ((currentPrice || pos.avgCost) - pos.avgCost)).toFixed(2), heldMin: +((Date.now() - pos.openedAt) / 60000).toFixed(1) });
    }
    const markets = this.engine.markets.slice(0, 12).map(m => {
      const px = this.engine.prices.get(m.conditionId);
      return { conditionId: m.conditionId, question: m.question, yes: px?.yes, no: px?.no, spread: px?.spread, fair: px ? this.engine.model.compute(m.conditionId, px.yes) : null, volume: m.volume, warmedUp: this.engine.warmupDone.has(m.conditionId) };
    });
    return { ts: Date.now(), running: this.engine.running, halted: this.risk.halted, haltReason: this.risk.haltReason, tickCount: this.engine.tickCount, stats: s, positions, markets, recentTrades: this.risk.trades.slice(-30).reverse() };
  }

  _auth(token) {
    try { return crypto.timingSafeEqual(Buffer.from(token || ""), Buffer.from(DASHBOARD_TOKEN)); } catch { return false; }
  }

  broadcast() {
    if (!this.clients.size) return;
    const payload = JSON.stringify({ type: "state", data: this._snapshot() });
    for (const ws of this.clients) if (ws.readyState === 1) ws.send(payload);
  }

  async handleCommand(cmd) {
    if (cmd === "stop")   { this.engine.stop(); return { ok: true, msg: "Stopped" }; }
    if (cmd === "start")  { if (!this.engine.running) { this.engine.start(); return { ok: true, msg: "Started" }; } return { ok: false, msg: "Already running" }; }
    if (cmd === "resume") { this.risk.resume(); return { ok: true, msg: "Resumed" }; }
    return { ok: false, msg: "Unknown command" };
  }

  start() {
    this._server = http.createServer(async (req, res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
      const token = (req.headers.authorization || "").replace("Bearer ", "");
      if (!this._auth(token)) { res.writeHead(401); res.end(JSON.stringify({ error: "Unauthorized" })); return; }
      if (req.method === "GET" && req.url === "/api") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify(this._snapshot())); return; }
      res.writeHead(404); res.end();
    });
    this._wss = new WebSocketServer({ server: this._server });
    this._wss.on("connection", (ws, req) => {
      const token = new URL(req.url, "http://localhost").searchParams.get("token") || "";
      if (!this._auth(token)) { ws.close(1008, "Unauthorized"); return; }
      this.clients.add(ws);
      ws.send(JSON.stringify({ type: "state", data: this._snapshot() }));
      ws.on("message", async raw => { try { const { command } = JSON.parse(raw.toString()); const result = await this.handleCommand(command); ws.send(JSON.stringify({ type: "commandResult", data: result })); } catch {} });
      ws.on("close", () => this.clients.delete(ws));
    });
    this._server.listen(PORT, "0.0.0.0", () => logger.info(`Dashboard live on port ${PORT}`));
    this._broadcastInterval = setInterval(() => this.broadcast(), 1500);
  }

  stop() {
    if (this._broadcastInterval) clearInterval(this._broadcastInterval);
    for (const ws of this.clients) ws.close();
    this._server?.close();
  }
}
