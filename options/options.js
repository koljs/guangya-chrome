// 设置页逻辑

document.addEventListener('DOMContentLoaded', async () => {
  const refreshTokenInput = document.getElementById('refreshToken');
  const deviceIdInput = document.getElementById('deviceId');
  const genDeviceBtn = document.getElementById('genDeviceId');
  const loginBtn = document.getElementById('loginBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const testBtn = document.getElementById('testBtn');
  const status = document.getElementById('status');
  const status2 = document.getElementById('status2');
  const loginSection = document.getElementById('loginSection');
  const loggedInSection = document.getElementById('loggedInSection');
  const userInfo = document.getElementById('userInfo');

  // 检查登录状态
  async function checkLoginStatus() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'checkLogin' }, (response) => {
        resolve(response && response.loggedIn);
      });
    });
  }

  // 显示状态
  function showStatus(elem, msg, type = 'loading') {
    elem.textContent = msg;
    elem.className = `status ${type}`;
  }

  // 切换显示
  function showSection(loggedIn) {
    loginSection.style.display = loggedIn ? 'none' : 'block';
    loggedInSection.style.display = loggedIn ? 'block' : 'none';
  }

  // 初始化
  const loggedIn = await checkLoginStatus();
  showSection(loggedIn);
  if (loggedIn) {
    showStatus(status2, '正在获取用户信息...', 'loading');
    chrome.runtime.sendMessage({ action: 'getUserInfo' }, (response) => {
      if (response && response.success) {
        const user = response.data;
        userInfo.textContent = `已登录 - ${user.nickname || user.user_name || user.account || '用户'}`;
        showStatus(status2, '', '');
      } else {
        showStatus(status2, response?.error || '获取用户信息失败', 'error');
      }
    });
  }

  // 随机生成Device ID
  genDeviceBtn.addEventListener('click', () => {
    const chars = '0123456789';
    let id = '';
    for (let i = 0; i < 32; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    deviceIdInput.value = id;
  });

  // 登录
  loginBtn.addEventListener('click', async () => {
    const refreshToken = refreshTokenInput.value.trim();
    const deviceId = deviceIdInput.value.trim();

    if (!refreshToken) {
      showStatus(status, '请输入refresh_token', 'error');
      return;
    }
    if (!deviceId || deviceId.length !== 32) {
      showStatus(status, '请输入32位Device ID', 'error');
      return;
    }

    showStatus(status, '正在验证Token...', 'loading');
    loginBtn.disabled = true;

    chrome.runtime.sendMessage({
      action: 'login',
      refreshToken,
      deviceId
    }, (response) => {
      loginBtn.disabled = false;
      if (response && response.success) {
        showStatus(status, '登录成功！Token验证通过', 'success');
        setTimeout(() => location.reload(), 1000);
      } else {
        showStatus(status, response?.error || '登录失败', 'error');
      }
    });
  });

  // 测试连接
  testBtn.addEventListener('click', () => {
    showStatus(status2, '正在测试...', 'loading');
    chrome.runtime.sendMessage({ action: 'getUserInfo' }, (response) => {
      if (response && response.success) {
        const user = response.data;
        showStatus(status2, `连接正常 - ${user.nickname || user.user_name || '用户'}`, 'success');
      } else {
        showStatus(status2, response?.error || '连接失败', 'error');
      }
    });
  });

  // 退出登录
  logoutBtn.addEventListener('click', () => {
    if (!confirm('确定退出登录吗？')) return;
    chrome.runtime.sendMessage({ action: 'logout' }, (response) => {
      if (response && response.success) {
        location.reload();
      }
    });
  });
});
