# 🚀 Vercel 部署指南

## 📋 部署前准备

### 1. 确认项目状态
- ✅ 代码已推送到 GitHub: `https://github.com/caitingYUE/haigoo-remote.git`
- ✅ RSS 代理服务已配置: `api/rss-proxy.js`
- ✅ Vercel 配置文件已更新: `vercel.json`

### 2. 项目结构
```
├── api/
│   └── rss-proxy.js          # Serverless Function
├── vercel.json               # Vercel 配置
├── .env.example              # 环境变量示例
└── src/                      # 前端代码
```

## 🔧 部署步骤

### 方式一：通过 Vercel 网站部署（推荐）

1. **访问 Vercel**
   - 打开 [vercel.com](https://vercel.com)
   - 使用 GitHub 账号登录

2. **导入项目**
   - 点击 "New Project"
   - 选择 GitHub 仓库: `haigoo-remote`
   - 点击 "Import"

3. **配置项目**
   - Project Name: `haigoo-remote`
   - Framework Preset: `Vite`
   - Root Directory: `./` (默认)
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **环境变量配置**
```
VITE_ALIBABA_BAILIAN_API_KEY=your_api_key_here
VITE_ALIBABA_BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/api/v1
VITE_APP_NAME=Haigoo Assistant
VITE_APP_VERSION=1.0.0
NODE_ENV=production
```

说明：生产环境默认使用 Vercel Functions 提供的相对路径 API（如 `/api/rss-proxy`），无需额外配置 `VITE_API_BASE_URL` 或 `VITE_RSS_PROXY_URL`。如使用自定义域或独立后端，再根据需要添加对应变量。

5. **部署**
   - 点击 "Deploy"
   - 等待部署完成（约 2-3 分钟）

### 方式二：通过 Vercel CLI 部署

1. **安装 Vercel CLI**
```bash
npm i -g vercel
```

2. **登录 Vercel**
```bash
vercel login
```

3. **部署项目**
```bash
vercel --prod
```

## 🌐 部署后配置

### 1. 获取部署 URL
部署完成后，你会得到一个 URL，例如：
```
https://haigoo.vercel.app
```

### 2. API 端点
生产环境默认通过 Vercel Functions 提供：
```
https://your-app.vercel.app/api/rss-proxy
```
前端代码推荐使用相对路径 `'/api/rss-proxy'`（由平台路由到对应函数），开发环境可通过本地代理指向 `http://localhost:3001/api/rss-proxy`。

### 3. 重新部署
更新环境变量后，触发重新部署以应用更改。

## 🧪 测试部署

### 1. 访问应用
- 主页: `https://your-app.vercel.app`
- 管理后台: `https://your-app.vercel.app/admin`

### 2. 测试 RSS 功能
- 在管理后台点击"同步数据"
- 检查是否能正常获取 RSS 数据
- 确认没有 CORS 错误

### 3. 测试 API 端点
```bash
curl https://your-app.vercel.app/api/rss-proxy?url=https://remotive.com/remote-jobs/feed
```

## 🔍 故障排除

### 常见问题

1. **构建失败**
   - 检查 `package.json` 中的构建脚本
   - 确认所有依赖都已正确安装

2. **API 路由不工作**
   - 检查 `vercel.json` 配置
   - 确认 `api/` 目录结构正确

3. **环境变量未生效**
   - 确认变量名以 `VITE_` 开头
   - 重新部署以应用更改

4. **CORS 错误**
   - 检查 Serverless 代理是否正常运行（`api/rss-proxy.js`）
   - 确认 RSS 源 URL 正确

## 📝 注意事项

- Vercel 免费计划有使用限制
- Serverless Functions 有执行时间限制（10秒）
- 大量 RSS 源可能需要优化请求策略
- 建议设置自定义域名以获得更好的用户体验

## 🔄 持续部署

每次推送到 `main` 分支时，Vercel 会自动重新部署应用。确保：
- 代码通过测试
- 环境变量配置正确
- API 功能正常工作