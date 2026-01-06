# 🔐 Google OAuth 配置指南 - Develop 环境

## 🎯 目标

为开发环境（Preview）配置 Google OAuth 登录功能，使用户可以在测试环境中使用 Google 账号登录。

---

## 📋 前提条件

✅ 已有 Google Cloud Project（如果还没有，请先创建）  
✅ 开发环境 URL: `https://haigoo-remote-git-develop-caitlinyct.vercel.app`  
✅ 生产环境 URL: `https://haigooremote.com`

---

## 🚀 快速配置（10分钟完成）

### 步骤 1: 访问 Google Cloud Console

1. 打开 [Google Cloud Console](https://console.cloud.google.com/)
2. 选择您的项目（或创建新项目）

### 步骤 2: 启用 Google+ API

1. 在左侧菜单中，点击 **"APIs & Services"** → **"Library"**
2. 搜索 **"Google+ API"**
3. 点击 **"Enable"**

### 步骤 3: 创建 OAuth 2.0 凭据

1. 在左侧菜单中，点击 **"APIs & Services"** → **"Credentials"**
2. 点击顶部的 **"+ CREATE CREDENTIALS"**
3. 选择 **"OAuth client ID"**

#### 配置 OAuth consent screen（首次需要）

如果提示配置同意屏幕：

1. 选择 **"External"**（外部用户）
2. 填写应用信息：
   - **App name**: Haigoo
   - **User support email**: 您的邮箱
   - **Developer contact**: 您的邮箱
3. 点击 **"Save and Continue"**
4. Scopes 页面：点击 **"Add or Remove Scopes"**
   - 选择: `email`, `profile`, `openid`
   - 点击 **"Update"** → **"Save and Continue"**
5. Test users: 添加您的测试邮箱（开发阶段需要）
6. 点击 **"Save and Continue"**

#### 创建 OAuth Client ID

1. **Application type**: 选择 **"Web application"**
2. **Name**: 输入 `Haigoo - All Environments`
3. **Authorized JavaScript origins**: 添加以下 URLs
```
http://localhost:3000
http://localhost:3001
https://haigoo.vercel.app
https://haigoo-remote-git-develop-caitlinyct.vercel.app
```

4. **Authorized redirect URIs**: 添加以下 URLs
```
http://localhost:3000
http://localhost:3001
https://haigoo.vercel.app
https://haigoo-remote-git-develop-caitlinyct.vercel.app
```

5. 点击 **"Create"**

### 步骤 4: 获取凭据

创建成功后，会显示：
- ✅ **Client ID**: `xxxxx.apps.googleusercontent.com`
- ✅ **Client Secret**: `xxxxxxxxxxxxxxx`

**⚠️ 重要**: 复制并保存这两个值！

---

## 🔧 配置 Vercel 环境变量

### 方法 A: 通过 Vercel Dashboard（推荐）

#### 为 Preview（Develop）环境配置

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 选择您的项目 `Haigoo_assistant`
3. 点击 **"Settings"** → **"Environment Variables"**
4. 添加以下变量：

| 变量名 | 值 | 环境 |
|--------|---|------|
| `GOOGLE_CLIENT_ID` | `xxxxx.apps.googleusercontent.com` | ✅ Preview |
| `GOOGLE_CLIENT_SECRET` | `xxxxxxxxxxxxxxx` | ✅ Preview |
| `VITE_GOOGLE_CLIENT_ID` | `xxxxx.apps.googleusercontent.com` | ✅ Preview |

**注意**: 
- 只勾选 **"Preview"** 环境
- 不要勾选 Production（生产环境已有配置）

#### 为 Production（生产）环境配置（如果还没有）

| 变量名 | 值 | 环境 |
|--------|---|------|
| `GOOGLE_CLIENT_ID` | `xxxxx.apps.googleusercontent.com` | ✅ Production |
| `GOOGLE_CLIENT_SECRET` | `xxxxxxxxxxxxxxx` | ✅ Production |
| `VITE_GOOGLE_CLIENT_ID` | `xxxxx.apps.googleusercontent.com` | ✅ Production |

### 方法 B: 通过 Vercel CLI

```bash
cd /Users/caitlinyct/Haigoo_Admin/Haigoo_assistant

# 为 Preview 环境添加
vercel env add GOOGLE_CLIENT_ID preview
# 输入: xxxxx.apps.googleusercontent.com

vercel env add GOOGLE_CLIENT_SECRET preview
# 输入: xxxxxxxxxxxxxxx

vercel env add VITE_GOOGLE_CLIENT_ID preview
# 输入: xxxxx.apps.googleusercontent.com

# 为 Production 环境添加（如果需要）
vercel env add GOOGLE_CLIENT_ID production
vercel env add GOOGLE_CLIENT_SECRET production
vercel env add VITE_GOOGLE_CLIENT_ID production
```

---

## 🔄 重新部署

配置完环境变量后，需要重新部署才能生效：

### 方法 A: 推送代码触发部署

```bash
cd /Users/caitlinyct/Haigoo_Admin/Haigoo_assistant

# 确保在 develop 分支
git checkout develop

# 提交性能优化的改动
git add -A
git commit -m "feat: 性能优化 - 限制职位加载数量，配置 Google OAuth"
git push origin develop
```

### 方法 B: 通过 Vercel Dashboard 手动重新部署

1. 访问 Vercel Dashboard
2. 进入您的项目
3. 找到最新的 Preview 部署
4. 点击右侧的 **"..."** → **"Redeploy"**
5. 勾选 **"Use existing Build Cache"**（可选）
6. 点击 **"Redeploy"**

---

## ✅ 验证配置

### 1. 检查环境变量

部署完成后，访问：
```
https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/health
```

查看响应中的 `googleOAuth` 字段：
```json
{
  "status": "healthy",
  "environment": "Development",
  "auth": {
    "googleOAuth": {
      "configured": true  // ✅ 应该是 true
    }
  }
}
```

### 2. 测试登录功能

1. 访问登录页面：
```
https://haigoo-remote-git-develop-caitlinyct.vercel.app/login
```

2. 点击 **"使用 Google 登录"**

3. 应该会：
   - ✅ 跳转到 Google 登录页面
   - ✅ 选择账号后成功登录
   - ✅ 返回到首页，显示用户信息

### 3. 测试注册功能

1. 访问注册页面：
```
https://haigoo-remote-git-develop-caitlinyct.vercel.app/register
```

2. 使用邮箱注册或 Google 登录

3. 应该成功创建账号

---

## 🐛 常见问题排查

### 问题 1: "Google 登录功能开发中"提示

**原因**: 前端检测到 `GOOGLE_CLIENT_ID` 未配置

**解决方案**:
1. 确认 Vercel 环境变量中有 `VITE_GOOGLE_CLIENT_ID`
2. 重新部署应用
3. 清除浏览器缓存并刷新

### 问题 2: "redirect_uri_mismatch" 错误

**原因**: Google OAuth 配置中的 Redirect URI 不匹配

**解决方案**:
1. 返回 Google Cloud Console
2. 编辑 OAuth Client ID
3. 确认 **Authorized redirect URIs** 包含：
```
https://haigoo-remote-git-develop-caitlinyct.vercel.app
```
4. 保存后等待 5 分钟生效

### 问题 3: "Access blocked: This app's request is invalid"

**原因**: OAuth consent screen 配置不完整

**解决方案**:
1. 返回 Google Cloud Console
2. 进入 **"OAuth consent screen"**
3. 确认已添加 `email`, `profile`, `openid` scopes
4. 在 Test users 中添加您的邮箱
5. 保存后重试

### 问题 4: "idpiframe_initialization_failed"

**原因**: 第三方 Cookie 被浏览器阻止

**解决方案**:
1. 在 Chrome 中打开设置
2. 搜索 "Cookie"
3. 允许第三方 Cookie（至少对 Google 域名）
4. 或使用隐私模式测试

---

## 📊 配置清单

完成配置后，请确认以下各项：

- [ ] Google Cloud Project 已创建
- [ ] Google+ API 已启用
- [ ] OAuth Client ID 已创建
- [ ] Authorized JavaScript origins 包含开发环境 URL
- [ ] Authorized redirect URIs 包含开发环境 URL
- [ ] Vercel Preview 环境变量已配置：
  - [ ] `GOOGLE_CLIENT_ID`
  - [ ] `GOOGLE_CLIENT_SECRET`
  - [ ] `VITE_GOOGLE_CLIENT_ID`
- [ ] 应用已重新部署
- [ ] `/api/health` 显示 `googleOAuth.configured: true`
- [ ] 登录功能测试通过
- [ ] 注册功能测试通过

---

## 💡 最佳实践

### 安全建议

1. **不要提交凭据到代码库**
```bash
# 确认 .gitignore 包含
.env
.env.local
.env.*.local
```

2. **定期轮换 Client Secret**
   - 每 3-6 个月更换一次
   - 如果怀疑泄露，立即更换

3. **限制 OAuth Scopes**
   - 只请求必需的权限（email, profile）
   - 不要请求不必要的敏感权限

### 开发建议

1. **使用统一的 OAuth Client**
   - 所有环境（local, preview, production）使用同一个 Client ID
   - 简化管理和维护

2. **添加测试用户**
   - 在 OAuth consent screen 的 Test users 中添加团队成员邮箱
   - 开发阶段限制只有测试用户可以登录

3. **监控使用情况**
   - 在 Google Cloud Console 查看 API 使用量
   - 设置配额和预警

---

## 🚀 完成！

配置完成后，开发环境现在应该可以：

✅ 使用 Google 账号登录  
✅ 使用邮箱注册  
✅ 发送验证邮件（如果配置了 SMTP）  
✅ 正常管理用户会话  

---

## 📞 需要帮助？

如果遇到问题：

1. 检查 Vercel 部署日志
```
vercel logs <deployment-url>
```

2. 检查浏览器控制台（F12）的错误信息

3. 查看本文档的"常见问题排查"部分

4. 参考官方文档：
   - [Google OAuth 2.0 文档](https://developers.google.com/identity/protocols/oauth2)
   - [Vercel 环境变量文档](https://vercel.com/docs/concepts/projects/environment-variables)

---

**祝配置顺利！** 🎉