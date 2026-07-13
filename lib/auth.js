// 光鸭云盘认证管理器

importScripts('config.js');

const Auth = {
  // 获取存储的认证信息
  async getAuth() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['refreshToken', 'deviceId', 'accessToken', 'expiresAt'], (result) => {
        resolve(result);
      });
    });
  },

  // 保存认证信息
  async saveAuth(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, () => resolve());
    });
  },

  // 清除认证信息
  async clearAuth() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['refreshToken', 'deviceId', 'accessToken', 'expiresAt'], () => resolve());
    });
  },

  // 检查是否已登录
  async isLoggedIn() {
    const auth = await this.getAuth();
    return !!(auth.refreshToken && auth.deviceId);
  },

  // 刷新Token
  async refreshToken() {
    const auth = await this.getAuth();
    if (!auth.refreshToken || !auth.deviceId) {
      throw new Error('未登录，请先设置refresh_token和deviceId');
    }

    const url = `${CONFIG.ACCOUNT_BASE_URL}/v1/auth/token?client_id=${CONFIG.CLIENT_ID}`;
    const body = {
      client_id: CONFIG.CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: auth.refreshToken
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Token刷新失败: ${resp.status} ${text}`);
    }

    const data = await resp.json();
    if (data.code !== 0 && data.code !== undefined) {
      throw new Error(`Token刷新失败: ${data.message || data.msg || '未知错误'}`);
    }

    const tokenData = data.data || data;
    const newAccessToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || 7200;
    const newRefreshToken = tokenData.refresh_token || auth.refreshToken;

    const saveData = {
      accessToken: newAccessToken,
      expiresAt: Date.now() + (expiresIn - 300) * 1000
    };

    if (newRefreshToken !== auth.refreshToken) {
      saveData.refreshToken = newRefreshToken;
    }

    await this.saveAuth(saveData);
    console.log('[Auth] Token刷新成功，过期时间:', new Date(saveData.expiresAt).toISOString());
    return newAccessToken;
  },

  // 确保Token有效
  async ensureValidToken() {
    const auth = await this.getAuth();
    if (!auth.accessToken || Date.now() + CONFIG.TOKEN_REFRESH_AHEAD_MS > (auth.expiresAt || 0)) {
      return await this.refreshToken();
    }
    return auth.accessToken;
  }
};

self.Auth = Auth;
