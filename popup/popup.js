// 简易光鸭云 - 弹窗逻辑

const state = {
  currentParentId: '',
  breadcrumbs: [{ id: '', name: '全部文件' }],
  files: [],
  selectedFile: null,
  clipboard: null,
  selectedIds: new Set(),
  viewMode: 'list',
  theme: 'light',
  sortKey: 'date',
  sortDir: 'desc',
  dragCounter: 0,
  transferTasks: [],
  transferTab: 'all',
  magnetBtInfo: null,
  magnetSelectedIndexes: new Set(),
  hiddenCloudTaskIds: new Set()
};

const elements = {
  notLoggedView: document.getElementById('notLoggedView'),
  mainView: document.getElementById('mainView'),
  breadcrumb: document.getElementById('breadcrumb'),
  content: document.getElementById('content'),
  snackbar: document.getElementById('snackbar'),
  refreshBtn: document.getElementById('refreshBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  themeBtn: document.getElementById('themeBtn'),
  themeIcon: document.getElementById('themeIcon'),
  goSettingsBtn: document.getElementById('goSettingsBtn'),
  newFolderBtn: document.getElementById('newFolderBtn'),
  uploadBtn: document.getElementById('uploadBtn'),
  pasteBtn: document.getElementById('pasteBtn'),
  cancelPasteBtn: document.getElementById('cancelPasteBtn'),
  viewToggleBtn: document.getElementById('viewToggleBtn'),
  viewToggleIcon: document.getElementById('viewToggleIcon'),
  selectAllBtn: document.getElementById('selectAllBtn'),
  selectAllIcon: document.getElementById('selectAllIcon'),
  batchBar: document.getElementById('batchBar'),
  selectionCount: document.getElementById('selectionCount'),
  batchMoveBtn: document.getElementById('batchMoveBtn'),
  batchCopyBtn: document.getElementById('batchCopyBtn'),
  batchDeleteBtn: document.getElementById('batchDeleteBtn'),
  batchCancelBtn: document.getElementById('batchCancelBtn'),
  contextMenu: document.getElementById('contextMenu'),
  dialogOverlay: document.getElementById('dialogOverlay'),
  dialogTitle: document.getElementById('dialogTitle'),
  dialogInput: document.getElementById('dialogInput'),
  dialogCancel: document.getElementById('dialogCancel'),
  dialogConfirm: document.getElementById('dialogConfirm'),
  uploadOverlay: document.getElementById('uploadOverlay'),
  uploadFilename: document.getElementById('uploadFilename'),
  uploadProgressFill: document.getElementById('uploadProgressFill'),
  uploadStatus: document.getElementById('uploadStatus'),
  sortBtn: document.getElementById('sortBtn'),
  sortMenu: document.getElementById('sortMenu'),
  sortDirBtn: document.getElementById('sortDirBtn'),
  sortDirIcon: document.getElementById('sortDirIcon'),
  sortDirText: document.getElementById('sortDirText'),
  capacityText: document.getElementById('capacityText'),
  capacityProgressFill: document.getElementById('capacityProgressFill'),
  capacityPercent: document.getElementById('capacityPercent'),
  dropOverlay: document.getElementById('dropOverlay'),
  cloudAddBtn: document.getElementById('cloudAddBtn'),
  transferBtn: document.getElementById('transferBtn'),
  transferPanel: document.getElementById('transferPanel'),
  transferRefreshBtn: document.getElementById('transferRefreshBtn'),
  transferClearBtn: document.getElementById('transferClearBtn'),
  transferCloseBtn: document.getElementById('transferCloseBtn'),
  transferList: document.getElementById('transferList'),
  magnetOverlay: document.getElementById('magnetOverlay'),
  magnetTitle: document.getElementById('magnetTitle'),
  magnetInput: document.getElementById('magnetInput'),
  magnetConfirm: document.getElementById('magnetConfirm'),
  magnetCancel: document.getElementById('magnetCancel'),
  magnetStatus: document.getElementById('magnetStatus'),
  btFileListContainer: document.getElementById('btFileListContainer'),
  btFileList: document.getElementById('btFileList'),
  btSelectAll: document.getElementById('btSelectAll'),
  btSelectedCount: document.getElementById('btSelectedCount'),
  openSidePanelBtn: document.getElementById('openSidePanelBtn'),
  appTitle: document.querySelector('.app-title')
};

let dialogCallback = null;

function sendMessage(msg) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, resolve);
  });
}

function showSnackbar(msg) {
  elements.snackbar.textContent = msg;
  elements.snackbar.classList.add('show');
  setTimeout(() => elements.snackbar.classList.remove('show'), 3000);
}

function getFileIcon(file) {
  const isDir = file.dirType === 1 && file.resType === 2;
  if (isDir) return { icon: 'folder', class: 'folder' };
  const ext = (file.ext || file.fileName || '').split('.').pop().toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(ext)) return { icon: 'image', class: 'image' };
  if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv'].includes(ext)) return { icon: 'movie', class: 'video' };
  if (['mp3', 'flac', 'wav', 'aac', 'm4a', 'ogg'].includes(ext)) return { icon: 'music_note', class: 'audio' };
  if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(ext)) return { icon: 'description', class: 'doc' };
  return { icon: 'insert_drive_file', class: 'other' };
}

function formatSize(bytes) {
  if (!bytes || bytes <= 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (bytes >= 1024 && i < units.length - 1) { bytes /= 1024; i++; }
  return `${bytes.toFixed(1)} ${units[i]}`;
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const ts = typeof timestamp === 'number' ? (timestamp > 1e12 ? timestamp : timestamp * 1000) : Date.parse(timestamp);
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ==================== 主题 ====================
function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  elements.themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
  chrome.storage.local.set({ theme: theme });
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

// ==================== 视图 ====================
function applyViewMode(mode) {
  state.viewMode = mode;
  elements.viewToggleIcon.textContent = mode === 'grid' ? 'view_list' : 'grid_view';
  chrome.storage.local.set({ viewMode: mode });
  renderFiles();
}

function toggleView() {
  applyViewMode(state.viewMode === 'grid' ? 'list' : 'grid');
}

// ==================== 多选 ====================
function selectAll() {
  if (state.files.length > 0 && state.selectedIds.size < state.files.length) {
    state.files.forEach(f => state.selectedIds.add(f.fileId));
  } else {
    state.selectedIds.clear();
  }
  renderFiles();
  updateSelectionUI();
}

function clearSelection() {
  state.selectedIds.clear();
  renderFiles();
  updateSelectionUI();
}

function updateSelectionUI() {
  const count = state.selectedIds.size;
  elements.selectionCount.textContent = `已选 ${count} 项`;
  if (count > 0) {
    elements.batchBar.classList.add('show');
  } else {
    elements.batchBar.classList.remove('show');
  }
  const allSelected = count > 0 && count === state.files.length;
  elements.selectAllIcon.textContent = allSelected ? 'deselect' : 'check_circle';
  elements.selectAllBtn.classList.toggle('active', allSelected);
}

// ==================== 排序 ====================
function getSortValue(file, key) {
  switch (key) {
    case 'name': return (file.fileName || '').toLowerCase();
    case 'size': return file.fileSize || 0;
    case 'date': return file.ctime || 0;
    default: return 0;
  }
}

function sortFiles() {
  const { sortKey, sortDir } = state;
  state.files.sort((a, b) => {
    const aIsDir = a.dirType === 1 && a.resType === 2;
    const bIsDir = b.dirType === 1 && b.resType === 2;
    if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
    let av = getSortValue(a, sortKey);
    let bv = getSortValue(b, sortKey);
    let cmp = 0;
    if (sortKey === 'name') {
      cmp = String(av).localeCompare(String(bv), 'zh-CN');
    } else {
      cmp = av < bv ? -1 : (av > bv ? 1 : 0);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });
}

function applySort(key) {
  if (state.sortKey === key) {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortKey = key;
    state.sortDir = key === 'name' ? 'asc' : 'desc';
  }
  chrome.storage.local.set({ sortKey: state.sortKey, sortDir: state.sortDir });
  updateSortMenuUI();
  renderFiles();
}

function toggleSortDir() {
  state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  chrome.storage.local.set({ sortDir: state.sortDir });
  updateSortMenuUI();
  renderFiles();
}

function updateSortMenuUI() {
  ['name', 'size', 'date'].forEach(k => {
    const check = elements.sortMenu.querySelector(`[data-check="${k}"]`);
    const item = elements.sortMenu.querySelector(`[data-sort="${k}"]`);
    if (check) check.classList.toggle('hidden', state.sortKey !== k);
    if (item) item.classList.toggle('active', state.sortKey === k);
  });
  const isAsc = state.sortDir === 'asc';
  elements.sortDirIcon.textContent = isAsc ? 'arrow_upward' : 'arrow_downward';
  elements.sortDirText.textContent = isAsc ? '升序' : '降序';
}

function showSortMenu(e) {
  e.stopPropagation();
  const rect = elements.sortBtn.getBoundingClientRect();
  elements.sortMenu.style.left = Math.min(rect.left, window.innerWidth - 190) + 'px';
  elements.sortMenu.style.top = (rect.bottom + 4) + 'px';
  elements.sortMenu.classList.add('show');
  updateSortMenuUI();
}

function hideSortMenu() {
  elements.sortMenu.classList.remove('show');
}

// ==================== 容量 ====================
async function loadCapacity() {
  try {
    const resp = await sendMessage({ action: 'getAssets' });
    if (resp && resp.success && resp.data) {
      const total = resp.data.totalSpaceSize || 0;
      const used = resp.data.usedSpaceSize || 0;
      renderCapacity(used, total);
    }
  } catch (e) {
    elements.capacityText.textContent = '容量信息获取失败';
  }
}

function renderCapacity(used, total) {
  const percent = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  elements.capacityText.textContent = `${formatSize(used)} / ${formatSize(total)}`;
  elements.capacityProgressFill.style.width = percent + '%';
  elements.capacityProgressFill.classList.remove('warning', 'danger');
  if (percent >= 90) elements.capacityProgressFill.classList.add('danger');
  else if (percent >= 75) elements.capacityProgressFill.classList.add('warning');
  elements.capacityPercent.textContent = percent.toFixed(1) + '%';
}

// ==================== 渲染 ====================
function renderBreadcrumb() {
  elements.breadcrumb.innerHTML = '';
  state.breadcrumbs.forEach((item, index) => {
    const span = document.createElement('span');
    span.className = 'breadcrumb-item' + (index === state.breadcrumbs.length - 1 ? ' current' : '');
    span.textContent = item.name;
    span.addEventListener('click', () => {
      state.breadcrumbs = state.breadcrumbs.slice(0, index + 1);
      state.currentParentId = item.id;
      clearSelection();
      loadFiles();
    });
    elements.breadcrumb.appendChild(span);
    if (index < state.breadcrumbs.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-sep';
      sep.textContent = '/';
      elements.breadcrumb.appendChild(sep);
    }
  });
}

function renderFiles() {
  elements.content.innerHTML = '';
  if (state.files.length === 0) {
    elements.content.innerHTML = '<div class="empty"><span class="material-icons-round">folder_open</span><div>此文件夹为空</div></div>';
    return;
  }

  sortFiles();

  if (state.viewMode === 'grid') {
    renderGrid();
  } else {
    renderList();
  }
}

function bindItemInteractions(element, file, isDir) {
  let clickTimer = null;
  const CLICK_DELAY = 220;

  const openAction = () => {
    if (isDir) {
      state.currentParentId = file.fileId;
      state.breadcrumbs.push({ id: file.fileId, name: file.fileName });
      clearSelection();
      loadFiles();
    } else {
      downloadFile(file);
    }
  };

  const doSelect = () => {
    const isSelected = state.selectedIds.has(file.fileId);
    if (isSelected) {
      state.selectedIds.delete(file.fileId);
    } else {
      state.selectedIds.add(file.fileId);
    }
    element.classList.toggle('selected', !isSelected);
    updateSelectionUI();
  };

  element.addEventListener('click', (e) => {
    if (e.target.closest('.more-btn')) return;
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
      return;
    }
    clickTimer = setTimeout(() => {
      clickTimer = null;
      doSelect();
    }, CLICK_DELAY);
  });

  element.addEventListener('dblclick', (e) => {
    if (e.target.closest('.more-btn')) return;
    if (clickTimer) {
      clearTimeout(clickTimer);
      clickTimer = null;
    }
    openAction();
  });

  const moreBtn = element.querySelector('.more-btn');
  if (moreBtn) {
    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showContextMenu(e, file);
    });
  }
  element.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    showContextMenu(e, file);
  });
}

function renderList() {
  state.files.forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-item' + (state.selectedIds.has(file.fileId) ? ' selected' : '');
    const iconInfo = getFileIcon(file);
    const isDir = file.dirType === 1 && file.resType === 2;
    const sizeText = isDir ? '-' : formatSize(file.fileSize);
    const dateText = formatDate(file.ctime);

    item.innerHTML = `
      <div class="file-icon ${iconInfo.class}"><span class="material-icons-round">${iconInfo.icon}</span></div>
      <div class="file-info">
        <div class="file-name">${escapeHtml(file.fileName)}</div>
        <div class="file-meta">${sizeText}${dateText ? ' · ' + dateText : ''}</div>
      </div>
      <button class="more-btn" title="更多操作"><span class="material-icons-round">more_vert</span></button>
    `;

    bindItemInteractions(item, file, isDir);
    elements.content.appendChild(item);
  });
}

function renderGrid() {
  const grid = document.createElement('div');
  grid.className = 'file-grid';
  state.files.forEach(file => {
    const card = document.createElement('div');
    card.className = 'file-card' + (state.selectedIds.has(file.fileId) ? ' selected' : '');
    const iconInfo = getFileIcon(file);
    const isDir = file.dirType === 1 && file.resType === 2;
    const sizeText = isDir ? '-' : formatSize(file.fileSize);

    card.innerHTML = `
      <div class="file-card-icon ${iconInfo.class}"><span class="material-icons-round">${iconInfo.icon}</span></div>
      <div class="file-card-name">${escapeHtml(file.fileName)}</div>
      <div class="file-card-meta">${sizeText}</div>
      <button class="more-btn" title="更多操作"><span class="material-icons-round">more_vert</span></button>
    `;

    bindItemInteractions(card, file, isDir);
    grid.appendChild(card);
  });
  elements.content.appendChild(grid);
}

// 右键菜单
function showContextMenu(e, file) {
  state.selectedFile = file;
  const menu = elements.contextMenu;
  const x = Math.min(e.clientX, window.innerWidth - 180);
  const y = Math.min(e.clientY, window.innerHeight - 250);
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.add('show');
  const downloadItem = menu.querySelector('[data-action="download"]');
  const isDir = file.dirType === 1 && file.resType === 2;
  downloadItem.style.display = isDir ? 'none' : 'flex';
}

function hideContextMenu() {
  elements.contextMenu.classList.remove('show');
}

// 对话框
function showDialog(title, placeholder, defaultValue, callback) {
  elements.dialogTitle.textContent = title;
  elements.dialogInput.placeholder = placeholder;
  elements.dialogInput.value = defaultValue || '';
  dialogCallback = callback;
  elements.dialogOverlay.classList.add('show');
  setTimeout(() => elements.dialogInput.focus(), 100);
}

function hideDialog() {
  elements.dialogOverlay.classList.remove('show');
  dialogCallback = null;
}

// 下载文件
async function downloadFile(file) {
  showSnackbar(`正在获取下载链接: ${file.fileName}`);
  const task = addTransferTask('download', file.fileName, 'pending', 0, file.fileSize);
  try {
    const resp = await sendMessage({ action: 'downloadFile', fileId: file.fileId, fileName: file.fileName });
    if (resp && resp.success) {
      updateTransferTask(task.id, { status: 'downloading' });
      showSnackbar(`下载已开始: ${file.fileName}`);
    } else {
      updateTransferTask(task.id, { status: 'error' });
      showSnackbar(`下载失败: ${resp?.error || '未知错误'}`);
    }
  } catch (e) {
    updateTransferTask(task.id, { status: 'error' });
    showSnackbar(`下载失败: ${e.message}`);
  }
}

// ==================== 上传功能 ====================
function showUploadProgress(fileName) {
  elements.uploadFilename.textContent = fileName;
  elements.uploadProgressFill.style.width = '0%';
  elements.uploadStatus.textContent = '准备中...';
  elements.uploadOverlay.classList.add('show');
}

function updateUploadProgress(percent, status) {
  elements.uploadProgressFill.style.width = percent + '%';
  if (status) elements.uploadStatus.textContent = `${status} ${percent}%`;
}

function hideUploadProgress() {
  elements.uploadOverlay.classList.remove('show');
}

// 增量SHA-1，支持流式计算大文件GCID
class SHA1Stream {
  constructor() {
    this.h = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    this.block = new Uint8Array(64);
    this.blockLen = 0;
    this.totalLen = 0;
  }
  update(data) {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    this.totalLen += bytes.length;
    let offset = 0;
    while (offset < bytes.length) {
      const toCopy = Math.min(64 - this.blockLen, bytes.length - offset);
      this.block.set(bytes.subarray(offset, offset + toCopy), this.blockLen);
      this.blockLen += toCopy;
      offset += toCopy;
      if (this.blockLen === 64) { this._processBlock(); this.blockLen = 0; }
    }
  }
  _processBlock() {
    const w = new Array(80);
    for (let i = 0; i < 16; i++) {
      w[i] = (this.block[i*4]<<24) | (this.block[i*4+1]<<16) | (this.block[i*4+2]<<8) | this.block[i*4+3];
    }
    for (let i = 16; i < 80; i++) {
      w[i] = this._rotl(w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16], 1);
    }
    let [a,b,c,d,e] = this.h;
    for (let i = 0; i < 80; i++) {
      let f, k;
      if (i<20) { f=(b&c)|(~b&d); k=0x5A827999; }
      else if (i<40) { f=b^c^d; k=0x6ED9EBA1; }
      else if (i<60) { f=(b&c)|(b&d)|(c&d); k=0x8F1BBCDC; }
      else { f=b^c^d; k=0xCA62C1D6; }
      const t = (this._rotl(a,5) + f + e + k + w[i]) >>> 0;
      e=d; d=c; c=this._rotl(b,30); b=a; a=t;
    }
    this.h[0]=(this.h[0]+a)>>>0; this.h[1]=(this.h[1]+b)>>>0;
    this.h[2]=(this.h[2]+c)>>>0; this.h[3]=(this.h[3]+d)>>>0;
    this.h[4]=(this.h[4]+e)>>>0;
  }
  _rotl(n, bits) { return ((n<<bits)|(n>>>(32-bits)))>>>0; }
  digest() {
    const totalBits = this.totalLen * 8;
    this.update(new Uint8Array([0x80]));
    while (this.blockLen !== 56) this.update(new Uint8Array([0]));
    const lenBytes = new Uint8Array(8);
    const high = Math.floor(totalBits / 0x100000000);
    const low = totalBits % 0x100000000;
    lenBytes[0] = Math.floor(high/0x1000000)&0xff; lenBytes[1] = Math.floor(high/0x10000)&0xff;
    lenBytes[2] = Math.floor(high/0x100)&0xff; lenBytes[3] = high&0xff;
    lenBytes[4] = Math.floor(low/0x1000000)&0xff; lenBytes[5] = Math.floor(low/0x10000)&0xff;
    lenBytes[6] = Math.floor(low/0x100)&0xff; lenBytes[7] = low&0xff;
    this.update(lenBytes);
    return this.h.map(n => n.toString(16).padStart(8, '0')).join('');
  }
}

async function computeSHA1(arrayBuffer) {
  const hashBuffer = await crypto.subtle.digest('SHA-1', arrayBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 流式计算GCID，逐块读取不保留全文件
async function computeGCIDFromUrl(url, fileSize, onProgress) {
  const resp = await fetch(url);
  const reader = resp.body.getReader();
  const sha1 = new SHA1Stream();
  let readBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    sha1.update(value);
    readBytes += value.length;
    if (onProgress) onProgress(readBytes, fileSize);
  }
  return sha1.digest();
}

// ==================== OSS分片上传 ====================
const UPLOAD_PART_SIZE = 64 * 1024 * 1024;
const UPLOAD_MULTIPART_THRESHOLD = 4 * 1024 * 1024;
const UPLOAD_MAX_PARALLEL = 4;

async function hmacSha1Base64(key, data) {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw', encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

async function buildOSSAuth(creds, method, contentType, date, canonicalizedResource) {
  const canonicalizedOSSHeaders = `x-oss-date:${date}\nx-oss-security-token:${creds.creds.sessionToken}\n`;
  const stringToSign = `${method}\n\n${contentType}\n${date}\n${canonicalizedOSSHeaders}${canonicalizedResource}`;
  const signature = await hmacSha1Base64(creds.creds.secretAccessKey, stringToSign);
  return `OSS ${creds.creds.accessKeyID}:${signature}`;
}

async function ossInitiateMultipart(bucketUrl, objectKey, creds) {
  const date = new Date().toUTCString();
  const contentType = 'application/octet-stream';
  const canonicalizedResource = `/${creds.bucketName}/${objectKey}?uploads`;
  const authorization = await buildOSSAuth(creds, 'POST', contentType, date, canonicalizedResource);

  const resp = await fetch(`${bucketUrl}/${objectKey}?uploads`, {
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Type': contentType,
      'x-oss-date': date,
      'x-oss-security-token': creds.creds.sessionToken
    },
    body: new ArrayBuffer(0)
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`初始化分片上传失败: ${resp.status} ${text}`);
  }
  const xml = await resp.text();
  const match = xml.match(/<UploadId>(.*?)<\/UploadId>/);
  if (!match) throw new Error('未获取到UploadId: ' + xml);
  return match[1];
}

async function ossUploadPart(bucketUrl, objectKey, creds, uploadId, partNumber, blob) {
  const date = new Date().toUTCString();
  const contentType = 'application/octet-stream';
  const canonicalizedResource = `/${creds.bucketName}/${objectKey}?partNumber=${partNumber}&uploadId=${uploadId}`;
  const authorization = await buildOSSAuth(creds, 'PUT', contentType, date, canonicalizedResource);

  const resp = await fetch(`${bucketUrl}/${objectKey}?partNumber=${partNumber}&uploadId=${uploadId}`, {
    method: 'PUT',
    headers: {
      'Authorization': authorization,
      'Content-Type': contentType,
      'x-oss-date': date,
      'x-oss-security-token': creds.creds.sessionToken
    },
    body: blob
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`分片 ${partNumber} 上传失败: ${resp.status} ${text}`);
  }
  const etag = resp.headers.get('ETag');
  if (!etag) throw new Error(`分片 ${partNumber} 未获取到ETag`);
  return { partNumber, etag, size: blob.size };
}

async function ossCompleteMultipart(bucketUrl, objectKey, creds, uploadId, parts) {
  const date = new Date().toUTCString();
  const contentType = 'application/xml';
  const canonicalizedResource = `/${creds.bucketName}/${objectKey}?uploadId=${uploadId}`;
  const authorization = await buildOSSAuth(creds, 'POST', contentType, date, canonicalizedResource);

  const xml = '<CompleteMultipartUpload>' +
    parts.sort((a, b) => a.partNumber - b.partNumber)
      .map(p => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`)
      .join('') +
    '</CompleteMultipartUpload>';

  const resp = await fetch(`${bucketUrl}/${objectKey}?uploadId=${uploadId}`, {
    method: 'POST',
    headers: {
      'Authorization': authorization,
      'Content-Type': contentType,
      'x-oss-date': date,
      'x-oss-security-token': creds.creds.sessionToken
    },
    body: xml
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`合并分片失败: ${resp.status} ${text}`);
  }
}

async function uploadFileObject(fileName, fileSize, file, blobUrl) {
  const task = addTransferTask('upload', fileName, 'pending', 0, fileSize);
  try {
    // 流式计算GCID，不读全文件到内存
    updateUploadProgress(0, '计算文件指纹...');
    const gcid = await computeGCIDFromUrl(blobUrl, fileSize, (read, total) => {
      const pct = Math.round(read / total * 30);
      updateUploadProgress(pct, `计算文件指纹 ${formatSize(read)}/${formatSize(total)}`);
    });

    updateUploadProgress(30, '获取上传凭证');
    const resp = await sendMessage({
      action: 'getUploadCredential',
      fileSize: fileSize, gcid: gcid, fileName: fileName, parentId: state.currentParentId
    });
    if (!resp || !resp.success) throw new Error(resp?.error || '获取凭证失败');
    const creds = resp.data;

    updateTransferTask(task.id, { status: 'uploading', progress: 0 });
    updateUploadProgress(30, '上传中');

    const bucketUrl = `https://${creds.bucketName}.oss-${creds.region}.aliyuncs.com`;
    const objectKey = creds.objectPath;

    if (fileSize <= UPLOAD_MULTIPART_THRESHOLD) {
      // 简单上传（小文件 ≤4MB，直接读取）
      const date = new Date().toUTCString();
      const contentType = 'application/octet-stream';
      const canonicalizedResource = `/${creds.bucketName}/${objectKey}`;
      const authorization = await buildOSSAuth(creds, 'PUT', contentType, date, canonicalizedResource);
      const blobResp = await fetch(blobUrl);
      const blob = await blobResp.blob();
      const ossResp = await fetch(`${bucketUrl}/${objectKey}`, {
        method: 'PUT',
        headers: {
          'Authorization': authorization,
          'Content-Type': contentType,
          'x-oss-date': date,
          'x-oss-security-token': creds.creds.sessionToken
        },
        body: blob
      });
      if (!ossResp.ok) {
        const text = await ossResp.text();
        throw new Error(`OSS上传失败: ${ossResp.status} ${text}`);
      }
    } else {
      // 分片上传（大文件 >4MB，用file.slice不读全文件）
      updateUploadProgress(30, '初始化分片上传');
      const uploadId = await ossInitiateMultipart(bucketUrl, objectKey, creds);

      const partCount = Math.ceil(fileSize / UPLOAD_PART_SIZE);
      const parts = [];
      let uploadedBytes = 0;

      updateUploadProgress(30, `上传中 (${partCount}片)`);

      for (let i = 0; i < partCount; i += UPLOAD_MAX_PARALLEL) {
        const batch = [];
        for (let j = i; j < Math.min(i + UPLOAD_MAX_PARALLEL, partCount); j++) {
          const start = j * UPLOAD_PART_SIZE;
          const end = Math.min(start + UPLOAD_PART_SIZE, fileSize);
          // 优先用file.slice（不读全文件），失败则用blobUrl Range
          let blob;
          try {
            blob = file.slice(start, end);
          } catch (sliceErr) {
            console.warn('[Upload] file.slice失败，改用blobUrl Range:', sliceErr);
            const rangeResp = await fetch(blobUrl, { headers: { 'Range': `bytes=${start}-${end-1}` } });
            blob = await rangeResp.blob();
          }
          batch.push(ossUploadPart(bucketUrl, objectKey, creds, uploadId, j + 1, blob));
        }
        const results = await Promise.all(batch);
        for (const r of results) {
          parts.push(r);
          uploadedBytes += r.size;
          const pct = 30 + Math.round(uploadedBytes / fileSize * 65);
          updateUploadProgress(pct, '上传中');
          updateTransferTask(task.id, { progress: pct, consumed: uploadedBytes });
        }
      }

      updateUploadProgress(98, '合并分片');
      await ossCompleteMultipart(bucketUrl, objectKey, creds, uploadId, parts);
    }

    updateTransferTask(task.id, { status: 'done', progress: 100 });
    hideUploadProgress();
    delayedRefresh(`上传成功: ${fileName}`);
    return true;
  } catch (e) {
    updateTransferTask(task.id, { status: 'error' });
    hideUploadProgress();
    showSnackbar(`上传失败: ${e.message}`);
    return false;
  }
}

async function uploadFile() {
  const input = document.getElementById('persistentFileInput');
  input.value = '';  // 重置以确保同名文件也能触发change
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    console.log('[Upload] 文件已选择:', file.name, file.size, 'type:', file.type);
    // 立即显示进度条，避免大文件读取时无反馈
    showUploadProgress(file.name);
    updateUploadProgress(0, '正在准备上传...');
    // 创建blob URL，传给uploadFileObject做流式GCID+分片上传，不提前读全文件
    let url = null;
    try {
      url = URL.createObjectURL(file);
      console.log('[Upload] blob URL:', url);
      await uploadFileObject(file.name, file.size, file, url);
    } catch (err) {
      console.error('[Upload] 上传失败:', err);
      hideUploadProgress();
      showSnackbar(`上传失败: ${err.message}`);
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  };
  input.click();
}

// ==================== 拖拽上传 ====================
function setupDragDrop() {
  document.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    state.dragCounter++;
    elements.dropOverlay.classList.add('show');
  });
  document.addEventListener('dragover', (e) => {
    if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  document.addEventListener('dragleave', (e) => {
    if (!e.dataTransfer) return;
    e.preventDefault();
    state.dragCounter--;
    if (state.dragCounter <= 0) {
      state.dragCounter = 0;
      elements.dropOverlay.classList.remove('show');
    }
  });
  document.addEventListener('drop', async (e) => {
    if (!e.dataTransfer || !e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    state.dragCounter = 0;
    elements.dropOverlay.classList.remove('show');
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      showUploadProgress(file.name);
      updateUploadProgress(0, '正在准备上传...');
      let url = null;
      try {
        url = URL.createObjectURL(file);
        const ok = await uploadFileObject(file.name, file.size, file, url);
        if (!ok) break;
      } catch (err) {
        hideUploadProgress();
        showSnackbar(`上传失败: ${err.message}`);
        break;
      } finally {
        if (url) URL.revokeObjectURL(url);
      }
    }
  });
}

// ==================== 传输列表 ====================
function addTransferTask(type, name, status, progress, total) {
  const task = {
    id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    type: type,
    name: name,
    status: status,
    progress: progress || 0,
    total: total || 0,
    time: Date.now()
  };
  state.transferTasks.unshift(task);
  return task;
}

function updateTransferTask(id, updates) {
  const task = state.transferTasks.find(t => t.id === id);
  if (task) {
    Object.assign(task, updates);
  }
}

function renderTransferList() {
  const list = elements.transferList;
  list.innerHTML = '';
  let tasks = state.transferTasks;
  if (state.transferTab !== 'all') {
    tasks = tasks.filter(t => t.type === state.transferTab);
  }
  if (tasks.length === 0) {
    list.innerHTML = '<div class="empty"><span class="material-icons-round">inbox</span><div>暂无传输任务</div></div>';
    return;
  }
  tasks.forEach(task => {
    const item = document.createElement('div');
    item.className = 'transfer-item';
    const iconMap = { upload: 'upload', download: 'download', cloud: 'cloud_download' };
    const statusText = task.status === 'done' ? '已完成' :
                       task.status === 'error' ? '失败' :
                       task.status === 'cancelled' ? '已取消' :
                       task.status === 'uploading' ? `上传中 ${task.progress}%` :
                       task.status === 'downloading' ? `下载中` :
                       task.status === 'pending' ? '等待中' :
                       task.status === 'cloud_pending' ? '云添加中' :
                       task.status === 'cloud_downloading' ? `下载中 ${task.progress}%` : task.status;
    const progressClass = task.status === 'done' ? 'done' : (task.status === 'error' ? 'error' : '');
    const progressWidth = task.status === 'done' ? 100 : (task.progress || 0);
    const canCancel = ['pending', 'uploading', 'downloading', 'cloud_pending', 'cloud_downloading'].includes(task.status);
    const canRemove = ['done', 'error', 'cancelled'].includes(task.status);

    item.innerHTML = `
      <div class="transfer-item-header">
        <div class="transfer-item-icon ${task.type}"><span class="material-icons-round">${iconMap[task.type] || 'file'}</span></div>
        <div class="transfer-item-info">
          <div class="transfer-item-name">${escapeHtml(task.name)}</div>
          <div class="transfer-item-status">${statusText}${task.total ? ' · ' + formatSize(task.total) : ''}</div>
        </div>
        ${canCancel ? `<button class="more-btn transfer-cancel-btn" title="取消"><span class="material-icons-round">close</span></button>` : ''}
        ${canRemove ? `<button class="more-btn transfer-remove-btn" title="移除"><span class="material-icons-round">delete_outline</span></button>` : ''}
      </div>
      <div class="transfer-item-progress">
        <div class="transfer-item-progress-fill ${progressClass}" style="width:${progressWidth}%"></div>
      </div>
    `;
    const cancelBtn = item.querySelector('.transfer-cancel-btn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => cancelTransferTask(task.id));
    const removeBtn = item.querySelector('.transfer-remove-btn');
    if (removeBtn) removeBtn.addEventListener('click', () => removeTransferTask(task.id));
    list.appendChild(item);
  });
}

function showTransferPanel() {
  elements.transferPanel.classList.add('show');
  renderTransferList();
  loadCloudTasks();
}

function hideTransferPanel() {
  elements.transferPanel.classList.remove('show');
}

function clearFinishedTasks() {
  const finishedStatuses = ['done', 'error', 'cancelled'];
  const removed = state.transferTasks.filter(t => finishedStatuses.includes(t.status));
  removed.forEach(t => {
    if (t.cloudTaskId) state.hiddenCloudTaskIds.add(t.cloudTaskId);
  });
  state.transferTasks = state.transferTasks.filter(t => !finishedStatuses.includes(t.status));
  saveHiddenCloudTaskIds();
  renderTransferList();
}

function saveHiddenCloudTaskIds() {
  chrome.storage.local.set({ hiddenCloudTaskIds: Array.from(state.hiddenCloudTaskIds) });
}

function cancelTransferTask(taskId) {
  const task = state.transferTasks.find(t => t.id === taskId);
  if (!task) return;
  updateTransferTask(taskId, { status: 'cancelled' });
  renderTransferList();
}

function removeTransferTask(taskId) {
  state.transferTasks = state.transferTasks.filter(t => t.id !== taskId);
  renderTransferList();
}

async function loadCloudTasks() {
  try {
    const resp = await sendMessage({ action: 'listCloudTasks', status: [0, 1, 2] });
    if (resp && resp.success && resp.data && resp.data.list) {
      resp.data.list.forEach(task => {
        if (state.hiddenCloudTaskIds.has(task.taskId)) return;
        const existing = state.transferTasks.find(t => t.cloudTaskId === task.taskId);
        if (existing) {
          existing.progress = task.progress || 0;
          existing.status = task.status === 2 ? 'done' : (task.status === 1 ? 'cloud_downloading' : 'cloud_pending');
        } else {
          state.transferTasks.unshift({
            id: 'cloud_' + task.taskId,
            cloudTaskId: task.taskId,
            type: 'cloud',
            name: task.taskName || '云添加任务',
            status: task.status === 2 ? 'done' : (task.status === 1 ? 'cloud_downloading' : 'cloud_pending'),
            progress: task.progress || 0,
            total: task.fileSize || 0,
            time: Date.now()
          });
        }
      });
      renderTransferList();
    }
  } catch (e) {
    console.error('加载云任务失败:', e);
  }
}

// ==================== 云添加（磁力链接）====================
function showMagnetDialog() {
  elements.magnetInput.value = '';
  elements.magnetInput.style.display = 'block';
  elements.btFileListContainer.style.display = 'none';
  elements.magnetStatus.style.display = 'none';
  elements.magnetConfirm.textContent = '解析';
  elements.magnetTitle.textContent = '云添加 - 磁力链接';
  state.magnetBtInfo = null;
  state.magnetSelectedIndexes.clear();
  elements.magnetOverlay.classList.add('show');
  setTimeout(() => elements.magnetInput.focus(), 100);
}

function hideMagnetDialog() {
  elements.magnetOverlay.classList.remove('show');
  state.magnetBtInfo = null;
  state.magnetSelectedIndexes.clear();
}

function showMagnetStatus(msg) {
  elements.magnetStatus.textContent = msg;
  elements.magnetStatus.style.display = 'block';
}

async function parseMagnetLink() {
  const url = elements.magnetInput.value.trim();
  if (!url) {
    showMagnetStatus('请输入磁力链接');
    return;
  }
  if (!url.startsWith('magnet:')) {
    showMagnetStatus('链接格式不正确，应以 magnet: 开头');
    return;
  }
  elements.magnetConfirm.disabled = true;
  showMagnetStatus('正在解析...');
  try {
    const resp = await sendMessage({ action: 'parseMagnet', magnetUrl: url });
    if (!resp || !resp.success) throw new Error(resp?.error || '解析失败');
    const list = resp.data;
    if (!list || !Array.isArray(list) || list.length === 0) {
      throw new Error('解析失败：无数据');
    }
    const wrapper = list[0].data;
    if (!wrapper || !wrapper.btResInfo) {
      throw new Error('解析失败：无BT信息');
    }
    const btInfo = wrapper.btResInfo;
    state.magnetBtInfo = { info: btInfo, url: url };
    elements.magnetInput.style.display = 'none';
    elements.magnetStatus.style.display = 'none';
    elements.btFileListContainer.style.display = 'block';
    elements.magnetConfirm.textContent = '开始下载';
    elements.magnetTitle.textContent = `选择文件 - ${btInfo.fileName}`;
    renderBtFiles(btInfo);
  } catch (e) {
    showMagnetStatus(`解析失败: ${e.message}`);
  } finally {
    elements.magnetConfirm.disabled = false;
  }
}

function renderBtFiles(btInfo) {
  const list = elements.btFileList;
  list.innerHTML = '';
  (btInfo.subfiles || []).forEach((sub) => {
    const item = document.createElement('div');
    item.className = 'bt-file-item';
    item.innerHTML = `
      <input type="checkbox" class="bt-checkbox" data-index="${sub.fileIndex}" checked>
      <div class="bt-file-info">
        <div class="bt-file-name">${escapeHtml(sub.fileName)}</div>
        <div class="bt-file-size">${formatSize(sub.fileSize)}</div>
      </div>
    `;
    const cb = item.querySelector('.bt-checkbox');
    cb.addEventListener('change', () => syncBtSelectAll());
    list.appendChild(item);
  });
  elements.btSelectAll.checked = true;
  syncBtSelectAll();
}

function syncBtSelectAll() {
  const checkboxes = elements.btFileList.querySelectorAll('.bt-checkbox');
  const total = checkboxes.length;
  const checked = Array.from(checkboxes).filter(cb => cb.checked).length;
  elements.btSelectedCount.textContent = `已选 ${checked}/${total}`;
  elements.btSelectAll.checked = total > 0 && checked === total;
}

function btSelectAllToggle(checked) {
  elements.btFileList.querySelectorAll('.bt-checkbox').forEach(cb => {
    cb.checked = checked;
  });
  syncBtSelectAll();
}

function getSelectedBtIndexes() {
  return Array.from(elements.btFileList.querySelectorAll('.bt-checkbox:checked')).map(cb => parseInt(cb.dataset.index));
}

async function createCloudTaskFromMagnet() {
  if (!state.magnetBtInfo) {
    parseMagnetLink();
    return;
  }
  const indexes = getSelectedBtIndexes();
  if (indexes.length === 0) {
    showMagnetStatus('请至少选择一个文件');
    return;
  }
  elements.magnetConfirm.disabled = true;
  showMagnetStatus('正在创建任务...');
  try {
    const resp = await sendMessage({
      action: 'createCloudTask',
      newName: state.magnetBtInfo.info.fileName,
      fileIndexes: indexes,
      magnetUrl: state.magnetBtInfo.url,
      parentId: state.currentParentId
    });
    if (!resp || !resp.success) throw new Error(resp?.error || '创建失败');
    const taskId = resp.data.taskId || '';
    addTransferTask('cloud', state.magnetBtInfo.info.fileName, 'cloud_pending', 0, state.magnetBtInfo.info.fileSize);
    if (taskId) {
      const task = state.transferTasks[0];
      task.cloudTaskId = taskId;
    }
    hideMagnetDialog();
    showSnackbar('云添加任务已创建');
  } catch (e) {
    showMagnetStatus(`创建失败: ${e.message}`);
  } finally {
    elements.magnetConfirm.disabled = false;
  }
}

// 加载文件列表
async function loadFiles() {
  elements.content.innerHTML = '<div class="loading"><span class="material-icons-round">progress_rotate</span>加载中...</div>';
  renderBreadcrumb();
  try {
    const resp = await sendMessage({ action: 'getFileList', parentId: state.currentParentId });
    if (resp && resp.success) {
      state.files = resp.data.list || resp.data.file_list || [];
      renderFiles();
    } else {
      elements.content.innerHTML = `<div class="empty"><span class="material-icons-round" style="color:var(--error)">error</span><div>${escapeHtml(resp?.error || '加载失败')}</div></div>`;
    }
  } catch (e) {
    elements.content.innerHTML = `<div class="empty"><span class="material-icons-round" style="color:var(--error)">error</span><div>${escapeHtml(e.message)}</div></div>`;
  }
}

function delayedRefresh(msg) {
  showSnackbar(msg);
  setTimeout(() => loadFiles(), 1500);
}

// 新建文件夹
async function createFolder() {
  showDialog('新建文件夹', '请输入文件夹名称', '', async (name) => {
    if (!name) return;
    try {
      const resp = await sendMessage({ action: 'createDir', parentId: state.currentParentId, dirName: name });
      if (resp && resp.success) {
        delayedRefresh('文件夹创建成功');
      } else {
        showSnackbar(`创建失败: ${resp?.error || '未知错误'}`);
      }
    } catch (e) {
      showSnackbar(`创建失败: ${e.message}`);
    }
  });
}

// 重命名
async function renameFile(file) {
  showDialog('重命名', '请输入新名称', file.fileName, async (name) => {
    if (!name || name === file.fileName) return;
    try {
      const resp = await sendMessage({ action: 'rename', fileId: file.fileId, newName: name });
      if (resp && resp.success) {
        delayedRefresh('重命名成功');
      } else {
        showSnackbar(`重命名失败: ${resp?.error || '未知错误'}`);
      }
    } catch (e) {
      showSnackbar(`重命名失败: ${e.message}`);
    }
  });
}

// 删除文件（单个）
async function deleteFile(file) {
  if (!confirm(`确定删除"${file.fileName}"吗？`)) return;
  try {
    const resp = await sendMessage({ action: 'deleteFile', fileIds: [file.fileId] });
    if (resp && resp.success) {
      delayedRefresh('删除成功');
    } else {
      showSnackbar(`删除失败: ${resp?.error || '未知错误'}`);
    }
  } catch (e) {
    showSnackbar(`删除失败: ${e.message}`);
  }
}

// 批量删除
async function batchDelete() {
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;
  if (!confirm(`确定删除选中的 ${ids.length} 个文件吗？`)) return;
  try {
    const resp = await sendMessage({ action: 'deleteFile', fileIds: ids });
    if (resp && resp.success) {
      clearSelection();
      delayedRefresh(`已删除 ${ids.length} 个文件`);
    } else {
      showSnackbar(`批量删除失败: ${resp?.error || '未知错误'}`);
    }
  } catch (e) {
    showSnackbar(`批量删除失败: ${e.message}`);
  }
}

// 批量移动/复制（存入剪贴板）
function showPasteButtons() {
  elements.pasteBtn.style.display = 'flex';
  elements.cancelPasteBtn.style.display = 'flex';
}

function hidePasteButtons() {
  elements.pasteBtn.style.display = 'none';
  elements.cancelPasteBtn.style.display = 'none';
}

function cancelPaste() {
  state.clipboard = null;
  hidePasteButtons();
  showSnackbar('已取消粘贴');
}

function batchMove() {
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;
  state.clipboard = { action: 'move', fileIds: ids };
  showPasteButtons();
  clearSelection();
  showSnackbar(`已剪切 ${ids.length} 个文件（导航到目标目录后点击粘贴）`);
}

function batchCopy() {
  const ids = Array.from(state.selectedIds);
  if (ids.length === 0) return;
  state.clipboard = { action: 'copy', fileIds: ids };
  showPasteButtons();
  clearSelection();
  showSnackbar(`已复制 ${ids.length} 个文件（导航到目标目录后点击粘贴）`);
}

// 单个移动/复制
function cutFile(file) {
  state.clipboard = { action: 'move', fileIds: [file.fileId] };
  showPasteButtons();
  showSnackbar(`已剪切: ${file.fileName}（导航到目标目录后点击粘贴）`);
}

function copyFileToClipboard(file) {
  state.clipboard = { action: 'copy', fileIds: [file.fileId] };
  showPasteButtons();
  showSnackbar(`已复制: ${file.fileName}（导航到目标目录后点击粘贴）`);
}

// 粘贴
async function paste() {
  if (!state.clipboard) {
    showSnackbar('剪贴板为空');
    return;
  }
  const { action, fileIds } = state.clipboard;
  try {
    const resp = await sendMessage({
      action: action === 'move' ? 'moveFile' : 'copyFile',
      fileIds: fileIds,
      targetParentId: state.currentParentId
    });
    if (resp && resp.success) {
      state.clipboard = null;
      hidePasteButtons();
      delayedRefresh(`${action === 'move' ? '移动' : '复制'}成功`);
    } else {
      showSnackbar(`操作失败: ${resp?.error || '未知错误'}`);
    }
  } catch (e) {
    showSnackbar(`操作失败: ${e.message}`);
  }
}

// Side Panel 环境检测
function detectSidePanelMode() {
  // Popup 固定 400x600；Side Panel 占满整个浏览器高度，通常远大于 600
  const isSidePanel = window.innerHeight >= 700;
  console.log('[SidePanel] detectSidePanelMode: innerHeight=' + window.innerHeight + ', isSidePanel=' + isSidePanel);
  applySidePanelMode(isSidePanel);
  // 监听窗口尺寸变化（Side Panel可能随浏览器调整而变化）
  window.addEventListener('resize', () => {
    applySidePanelMode(window.innerHeight >= 700);
  });
}

function applySidePanelMode(enabled) {
  const has = document.body.classList.contains('side-panel-mode');
  console.log('[SidePanel] applySidePanelMode: enabled=' + enabled + ', has=' + has);
  if (enabled && !has) {
    document.documentElement.classList.add('side-panel-mode');
    document.body.classList.add('side-panel-mode');
    if (elements.openSidePanelBtn) elements.openSidePanelBtn.style.display = 'none';
  } else if (!enabled && has) {
    document.documentElement.classList.remove('side-panel-mode');
    document.body.classList.remove('side-panel-mode');
    if (elements.openSidePanelBtn) elements.openSidePanelBtn.style.display = '';
  }
}

// 在侧边栏中打开（关闭当前popup）
// 注意：chrome.sidePanel.open() 必须在用户手势上下文中直接调用，
// 通过 sendMessage 转发到 service worker 会丢失用户手势上下文
async function openSidePanel() {
  try {
    if (!chrome.sidePanel || !chrome.sidePanel.open) {
      showSnackbar('当前浏览器不支持Side Panel API（需Chrome 114+）');
      return;
    }
    const currentWindow = await chrome.windows.getCurrent();
    await chrome.sidePanel.open({ windowId: currentWindow.id });
    window.close();
  } catch (err) {
    showSnackbar('打开侧边栏失败: ' + err.message);
  }
}

// 初始化
async function init() {
  // 检测运行环境：Popup (固定400x600) vs Side Panel (全高)
  detectSidePanelMode();

  // 加载保存的偏好
  const prefs = await new Promise(resolve => {
    chrome.storage.local.get(['theme', 'viewMode', 'sortKey', 'sortDir', 'hiddenCloudTaskIds'], resolve);
  });
  if (prefs.hiddenCloudTaskIds) {
    state.hiddenCloudTaskIds = new Set(prefs.hiddenCloudTaskIds);
  }
  applyTheme(prefs.theme || 'light');
  state.viewMode = prefs.viewMode || 'list';
  state.sortKey = prefs.sortKey || 'date';
  state.sortDir = prefs.sortDir || 'desc';
  elements.viewToggleIcon.textContent = state.viewMode === 'grid' ? 'view_list' : 'grid_view';
  updateSortMenuUI();
  setupDragDrop();
  setupDownloadListener();

  const resp = await sendMessage({ action: 'checkLogin' });
  if (resp && resp.loggedIn) {
    elements.notLoggedView.style.display = 'none';
    elements.mainView.style.display = 'flex';
    await loadFiles();
    loadCapacity();
  } else {
    elements.notLoggedView.style.display = 'flex';
    elements.mainView.style.display = 'none';
  }
}

// 下载状态监听
function setupDownloadListener() {
  chrome.downloads.onChanged.addListener((delta) => {
    if (delta.state && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) {
      chrome.downloads.search({ id: delta.id }, (results) => {
        if (!results || !results[0]) return;
        const filename = results[0].filename ? results[0].filename.split(/[/\\]/).pop() : '';
        const task = state.transferTasks.find(t => t.type === 'download' && t.name === filename && t.status === 'downloading');
        if (task) {
          updateTransferTask(task.id, {
            status: delta.state.current === 'complete' ? 'done' : 'error',
            progress: delta.state.current === 'complete' ? 100 : task.progress
          });
          if (elements.transferPanel.classList.contains('show')) renderTransferList();
        }
      });
    }
  });
}

// 事件绑定
elements.themeBtn.addEventListener('click', toggleTheme);
elements.refreshBtn.addEventListener('click', () => { clearSelection(); loadFiles(); loadCapacity(); });
elements.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
elements.goSettingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
elements.newFolderBtn.addEventListener('click', createFolder);
elements.uploadBtn.addEventListener('click', uploadFile);
elements.pasteBtn.addEventListener('click', paste);
elements.cancelPasteBtn.addEventListener('click', cancelPaste);
elements.viewToggleBtn.addEventListener('click', toggleView);
elements.selectAllBtn.addEventListener('click', selectAll);
elements.batchDeleteBtn.addEventListener('click', batchDelete);
elements.batchMoveBtn.addEventListener('click', batchMove);
elements.batchCopyBtn.addEventListener('click', batchCopy);
elements.batchCancelBtn.addEventListener('click', clearSelection);

// 传输列表和云添加
elements.cloudAddBtn.addEventListener('click', showMagnetDialog);
elements.transferBtn.addEventListener('click', showTransferPanel);
elements.openSidePanelBtn.addEventListener('click', openSidePanel);
elements.transferCloseBtn.addEventListener('click', hideTransferPanel);
elements.transferRefreshBtn.addEventListener('click', () => { loadCloudTasks(); });
elements.transferClearBtn.addEventListener('click', clearFinishedTasks);
elements.transferPanel.querySelectorAll('.transfer-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    elements.transferPanel.querySelectorAll('.transfer-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    state.transferTab = tab.dataset.tab;
    renderTransferList();
  });
});
elements.magnetConfirm.addEventListener('click', () => {
  if (state.magnetBtInfo) {
    createCloudTaskFromMagnet();
  } else {
    parseMagnetLink();
  }
});
elements.magnetCancel.addEventListener('click', hideMagnetDialog);
elements.btSelectAll.addEventListener('change', (e) => btSelectAllToggle(e.target.checked));
elements.magnetInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (!state.magnetBtInfo) parseMagnetLink();
  }
});

// 排序
elements.sortBtn.addEventListener('click', showSortMenu);
elements.sortMenu.addEventListener('click', (e) => {
  e.stopPropagation();
  const item = e.target.closest('.sort-item');
  if (item) {
    applySort(item.dataset.sort);
    hideSortMenu();
  }
});
elements.sortDirBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSortDir();
});

// 右键菜单项
elements.contextMenu.addEventListener('click', (e) => {
  const item = e.target.closest('.menu-item');
  if (!item) return;
  const action = item.dataset.action;
  const file = state.selectedFile;
  hideContextMenu();
  switch (action) {
    case 'download': downloadFile(file); break;
    case 'rename': renameFile(file); break;
    case 'delete': deleteFile(file); break;
    case 'move': cutFile(file); break;
    case 'copy': copyFileToClipboard(file); break;
  }
});

document.addEventListener('click', (e) => {
  if (!elements.contextMenu.contains(e.target)) hideContextMenu();
  if (!elements.sortMenu.contains(e.target) && e.target !== elements.sortBtn && !elements.sortBtn.contains(e.target)) {
    hideSortMenu();
  }
});

elements.dialogCancel.addEventListener('click', hideDialog);
elements.dialogConfirm.addEventListener('click', () => {
  const value = elements.dialogInput.value.trim();
  if (dialogCallback) dialogCallback(value);
  hideDialog();
});
elements.dialogInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const value = elements.dialogInput.value.trim();
    if (dialogCallback) dialogCallback(value);
    hideDialog();
  }
});

init();
