import api from './api';

/** Fallback when API is unavailable or omits balance — new accounts should start at 0 */
const DEFAULT_COINS = 0;

/** Server must derive line items and amounts from `pack_id` / `custom_coins` — never from display fields. */
export const MAX_CUSTOM_COINS_PURCHASE = 1_000_000;

/**
 * Stripe Checkout success/cancel URLs must stay on this origin so they cannot be pointed at a third party
 * if this module is ever called with untrusted opts (e.g. from devtools).
 */
function assertCheckoutReturnUrls(successUrl, cancelUrl) {
  if (successUrl == null && cancelUrl == null) {
    return;
  }
  if (typeof window === 'undefined' || !successUrl || !cancelUrl) {
    throw new Error('Checkout requires both success and cancel return URLs');
  }
  const allowedOrigin = window.location.origin;
  for (const raw of [successUrl, cancelUrl]) {
    let u;
    try {
      u = new URL(raw);
    } catch {
      throw new Error('Invalid checkout return URL');
    }
    if (u.origin !== allowedOrigin) {
      throw new Error('Checkout return URLs must use the same origin as this app');
    }
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (!local && u.protocol !== 'https:') {
      throw new Error('Checkout return URLs must use HTTPS');
    }
    if (local && u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error('Invalid checkout return URL');
    }
  }
}

class CoinService {
  /**
   * Get coins for a specific user
   * @param {string} userId - User ID
   * @returns {Promise<number>} - User's coin balance
   */
  async getUserCoins(userId) {
    if (!userId) {
      return DEFAULT_COINS;
    }

    try {
      const response = await api.get(`/api/coins/${userId}`);
      // Handle 0 coins properly (0 is falsy, so || would use DEFAULT_COINS incorrectly)
      if (response.data && typeof response.data.coins === 'number') {
        return response.data.coins;
      }
      return DEFAULT_COINS;
    } catch (error) {
      console.error('Error getting user coins:', error);
      return DEFAULT_COINS;
    }
  }

  /**
   * Get user's coin balance including locked coins
   * @param {string} userId - User ID
   * @returns {Promise<{ coins: number, locked_coins: number, total_coins: number }>}
   */
  async getUserBalance(userId) {
    if (!userId) {
      return { coins: DEFAULT_COINS, locked_coins: 0, total_coins: DEFAULT_COINS };
    }

    try {
      const response = await api.get(`/api/coins/${userId}`);
      return {
        coins: response.data?.coins || 0,
        locked_coins: response.data?.locked_coins || 0,
        total_coins: (response.data?.coins || 0) + (response.data?.locked_coins || 0)
      };
    } catch (error) {
      console.error('Error getting user balance:', error);
      return { coins: DEFAULT_COINS, locked_coins: 0, total_coins: DEFAULT_COINS };
    }
  }

  /**
   * Deduct coins from a user's balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount to deduct
   * @param {{ reason?: string, refType?: string, refId?: string }} opts - Optional transaction metadata
   * @returns {Promise<{ coins: number, deducted: number, balanceBefore: number, balanceAfter: number } | null>} - Response data or null on error
   */
  async deductCoins(userId, amount, opts = {}) {
    if (!userId || typeof amount !== 'number' || amount <= 0) {
      console.error('Invalid parameters for deductCoins');
      return null;
    }

    try {
      const response = await api.post(`/api/coins/${userId}/deduct`, { 
        amount,
        reason: opts.reason,
        refType: opts.refType,
        refId: opts.refId
      });
      return response.data;
    } catch (error) {
      console.error('Error deducting coins:', error);
      // Re-throw to allow caller to handle insufficient funds specifically
      if (error.response?.status === 400 && error.response?.data?.error === 'Insufficient coins') {
        throw error;
      }
      return null;
    }
  }

  /**
   * Check if user has sufficient coins for a purchase
   * @param {string} userId - User ID
   * @param {number} amount - Amount to check
   * @returns {Promise<boolean>} - True if user has sufficient coins
   */
  async hasSufficientCoins(userId, amount) {
    if (!userId || typeof amount !== 'number' || amount <= 0) {
      return false;
    }

    try {
      const currentCoins = await this.getUserCoins(userId);
      return currentCoins >= amount;
    } catch (error) {
      console.error('Error checking sufficient coins:', error);
      return false;
    }
  }

  /**
   * Initialize coins for a new user (not needed with database default)
   * @param {string} userId - User ID
   * @returns {Promise<number>} - User's coin balance
   */
  async initializeUserCoins(userId) {
    if (!userId) {
      return DEFAULT_COINS;
    }

    // With database, users get default coins automatically
    return await this.getUserCoins(userId);
  }

  /**
   * Get coin packs for purchase (authoritative pricing lives on the server — no client fallback).
   * @returns {Promise<{ packs: Array<{ id, coins, usdCents, usd }> }>}
   */
  async getCoinPacks() {
    const response = await api.get('/api/coins/packs');
    return response.data;
  }

  /**
   * Get currency rates
   * @returns {Promise<{ rates: Array }>}
   */
  async getCurrencyRates() {
    try {
      const response = await api.get('/api/coins/currency-rates');
      return response.data;
    } catch (error) {
      console.error('Error fetching currency rates:', error);
      return { rates: [] };
    }
  }

  /**
   * Create a purchase intent (redirects to Stripe Checkout).
   * Only sends fields the API should trust: pack id or custom coin count + currency, and same-origin return URLs.
   * Line item names and amounts must be resolved on the server from `pack_id` / validated `custom_coins`.
   * @param {string|null} packId - Pack id from getCoinPacks(), or null for custom coins
   * @param {{ successUrl?: string, cancelUrl?: string, customCoins?: number, currency?: string }} opts
   * @returns {Promise<{ url: string }>} - Redirect to url
   */
  async createPurchaseIntent(packId, opts = {}) {
    const body = {};
    if (packId) {
      body.pack_id = packId;
    } else if (opts.customCoins != null) {
      const n = Number(opts.customCoins);
      if (!Number.isInteger(n) || n < 1 || n > MAX_CUSTOM_COINS_PURCHASE) {
        throw new Error(`Coin amount must be a whole number between 1 and ${MAX_CUSTOM_COINS_PURCHASE.toLocaleString()}`);
      }
      body.custom_coins = n;
      body.currency = opts.currency || 'USD';
    } else {
      throw new Error('Either packId or customCoins must be provided');
    }

    if (opts.successUrl != null || opts.cancelUrl != null) {
      assertCheckoutReturnUrls(opts.successUrl, opts.cancelUrl);
      body.success_url = opts.successUrl;
      body.cancel_url = opts.cancelUrl;
    }

    const response = await api.post('/api/coins/purchase-intent', body);
    return response.data;
  }
}

// Export a singleton instance
const coinService = new CoinService();
export default coinService;
