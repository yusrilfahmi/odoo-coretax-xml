/**
 * Odoo 19 API Client menggunakan protokol JSON-RPC / External API
 */
export class OdooClient {
  constructor(config = {}) {
    this.baseUrl = (config.baseUrl || '').replace(/\/+$/, '');
    this.db = config.db;
    this.username = config.username;
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs || 15000;
    this.uid = null;
  }

  /**
   * Autentikasi / Login ke Odoo untuk mendapatkan User ID (UID)
   * @returns {Promise<number>}
   */
  async authenticate() {
    if (this.uid) return this.uid;

    if (!this.baseUrl || !this.db || !this.username || !this.apiKey) {
      throw new Error('ODOO_CONFIG_INCOMPLETE: URL, DB, Username, atau API Key Odoo belum dikonfigurasi.');
    }

    const payload = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'common',
        method: 'authenticate',
        args: [this.db, this.username, this.apiKey, {}]
      },
      id: Math.floor(Math.random() * 1000000)
    };

    const res = await fetch(`${this.baseUrl}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!res.ok) {
      throw new Error(`ODOO_HTTP_ERROR: Server Odoo mengembalikan HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(`ODOO_AUTH_FAILED: ${data.error.data?.message || data.error.message}`);
    }

    if (!data.result) {
      throw new Error('ODOO_AUTH_INVALID: Kredensial Odoo tidak valid.');
    }

    this.uid = data.result;
    return this.uid;
  }

  /**
   * Eksekusi method execute_kw pada model Odoo
   * @param {string} model
   * @param {string} method
   * @param {Array} args
   * @param {object} kwargs
   * @returns {Promise<any>}
   */
  async executeKw(model, method, args = [], kwargs = {}) {
    const uid = await this.authenticate();

    const payload = {
      jsonrpc: '2.0',
      method: 'call',
      params: {
        service: 'object',
        method: 'execute_kw',
        args: [this.db, uid, this.apiKey, model, method, args, kwargs]
      },
      id: Math.floor(Math.random() * 1000000)
    };

    const res = await fetch(`${this.baseUrl}/jsonrpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(this.timeoutMs)
    });

    if (!res.ok) {
      throw new Error(`ODOO_HTTP_ERROR: Server Odoo mengembalikan HTTP ${res.status}`);
    }

    const data = await res.json();
    if (data.error) {
      throw new Error(`ODOO_RPC_ERROR [${model}.${method}]: ${data.error.data?.message || data.error.message}`);
    }

    return data.result;
  }
}

