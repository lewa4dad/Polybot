<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#020407">
<title>PolyBot Monitor</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Exo+2:wght@300;400;600;700;900&display=swap" rel="stylesheet">
<style>
  :root {
    --bg:       #020407;
    --bg1:      #060c10;
    --bg2:      #0a1520;
    --border:   #0d2535;
    --green:    #00e5a0;
    --green2:   #00ff88;
    --red:      #ff3366;
    --amber:    #ffaa00;
    --blue:     #00aaff;
    --dim:      #1a3a50;
    --muted:    #2a5570;
    --text:     #c8e0ee;
    --textdim:  #4a7a99;
    --mono:     'Share Tech Mono', monospace;
    --sans:     'Exo 2', sans-serif;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }

  html, body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    height: 100%;
    overflow: hidden;
    overscroll-behavior: none;
  }

  /* ── Connect screen ─────────────────────────────────────────────────────── */
  #connect-screen {
    position: fixed; inset: 0; z-index: 100;
    background: var(--bg);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 0; padding: 32px 24px;
  }

  .logo-mark {
    width: 64px; height: 64px; margin-bottom: 24px;
    position: relative;
  }
  .logo-mark svg { width: 100%; height: 100%; }

  .connect-title {
    font-family: var(--sans);
    font-weight: 900;
    font-size: 28px;
    letter-spacing: 4px;
    color: var(--green);
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .connect-sub {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--textdim);
    letter-spacing: 2px;
    margin-bottom: 40px;
  }

  .field-group { width: 100%; max-width: 340px; margin-bottom: 14px; }
  .field-label {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--textdim);
    letter-spacing: 2px;
    margin-bottom: 6px;
    display: block;
    text-transform: uppercase;
  }
  .field-input {
    width: 100%;
    background: var(--bg1);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 12px 14px;
    color: var(--text);
    font-family: var(--mono);
    font-size: 13px;
    outline: none;
    transition: border-color 0.2s;
  }
  .field-input:focus { border-color: var(--green); }
  .field-input::placeholder { color: var(--dim); }

  .connect-btn {
    width: 100%; max-width: 340px;
    margin-top: 8px;
    background: var(--green);
    color: var(--bg);
    border: none;
    border-radius: 4px;
    padding: 14px;
    font-family: var(--sans);
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 3px;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 0.2s;
  }
  .connect-btn:active { opacity: 0.7; }
  .connect-btn:disabled { opacity: 0.4; cursor: default; }

  .connect-error {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--red);
    margin-top: 10px;
    text-align: center;
    min-height: 16px;
  }

  /* ── App shell ──────────────────────────────────────────────────────────── */
  #app {
    display: none;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
  }
  #app.visible { display: flex; }

  /* ── Header ─────────────────────────────────────────────────────────────── */
  .header {
    flex-shrink: 0;
    background: var(--bg1);
    border-bottom: 1px solid var(--border);
    padding: 12px 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .header-dot {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--green);
    box-shadow: 0 0 8px var(--green);
    flex-shrink: 0;
  }
  .header-dot.halted { background: var(--red); box-shadow: 0 0 8px var(--red); }
  .header-dot.offline { background: var(--muted); box-shadow: none; }
  .header-dot.live { animation: hbeat 2s ease-in-out infinite; }
  @keyframes hbeat { 0%,100%{opacity:1} 50%{opacity:0.3} }

  .header-title {
    font-family: var(--sans);
    font-weight: 700;
    font-size: 14px;
    letter-spacing: 3px;
    color: var(--green);
    text-transform: uppercase;
  }
  .header-status {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--textdim);
    margin-left: auto;
  }
  .disconnect-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--textdim);
    border-radius: 3px;
    padding: 4px 8px;
    font-family: var(--mono);
    font-size: 10px;
    cursor: pointer;
  }

  /* ── Tab bar ────────────────────────────────────────────────────────────── */
  .tabs {
    flex-shrink: 0;
    display: flex;
    background: var(--bg1);
    border-bottom: 1px solid var(--border);
  }
  .tab {
    flex: 1;
    padding: 11px 4px;
    text-align: center;
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 1.5px;
    color: var(--textdim);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.15s;
    text-transform: uppercase;
    user-select: none;
  }
  .tab.active { color: var(--green); border-bottom-color: var(--green); }
  .tab-icon { font-size: 14px; display: block; margin-bottom: 2px; }

  /* ── Scroll area ─────────────────────────────────────────────────────────── */
  .panel { display: none; flex: 1; overflow-y: auto; padding: 12px; gap: 10px; flex-direction: column; }
  .panel.active { display: flex; }

  /* ── Cards ──────────────────────────────────────────────────────────────── */
  .card {
    background: var(--bg1);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 14px;
  }
  .card-title {
    font-family: var(--mono);
    font-size: 9px;
    letter-spacing: 2px;
    color: var(--textdim);
    text-transform: uppercase;
    margin-bottom: 10px;
  }

  /* ── Stats grid ──────────────────────────────────────────────────────────── */
  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .stat-cell {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 10px 12px;
  }
  .stat-label {
    font-family: var(--mono);
    font-size: 8px;
    color: var(--textdim);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  .stat-value {
    font-family: var(--sans);
    font-weight: 700;
    font-size: 18px;
    color: var(--text);
    line-height: 1;
  }
  .stat-value.pos { color: var(--green); }
  .stat-value.neg { color: var(--red); }
  .stat-value.warn { color: var(--amber); }
  .stat-value.sm { font-size: 13px; }

  /* ── PnL big display ─────────────────────────────────────────────────────── */
  .pnl-hero {
    text-align: center;
    padding: 8px 0 4px;
  }
  .pnl-label {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--textdim);
    letter-spacing: 3px;
    text-transform: uppercase;
    margin-bottom: 6px;
  }
  .pnl-value {
    font-family: var(--sans);
    font-weight: 900;
    font-size: 42px;
    line-height: 1;
    transition: color 0.3s;
  }
  .pnl-sub {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--textdim);
    margin-top: 4px;
  }

  /* ── Sparkline ───────────────────────────────────────────────────────────── */
  .spark-wrap { margin: 8px 0 4px; }
  canvas.spark { width: 100%; height: 60px; display: block; border-radius: 3px; }

  /* ── Control buttons ─────────────────────────────────────────────────────── */
  .ctrl-row { display: flex; gap: 8px; }
  .ctrl-btn {
    flex: 1;
    padding: 13px 8px;
    border-radius: 4px;
    border: 1px solid;
    font-family: var(--sans);
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 2px;
    text-transform: uppercase;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.1s;
  }
  .ctrl-btn:active { opacity: 0.6; transform: scale(0.97); }
  .ctrl-btn.start  { background: #001a0e; color: var(--green); border-color: #003322; }
  .ctrl-btn.stop   { background: #1a0008; color: var(--red);   border-color: #330011; }
  .ctrl-btn.resume { background: #1a1000; color: var(--amber); border-color: #332200; }

  /* ── Position cards ──────────────────────────────────────────────────────── */
  .pos-card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 10px 12px;
    margin-bottom: 6px;
  }
  .pos-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
  .pos-question { font-size: 11px; color: var(--text); line-height: 1.4; flex: 1; padding-right: 10px; }
  .pos-pnl { font-family: var(--sans); font-weight: 700; font-size: 14px; flex-shrink: 0; }
  .pos-meta { display: flex; gap: 12px; flex-wrap: wrap; }
  .pos-meta span { font-family: var(--mono); font-size: 9px; color: var(--textdim); }
  .side-tag {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 2px;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1px;
    margin-right: 6px;
  }
  .side-tag.yes { background: #001a0e; color: var(--green); border: 1px solid #003322; }
  .side-tag.no  { background: #1a0008; color: var(--red);   border: 1px solid #330011; }

  /* ── Market rows ─────────────────────────────────────────────────────────── */
  .mkt-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 0;
    border-bottom: 1px solid var(--border);
  }
  .mkt-row:last-child { border-bottom: none; }
  .mkt-q { flex: 1; font-size: 11px; color: var(--text); line-height: 1.4; }
  .mkt-right { text-align: right; flex-shrink: 0; }
  .mkt-yes { font-family: var(--sans); font-weight: 700; font-size: 16px; }
  .mkt-spread { font-family: var(--mono); font-size: 9px; color: var(--textdim); }
  .warm-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; margin-top: 3px; }

  /* ── Trade rows ──────────────────────────────────────────────────────────── */
  .trade-row {
    padding: 9px 0;
    border-bottom: 1px solid var(--border);
  }
  .trade-row:last-child { border-bottom: none; }
  .trade-top { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
  .trade-q { font-size: 11px; color: var(--text); flex: 1; }
  .trade-pnl { font-family: var(--sans); font-weight: 700; font-size: 12px; }
  .trade-meta { font-family: var(--mono); font-size: 9px; color: var(--textdim); }

  /* ── Empty state ─────────────────────────────────────────────────────────── */
  .empty { text-align: center; padding: 40px 20px; font-family: var(--mono); font-size: 11px; color: var(--dim); }

  /* ── Halt banner ─────────────────────────────────────────────────────────── */
  .halt-banner {
    background: #1a0005;
    border: 1px solid #550011;
    border-radius: 4px;
    padding: 10px 14px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--red);
    display: none;
  }
  .halt-banner.visible { display: block; }

  /* ── Ticker ──────────────────────────────────────────────────────────────── */
  .tick-badge {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--textdim);
    padding: 2px 6px;
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: 2px;
  }
</style>
</head>
<body>

<!-- ── Connect Screen ──────────────────────────────────────────────────────── -->
<div id="connect-screen">
  <div class="logo-mark">
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="32,4 60,20 60,44 32,60 4,44 4,20" stroke="#00e5a0" stroke-width="2" fill="none" opacity="0.4"/>
      <polygon points="32,14 50,24 50,40 32,50 14,40 14,24" stroke="#00e5a0" stroke-width="1.5" fill="none" opacity="0.7"/>
      <circle cx="32" cy="32" r="8" fill="#00e5a0" opacity="0.9"/>
      <circle cx="32" cy="32" r="3" fill="#020407"/>
    </svg>
  </div>
  <div class="connect-title">PolyBot</div>
  <div class="connect-sub">BTC HFT MONITOR</div>

  <div class="field-group">
    <label class="field-label" for="vps-url">VPS IP or Hostname</label>
    <input id="vps-url" class="field-input" type="text" placeholder="e.g. 123.45.67.89 or mybot.xyz" autocomplete="off" autocorrect="off" spellcheck="false">
  </div>
  <div class="field-group">
    <label class="field-label" for="vps-port">Dashboard Port</label>
    <input id="vps-port" class="field-input" type="number" value="3001" placeholder="3001">
  </div>
  <div class="field-group">
    <label class="field-label" for="vps-token">Dashboard Token</label>
    <input id="vps-token" class="field-input" type="password" placeholder="DASHBOARD_TOKEN from your .env">
  </div>

  <button class="connect-btn" id="connect-btn" onclick="doConnect()">CONNECT</button>
  <div class="connect-error" id="connect-error"></div>
</div>

<!-- ── Main App ────────────────────────────────────────────────────────────── -->
<div id="app">
  <div class="header">
    <div class="header-dot offline" id="hdr-dot"></div>
    <div class="header-title">PolyBot</div>
    <div class="header-status" id="hdr-status">—</div>
    <button class="disconnect-btn" onclick="doDisconnect()">✕</button>
  </div>

  <div class="tabs">
    <div class="tab active" onclick="switchTab('overview')" id="tab-overview">
      <span class="tab-icon">◈</span>Overview
    </div>
    <div class="tab" onclick="switchTab('positions')" id="tab-positions">
      <span class="tab-icon">◉</span>Positions
    </div>
    <div class="tab" onclick="switchTab('markets')" id="tab-markets">
      <span class="tab-icon">◎</span>Markets
    </div>
    <div class="tab" onclick="switchTab('trades')" id="tab-trades">
      <span class="tab-icon">◇</span>Trades
    </div>
  </div>

  <!-- Overview panel -->
  <div class="panel active" id="panel-overview">
    <div id="halt-banner" class="halt-banner">🛑 RISK HALT — <span id="halt-reason"></span></div>

    <div class="card">
      <div class="pnl-hero">
        <div class="pnl-label">Total P&L</div>
        <div class="pnl-value" id="pnl-hero">$0.00</div>
        <div class="pnl-sub" id="pnl-sub">Unrealized: $0.00</div>
      </div>
      <div class="spark-wrap">
        <canvas class="spark" id="spark-canvas"></canvas>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Engine Controls</div>
      <div class="ctrl-row" id="ctrl-row">
        <button class="ctrl-btn start" onclick="sendCommand('start')">▶ START</button>
        <button class="ctrl-btn stop"  onclick="sendCommand('stop')">■ STOP</button>
        <button class="ctrl-btn resume" onclick="sendCommand('resume')">↺ RESUME</button>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-cell">
        <div class="stat-label">Bankroll</div>
        <div class="stat-value sm" id="st-bankroll">$—</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Realized PnL</div>
        <div class="stat-value sm" id="st-realized">$—</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Open Positions</div>
        <div class="stat-value" id="st-positions">—</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Total Trades</div>
        <div class="stat-value" id="st-trades">—</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Win Rate</div>
        <div class="stat-value" id="st-winrate">—</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Drawdown</div>
        <div class="stat-value" id="st-drawdown">—</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Profit Factor</div>
        <div class="stat-value" id="st-pf">—</div>
      </div>
      <div class="stat-cell">
        <div class="stat-label">Tick #</div>
        <div class="stat-value" id="st-ticks">—</div>
      </div>
    </div>
  </div>

  <!-- Positions panel -->
  <div class="panel" id="panel-positions">
    <div class="card">
      <div class="card-title">Open Positions</div>
      <div id="positions-list"><div class="empty">No open positions</div></div>
    </div>
  </div>

  <!-- Markets panel -->
  <div class="panel" id="panel-markets">
    <div class="card">
      <div class="card-title">BTC Markets</div>
      <div id="markets-list"><div class="empty">Loading…</div></div>
    </div>
  </div>

  <!-- Trades panel -->
  <div class="panel" id="panel-trades">
    <div class="card">
      <div class="card-title">Recent Trades</div>
      <div id="trades-list"><div class="empty">No trades yet</div></div>
    </div>
  </div>
</div>

<script>
// ── State ─────────────────────────────────────────────────────────────────────
let ws = null;
let wsUrl = "";
let token = "";
let pnlHistory = [];
let lastState = null;
let sparkCtx = null;
let sparkAnim = null;
let reconnectTimer = null;
let reconnectAttempts = 0;

const $ = id => document.getElementById(id);

// ── Persistence ───────────────────────────────────────────────────────────────
function saveConn(url, port, tok) {
  try {
    localStorage.setItem("pb_url", url);
    localStorage.setItem("pb_port", port);
    localStorage.setItem("pb_tok", tok);
  } catch {}
}
function loadConn() {
  try {
    const url = localStorage.getItem("pb_url") || "";
    const port = localStorage.getItem("pb_port") || "3001";
    const tok  = localStorage.getItem("pb_tok") || "";
    if (url) { $("vps-url").value = url; $("vps-port").value = port; $("vps-token").value = tok; }
  } catch {}
}

// ── Connect ───────────────────────────────────────────────────────────────────
function doConnect() {
  const host = $("vps-url").value.trim();
  const port = $("vps-port").value.trim() || "3001";
  token = $("vps-token").value.trim();

  if (!host) { $("connect-error").textContent = "Enter your VPS IP or hostname."; return; }
  if (!token) { $("connect-error").textContent = "Enter your dashboard token."; return; }

  $("connect-error").textContent = "";
  $("connect-btn").disabled = true;
  $("connect-btn").textContent = "CONNECTING…";

  wsUrl = `ws://${host}:${port}?token=${encodeURIComponent(token)}`;
  saveConn(host, port, token);
  openWS();
}

function openWS() {
  if (ws) { ws.onclose = null; ws.close(); }
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    reconnectAttempts = 0;
    $("connect-screen").style.display = "none";
    $("app").classList.add("visible");
    setDot("live");
    $("hdr-status").textContent = "LIVE";
    $("connect-btn").disabled = false;
    $("connect-btn").textContent = "CONNECT";
  };

  ws.onmessage = e => {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === "state") applyState(msg.data);
      if (msg.type === "commandResult") showCmdResult(msg.data);
    } catch {}
  };

  ws.onerror = () => {
    $("connect-error").textContent = "Connection failed. Check IP, port, and token.";
    $("connect-btn").disabled = false;
    $("connect-btn").textContent = "CONNECT";
  };

  ws.onclose = () => {
    setDot("offline");
    $("hdr-status").textContent = "RECONNECTING…";
    reconnectAttempts++;
    const delay = Math.min(3000 * reconnectAttempts, 30000);
    reconnectTimer = setTimeout(openWS, delay);
  };
}

function doDisconnect() {
  clearTimeout(reconnectTimer);
  if (ws) { ws.onclose = null; ws.close(); ws = null; }
  $("app").classList.remove("visible");
  $("connect-screen").style.display = "flex";
  $("connect-btn").disabled = false;
  $("connect-btn").textContent = "CONNECT";
  setDot("offline");
}

// ── Apply state ───────────────────────────────────────────────────────────────
function applyState(d) {
  lastState = d;
  const s = d.stats;

  // Halt banner
  $("halt-banner").classList.toggle("visible", d.halted);
  $("halt-reason").textContent = d.haltReason || "";

  // Header dot
  setDot(d.halted ? "halted" : d.running ? "live" : "offline");
  $("hdr-status").textContent = d.halted ? "HALTED" : d.running ? `T#${d.tickCount}` : "STOPPED";

  // PnL hero
  const totalPnl = s.totalPnl;
  const heroEl = $("pnl-hero");
  heroEl.textContent = (totalPnl >= 0 ? "+" : "") + "$" + Math.abs(totalPnl).toFixed(2);
  heroEl.style.color = totalPnl >= 0 ? "var(--green)" : "var(--red)";
  $("pnl-sub").textContent = `Unrealized: ${s.unrealizedPnl >= 0 ? "+" : ""}$${s.unrealizedPnl.toFixed(2)} · Bankroll: $${s.bankroll.toFixed(2)}`;

  // Track PnL history for sparkline
  pnlHistory.push(totalPnl);
  if (pnlHistory.length > 120) pnlHistory.shift();
  drawSparkline();

  // Stats
  setText("st-bankroll",  "$" + s.bankroll.toFixed(2));
  setValColor("st-realized", (s.realizedPnl >= 0 ? "+" : "") + "$" + s.realizedPnl.toFixed(2), s.realizedPnl);
  setText("st-positions", s.openPositions);
  setText("st-trades",    s.totalTrades);
  setValColor("st-winrate",  (s.winRate * 100).toFixed(1) + "%", s.winRate - 0.5);
  setDrawdown("st-drawdown", s.drawdown);
  setText("st-pf",        s.profitFactor || "—");
  setText("st-ticks",     d.tickCount);

  // Positions
  renderPositions(d.positions);

  // Markets
  renderMarkets(d.markets);

  // Trades
  renderTrades(d.recentTrades);
}

// ── Render helpers ─────────────────────────────────────────────────────────────
function setText(id, val) { $(id).textContent = val; }

function setValColor(id, text, val) {
  const el = $(id);
  el.textContent = text;
  el.className = "stat-value sm " + (val > 0 ? "pos" : val < 0 ? "neg" : "");
}

function setDrawdown(id, val) {
  const el = $(id);
  el.textContent = (val * 100).toFixed(1) + "%";
  el.className = "stat-value " + (val > 0.15 ? "neg" : val > 0.08 ? "warn" : "");
}

function setDot(state) {
  const d = $("hdr-dot");
  d.className = "header-dot " + state;
}

function renderPositions(positions) {
  const el = $("positions-list");
  if (!positions || positions.length === 0) {
    el.innerHTML = '<div class="empty">No open positions</div>';
    return;
  }
  el.innerHTML = positions.map(p => `
    <div class="pos-card">
      <div class="pos-header">
        <div class="pos-question">
          <span class="side-tag ${p.side.toLowerCase()}">${p.side}</span>${p.question || p.key}
        </div>
        <div class="pos-pnl" style="color:${p.unrealizedPnl >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${p.unrealizedPnl >= 0 ? "+" : ""}$${p.unrealizedPnl.toFixed(2)}
        </div>
      </div>
      <div class="pos-meta">
        <span>${p.shares} sh</span>
        <span>avg ${p.avgCost.toFixed(4)}</span>
        <span>now ${p.currentPrice.toFixed(4)}</span>
        <span>${p.heldMin}m</span>
        <span>$${p.size.toFixed(2)}</span>
      </div>
    </div>
  `).join("");
}

function renderMarkets(markets) {
  const el = $("markets-list");
  if (!markets || markets.length === 0) {
    el.innerHTML = '<div class="empty">No markets loaded</div>';
    return;
  }
  el.innerHTML = markets.map(m => {
    const yes = m.yes != null ? (m.yes * 100).toFixed(1) + "%" : "—";
    const fair = m.fair != null ? (m.fair * 100).toFixed(1) + "%" : "—";
    const spread = m.spread != null ? (m.spread * 100).toFixed(2) + "%" : "—";
    const yesColor = m.yes > 0.5 ? "var(--green)" : m.yes < 0.5 ? "var(--red)" : "var(--text)";
    const warmColor = m.warmedUp ? "var(--green)" : "var(--muted)";
    return `
      <div class="mkt-row">
        <div class="warm-dot" style="background:${warmColor}" title="${m.warmedUp ? 'Warmed up' : 'Warming up'}"></div>
        <div class="mkt-q">${m.question}</div>
        <div class="mkt-right">
          <div class="mkt-yes" style="color:${yesColor}">${yes}</div>
          <div class="mkt-spread">FV ${fair} · S ${spread}</div>
        </div>
      </div>
    `;
  }).join("");
}

function renderTrades(trades) {
  const el = $("trades-list");
  if (!trades || trades.length === 0) {
    el.innerHTML = '<div class="empty">No trades yet</div>';
    return;
  }
  el.innerHTML = trades.map(t => {
    const isClose = t.type === "CLOSE";
    const pnlStr = isClose
      ? `<span class="trade-pnl" style="color:${t.pnl >= 0 ? 'var(--green)' : 'var(--red)'}">${t.pnl >= 0 ? "+" : ""}$${t.pnl?.toFixed(2)}</span>`
      : "";
    const meta = isClose
      ? `CLOSE · ${t.side} · avg ${t.openCost?.toFixed(4)} → ${t.closePrice?.toFixed(4)} · ${t.shares?.toFixed(2)} sh`
      : `OPEN · ${t.side} · ${t.price?.toFixed(4)} · $${t.size?.toFixed(2)}`;
    const ts = new Date(t.ts).toLocaleTimeString("en-US", { hour12: false });
    return `
      <div class="trade-row">
        <div class="trade-top">
          <span class="side-tag ${(t.side||'').toLowerCase()}">${t.side}</span>
          <div class="trade-q">${(t.question || "").slice(0, 50)}</div>
          ${pnlStr}
        </div>
        <div class="trade-meta">${ts} · ${meta}</div>
      </div>
    `;
  }).join("");
}

// ── Sparkline ─────────────────────────────────────────────────────────────────
function drawSparkline() {
  const canvas = $("spark-canvas");
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const data = pnlHistory;
  if (data.length < 2) return;

  ctx.clearRect(0, 0, w, h);

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = Math.max(max - min, 0.01);
  const pad = 4;

  const px = (i) => (i / (data.length - 1)) * (w - pad * 2) + pad;
  const py = (v) => h - pad - ((v - min) / range) * (h - pad * 2);

  // Fill
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  const isUp = data[data.length - 1] >= data[0];
  grad.addColorStop(0, isUp ? "rgba(0,229,160,0.15)" : "rgba(255,51,102,0.12)");
  grad.addColorStop(1, "rgba(0,0,0,0)");

  ctx.beginPath();
  ctx.moveTo(px(0), py(data[0]));
  data.forEach((v, i) => { if (i > 0) ctx.lineTo(px(i), py(v)); });
  ctx.lineTo(px(data.length - 1), h);
  ctx.lineTo(px(0), h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.moveTo(px(0), py(data[0]));
  data.forEach((v, i) => { if (i > 0) ctx.lineTo(px(i), py(v)); });
  ctx.strokeStyle = isUp ? "#00e5a0" : "#ff3366";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Zero line
  if (min <= 0 && max >= 0) {
    ctx.beginPath();
    ctx.moveTo(pad, py(0));
    ctx.lineTo(w - pad, py(0));
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(name) {
  ["overview","positions","markets","trades"].forEach(t => {
    $(`tab-${t}`).classList.toggle("active", t === name);
    $(`panel-${t}`).classList.toggle("active", t === name);
  });
  if (name === "overview") requestAnimationFrame(drawSparkline);
}

// ── Commands ──────────────────────────────────────────────────────────────────
function sendCommand(cmd) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ command: cmd }));
}

function showCmdResult(r) {
  // Brief visual feedback — could be a toast
  $("hdr-status").textContent = r.msg;
  setTimeout(() => {
    if (lastState) $("hdr-status").textContent = lastState.running ? `T#${lastState.tickCount}` : "STOPPED";
  }, 2000);
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadConn();
window.addEventListener("resize", drawSparkline);
</script>
</body>
</html>
