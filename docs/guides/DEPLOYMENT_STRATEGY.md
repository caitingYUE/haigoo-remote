# Haigoo 双环境部署策略

## 📋 概述

本文档定义了 Haigoo 项目的双环境部署策略，确保开发环境和生产环境完全隔离，同时保持配置一致性。

---

## 🏗️ 环境架构

### 1. **生产环境（Production）**
- **用途**: 面向真实用户的稳定版本
- **Git 分支**: `main`
- **Vercel 部署**: Production Deployment
- **域名**: `haigooremote.com`
- **数据存储**: 生产级 Redis/KV 实例

### 2. **开发环境（Development/Staging）**
- **用途**: 开发测试、新功能验证
- **Git 分支**: `develop`
- **Vercel 部署**: Preview Deployment
- **域名**: `haigoo-dev.vercel.app` 或自定义域名 `dev.haigoo.com`
- **数据存储**: 独立的开发 Redis/KV 实例

---

## 🔀 Git 分支策略

```
main (生产环境)
  ↑
  | merge (经过充分测试后)
  |
develop (开发环境)
  ↑
  | merge (功能完成后)
  |
feature/* (功能分支)
```

### 分支规则

1. **`main` 分支**
   - 受保护分支，不允许直接 push
   - 只接受来自 `develop` 的 Pull Request
   - 每次合并都会自动部署到生产环境
   - 必须通过 Code Review

2. **`develop` 分支**
   - 开发主分支
   - 接受来自 `feature/*` 分支的合并
   - 每次 push 自动部署到开发环境
   - 用于集成测试

3. **`feature/*` 分支**
   - 功能开发分支
   - 从 `develop` 创建
   - 完成后合并回 `develop`
   - 命名规范: `feature/用户登录`, `feature/简历解析优化`

---

## 🔐 环境变量配置

### Vercel 环境变量设置

在 Vercel Dashboard → Settings → Environment Variables 中配置：

#### **生产环境变量（Production）**

| 变量名 | 用途 | 示例值 | Environment |
|--------|------|--------|-------------|
| `REDIS_URL` | 生产 Redis URL | `redis://prod.upstash.io:6379` | Production |
| `KV_REST_API_URL` | 生产 KV URL | `https://prod-kv.vercel.com` | Production |
| `KV_REST_API_TOKEN` | 生产 KV Token | `prod_token_xxx` | Production |
| `JWT_SECRET` | JWT 密钥（生产） | `prod_secret_key_xxx` | Production |
| `SMTP_HOST` | 邮件服务器 | `smtp.gmail.com` | Production |
| `SMTP_USER` | 邮件账号 | `noreply@haigoo.com` | Production |
| `SMTP_PASS` | 邮件密码 | `prod_password_xxx` | Production |
| `GOOGLE_CLIENT_ID` | Google OAuth ID | `prod_google_id_xxx` | Production |
| `NODE_ENV` | 环境标识 | `production` | Production |
| `SITE_URL` | 站点 URL | `https://haigooremote.com` | Production |

#### **开发环境变量（Preview）**

| 变量名 | 用途 | 示例值 | Environment |
|--------|------|--------|-------------|
| `REDIS_URL` | 开发 Redis URL | `redis://dev.upstash.io:6379` | Preview |
| `KV_REST_API_URL` | 开发 KV URL | `https://dev-kv.vercel.com` | Preview |
| `KV_REST_API_TOKEN` | 开发 KV Token | `dev_token_xxx` | Preview |
| `JWT_SECRET` | JWT 密钥（开发） | `dev_secret_key_xxx` | Preview |
| `SMTP_HOST` | 邮件服务器（测试） | `smtp.mailtrap.io` | Preview |
| `SMTP_USER` | 邮件账号（测试） | `dev@haigoo.com` | Preview |
| `SMTP_PASS` | 邮件密码（测试） | `dev_password_xxx` | Preview |
| `GOOGLE_CLIENT_ID` | Google OAuth ID（测试） | `dev_google_id_xxx` | Preview |
| `NODE_ENV` | 环境标识 | `development` | Preview |
| `SITE_URL` | 站点 URL | `https://haigoo-dev.vercel.app` | Preview |

---

## 🗄️ 数据存储隔离

### Redis/Upstash 配置

#### **生产数据库**
```bash
# 生产 Redis 实例
Database: haigoo-production
URL: redis://prod.upstash.io:6379
Key Prefix: haigoo:prod:*
```

#### **开发数据库**
```bash
# 开发 Redis 实例
Database: haigoo-development
URL: redis://dev.upstash.io:6379
Key Prefix: haigoo:dev:*
```

### Vercel KV 配置

在 Vercel Dashboard 中创建两个独立的 KV 存储：
1. `haigoo-kv-production` → 绑定到 Production 环境
2. `haigoo-kv-development` → 绑定到 Preview 环境

---

## 🚀 部署流程

### 开发流程

```bash
# 1. 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/新功能名称

# 2. 开发并提交
git add .
git commit -m "feat: 实现新功能"

# 3. 推送到远程（可选，创建 PR 预览）
git push origin feature/新功能名称

# 4. 合并到 develop（触发开发环境部署）
git checkout develop
git merge feature/新功能名称
git push origin develop
# → Vercel 自动部署到开发环境

# 5. 在开发环境测试
# 访问 https://haigoo-dev.vercel.app 进行测试

# 6. 测试通过后，合并到 main（触发生产环境部署）
git checkout main
git merge develop
git push origin main
# → Vercel 自动部署到生产环境
```

### 紧急修复流程（Hotfix）

```bash
# 1. 从 main 创建 hotfix 分支
git checkout main
git checkout -b hotfix/修复问题描述

# 2. 修复并提交
git add .
git commit -m "fix: 修复紧急问题"

# 3. 合并回 main 和 develop
git checkout main
git merge hotfix/修复问题描述
git push origin main

git checkout develop
git merge hotfix/修复问题描述
git push origin develop

# 4. 删除 hotfix 分支
git branch -d hotfix/修复问题描述
```

---

## 🔧 Vercel 配置

### `vercel.json` 配置（保持不变）

当前的 `vercel.json` 配置对两个环境都适用，不需要修改。

### Vercel Dashboard 设置

#### 1. **Project Settings → Git**

**Production Branch (生产分支)**
```
Branch: main
```

**Preview Deployments (预览部署)**
```
✅ Enable automatic deployments for all branches
Branch: develop (设为主要预览分支)
```

#### 2. **Project Settings → Domains**

配置自定义域名（可选）：
- Production: `haigoo.com` → 指向 main 分支
- Development: `dev.haigoo.com` → 指向 develop 分支

#### 3. **Project Settings → Environment Variables**

按照上面的表格配置所有环境变量，确保：
- 生产变量只在 `Production` 环境生效
- 开发变量只在 `Preview` 环境生效

---

## 📊 环境检测代码

### 创建环境配置文件

```typescript
// config/environment.ts
export const ENV = {
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
  apiUrl: process.env.SITE_URL || 'http://localhost:3000',
  redisUrl: process.env.REDIS_URL,
  jwtSecret: process.env.JWT_SECRET,
}

// 获取当前环境名称
export const getEnvironmentName = () => {
  if (ENV.isProduction) return 'Production'
  if (ENV.isDevelopment) return 'Development'
  return 'Local'
}

// 打印环境信息（仅在非生产环境）
if (!ENV.isProduction) {
  console.log(`[Environment] Running in ${getEnvironmentName()} mode`)
  console.log(`[Environment] API URL: ${ENV.apiUrl}`)
}
```

### 在 API 中使用环境配置

```javascript
// api/health.js
import { getEnvironmentName } from '../config/environment'

export default async function handler(req, res) {
  const healthStatus = {
    status: 'healthy',
    environment: getEnvironmentName(),
    timestamp: new Date().toISOString(),
    // ... 其他信息
  }
  res.status(200).json(healthStatus)
}
```

---

## 🧪 测试策略

### 开发环境测试清单

在每次合并到 `main` 前，必须在开发环境完成以下测试：

- [ ] **用户认证**
  - [ ] 邮箱注册 + 验证
  - [ ] Google OAuth 登录
  - [ ] 登出功能
  - [ ] Token 刷新

- [ ] **简历管理**
  - [ ] 上传简历（PDF/DOCX/TXT）
  - [ ] 简历解析准确性
  - [ ] 简历列表显示
  - [ ] 简历删除

- [ ] **职位功能**
  - [ ] 职位列表加载
  - [ ] 职位详情查看
  - [ ] 职位收藏
  - [ ] 职位申请

- [ ] **个人资料**
  - [ ] 资料编辑保存
  - [ ] 头像上传
  - [ ] 导航栏跳转

- [ ] **数据持久化**
  - [ ] Redis 存储验证
  - [ ] 刷新页面数据保持
  - [ ] 跨设备数据同步

---

## 🔒 安全注意事项

1. **永远不要**在代码中硬编码敏感信息
2. **永远不要**将 `.env` 文件提交到 Git
3. **定期轮换** JWT_SECRET 和 API 密钥
4. **生产环境**的数据库凭证必须与开发环境完全不同
5. **开发环境**可以使用测试邮箱服务（如 Mailtrap）
6. **定期备份**生产环境的 Redis 数据

---

## 📈 监控和日志

### 开发环境

- 详细日志输出（包括调试信息）
- Vercel 函数日志保留 7 天
- 错误堆栈完整显示

### 生产环境

- 仅输出关键日志（警告和错误）
- Vercel 函数日志保留 30 天
- 错误信息脱敏处理

---

## 🚦 环境切换命令

### 快速切换分支

```bash
# 切换到开发环境
alias dev="git checkout develop && git pull origin develop"

# 切换到生产环境
alias prod="git checkout main && git pull origin main"

# 查看当前环境
alias env="git branch --show-current"
```

---

## 📝 变更记录

| 日期 | 版本 | 变更内容 | 负责人 |
|------|------|----------|--------|
| 2024-01-XX | 1.0 | 初始版本，定义双环境策略 | Team |

---

## 🆘 常见问题

### Q1: 如何区分当前访问的是哪个环境？

**A**: 在前端添加环境标识：

```typescript
// 在页面底部或控制台显示
if (process.env.NODE_ENV !== 'production') {
  console.log('🔧 当前环境: 开发环境')
  // 可选：在页面角落显示环境标识
}
```

### Q2: 开发环境的数据会影响生产环境吗？

**A**: 不会。两个环境使用完全独立的：
- Redis 实例
- Vercel KV 存储
- 数据库连接
- JWT 密钥

### Q3: 如何在本地测试开发环境的代码？

**A**: 
```bash
# 1. 切换到 develop 分支
git checkout develop

# 2. 安装依赖
npm install

# 3. 复制环境变量（使用开发环境配置）
cp .env.development.example .env.local

# 4. 启动本地服务器
npm run dev
```

### Q4: 紧急修复应该直接改 main 吗？

**A**: 不建议。应该：
1. 创建 `hotfix/*` 分支
2. 修复问题
3. 同时合并到 `main` 和 `develop`
4. 确保两个环境保持同步

---

## ✅ 实施检查清单

### 初始设置

- [ ] 创建 `develop` 分支
- [ ] 配置 Vercel 双环境部署
- [ ] 设置生产环境变量（Production）
- [ ] 设置开发环境变量（Preview）
- [ ] 创建生产 Redis 实例
- [ ] 创建开发 Redis 实例
- [ ] 配置 Vercel KV（生产和开发）
- [ ] 设置自定义域名（可选）
- [ ] 配置 Git 分支保护规则
- [ ] 测试开发环境部署
- [ ] 测试生产环境部署
- [ ] 验证数据隔离
- [ ] 更新团队文档

---

**注意**: 本策略应定期审查和更新，确保符合项目发展需求。

