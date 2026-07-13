// 简易光鸭云 - Service Worker (合并版)

// ==================== 配置常量 ====================
const CONFIG = {
  API_BASE_URL: 'https://api.guangyapan.com',
  ACCOUNT_BASE_URL: 'https://account.guangyapan.com',
  CLIENT_ID: 'aMe_eFSlkrbQXpUV',
  TOKEN_REFRESH_AHEAD_MS: 5 * 60 * 1000,
};

function buildUserAgent(deviceId) {
  const ts = Date.now();
  return `ANDROID-com.guangshanyun.pan/1.1.0 protocolversion/200 accesstype/ clientid/${CONFIG.CLIENT_ID} clientversion/1.1.0 action_type/ networktype/WIFI sessionid/ deviceid/${deviceId} providername/NONE devicesign/div101.${deviceId}500fb2df465d3545f22ac4f1b962fd3e refresh_token/ sdkversion/2.0.7 datetime/${ts} usrno/ appname/android-com.guangshanyun.pan session_origin/ grant_type/ appid/ clientip/ devicename/Xiaomi_M2102k1ac osversion/14 platformversion/10 accessmode/ devicemodel/M2102K1AC channel/10003 callApp/com.miui.home`;
}

function buildHeaders(deviceId, accessToken) {
  const ts = Date.now().toString();
  return {
    'app': 'com.guangshanyun.pan',
    'peerId': '676777E27FF1B36V',
    'bd': 'Xiaomi',
    'os': '34',
    'ch': '10003',
    'X-Device-Id': deviceId,
    'nt': '1',
    'sign': '',
    'User-Agent': buildUserAgent(deviceId),
    'vc': '1040',
    'client_id': CONFIG.CLIENT_ID,
    'dt': '1',
    'Authorization': `Bearer ${accessToken}`,
    'X-Captcha-Token': '',
    'x-client-id': CONFIG.CLIENT_ID,
    'av': '1.1.0',
    'vpn': '0',
    'md': 'Xiaomi M2102K1AC mars Xiaomi',
    'guid': deviceId,
    'Accept-Language': 'zh-CN',
    'did': deviceId,
    'ts': ts,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
}

// ==================== 认证管理 ====================
const Auth = {
  async getAuth() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['refreshToken', 'deviceId', 'accessToken', 'expiresAt'], (result) => {
        resolve(result);
      });
    });
  },

  async saveAuth(data) {
    return new Promise((resolve) => {
      chrome.storage.local.set(data, () => resolve());
    });
  },

  async clearAuth() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(['refreshToken', 'deviceId', 'accessToken', 'expiresAt'], () => resolve());
    });
  },

  async isLoggedIn() {
    const auth = await this.getAuth();
    return !!(auth.refreshToken && auth.deviceId);
  },

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
    console.log('[Auth] Token刷新成功');
    return newAccessToken;
  },

  async ensureValidToken() {
    const auth = await this.getAuth();
    if (!auth.accessToken || Date.now() + CONFIG.TOKEN_REFRESH_AHEAD_MS > (auth.expiresAt || 0)) {
      return await this.refreshToken();
    }
    return auth.accessToken;
  }
};

// ==================== API封装 ====================
const Api = {
  async request(url, options = {}) {
    const accessToken = await Auth.ensureValidToken();
    const auth = await Auth.getAuth();
    const headers = buildHeaders(auth.deviceId, accessToken);

    const resp = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers }
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`HTTP ${resp.status}: ${text}`);
    }

    const data = await resp.json();
    if (data.code !== 0 && data.code !== undefined) {
      throw new Error(`API错误: ${data.message || data.msg || '未知错误'}`);
    }
    return data;
  },

  async getFileList(parentId = '', page = 0, pageSize = 50) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/file/get_file_list`;
    const body = {
      sortType: 1,
      resType: 0,
      orderBy: 3,
      pageSize: pageSize,
      page: page,
      dirType: 1,
      parentId: parentId
    };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  async getDownloadUrl(fileId) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/get_res_download_url`;
    const body = { requestId: '', fileId: fileId };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  async getUserInfo() {
    const url = `${CONFIG.ACCOUNT_BASE_URL}/v1/user/me`;
    const data = await this.request(url, { method: 'GET' });
    return data.data || data;
  },

  async getAssets() {
    const url = `${CONFIG.API_BASE_URL}/assets/v1/get_assets`;
    const body = { type: 0 };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  async createDir(parentId, dirName) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/file/create_dir`;
    const body = { failIfNameExist: false, parentId: parentId, dirName: dirName };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  async rename(fileId, newName) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/file/rename`;
    const body = { newName: newName, fileId: fileId };
    return await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  async deleteFile(fileIds) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/file/delete_file`;
    const body = { fileIds: Array.isArray(fileIds) ? fileIds : [fileIds] };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  async moveFile(fileIds, targetParentId) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/file/move_file`;
    const body = { fileIds: Array.isArray(fileIds) ? fileIds : [fileIds], parentId: targetParentId };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  async copyFile(fileIds, targetParentId) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/file/copy_file`;
    const body = { fileIds: Array.isArray(fileIds) ? fileIds : [fileIds], parentId: targetParentId };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  async getUploadCredential(fileSize, gcid, fileName, parentId) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/get_res_center_token`;
    const body = {
      res: { fileSize: fileSize, gcid: gcid },
      name: fileName,
      parentId: parentId,
      capacity: 2
    };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  async parseMagnet(magnetUrl) {
    const url = `${CONFIG.API_BASE_URL}/cloudcollection/v1/batch_resolve_res`;
    const body = { reqs: [{ url: magnetUrl }] };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  async createCloudTask(newName, fileIndexes, magnetUrl, parentId) {
    const url = `${CONFIG.API_BASE_URL}/cloudcollection/v1/create_task`;
    const body = {
      newName: newName,
      fileIndexes: fileIndexes,
      url: magnetUrl,
      parentId: parentId
    };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  async listCloudTasks(cursor = '', pageSize = 50, status = [0]) {
    const url = `${CONFIG.API_BASE_URL}/cloudcollection/v1/list_task`;
    const body = {
      cursor: cursor,
      pageSize: pageSize,
      status: status
    };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  }
};

// ==================== 消息处理 ====================
// 注：OSS分片上传已移至popup.js直接执行（需在用户上下文fetch大文件）
// service-worker仅保留getUploadCredential凭证获取，不再转发arrayBuffer
console.log('[SW] Service Worker 启动');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[SW] 收到消息:', request.action);

  (async () => {
    try {
      switch (request.action) {
        case 'checkLogin':
          const loggedIn = await Auth.isLoggedIn();
          sendResponse({ success: true, loggedIn });
          break;

        case 'login':
          await Auth.saveAuth({
            refreshToken: request.refreshToken,
            deviceId: request.deviceId,
            accessToken: '',
            expiresAt: 0
          });
          await Auth.refreshToken();
          sendResponse({ success: true });
          break;

        case 'logout':
          await Auth.clearAuth();
          sendResponse({ success: true });
          break;

        case 'getFileList':
          const listData = await Api.getFileList(request.parentId || '', request.page || 0, request.pageSize || 50);
          sendResponse({ success: true, data: listData });
          break;

        case 'getDownloadUrl':
          const dlData = await Api.getDownloadUrl(request.fileId);
          sendResponse({ success: true, data: dlData });
          break;

        case 'downloadFile':
          const urlData = await Api.getDownloadUrl(request.fileId);
          const downloadUrl = urlData.signedURL || urlData.url || urlData.download_url;
          chrome.downloads.download({
            url: downloadUrl,
            filename: request.fileName,
            conflictAction: 'uniquify'
          });
          sendResponse({ success: true });
          break;

        case 'getUserInfo':
          const userInfo = await Api.getUserInfo();
          sendResponse({ success: true, data: userInfo });
          break;

        case 'getAssets':
          const assets = await Api.getAssets();
          sendResponse({ success: true, data: assets });
          break;

        case 'createDir':
          await Api.createDir(request.parentId, request.dirName);
          sendResponse({ success: true });
          break;

        case 'rename':
          await Api.rename(request.fileId, request.newName);
          sendResponse({ success: true });
          break;

        case 'deleteFile':
          await Api.deleteFile(request.fileIds);
          sendResponse({ success: true });
          break;

        case 'moveFile':
          await Api.moveFile(request.fileIds, request.targetParentId);
          sendResponse({ success: true });
          break;

        case 'copyFile':
          await Api.copyFile(request.fileIds, request.targetParentId);
          sendResponse({ success: true });
          break;

        case 'getUploadCredential':
          const credData = await Api.getUploadCredential(request.fileSize, request.gcid, request.fileName, request.parentId);
          sendResponse({ success: true, data: credData });
          break;

        case 'parseMagnet':
          const magnetData = await Api.parseMagnet(request.magnetUrl);
          sendResponse({ success: true, data: magnetData });
          break;

        case 'createCloudTask':
          const taskData = await Api.createCloudTask(request.newName, request.fileIndexes, request.magnetUrl, request.parentId);
          sendResponse({ success: true, data: taskData });
          break;

        case 'listCloudTasks':
          const taskList = await Api.listCloudTasks(request.cursor || '', request.pageSize || 50, request.status || [0]);
          sendResponse({ success: true, data: taskList });
          break;

        default:
          sendResponse({ success: false, error: '未知操作' });
        }
    } catch (error) {
      console.error('[SW] 错误:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();

  return true;
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[SW] 插件已安装');
  // 点击插件图标时打开popup，而非Side Panel；用户可通过popup内按钮手动打开Side Panel
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch((err) => {
      console.warn('[SW] 设置Side Panel行为失败:', err);
    });
  }
});

chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && delta.state.current === 'complete') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '简易光鸭云',
      message: '文件下载完成'
    });
  }
});
