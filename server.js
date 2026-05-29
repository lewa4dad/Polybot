/**
 * Polymarket CLOB API Client
 * Handles auth, order signing, and all REST calls to clob.polymarket.com
 */

import axios from "axios";
import { ethers } from "ethers";
import crypto from "crypto";
import logger from "./logger.js";

const CLOB_BASE = "https://clob.polymarket.com";
const GAMMA_BASE = "https://gamma-api.polymarket.com";

// EIP-712 domain for Polymarket order signing
const DOMAIN = {
  name: "ClobAuthDomain",
  version: "1",
  chainId: 137, // Polygon mainnet
};

export class PolymarketClient {
  constructor({ privateKey, apiKey, apiSecret, apiPassphrase }) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.apiPassphrase = apiPassphrase;

    if (privateKey && privateKey !== "0xYOUR_PRIVATE_KEY_HERE") {
      this.wallet = new ethers.Wallet(privateKey);
      this.address = this.wallet.address;
      logger.info(`Wallet loaded: ${this.address}`);
    } else {
      this.wallet = null;
      this.address = null;
      logger.warn("No private key set — running in READ-ONLY mode (no live orders)");
    }

    this.http = axios.create({
      baseURL: CLOB_BASE,
      timeout: 8000,
      headers: { "Content-Type": "application/json" },
    });

    // Response interceptor for error logging
    this.http.interceptors.response.use(
      (r) => r,
      (err) => {
        const msg = err.response?.data?.message || err.message;
        logger.error(`CLOB API error: ${msg}`);
        return Promise.reject(err);
      }
    );
  }

  // ── HMAC auth header for signed endpoints ──────────────────────────────────
  _authHeaders(method, path, body = "") {
    if (!this.apiKey || this.apiKey === "your_clob_api_key_here") return {};
    const ts = Math.floor(Date.now() / 1000).toString();
    const msg = ts + method.toUpperCase() + path + (body ? JSON.stringify(body) : "");
    const sig = crypto
      .createHmac("sha256", Buffer.from(this.apiSecret, "base64"))
      .update(msg)
      .digest("base64");
    return {
      "POLY-API-KEY": this.apiKey,
      "POLY-SIGNATURE": sig,
      "POLY-TIMESTAMP": ts,
      "POLY-PASSPHRASE": this.apiPassphrase,
    };
  }

  // ── Gamma API: fetch active BTC markets ───────────────────────────────────
  async fetchBTCMarkets() {
    try {
      const res = await axios.get(`${GAMMA_BASE}/markets`, {
        params: { tag_slug: "crypto", active: true, limit: 80, closed: false },
        timeout: 10000,
      });

      const all = Array.isArray(res.data) ? res.data : res.data.markets || [];
      const btc = all.filter((m) => {
        const q = (m.question || m.title || "").toLowerCase();
        return q.includes("bitcoin") || q.includes("btc");
      });

      logger.info(`Found ${btc.length} active BTC markets on Polymarket`);
      return btc.map((m) => ({
        conditionId: m.conditionId || m.id,
        slug: m.slug,
        question: m.question || m.title,
        endDate: m.endDate || m.end_date_iso,
        volume: parseFloat(m.volume || m.volumeNum || 0),
        liquidity: parseFloat(m.liquidity || 0),
        active: m.active !== false,
        tokens: m.tokens || [], // YES/NO token addresses
      }));
    } catch (err) {
      logger.error(`Failed to fetch BTC markets: ${err.message}`);
      return [];
    }
  }

  // ── CLOB: fetch order book for a market ──────────────────────────────────
  async fetchOrderBook(tokenId) {
    try {
      const res = await this.http.get(`/book`, { params: { token_id: tokenId } });
      return res.data; // { bids: [{price, size}], asks: [{price, size}] }
    } catch {
      return null;
    }
  }

  // ── CLOB: fetch last trade price ──────────────────────────────────────────
  async fetchLastTrade(tokenId) {
    try {
      const res = await this.http.get(`/last-trade-price`, { params: { token_id: tokenId } });
      return parseFloat(res.data?.price || 0);
    } catch {
      return null;
    }
  }

  // ── CLOB: fetch spread ────────────────────────────────────────────────────
  async fetchSpread(tokenId) {
    try {
      const res = await this.http.get(`/spread`, { params: { token_id: tokenId } });
      return res.data;
    } catch {
      return null;
    }
  }

  // ── CLOB: fetch open positions ────────────────────────────────────────────
  async fetchPositions() {
    if (!this.apiKey || this.apiKey === "your_clob_api_key_here") return [];
    try {
      const path = "/positions";
      const res = await this.http.get(path, {
        headers: this._authHeaders("GET", path),
      });
      return res.data || [];
    } catch {
      return [];
    }
  }

  // ── CLOB: place a limit order (EIP-712 signed) ───────────────────────────
  async placeOrder({ tokenId, side, price, size }) {
    if (!this.wallet) {
      logger.warn(`[DRY RUN] Would place: ${side} ${size} USDC @ ${price} on ${tokenId}`);
      return { dry_run: true, side, price, size, tokenId };
    }

    // Build order payload
    const order = {
      salt: Date.now(),
      maker: this.address,
      signer: this.address,
      taker: "0x0000000000000000000000000000000000000000",
      tokenId,
      makerAmount: ethers.parseUnits(size.toFixed(6), 6).toString(), // USDC has 6 decimals
      takerAmount: ethers.parseUnits((size / price).toFixed(2), 2).toString(),
      expiration: Math.floor(Date.now() / 1000) + 300, // 5 min TTL
      nonce: "0",
      feeRateBps: "0",
      side: side === "BUY" ? 0 : 1,
      signatureType: 0, // EOA signature
    };

    // EIP-712 types for Polymarket order
    const types = {
      Order: [
        { name: "salt", type: "uint256" },
        { name: "maker", type: "address" },
        { name: "signer", type: "address" },
        { name: "taker", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "makerAmount", type: "uint256" },
        { name: "takerAmount", type: "uint256" },
        { name: "expiration", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "feeRateBps", type: "uint256" },
        { name: "side", type: "uint8" },
        { name: "signatureType", type: "uint8" },
      ],
    };

    try {
      const signature = await this.wallet.signTypedData(DOMAIN, types, order);
      const payload = { ...order, signature };

      const path = "/order";
      const res = await this.http.post(path, payload, {
        headers: this._authHeaders("POST", path, payload),
      });

      logger.info(`Order placed: ${side} ${size} USDC @ ${price} | orderId: ${res.data?.orderID}`);
      return res.data;
    } catch (err) {
      logger.error(`Order failed: ${err.message}`);
      return null;
    }
  }

  // ── CLOB: cancel an order ─────────────────────────────────────────────────
  async cancelOrder(orderId) {
    if (!this.wallet) return;
    try {
      const path = `/order/${orderId}`;
      await this.http.delete(path, {
        headers: this._authHeaders("DELETE", path),
      });
      logger.info(`Order cancelled: ${orderId}`);
    } catch (err) {
      logger.error(`Cancel failed: ${err.message}`);
    }
  }

  // ── CLOB: fetch open orders ───────────────────────────────────────────────
  async fetchOpenOrders() {
    if (!this.apiKey || this.apiKey === "your_clob_api_key_here") return [];
    try {
      const path = "/orders";
      const res = await this.http.get(path, {
        headers: this._authHeaders("GET", path),
        params: { maker_address: this.address },
      });
      return res.data || [];
    } catch {
      return [];
    }
  }
}
