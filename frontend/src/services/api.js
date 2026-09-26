const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  getToken() {
    return this.token;
  }

  async request(endpoint, options = {}) {
    const headers = new Headers(options.headers || {});
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      let errorMsg = `Error ${res.status}: ${res.statusText}`;
      try {
        const errorJson = await res.json();
        if (errorJson.detail) {
          if (typeof errorJson.detail === 'string') {
            errorMsg = errorJson.detail;
          } else if (Array.isArray(errorJson.detail)) {
            errorMsg = errorJson.detail.map((d) => d.msg || JSON.stringify(d)).join(', ');
          }
        }
      } catch {
        // Use default errorMsg
      }
      throw new Error(errorMsg);
    }

    return res.json();
  }

  // Auth
  async demoLogin() {
    const data = await this.request('/api/auth/demo-login', { method: 'POST' });
    this.setToken(data.access_token);
    return data;
  }

  async login(payload) {
    const data = await this.request('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) });
    this.setToken(data.access_token);
    return data;
  }

  async register(payload) {
    const data = await this.request('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    this.setToken(data.access_token);
    return data;
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.clearToken();
    }
  }

  async getProfile() {
    return this.request('/api/auth/me');
  }

  // Accounts
  async getAccounts() {
    return this.request('/api/accounts');
  }

  async createAccount(payload) {
    return this.request('/api/accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getAccountSummary(accountId) {
    return this.request(`/api/accounts/${accountId}/summary`);
  }

  async deleteAccount(accountId) {
    return this.request(`/api/accounts/${accountId}`, {
      method: 'DELETE',
    });
  }

  // Transactions
  async getTransactions(accountId, params = {}) {
    const url = new URL(`${API_BASE}/api/accounts/${accountId}/transactions`);
    if (params.startDate) url.searchParams.append('start_date', params.startDate);
    if (params.endDate) url.searchParams.append('end_date', params.endDate);
    if (params.type && params.type !== 'ALL') url.searchParams.append('transaction_type', params.type);
    if (params.search) url.searchParams.append('search', params.search);
    if (params.page) url.searchParams.append('page', params.page.toString());
    if (params.limit) url.searchParams.append('limit', params.limit.toString());

    return this.request(url.pathname + url.search);
  }

  async createTransaction(payload) {
    return this.request('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateTransaction(id, payload) {
    return this.request(`/api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteTransaction(id) {
    return this.request(`/api/transactions/${id}`, {
      method: 'DELETE',
    });
  }

  // Interest Calculations
  async calculateInterest(payload) {
    return this.request('/api/interest/calculate', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getQuarterPreview(accountId, year, quarter, convention = 'ACTUAL_365') {
    return this.request(
      `/api/interest/quarter-preview?account_id=${accountId}&year=${year}&quarter=${quarter}&day_count_convention=${convention}`
    );
  }

  async postQuarterlyInterest(payload) {
    return this.request('/api/interest/post', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getInterestPostings(accountId) {
    return this.request(`/api/interest/postings/${accountId}`);
  }

  // Interest Slabs
  async getInterestSlabs() {
    return this.request('/api/interest-slabs');
  }

  async createInterestSlab(payload) {
    return this.request('/api/interest-slabs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateInterestSlab(id, payload) {
    return this.request(`/api/interest-slabs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async deleteInterestSlab(id) {
    return this.request(`/api/interest-slabs/${id}`, {
      method: 'DELETE',
    });
  }

  // Statement / Passbook
  async getStatement(accountId, startDate, endDate) {
    let q = '';
    if (startDate) q += `start_date=${startDate}&`;
    if (endDate) q += `end_date=${endDate}`;
    const endpoint = `/api/accounts/${accountId}/statement${q ? '?' + q : ''}`;
    return this.request(endpoint);
  }

  getStatementCsvDownloadUrl(accountId, startDate, endDate) {
    let q = '';
    if (startDate) q += `start_date=${startDate}&`;
    if (endDate) q += `end_date=${endDate}`;
    return `${API_BASE}/api/accounts/${accountId}/statement/csv${q ? '?' + q : ''}`;
  }

  // CSV Import
  async validateCsv(accountId, file) {
    const formData = new FormData();
    formData.append('account_id', accountId);
    formData.append('file', file);

    return this.request('/api/import/csv/validate', {
      method: 'POST',
      body: formData,
    });
  }

  async confirmCsvImport(accountId, validRows) {
    return this.request('/api/import/csv/confirm', {
      method: 'POST',
      body: JSON.stringify({ account_id: accountId, valid_rows: validRows }),
    });
  }

  // Database Management (Purge / Seed on demand)
  async clearAccountTransactions(accountId) {
    return this.request(`/api/database/accounts/${accountId}/clear-transactions`, {
      method: 'DELETE',
    });
  }

  async purgeStaticData() {
    return this.request('/api/database/purge-static', {
      method: 'DELETE',
    });
  }

  async purgeAllData() {
    return this.request('/api/database/purge-all', {
      method: 'DELETE',
    });
  }

  async resetSeedData() {
    return this.request('/api/database/seed-sample', {
      method: 'POST',
    });
  }
}

export const api = new ApiService();
