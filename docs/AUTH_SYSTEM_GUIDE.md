# Haigoo 用户认证系统文档

本文档介绍 Haigoo 平台的完整用户认证系统，包括前端界面、后端API、数据存储和部署配置。

---

## 📋 目录

1. [系统概述](#系统概述)
2. [技术栈](#技术栈)
3. [功能特性](#功能特性)
4. [文件结构](#文件结构)
5. [环境配置](#环境配置)
6. [本地开发](#本地开发)
7. [生产部署](#生产部署)
8. [API文档](#api文档)
9. [前端使用](#前端使用)
10. [安全考虑](#安全考虑)

---

## 🎯 系统概述

Haigoo 用户认证系统提供完整的用户注册、登录、身份验证和授权功能，支持：

- **邮箱 + 密码** 注册和登录
- **Google OAuth** 快速登录（需配置）
- **邮箱验证** 提升账户安全性
- **JWT Token** 无状态认证
- **路由守卫** 保护需要登录的页面
- **随机头像生成** 使用 DiceBear API
- **简历信息自动提取** 完善用户资料

---

## 🛠️ 技术栈

### 后端
- **Node.js 20.x**
- **bcryptjs** - 密码加密
- **jsonwebtoken** - JWT token 生成和验证
- **nodemailer** - 邮箱验证邮件发送
- **google-auth-library** - Google OAuth 验证
- **Redis / Vercel KV** - 用户数据存储

### 前端
- **React 18** + **TypeScript**
- **React Router** - 路由管理
- **Context API** - 全局认证状态管理
- **localStorage** - 本地token持久化

---

## ✨ 功能特性

### 1. 用户注册
- ✅ 邮箱 + 密码注册
- ✅ 密码强度验证（至少8位，包含字母和数字）
- ✅ 邮箱格式验证
- ✅ 重复邮箱检测
- ✅ 随机用户名生成（可选自定义）
- ✅ 随机头像生成
- ✅ 邮箱验证邮件发送

### 2. 用户登录
- ✅ 邮箱 + 密码登录
- ✅ Google OAuth 登录（需配置 `GOOGLE_CLIENT_ID`）
- ✅ 登录状态持久化（localStorage）
- ✅ 自动刷新用户信息

### 3. 身份验证
- ✅ JWT Token 认证（30天有效期）
- ✅ Token 自动验证和刷新
- ✅ 路由守卫保护（`ProtectedRoute` 组件）
- ✅ 未登录自动跳转登录页

### 4. 用户资料
- ✅ 查看和编辑个人信息
- ✅ 从简历自动提取信息（姓名、职位、地点等）
- ✅ 头像显示和更新

### 5. 邮箱验证
- ✅ 注册后发送验证邮件
- ✅ 验证链接点击验证
- ✅ 重新发送验证邮件
- ✅ 验证令牌过期检测（15分钟）

---

## 📂 文件结构

```
Haigoo_assistant/
├── api/
│   ├── auth/
│   │   ├── register.js         # 用户注册 API
│   │   ├── login.js            # 用户登录 API
│   │   ├── google.js           # Google OAuth API
│   │   ├── verify-email.js     # 邮箱验证 API
│   │   ├── resend-verification.js  # 重发验证邮件 API
│   │   ├── me.js               # 获取当前用户 API
│   │   └── update-profile.js   # 更新用户资料 API
│   └── utils/
│       ├── auth-helpers.js     # JWT、密码加密等辅助函数
│       ├── user-storage.js     # 用户数据存储服务
│       └── email-service.js    # 邮件发送服务
├── src/
│   ├── contexts/
│   │   └── AuthContext.tsx     # 认证状态管理Context
│   ├── components/
│   │   ├── ProtectedRoute.tsx  # 路由守卫组件
│   │   └── Header.tsx          # 导航栏（集成登录状态）
│   ├── pages/
│   │   ├── LoginPage.tsx       # 登录页面
│   │   └── RegisterPage.tsx    # 注册页面
│   └── types/
│       └── auth-types.ts       # 认证相关TypeScript类型
├── vercel.json                 # Vercel部署配置（包含认证API）
├── server.js                   # 本地开发服务器（包含认证API模拟）
└── AUTH_SYSTEM_README.md       # 本文档
```

---

## ⚙️ 环境配置

### 必需环境变量（生产环境）

在 Vercel Dashboard 或 `.env.local` 中配置：

```bash
# Redis 存储（优先）
REDIS_URL=redis://...
# 或者使用 Vercel KV
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...

# JWT 密钥（必须）
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# SMTP 邮件服务（用于邮箱验证，可选）
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@haigoo.com
FROM_NAME=Haigoo Team

# Google OAuth（可选）
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# 网站URL（用于邮箱验证链接）
SITE_URL=https://haigooremote.com
```

### Google OAuth 配置步骤

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 **Google+ API**
4. 创建 **OAuth 2.0 客户端ID**
   - 应用类型：Web应用
   - 授权重定向URI：`https://haigooremote.com`
5. 复制 **客户端ID** 到 `GOOGLE_CLIENT_ID` 环境变量

### Gmail SMTP 配置（用于邮箱验证）

1. 登录 Gmail 账户
2. 启用 **两步验证**
3. 生成 **应用专用密码**
   - 访问：https://myaccount.google.com/apppasswords
   - 选择应用：邮件
   - 选择设备：其他（自定义）
   - 输入名称：Haigoo
4. 复制生成的16位密码到 `SMTP_PASS`

---

## 🚀 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
# 启动后端开发服务器（端口 3001）
npm run dev

# 在另一个终端启动前端（端口 5173）
npm run dev
```

### 3. 访问应用

```
前端：http://localhost:5173
后端：http://localhost:3001
```

### 4. 测试认证功能

1. 访问 `http://localhost:5173/register` 注册账户
2. 注册成功后自动登录
3. 查看用户下拉菜单显示用户信息
4. 访问 `/profile` 测试路由守卫
5. 点击"退出登录"测试登出功能

**注意：** 本地开发环境使用内存存储，重启服务器后数据会丢失。邮件服务在本地不会真实发送，只会在控制台打印。

---

## 🌐 生产部署

### 1. 配置环境变量

在 Vercel Dashboard 的项目设置中添加所有必需的环境变量（见上方"环境配置"）。

### 2. 部署到 Vercel

```bash
# 提交代码
git add .
git commit -m "feat: 实现完整用户认证系统"
git push origin main

# Vercel 自动部署
```

### 3. 验证部署

1. 访问 `https://haigoo.vercel.app/api/health`
   - 检查 `storage.redis.status: "connected"` 或 `storage.kv.status: "connected"`
2. 访问 `https://haigoo.vercel.app/register`
   - 注册测试账户
3. 检查 Redis/KV 中的用户数据
   - Key: `haigoo:user:{email}`

---

## 📡 API文档

### 1. 用户注册

**POST** `/api/auth/register`

**请求体：**
```json
{
  "email": "user@example.com",
  "password": "Password123",
  "username": "optional_username"
}
```

**响应：**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "username": "User_abc123",
    "avatar": "https://api.dicebear.com/...",
    "emailVerified": false,
    "createdAt": "2025-11-07T...",
    "status": "active"
  },
  "message": "注册成功！请查收验证邮件"
}
```

### 2. 用户登录

**POST** `/api/auth/login`

**请求体：**
```json
{
  "email": "user@example.com",
  "password": "Password123"
}
```

**响应：**
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": { ... },
  "message": "登录成功"
}
```

### 3. Google OAuth 登录

**POST** `/api/auth/google`

**请求体：**
```json
{
  "idToken": "google_id_token_from_frontend"
}
```

**响应：** 同登录接口

### 4. 获取当前用户

**GET** `/api/auth/me`

**请求头：**
```
Authorization: Bearer {token}
```

**响应：**
```json
{
  "success": true,
  "user": { ... }
}
```

### 5. 更新用户资料

**PATCH** `/api/auth/update-profile`

**请求头：**
```
Authorization: Bearer {token}
```

**请求体：**
```json
{
  "username": "NewUsername",
  "fullName": "张三",
  "title": "前端工程师",
  "location": "北京",
  "targetRole": "高级前端工程师",
  "phone": "13800138000",
  "bio": "热爱编程..."
}
```

### 6. 验证邮箱

**POST** `/api/auth/verify-email`

**请求体：**
```json
{
  "email": "user@example.com",
  "token": "verification_token_from_email"
}
```

### 7. 重新发送验证邮件

**POST** `/api/auth/resend-verification`

**请求体：**
```json
{
  "email": "user@example.com"
}
```

---

## 💻 前端使用

### 1. 使用 AuthContext

```tsx
import { useAuth } from '../contexts/AuthContext'

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth()
  
  if (!isAuthenticated) {
    return <div>请先登录</div>
  }
  
  return (
    <div>
      <h1>欢迎，{user?.username}！</h1>
      <button onClick={logout}>退出登录</button>
    </div>
  )
}
```

### 2. 保护路由

```tsx
import ProtectedRoute from './components/ProtectedRoute'

<Route path="/profile" element={
  <ProtectedRoute>
    <ProfilePage />
  </ProtectedRoute>
} />
```

### 3. 登录和注册

```tsx
import { useAuth } from '../contexts/AuthContext'

function LoginForm() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = await login(email, password)
    if (result.success) {
      // 登录成功，跳转
    } else {
      // 显示错误
      alert(result.error)
    }
  }
  
  return <form onSubmit={handleSubmit}>...</form>
}
```

---

## 🔒 安全考虑

### 已实施的安全措施

1. ✅ **密码加密**：使用 bcryptjs 进行哈希（10轮）
2. ✅ **JWT Token**：30天有效期，存储在 localStorage
3. ✅ **密码强度验证**：前后端双重验证
4. ✅ **邮箱验证**：防止恶意注册
5. ✅ **CORS 配置**：限制跨域请求
6. ✅ **输入验证**：邮箱格式、密码强度等
7. ✅ **Token 过期检测**：自动清除无效认证状态

### 建议的进一步安全措施

1. ⚠️ **刷新Token机制**：实现短期access token + 长期refresh token
2. ⚠️ **速率限制**：防止暴力破解（可使用 Vercel Rate Limiting）
3. ⚠️ **HTTPS Only**：生产环境强制 HTTPS
4. ⚠️ **CSRF保护**：对于状态改变的操作添加CSRF token
5. ⚠️ **密码重置**：添加"忘记密码"功能
6. ⚠️ **多因素认证（MFA）**：增强账户安全性
7. ⚠️ **审计日志**：记录所有登录和敏感操作

---

## 📝 常见问题

### Q: 为什么登录后刷新页面会自动登出？

A: 检查浏览器的localStorage是否被清除。正常情况下，token会持久化到localStorage中，刷新后会自动恢复登录状态。

### Q: Google 登录无法使用？

A: 确保已配置 `GOOGLE_CLIENT_ID` 环境变量，并且前端集成了 Google OAuth SDK。本系统已提供后端验证逻辑，前端需添加 Google Sign-In 按钮。

### Q: 邮箱验证邮件未收到？

A: 检查 SMTP 配置是否正确，查看服务器日志确认邮件是否发送成功。Gmail用户需使用"应用专用密码"而非账户密码。

### Q: 本地开发时如何测试邮箱验证？

A: 本地开发环境不会真实发送邮件，验证token会打印在控制台中。可以手动调用 `/api/auth/verify-email` 进行验证。

### Q: 如何查看存储的用户数据？

A: 
- **本地**：用户数据存储在内存中，重启服务器会丢失
- **Vercel**：使用 Redis CLI 或 Vercel KV Dashboard 查看
  ```bash
  redis-cli -u $REDIS_URL
  GET haigoo:user:user@example.com
  ```

---

## 🎉 总结

Haigoo 用户认证系统现已完整实现，提供安全、可靠的用户身份验证和授权功能。系统采用现代化的技术栈，支持多种登录方式，并具备良好的扩展性。

**下一步计划：**
- [ ] 实现密码重置功能
- [ ] 添加用户头像上传
- [ ] 集成多因素认证（MFA）
- [ ] 完善用户资料编辑界面
- [ ] 添加登录历史记录

如有问题或建议，欢迎提出 Issue！

