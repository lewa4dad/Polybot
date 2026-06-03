import axios from "axios";
import { ethers } from "ethers";
import logger from "./logger.js";

const CLOB_BASE  = "https://clob.polymarket.com";
const GAMMA_BASE = "https://gamma-api.polymarket.com";

const DOMAIN = { name: "ClobAuthDomain", version: "1", chainId: 137 };

export class PolymarketClient {
  constructor({ privateKey, relayerApiKey }) {
    this.relayerApiKey = relayerApiKey || "";
    if (privateKey && privateKey !== "0xYOUR_METAMASK_PRIVATE_KEY_HERE") {
      this.wallet  = new ethers.Wallet(privateKey);
      this.address = this.wallet.address;
      logger.info(`Wallet loaded: ${this.address}`);
    } else {
      this.wallet  = null;
      this.address = null;
      logger.warn("No private key — running in DRY RUN mode");
    }
    this.clob = axios.create({ baseURL: CLOB_BASE, timeout: 8000, headers: { "Content-Type": "application/json" } });
    this.clob.interceptors.response.use(r => r, err => { logger.debug(`CLOB err: ${err.response?.data?.message || err.message}`); return Promise.reject(err); });
  }

async fetchBTCMarkets() {
  try {
    const res = await axios.get(`${GAMMA_BASE}/events`, {
      params: { slug: "btc-updown-5m", active: true, limit: 20 },
      timeout: 10000,
    });
    const events = Array.isArray(res.data) ? res.data : [res.data];
    const markets = events.flatMap(e => e.markets || []);
    logger.info(`Found ${markets.length} BTC 5min markets`);
    return markets.map(m => ({
      conditionId: m.conditionId || m.id,
      slug: m.slug,
      question: m.question || m.title,
      endDate: m.endDate,
      volume: parseFloat(m.volume || 0),
      liquidity: parseFloat(m.liquidity || 0),
      active: m.active !== false,
      tokens: m.tokens || [],
      clobTokenIds: m.clobTokenIds || m.clob_token_ids || [],
    }));
  } catch (err) {
    logger.error(`Failed to fetch markets: ${err.message}`);
    return [];
  }
}
    });
    logger.info(`Found ${btc.length} active BTC markets`);
   return btc.map(m => ({ conditionId: m.conditionId || m.id, slug: m.slug, question: m.question || m.title, endDate: m.endDate || m.end_date_iso, volume: parseFloat(m.volume || 0), liquidity: parseFloat(m.liquidity || 0), active: m.active !== false, tokens: m.tokens || [], clobTokenIds: m.clobTokenIds || m.clob_token_ids || [] }));
  } catch (err) { logger.error(`Failed to fetch markets: ${err.message}`); return []; }
}

  async fetchOrderBook(tokenId) {
    try { const res = await this.clob.get("/book", { params: { token_id: tokenId } }); return res.data; } catch { return null; }
  }

  async fetchSpread(tokenId) {
    try { const res = await this.clob.get("/spread", { params: { token_id: tokenId } }); return res.data; } catch { return null; }
  }

  async placeOrder({ tokenId, side, price, size }) {
    if (!this.wallet) { logger.warn(`[DRY RUN] ${side} $${size} @ ${price}`); return { dry_run: true }; }
    const order = {
      salt: Date.now(), maker: this.address, signer: this.address,
      taker: "0x0000000000000000000000000000000000000000", tokenId,
      makerAmount: ethers.parseUnits(size.toFixed(6), 6).toString(),
      takerAmount: ethers.parseUnits((size / price).toFixed(2), 2).toString(),
      expiration: Math.floor(Date.now() / 1000) + 300, nonce: "0", feeRateBps: "0",
      side: side === "BUY" ? 0 : 1, signatureType: 0,
    };
    const types = { Order: [
      { name: "salt", type: "uint256" }, { name: "maker", type: "address" }, { name: "signer", type: "address" },
      { name: "taker", type: "address" }, { name: "tokenId", type: "uint256" }, { name: "makerAmount", type: "uint256" },
      { name: "takerAmount", type: "uint256" }, { name: "expiration", type: "uint256" }, { name: "nonce", type: "uint256" },
      { name: "feeRateBps", type: "uint256" }, { name: "side", type: "uint8" }, { name: "signatureType", type: "uint8" },
    ]};
    try {
      const signature = await this.wallet.signTypedData(DOMAIN, types, order);
      const res = await this.clob.post("/order", { ...order, signature }, { headers: this.relayerApiKey ? { "RELAYER_API_KEY": this.relayerApiKey } : {} });
      logger.info(`Order placed: ${side} $${size} @ ${price} | id: ${res.data?.orderID}`);
      return res.data;
    } catch (err) { logger.error(`Order failed: ${err.message}`); return null; }
  }

  async cancelOrder(orderId) {
    if (!this.wallet || !orderId || orderId === "DRY_RUN") return;
    try { await this.clob.delete(`/order/${orderId}`, { headers: this.relayerApiKey ? { "RELAYER_API_KEY": this.relayerApiKey } : {} }); } catch (err) { logger.error(`Cancel failed: ${err.message}`); }
  }

  async fetchOpenOrders() {
    if (!this.address) return [];
    try { const res = await this.clob.get("/orders", { params: { maker_address: this.address }, headers: this.relayerApiKey ? { "RELAYER_API_KEY": this.relayerApiKey } : {} }); return res.data || []; } catch { return []; }
  }
}
