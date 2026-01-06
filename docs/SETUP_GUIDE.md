# Haigoo 双环境设置指南

## 🎯 目标

建立两套完全隔离的线上环境：
- **开发环境**: 用于测试新功能，数据可以随意修改
- **生产环境**: 真实用户使用，数据需要保护

---

## 📋 实施步骤

### 第一步：创建 develop 分支

```bash
# 在项目根目录执行
cd /Users/caitlinyct/Haigoo_Admin/Haigoo_assistant

# 创建并切换到 develop 分支
git checkout -b develop

# 推送到远程仓库
git push -u origin develop
```

### 第二步：配置 Vercel 项目

#### 1. 登录 Vercel Dashboard
访问: https://vercel.com/dashboard

#### 2. 进入项目设置
点击项目 → Settings

#### 3. 配置 Git 集成（Settings → Git）

**Production Branch (生产分支)**
```
Branch Name: main
```

**Preview Deployments (预览部署)**
```
☑️ Enable Automatic Deployments for All Branches
☑️ Deploy from the "develop" branch
```

#### 4. 配置环境变量（Settings → Environment Variables）

点击 "Add New" 按钮，为每个环境分别配置：

##### **生产环境变量**

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `NODE_ENV` | `production` | ☑️ Production |
| `REDIS_URL` | (生产Redis URL) | ☑️ Production |
| `JWT_SECRET` | (生产强密钥) | ☑️ Production |
| `GOOGLE_CLIENT_ID` | (生产OAuth ID) | ☑️ Production |
| ... | ... | ☑️ Production |

##### **开发环境变量**

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `NODE_ENV` | `development` | ☑️ Preview |
| `REDIS_URL` | (开发Redis URL) | ☑️ Preview |
| `JWT_SECRET` | (开发密钥) | ☑️ Preview |
| `GOOGLE_CLIENT_ID` | (开发OAuth ID) | ☑️ Preview |
| ... | ... | ☑️ Preview |

**重要提示**:
- 生产环境只勾选 "Production"
- 开发环境只勾选 "Preview"
- 两个环境使用完全不同的值

### 第三步：创建独立的数据库实例

#### Upstash Redis（推荐）

1. 访问 https://console.upstash.com/
2. 创建两个数据库：
   - `haigoo-production` (生产环境)
   - `haigoo-development` (开发环境)
3. 复制各自的 `REDIS_URL` 到 Vercel 环境变量

#### Vercel KV（可选）

1. 在 Vercel Dashboard → Storage → Create Database
2. 创建两个 KV 存储：
   - `haigoo-kv-production`
   - `haigoo-kv-development`
3. 将生产 KV 链接到 `Production` 环境
4. 将开发 KV 链接到 `Preview` 环境

### 第四步：配置 Google OAuth

#### 创建两个 OAuth 客户端

1. 访问 Google Cloud Console
2. 进入 APIs & Services → Credentials

#### 生产环境客户端

```
Name: Haigoo Production
Authorized JavaScript origins:
  - https://haigooremote.com
Authorized redirect URIs:
  - https://haigoo.vercel.app/api/auth/callback
```

#### 开发环境客户端

```
Name: Haigoo Development  
Authorized JavaScript origins:
  - https://haigoo-dev.vercel.app
  - https://haigoo-git-develop-xxx.vercel.app (Preview URL)
Authorized redirect URIs:
  - https://haigoo-dev.vercel.app/api/auth/callback
  - https://haigoo-git-develop-xxx.vercel.app/api/auth/callback
```

将各自的 Client ID 添加到对应的 Vercel 环境变量中。

### 第五步：测试部署

#### 测试开发环境

```bash
# 切换到 develop 分支
git checkout develop

# 进行一个小改动（如修改 README）
echo "# Development Test" >> README.md

# 提交并推送
git add .
git commit -m "test: 测试开发环境部署"
git push origin develop
```

等待 1-2 分钟，Vercel 会自动部署到开发环境。

访问 Vercel Dashboard 查看：
- Deployments 列表中应该有新的 Preview Deployment
- 环境标识为 "Preview"
- 分支显示为 "develop"

#### 测试生产环境

```bash
# 切换到 main 分支
git checkout main

# 合并 develop 的测试提交
git merge develop

# 推送到生产
git push origin main
```

Vercel 会自动部署到生产环境。

---

## 🔄 日常工作流程

### 开发新功能

```bash
# 1. 从 develop 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/新功能名称

# 2. 开发并提交
# ... 编写代码 ...
git add .
git commit -m "feat: 实现新功能"

# 3. 推送到 develop（自动部署到开发环境）
git checkout develop
git merge feature/新功能名称
git push origin develop

# 4. 在开发环境测试
# 访问 https://haigoo-dev.vercel.app 测试

# 5. 测试通过后，合并到 main（部署到生产）
git checkout main
git merge develop
git push origin main
```

### 查看部署状态

```bash
# 方法一：Vercel CLI（推荐）
vercel ls

# 方法二：访问 Vercel Dashboard
# https://vercel.com/dashboard
```

---

## 🧪 验证环境隔离

### 检查清单

- [ ] 两个环境使用不同的 Redis 实例
- [ ] 两个环境使用不同的 JWT_SECRET
- [ ] 两个环境使用不同的 Google OAuth Client ID
- [ ] 在开发环境注册的用户不会出现在生产环境
- [ ] 在开发环境上传的简历不会出现在生产环境
- [ ] 两个环境可以独立访问，互不影响

### 测试步骤

1. **测试用户数据隔离**
```bash
# 在开发环境注册账号 test@dev.com
# 访问 https://haigoo-dev.vercel.app
# 注册 → 登录 → 查看个人资料

# 在生产环境检查
# 访问 https://haigoo.vercel.app
# 尝试登录 test@dev.com （应该失败 - 用户不存在）
```

2. **测试简历数据隔离**
```bash
# 在开发环境上传测试简历
# 访问 https://haigoo-dev.vercel.app/resume
# 上传几份测试简历

# 在生产环境检查
# 访问 https://haigoo.vercel.app/resume
# 确认开发环境的简历不会显示
```

3. **测试环境标识**
```bash
# 访问开发环境健康检查
curl https://haigoo-dev.vercel.app/api/health
# 应该返回: "environment": "Development"

# 访问生产环境健康检查
curl https://haigoo.vercel.app/api/health
# 应该返回: "environment": "Production"
```

---

## 🎨 可选：添加环境标识

为了更容易区分当前环境，可以添加视觉标识：

### 方法一：在页面角落添加徽章

```typescript
// src/components/EnvironmentBadge.tsx
export default function EnvironmentBadge() {
  if (process.env.NODE_ENV === 'production') return null
  
  return (
    <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg z-50">
      🔧 开发环境
    </div>
  )
}
```

### 方法二：修改网站标题

```typescript
// index.html
<title>
  {process.env.NODE_ENV === 'production' ? 'Haigoo' : 'Haigoo (开发环境)'}
</title>
```

### 方法三：控制台日志

```typescript
// src/main.tsx
if (process.env.NODE_ENV !== 'production') {
  console.log(
    '%c🔧 开发环境',
    'background: #fbbf24; color: #000; font-size: 20px; padding: 10px;'
  )
}
```

---

## 🚨 常见问题

### Q1: 为什么我的环境变量没有生效？

**A**: 检查以下几点：
1. 在 Vercel Dashboard 中检查变量是否正确配置
2. 确认变量的 Environment 选择正确（Production 或 Preview）
3. 部署后需要重新部署才能生效
4. 使用 `vercel env pull` 拉取最新环境变量

### Q2: 如何查看当前部署的环境？

**A**: 
```bash
# 访问健康检查 API
curl https://your-deployment-url.vercel.app/api/health

# 或在浏览器控制台查看
fetch('/api/health').then(r => r.json()).then(console.log)
```

### Q3: 开发环境部署很慢怎么办？

**A**: 
- 开发环境每次 push 都会部署，这是正常的
- 如果不想某个提交触发部署，在提交信息中添加 `[skip ci]`
- 也可以在 Vercel 设置中关闭某些分支的自动部署

### Q4: 如何回滚到之前的版本？

**A**: 
1. 在 Vercel Dashboard → Deployments
2. 找到想要回滚的部署
3. 点击 "⋯" → "Promote to Production" (生产环境) 或 "Redeploy" (开发环境)

---

## 📚 相关文档

- [DEPLOYMENT_STRATEGY.md](./DEPLOYMENT_STRATEGY.md) - 完整的部署策略文档
- [UUID_SYSTEM_GUIDE.md](./UUID_SYSTEM_GUIDE.md) - 用户 UUID 系统指南
- [env.development.example](./env.development.example) - 开发环境变量示例
- [env.production.example](./env.production.example) - 生产环境变量示例

---

## ✅ 完成标志

当以下所有项都完成时，双环境配置就完成了：

- [x] ✅ 创建了 `develop` 分支
- [ ] ✅ 在 Vercel 配置了两套环境变量
- [ ] ✅ 创建了两套独立的 Redis 实例
- [ ] ✅ 配置了两套 Google OAuth 客户端
- [ ] ✅ 测试了开发环境部署
- [ ] ✅ 测试了生产环境部署
- [ ] ✅ 验证了数据隔离
- [ ] ✅ 团队成员都了解了工作流程

---

**注意**: 设置完成后，请务必验证两个环境的数据完全隔离，避免测试数据污染生产环境！