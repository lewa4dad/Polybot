/**
 * Polymarket Client
 * Uses private key (EIP-712) for order signing
 * Uses Relayer API key for authenticated requests
 */

import axios from "axios";
import { ethers } from "ethers";
import logger from "./logger.js";

const CLOB_BASE  = "https://clob.polymarket.com";
const GAMMA_BASE = "https://gamma-api.polymarket.com";
const RELAYER    = "https://relayer.polymarket.com";

const DOMAIN = {
  name: "ClobAuthDomain",
  version: "1",
  chainId: 137,
};

export class PolymarketClient {
  constructor({ privateKey, relayerApiKey }) {
    this.relayerApiKey = relayerApiKey || "";

    if (privateKey && privateKey !== "0xYOUR_PRIVATE_KEY_HERE") {
      this.wallet  = new ethers.Wallet(privateKey);
      this.address = this.wallet.address;
      logger.info(`Wallet loaded: ${this.address}`);
    } else {
      this.wallet  = null;
      this.address = null;
      logger.warn("No private key — running in DRY RUN mode (no live orders)");
    }

    // CLOB http client (public endpoints — no auth needed for reads)
    this.clob = axios.create({
      baseURL: CLOB_BASE,
      timeout: 8000,
      headers: { "Content-Type": "application/json" },
    });

    // Relayer http client (authenticated writes)
    this.relayer = axios.create({
      baseURL: RELAYER,
      timeout: 8000,
      headers: {
        "Content-Type": "application/json",
        ...(relayerApiKey ? { "RELAYER_API_KEY": relayerApiKey } : {}),
      },
    });

    this.clob.interceptors.response.use(
      r => r,
      err => { logger.debug(`CLOB err: ${err.response?.data?.message || err.message}`); return Promise.reject(err); }
    );
  }

  // ── Fetch active BTC markets from Gamma ───────────────────────────────────
  async fetchBTCMarkets() {
    try {
      const res = await axios.get(`${GAMMA_BASE}/markets`, {
        params: { tag_slug: "crypto", active: true, limit: 80, closed: false },
        timeout: 10000,
      });

      const all = Array.isArray(res.data) ? res.data : res.data.markets || [];
      const btc = all.filter(m => {
        const q = (m.question || m.title || "").toLowerCase();
        return q.includes("bitcoin") || q.includes("btc");
      });

      logger.info(`Found ${btc.length} active BTC markets`);
      return btc.map(m => ({
        conditionId: m.conditionId || m.id,
        slug:        m.slug,
        question:    m.question || m.title,
        endDate:     m.endDate  || m.end_date_iso,
        volume:      parseFloat(m.volume    || m.volumeNum || 0),
        liquidity:   parseFloat(m.liquidity || 0),
        active:      m.active !== false,
        tokens:      m.tokens  || [],
      }));
    } catch (err) {
      logger.error(`Failed to fetch BTC markets: ${err.message}`);
      return [];
    }
  }

  // ── Fetch order book (public) ─────────────────────────────────────────────
  async fetchOrderBook(tokenId) {
    try {
      const res = await this.clob.get("/book", { params: { token_id: tokenId } });
      return res.data;
    } catch { return null; }
  }

  // ── Fetch spread (public) ─────────────────────────────────────────────────
  async fetchSpread(tokenId) {
    try {
      const res = await this.clob.get("/spread", { params: { token_id: tokenId } });
      return res.data;
    } catch { return null; }
  }

  // ── Place order via EIP-712 signing + CLOB ────────────────────────────────
  async placeOrder({ tokenId, side, price, size }) {
    if (!this.wallet) {
      logger.warn(`[DRY RUN] ${side} ${size} USDC @ ${price} | token: ${tokenId}`);
      return { dry_run: true };
    }

    const order = {
      salt:        Date.now(),
      maker:       this.address,
      signer:      this.address,
      taker:       "0x0000000000000000000000000000000000000000",
      tokenId,
      makerAmount: ethers.parseUnits(size.toFixed(6), 6).toString(),
      takerAmount: ethers.parseUnits((size / price).toFixed(2), 2).toString(),
      expiration:  Math.floor(Date.now() / 1000) + 300,
      nonce:       "0",
      feeRateBps:  "0",
      side:        side === "BUY" ? 0 : 1,
      signatureType: 0,
    };

    const types = {
      Order: [
        { name: "salt",          type: "uint256" },
        { name: "maker",         type: "address" },
        { name: "signer",        type: "address" },
        { name: "taker",         type: "address" },
        { name: "tokenId",       type: "uint256" },
        { name: "makerAmount",   type: "uint256" },
        { name: "takerAmount",   type: "uint256" },
        { name: "expiration",    type: "uint256" },
        { name: "nonce",         type: "uint256" },
        { name: "feeRateBps",    type: "uint256" },
        { name: "side",          type: "uint8"   },
        { name: "signatureType", type: "uint8"   },
      ],
    };

    try {
      const signature = await this.wallet.signTypedData(DOMAIN, types, order);
      const payload   = { ...order, signature };

      const res = await this.clob.post("/order", payload, {
        headers: this.relayerApiKey ? { "RELAYER_API_KEY": this.relayerApiKey } : {},
      });

      logger.info(`Order placed: ${side} $${size} @ ${price} | id: ${res.data?.orderID}`);
      return res.data;
    } catch (err) {
      logger.error(`Order failed: ${err.message}`);
      return null;
    }
  }

  // ── Cancel order ──────────────────────────────────────────────────────────
  async cancelOrder(orderId) {
    if (!this.wallet || !orderId || orderId === "DRY_RUN") return;
    try {
      await this.clob.delete(`/order/${orderId}`, {
        headers: this.relayerApiKey ? { "RELAYER_API_KEY": this.relayerApiKey } : {},
      });
      logger.info(`Cancelled order: ${orderId}`);
    } catch (err) {
      logger.error(`Cancel failed: ${err.message}`);
    }
  }

  // ── Fetch open orders ─────────────────────────────────────────────────────
  async fetchOpenOrders() {
    if (!this.address) return [];
    try {
      const res = await this.clob.get("/orders", {
        params:  { maker_address: this.address },
        headers: this.relayerApiKey ? { "RELAYER_API_KEY": this.relayerApiKey } : {},
      });
      return res.data || [];
    } catch { return []; }
  }
}
