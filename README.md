# 简易光鸭云 - Chrome浏览器插件

光鸭云盘第三方Chrome浏览器插件，采用Google Material Design风格。

## 功能特性

- 🔐 **Token认证**：支持refresh_token自动续期
- 📁 **文件管理**：浏览、下载、重命名、删除、移动、复制
- ⬇️ **文件下载**：调用Chrome Downloads API，支持大文件
- 🎨 **Material Design**：参考R2-Cloud-Drive界面风格
- 📱 **轻量化**：popup弹窗设计，不占用标签页

## 安装方法

1. 打开Chrome浏览器，访问 `chrome://extensions/`
2. 开启右上角"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `guangya-chrome` 文件夹

## 使用说明

### 首次使用

1. 点击插件图标，弹出设置引导
2. 点击"前往设置"进入选项页
3. 输入 `refresh_token` 和 `device_id`
   - 通过抓包官方APP登录请求获取
   - device_id可点击"随机生成"
4. 点击"登录并验证"，等待Token刷新成功

### 日常使用

1. 点击插件图标打开弹窗
2. 浏览文件列表，点击文件夹进入
3. 点击文件直接下载
4. 点击面包屑导航返回上级目录
5. 点击刷新按钮重新加载

## 项目结构

```
guangya-chrome/
├── manifest.json              # MV3配置
├── background/
│   └── service-worker.js      # 后台服务（API请求、Token管理、下载）
├── lib/
│   ├── config.js              # 配置常量和请求头构建
│   ├── auth.js                # Token认证管理
│   └── api.js                 # 光鸭API封装
├── popup/
│   ├── popup.html             # 弹窗主界面
│   ├── popup.css              # Material Design样式（内联在html中）
│   └── popup.js               # 弹窗逻辑
├── options/
│   ├── options.html           # 设置/登录页
│   └── options.js             # 设置逻辑
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 技术要点

### 认证机制
- 使用refresh_token自动获取access_token
- Token有效期2小时，提前5分钟自动刷新
- Token存储在chrome.storage.local

### 请求头
所有API请求需注入20+个请求头，模拟官方APP客户端：
- `X-Device-Id`: 设备标识
- `Authorization`: Bearer Token
- `User-Agent`: 模拟Android客户端
- `client_id`: 固定值 `aMe_eFSlkrbQXpUV`

### API列表
- 文件列表：`POST /userres/v1/file/get_file_list`
- 下载URL：`POST /userres/v1/get_res_download_url`
- 用户信息：`GET /v1/user/me`
- 文件操作：创建目录/重命名/移动/复制/删除

## 避免的坑

1. **CSP限制**：所有JS必须外部引用，不能内联
2. **host_permissions**：必须声明API域名才能跨域请求
3. **MV3限制**：background使用service worker，不能持久化状态
4. **Token存储**：使用chrome.storage.local而非localStorage

## 参考项目

- [R2-Cloud-Drive](https://github.com/HandsomeMJZ/R2-Cloud-Drive) - 界面设计参考
- 光鸭云盘Android客户端 - API接口来源
