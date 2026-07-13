# 简易光鸭云 Chrome插件 - 技术文档

> 光鸭云盘第三方Chrome浏览器插件完整开发细节与避坑指南

## 目录

1. [架构设计](#1-架构设计)
2. [manifest.json 配置](#2-manifestjson-配置)
3. [认证机制](#3-认证机制)
4. [API接口文档](#4-api接口文档)
5. [OSS上传实现](#5-oss上传实现)
6. [Side Panel持久显示](#6-side-panel持久显示)
7. [UI交互设计](#7-ui交互设计)
8. [云添加功能](#8-云添加功能)
9. [传输列表管理](#9-传输列表管理)
10. [避坑指南](#10-避坑指南)

---

## 1. 架构设计

### 1.1 MV3 架构

```
┌─────────────────────────────────────────┐
│           Chrome Extension MV3          │
├─────────────────────────────────────────┤
│  service-worker.js (后台服务)            │
│  ├── Auth: Token管理 & 自动刷新          │
│  ├── Api: 业务API封装（列表/下载/凭证等）│
│  └── 消息处理: popup ↔ SW通信            │
├─────────────────────────────────────────┤
│  popup/popup.html + popup.js (弹窗UI)   │
│  ├── 文件列表浏览                        │
│  ├── 上传（含OSS分片上传 + 签名）        │
│  ├── 下载/云添加                        │
│  ├── 传输列表管理                        │
│  └── Side Panel检测与适配                │
├─────────────────────────────────────────┤
│  options/options.html + options.js      │
│  └── 登录设置 (refresh_token + deviceId) │
└─────────────────────────────────────────┘
```

### 1.2 文件结构

```
guangya-chrome/
├── manifest.json          # MV3配置
├── service-worker.js      # 后台服务（Auth/Api/消息处理）
├── popup/
│   ├── popup.html         # 主界面（CSS内联）
│   └── popup.js           # UI逻辑 + OSS分片上传
├── options/
│   ├── options.html       # 设置页
│   └── options.js         # 设置逻辑
├── lib/                   # 早期拆分版本（已合并到service-worker.js）
├── icons/                 # 图标资源
├── README.md              # 用户文档
└── TECHNICAL_NOTES.md     # 本文档
```

### 1.3 设计决策

| 决策 | 原因 |
|------|------|
| service-worker.js合并Auth/Api | 减少importScript调用，SW重启时加载更快 |
| CSS内联在popup.html | 避免CSP问题，减少文件请求数 |
| 业务API通过sendMessage转发到SW | SW中fetch不受CORS限制（需host_permissions） |
| OSS上传在popup.js直接执行 | 大文件无需arrayBuffer转发到SW，支持File.slice流式分片 |
| 持久化数据用chrome.storage.local | SW可能随时重启，不能依赖内存状态 |

---

## 2. manifest.json 配置

```json
{
  "manifest_version": 3,
  "name": "简易光鸭云",
  "version": "1.0.0",
  "permissions": [
    "storage",        // Token持久化
    "downloads",      // 文件下载
    "notifications",  // 下载完成通知
    "contextMenus",   // 右键菜单
    "sidePanel"       // Side Panel API
  ],
  "host_permissions": [
    "https://api.guangyapan.com/*",      // 主API
    "https://account.guangyapan.com/*",  // 认证API
    "https://*.aliyuncs.com/*"           // OSS上传/下载
  ],
  "background": {
    "service_worker": "service-worker.js"
  },
  "action": {
    "default_popup": "popup/popup.html"
  },
  "side_panel": {
    "default_path": "popup/popup.html"   // 复用popup页面
  },
  "options_page": "options/options.html"
}
```

### 关键点
- `side_panel.default_path` 复用popup页面，无需单独开发
- `host_permissions` 必须声明OSS域名，否则上传/下载被CORS阻止
- `sidePanel`权限从Chrome 114开始支持

---

## 3. 认证机制

### 3.1 Token体系

```
refresh_token (长期有效，用户输入)
    ↓ POST /v1/auth/token
access_token (2小时有效)
    ↓ 提前5分钟自动刷新
新access_token
```

### 3.2 请求头构建

所有API请求需要注入20+个请求头模拟Android客户端：

```javascript
function buildHeaders(deviceId, accessToken) {
  return {
    'app': 'com.guangshanyun.pan',
    'X-Device-Id': deviceId,
    'Authorization': `Bearer ${accessToken}`,
    'User-Agent': buildUserAgent(deviceId),  // 模拟Android APP
    'client_id': 'aMe_eFSlkrbQXpUV',
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    // ... 更多头
  };
}
```

### 3.3 Token自动刷新

```javascript
async ensureValidToken() {
  const auth = await this.getAuth();
  // 提前5分钟刷新
  if (!auth.accessToken || Date.now() + 5*60*1000 > (auth.expiresAt || 0)) {
    return await this.refreshToken();
  }
  return auth.accessToken;
}
```

### 3.4 存储

- `refreshToken`: 长期凭证
- `deviceId`: 设备标识（可随机生成）
- `accessToken`: 短期凭证（2小时）
- `expiresAt`: 过期时间戳

存储位置：`chrome.storage.local`（SW重启后仍可读取）

---

## 4. API接口文档

### 4.1 通用约定

- **Base URL**: `https://api.guangyapan.com`
- **Account URL**: `https://account.guangyapan.com`
- **参数命名**: 全部camelCase（如`parentId`, `fileId`, `fileName`）
- **响应格式**: `{ code: 0, msg: "success", data: {...} }`

### 4.2 文件列表

```
POST /userres/v1/file/get_file_list
```

请求体：
```json
{
  "sortType": 1,
  "resType": 0,
  "orderBy": 3,
  "pageSize": 50,
  "page": 0,
  "dirType": 1,
  "parentId": ""
}
```

响应：
```json
{
  "code": 0,
  "data": [{
    "fileId": "xxx",
    "fileName": "文件名",
    "fileSize": 1024,
    "dirType": 1,    // 1=目录
    "resType": 2,    // 2=文件夹（dirType===1 && resType===2 为文件夹）
    "updateTime": "2024-01-01 00:00:00"
  }]
}
```

### 4.3 下载

```
POST /userres/v1/get_res_download_url
请求: { "requestId": "", "fileId": "xxx" }
响应: { "signedURL": "https://..." }
```

调用`chrome.downloads.download()`触发浏览器原生下载。

### 4.4 容量

```
POST /assets/v1/get_assets
请求: { "type": 0 }
响应: {
  "totalSpaceSize": 10737418240,
  "usedSpaceSize": 5368709120,
  "vipStatus": 1
}
```

### 4.5 文件操作

| 操作 | 端点 | 请求体 |
|------|------|--------|
| 创建目录 | `POST /userres/v1/file/create_dir` | `{failIfNameExist, parentId, dirName}` |
| 重命名 | `POST /userres/v1/file/rename` | `{newName, fileId}` |
| 删除 | `POST /userres/v1/file/delete_file` | `{fileIds: [...]}` |
| 移动 | `POST /userres/v1/file/move_file` | `{fileIds: [...], parentId}` |
| 复制 | `POST /userres/v1/file/copy_file` | `{fileIds: [...], parentId}` |

### 4.6 上传凭证

```
POST /userres/v1/get_res_center_token
请求: {
  "res": { "fileSize": 1024, "gcid": "文件GCID" },
  "name": "文件名",
  "parentId": "",
  "capacity": 2
}
响应: {
  "bucketName": "xxx",
  "region": "cn-shenzhen",
  "objectPath": "xxx/xxx",
  "creds": {
    "accessKeyID": "STS.xxx",
    "secretAccessKey": "xxx",
    "sessionToken": "xxx"
  }
}
```

### 4.7 云添加

| 操作 | 端点 | 请求体 |
|------|------|--------|
| 解析磁力 | `POST /cloudcollection/v1/batch_resolve_res` | `{reqs: [{url: "magnet:..."}]}` |
| 创建任务 | `POST /cloudcollection/v1/create_task` | `{newName, fileIndexes, url, parentId}` |
| 任务列表 | `POST /cloudcollection/v1/list_task` | `{cursor, pageSize, status}` |

**磁力解析响应嵌套结构**（注意层级）：
```
data[0].data.btResInfo
     ↓
{
  "fileName": "BT名称",
  "fileSize": 1024,
  "subfilesNum": 10,
  "subfiles": [{
    "fileName": "子文件.mp4",
    "fileSize": 1024,
    "fileIndex": 0
  }]
}
```

---

## 5. OSS上传实现

### 5.1 概述

上传策略：突破100M限制 + 接近官方APP速度。
- 文件 ≤ 4MB：简单上传（单次PUT）
- 文件 > 4MB：分片上传（Multipart Upload），4MB分片 + 3并发并行

与Python版`oss2.resumable_upload()`策略一致（part_size=4MB，多线程并行），与官方APP速度接近。

> **关键决策**：上传在popup.js中直接fetch OSS API，不再通过service-worker转发arrayBuffer。原因：(1) 大文件arrayBuffer转发到SW会爆内存；(2) popup上下文支持流式上传；(3) 减少IPC开销。

### 5.2 OSS V1签名

```javascript
// StringToSign 构造（关键！）
const stringToSign = `${method}\n\n${contentType}\n${date}\n${canonicalizedOSSHeaders}${canonicalizedResource}`;

// CanonicalizedOSSHeaders 必须按字母序包含 x-oss-date 和 x-oss-security-token
const canonicalizedOSSHeaders = `x-oss-date:${date}\nx-oss-security-token:${sessionToken}\n`;

// CanonicalizedResource：分片上传时必须包含子资源参数（?uploads / ?partNumber=N&uploadId=xxx / ?uploadId=xxx）
const canonicalizedResource = `/${bucketName}/${objectKey}`;
```

**签名规则要点**：
| 场景 | CanonicalizedResource |
|---|---|
| 简单上传 | `/{bucket}/{objectKey}` |
| InitiateMultipart | `/{bucket}/{objectKey}?uploads` |
| UploadPart | `/{bucket}/{objectKey}?partNumber={N}&uploadId={id}` |
| CompleteMultipart | `/{bucket}/{objectKey}?uploadId={id}` |

子资源参数必须按字母序排列：`partNumber` 在 `uploadId` 之前。

### 5.3 HMAC-SHA1签名

```javascript
async function hmacSha1Base64(key, data) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}
```

### 5.4 简单上传（≤4MB）

```javascript
const resp = await fetch(`${bucketUrl}/${objectKey}`, {
  method: 'PUT',
  headers: {
    'Authorization': `OSS ${accessKeyID}:${signature}`,
    'Content-Type': contentType,
    'x-oss-date': date,                    // 替代Date头（浏览器禁止设置Date）
    'x-oss-security-token': sessionToken   // STS凭证
  },
  body: file  // 直接用File对象（实现ReadableStream上传）
});
```

### 5.5 分片上传（>4MB）

三步流程：InitiateMultipartUpload → UploadPart（并行）→ CompleteMultipartUpload。

#### 5.5.1 InitiateMultipartUpload

```javascript
// POST /{objectKey}?uploads → 返回XML含 <UploadId>
const resp = await fetch(`${bucketUrl}/${objectKey}?uploads`, {
  method: 'POST',
  headers: {
    'Authorization': authorization,  // CanonicalizedResource含 ?uploads
    'Content-Type': 'application/octet-stream',
    'x-oss-date': date,
    'x-oss-security-token': sessionToken
  },
  body: new ArrayBuffer(0)
});
const xml = await resp.text();
const uploadId = xml.match(/<UploadId>(.*?)<\/UploadId>/)[1];
```

#### 5.5.2 UploadPart（3并发并行）

```javascript
// PUT /{objectKey}?partNumber={N}&uploadId={id} → 响应头含ETag
const UPLOAD_PART_SIZE = 4 * 1024 * 1024;  // 4MB
const UPLOAD_MAX_PARALLEL = 3;

const partCount = Math.ceil(file.size / UPLOAD_PART_SIZE);
const parts = [];

for (let i = 0; i < partCount; i += UPLOAD_MAX_PARALLEL) {
  const batch = [];
  for (let j = i; j < Math.min(i + UPLOAD_MAX_PARALLEL, partCount); j++) {
    const blob = file.slice(j * UPLOAD_PART_SIZE, (j + 1) * UPLOAD_PART_SIZE);
    batch.push(ossUploadPart(bucketUrl, objectKey, creds, uploadId, j + 1, blob));
  }
  const results = await Promise.all(batch);  // 3片并行
  parts.push(...results);
}
```

**关键点**：
- `file.slice()`返回Blob，浏览器原生支持，无需读取整个文件到内存
- 每个分片单独计算OSS签名，CanonicalizedResource必须含`?partNumber=N&uploadId=xxx`
- ETag从响应头`resp.headers.get('ETag')`获取，**不是**响应体
- 并行策略：每批MAX_PARALLEL=3片，与Python版一致

#### 5.5.3 CompleteMultipartUpload

```javascript
// POST /{objectKey}?uploadId={id} → 请求体XML含所有Part的ETag
const xml = '<CompleteMultipartUpload>' +
  parts.sort((a, b) => a.partNumber - b.partNumber)
    .map(p => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`)
    .join('') +
  '</CompleteMultipartUpload>';

const resp = await fetch(`${bucketUrl}/${objectKey}?uploadId=${uploadId}`, {
  method: 'POST',
  headers: {
    'Authorization': authorization,  // CanonicalizedResource含 ?uploadId=xxx
    'Content-Type': 'application/xml',
    'x-oss-date': date,
    'x-oss-security-token': sessionToken
  },
  body: xml
});
```

**关键点**：
- Part列表必须按partNumber升序排列
- Content-Type必须是`application/xml`（不是octet-stream）
- CanonicalizedResource为`/{bucket}/{objectKey}?uploadId={id}`（不含partNumber）

### 5.6 进度跟踪

```javascript
let uploadedBytes = 0;
for (const r of results) {
  parts.push(r);
  uploadedBytes += r.size;  // 每片完成时累加
  const pct = Math.round(uploadedBytes / file.size * 100);
  updateUploadProgress(pct, '上传中');
  updateTransferTask(task.id, { progress: pct, consumed: uploadedBytes });
}
```

进度按"分片完成"粒度更新（非字节流式），3并发下每完成1片跳升1.5%左右（200MB文件50片）。

### 5.7 与Python版对比

| 维度 | Python版 | Chrome插件版 | Android版 |
|---|---|---|---|
| SDK | `oss2.resumable_upload()` | 原生fetch实现 | OkHttp原生实现 |
| 分片大小 | 4MB | 4MB | 4MB |
| 并行度 | 多线程 | 3（Promise.all） | 3（Kotlin async+awaitAll） |
| 签名头 | Date | x-oss-date | Date |
| 断点续传 | 支持（oss2内置） | 不支持 | 不支持 |
| 100M限制 | 无 | 无（已突破） | 无（已突破） |

> **为什么不需要抓包？** 光鸭云`/userres/v1/get_res_center_token`返回的STS凭证本身支持OSS完整API（包括Multipart Upload）。只需客户端自己实现分片协议即可，无需逆向官方APP。

---

## 6. Side Panel持久显示

### 6.1 配置

manifest.json:
```json
{
  "permissions": ["sidePanel"],
  "side_panel": {
    "default_path": "popup/popup.html"
  }
}
```

### 6.2 行为设置

service-worker.js:
```javascript
chrome.runtime.onInstalled.addListener(() => {
  // 点击图标打开popup，不直接打开Side Panel
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });
});
```

### 6.3 打开Side Panel（关键！）

```javascript
// popup.js - 必须在用户手势上下文中直接调用
async function openSidePanel() {
  const currentWindow = await chrome.windows.getCurrent();
  await chrome.sidePanel.open({ windowId: currentWindow.id });
  window.close();  // 关闭popup
}
```

> **避坑**: `chrome.sidePanel.open()` 必须在用户手势上下文中调用。通过 `sendMessage` 转发到 service worker 会丢失用户手势上下文，导致API调用失败。

### 6.4 环境检测

```javascript
function detectSidePanelMode() {
  // Popup固定400x600；Side Panel占满整个浏览器高度
  const isSidePanel = window.innerHeight >= 700;
  applySidePanelMode(isSidePanel);

  window.addEventListener('resize', () => {
    applySidePanelMode(window.innerHeight >= 700);
  });
}
```

### 6.5 CSS自适应

```css
/* Popup模式：固定尺寸 */
html, body { width: 400px; height: 600px; }

/* Side Panel模式：全屏 */
html.side-panel-mode, body.side-panel-mode {
  width: 100% !important;
  height: 100vh !important;
}
body.side-panel-mode .app-bar {
  padding: 0 4px 0 8px;
  gap: 2px;
}
body.side-panel-mode .icon-btn { width: 30px; height: 30px; }
```

---

## 7. UI交互设计

### 7.1 单击/双击冲突解决

**问题**: 单击触发选中 → 操作栏出现 → 布局下移 → 第二次点击落在错误文件上

**解决方案**: 220ms延迟区分单击和双击

```javascript
function bindItemInteractions(element, file, isDir) {
  let clickTimer = null;
  const CLICK_DELAY = 220;

  element.addEventListener('click', () => {
    if (clickTimer) {
      clearTimeout(clickTimer);  // 双击时取消第一次单击
      clickTimer = null;
      return;
    }
    clickTimer = setTimeout(() => {
      selectFile(file);  // 单击：选中
      clickTimer = null;
    }, CLICK_DELAY);
  });

  element.addEventListener('dblclick', () => {
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    openAction(file, isDir);  // 双击：打开
  });
}
```

### 7.2 文件排序

- 排序键: 名称/大小/修改时间
- 排序方向: 升序/降序
- 文件夹始终置顶
- 偏好持久化到`chrome.storage.local`

### 7.3 拖拽上传

```javascript
// dragCounter防止dragleave误触发
let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
  dragCounter++;
  showDropOverlay();
});

document.addEventListener('dragleave', () => {
  dragCounter--;
  if (dragCounter === 0) hideDropOverlay();
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  dragCounter = 0;
  hideDropOverlay();
  for (const file of e.dataTransfer.files) {
    await uploadFileObject(file);  // 依次上传
  }
});
```

### 7.4 复选框移除

- 删除所有文件复选框
- 全选改为按钮（`check_circle`图标）
- 单击选中文件，再次单击或点击取消按钮取消选中

---

## 8. 云添加功能

### 8.1 流程

```
用户点击"云添加"按钮
    ↓
输入磁力链接
    ↓
POST /cloudcollection/v1/batch_resolve_res (解析)
    ↓
显示BT文件列表（默认全选）
    ↓
用户选择需要的文件
    ↓
POST /cloudcollection/v1/create_task (创建任务)
    ↓
任务出现在传输列表"云添加"标签页
```

### 8.2 BT文件全选状态同步

**避坑**: 不要用`Set`同步checkbox状态，直接从DOM推导

```javascript
function syncBtSelectAll() {
  const checkboxes = elements.btFileList.querySelectorAll('.bt-checkbox');
  const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
  const total = checkboxes.length;

  elements.btSelectedCount.textContent = `已选 ${checkedCount}/${total}`;
  elements.btSelectAll.checked = (checkedCount === total);
  elements.btSelectAll.indeterminate = (checkedCount > 0 && checkedCount < total);
}
```

### 8.3 隐藏云任务持久化

**问题**: 清空云任务后刷新又显示出来（服务器仍返回这些任务）

**解决方案**: 记录被隐藏的任务ID

```javascript
// 清空时记录
state.hiddenCloudTaskIds.add(taskId);
await saveHiddenCloudTaskIds();

// 加载时跳过
function loadCloudTasks() {
  const visibleTasks = allTasks.filter(
    t => !state.hiddenCloudTaskIds.has(t.taskId)
  );
}
```

---

## 9. 传输列表管理

### 9.1 任务类型

| 类型 | 图标 | 颜色 | 状态 |
|------|------|------|------|
| upload | upload | 蓝色 | uploading → done/error |
| download | download | 绿色 | downloading → done/error |
| cloud | cloud | 紫色 | pending → done/error |

### 9.2 任务生命周期

```
addTransferTask() → state.transferTasks.push(task)
    ↓
updateTransferTask(id, patch) → 更新状态
    ↓
cancelTransferTask(id) → 取消下载
    ↓
removeTransferTask(id) → 从列表移除
    ↓
clearFinishedTasks() → 清除所有已完成/失败任务
```

### 9.3 下载状态监听

```javascript
chrome.downloads.onChanged.addListener((delta) => {
  if (delta.state && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) {
    chrome.downloads.search({ id: delta.id }, (results) => {
      const filename = results[0].filename.split(/[/\\]/).pop();
      const task = state.transferTasks.find(
        t => t.type === 'download' && t.name === filename && t.status === 'downloading'
      );
      if (task) {
        updateTransferTask(task.id, {
          status: delta.state.current === 'complete' ? 'done' : 'error'
        });
      }
    });
  }
});
```

---

## 10. 避坑指南

### 10.1 OSS签名

| 坑 | 解决方案 |
|----|---------|
| `x-oss-security-token` 未加入CanonicalizedOSSHeaders | 必须按字母序包含：`x-oss-date:...\nx-oss-security-token:...\n` |
| 浏览器fetch禁止设置`Date`头 | 使用`x-oss-date`替代，StringToSign中Date字段填x-oss-date的值 |
| STS凭证缺少sessionToken | 请求头和签名中都要包含`x-oss-security-token` |

### 10.2 Side Panel

| 坑 | 解决方案 |
|----|---------|
| `chrome.sidePanel.open()` 通过SW消息调用失败 | 必须在popup中直接调用（用户手势上下文） |
| Side Panel中标题换行 | HTML标题改为"光鸭云"（3字），CSS `white-space: nowrap` |
| Side Panel模式检测不准确 | `window.innerHeight >= 700`阈值（Popup固定600px） |
| Side Panel宽度窄导致布局挤压 | 缩小按钮至30px，减小gap至2px |

### 10.3 交互设计

| 坑 | 解决方案 |
|----|---------|
| 单击/双击冲突 | 220ms延迟，双击时取消第一次单击的选中操作 |
| BT全选checkbox多次切换后卡住 | 直接从DOM推导选中状态，不用Set同步 |
| 清空云任务后刷新又出现 | `hiddenCloudTaskIds`持久化到`chrome.storage.local` |
| 粘贴按钮无法取消 | 添加X取消按钮，调用`cancelPaste()`清除剪贴板 |

### 10.4 Chrome Extension MV3

| 坑 | 解决方案 |
|----|---------|
| CSP限制内联JS | 所有JS必须外部引用 |
| SW随时可能重启 | 状态存储在`chrome.storage.local`，不依赖内存 |
| `Date`头被fetch禁止 | OSS上传用`x-oss-date`替代 |
| ReadableStream在SW中不兼容 | 使用`Blob`作为fetch body |
| 下载进度显示0% | OSS签名URL可能缺`Content-Length`，用`FileInfo.fileSize`作为总量 |

### 10.5 API对接

| 坑 | 解决方案 |
|----|---------|
| 参数命名混淆 | 光鸭API全部camelCase（非snake_case） |
| 磁力解析响应嵌套 | `data[0].data.btResInfo`（三层嵌套） |
| 文件夹判断 | `dirType === 1 && resType === 2` |
| 移动/复制/删除返回慢 | API是异步操作，立即返回不等待完成 |

---

## 附录：光鸭云盘 API 端点速查

| 功能 | 方法 | 端点 |
|------|------|------|
| Token刷新 | POST | `account.guangyapan.com/v1/auth/token` |
| 用户信息 | GET | `account.guangyapan.com/v1/user/me` |
| 文件列表 | POST | `api.guangyapan.com/userres/v1/file/get_file_list` |
| 下载URL | POST | `api.guangyapan.com/userres/v1/get_res_download_url` |
| 创建目录 | POST | `api.guangyapan.com/userres/v1/file/create_dir` |
| 重命名 | POST | `api.guangyapan.com/userres/v1/file/rename` |
| 删除 | POST | `api.guangyapan.com/userres/v1/file/delete_file` |
| 移动 | POST | `api.guangyapan.com/userres/v1/file/move_file` |
| 复制 | POST | `api.guangyapan.com/userres/v1/file/copy_file` |
| 上传凭证 | POST | `api.guangyapan.com/userres/v1/get_res_center_token` |
| 容量 | POST | `api.guangyapan.com/assets/v1/get_assets` |
| 磁力解析 | POST | `api.guangyapan.com/cloudcollection/v1/batch_resolve_res` |
| 创建云任务 | POST | `api.guangyapan.com/cloudcollection/v1/create_task` |
| 云任务列表 | POST | `api.guangyapan.com/cloudcollection/v1/list_task` |
