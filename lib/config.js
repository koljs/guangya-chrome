// 光鸭云盘配置常量

const CONFIG = {
  API_BASE_URL: 'https://api.guangyapan.com',
  ACCOUNT_BASE_URL: 'https://account.guangyapan.com',
  CLIENT_ID: 'aMe_eFSlkrbQXpUV',
  TOKEN_REFRESH_AHEAD_MS: 5 * 60 * 1000, // 提前5分钟刷新
};

// 构建User-Agent
function buildUserAgent(deviceId) {
  const ts = Date.now();
  return `ANDROID-com.guangshanyun.pan/1.1.0 protocolversion/200 accesstype/ clientid/${CONFIG.CLIENT_ID} clientversion/1.1.0 action_type/ networktype/WIFI sessionid/ deviceid/${deviceId} providername/NONE devicesign/div101.${deviceId}500fb2df465d3545f22ac4f1b962fd3e refresh_token/ sdkversion/2.0.7 datetime/${ts} usrno/ appname/android-com.guangshanyun.pan session_origin/ grant_type/ appid/ clientip/ devicename/Xiaomi_M2102k1ac osversion/14 platformversion/10 accessmode/ devicemodel/M2102K1AC channel/10003 callApp/com.miui.home`;
}

// 构建请求头
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

// 生成设备ID
function generateDeviceId() {
  const chars = '0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

self.CONFIG = CONFIG;
self.buildUserAgent = buildUserAgent;
self.buildHeaders = buildHeaders;
self.generateDeviceId = generateDeviceId;
