// 光鸭云盘API封装

importScripts('config.js', 'auth.js');

const Api = {
  // 通用请求方法
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

  // 获取文件列表
  async getFileList(parentId = '0', page = 1, pageSize = 100) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/file/get_file_list`;
    const body = {
      parent_id: parentId,
      page: page,
      page_size: pageSize,
      order_by: 'file_name',
      order_type: 'asc'
    };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  // 获取下载URL
  async getDownloadUrl(fileId) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/get_res_download_url`;
    const body = { file_id: fileId };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  // 获取用户信息
  async getUserInfo() {
    const url = `${CONFIG.ACCOUNT_BASE_URL}/v1/user/me`;
    const data = await this.request(url, { method: 'GET' });
    return data.data || data;
  },

  // 获取资产信息（容量）
  async getAssets() {
    const url = `${CONFIG.API_BASE_URL}/assets/v1/get_assets`;
    const body = { type: 0 };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  // 创建目录
  async createDir(parentId, dirName) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/file/create_dir`;
    const body = {
      parent_id: parentId,
      dir_name: dirName
    };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  // 重命名
  async rename(fileId, newName) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/file/rename`;
    const body = {
      file_id: fileId,
      new_name: newName
    };
    return await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },

  // 删除文件
  async deleteFile(fileIds) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/file/delete_file`;
    const body = {
      file_ids: Array.isArray(fileIds) ? fileIds : [fileIds]
    };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  // 移动文件
  async moveFile(fileIds, targetParentId) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/file/move_file`;
    const body = {
      file_ids: Array.isArray(fileIds) ? fileIds : [fileIds],
      parent_id: targetParentId
    };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  // 复制文件
  async copyFile(fileIds, targetParentId) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/file/copy_file`;
    const body = {
      file_ids: Array.isArray(fileIds) ? fileIds : [fileIds],
      parent_id: targetParentId
    };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  // 获取任务状态
  async getTaskStatus(taskId) {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/get_task_status`;
    const body = { task_id: taskId };
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  },

  // 获取上传凭证
  async getUploadCredential() {
    const url = `${CONFIG.API_BASE_URL}/userres/v1/get_res_center_token`;
    const body = {};
    const data = await this.request(url, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return data.data || data;
  }
};

self.Api = Api;
