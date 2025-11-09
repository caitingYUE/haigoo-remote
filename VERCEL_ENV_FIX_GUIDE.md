# Vercel 环境变量配置修正指南

## 🎯 问题说明

Vercel 自动为 Upstash 存储生成了环境变量，但变量名不符合我们代码中的预期。

**当前情况：**
- Vercel 生成的变量名：`pre_haigoo_REDIS_URL`（Preview）
- 代码中使用的变量名：`REDIS_URL`

**需要做的：**
- 统一变量名，确保代码能正确读取

---

## ✅ 解决方案：添加标准环境变量

### 第一步：进入环境变量设置

1. 在 Vercel Dashboard，点击项目
2. 进入 **Settings** → **Environment Variables**

### 第二步：添加 Preview 环境的 REDIS_URL

点击 **"Add New"** 按钮：

```
┌─────────────────────────────────────────────────┐
│ Key (required)                                  │
│ REDIS_URL                                      │
├─────────────────────────────────────────────────┤
│ Value (required)                                │
│ [点击 Reference Existing Variable]              │
│                                                 │
│ 在下拉框中选择：                                  │
│ pre_haigoo_REDIS_URL                           │
├─────────────────────────────────────────────────┤
│ Environment (required)                          │
│ ☐ Production                                   │
│ ☑ Preview          ← 只勾选这个                 │
│ ☐ Development                                  │
└─────────────────────────────────────────────────┘
```

点击 **"Save"**

### 第三步：添加 Production 环境的 REDIS_URL（如果还没有）

如果 Production 环境还没有 `REDIS_URL`，也需要添加：

**方法 A：如果生产环境的 Redis 也是通过 Vercel Storage 连接的**

点击 **"Add New"**：

```
Key: REDIS_URL
Value: [Reference Existing Variable] 选择生产环境的 Redis URL
Environment: ☑ Production (只勾选这个)
```

**方法 B：如果是手动创建的 Upstash Redis**

点击 **"Add New"**：

```
Key: REDIS_URL
Value: redis://default:你的密码@prod-xxxxx.upstash.io:6379
Environment: ☑ Production (只勾选这个)
```

### 第四步：验证配置

配置完成后，你应该在环境变量列表中看到：

```
REDIS_URL
├─ Production: redis://default:***@prod-xxxxx.upstash.io:6379 (或引用)
└─ Preview:    → pre_haigoo_REDIS_URL (引用)

pre_haigoo_REDIS_URL
└─ Preview:    redis://default:***@dev-xxxxx.upstash.io:6379

pre_haigoo_KV_REST_API_URL
└─ Preview:    https://...

pre_haigoo_KV_REST_API_TOKEN
└─ Preview:    ***
```

---

## 🌐 域名配置问题解决

### 问题：pre.haigoo 显示 Invalid Configuration

这个问题的原因是 **自定义域名需要 DNS 配置**。

### 解决方案 A：使用 Vercel 自动域名（推荐）

**不需要配置 DNS，最简单：**

1. 删除 `pre.haigoo` 域名配置
2. Vercel 会自动为 develop 分支生成预览域名：
   - `haigoo-git-develop-your-username.vercel.app`
   - 或者类似的格式

3. 每次推送到 develop 分支，访问这个自动生成的域名即可

**优点：**
- ✅ 无需配置 DNS
- ✅ 自动 HTTPS
- ✅ 立即可用

### 解决方案 B：配置自定义域名（需要 DNS 权限）

如果你确实想使用 `pre.haigoo`：

#### 1. 确认你拥有 haigoo 域名

首先确认你拥有 `haigoo` 这个域名（在域名注册商如 Namecheap、GoDaddy 等）

#### 2. 在 Vercel 中配置域名

在 Vercel Dashboard → Settings → Domains：

```
点击 "Edit" pre.haigoo
```

Vercel 会显示需要添加的 DNS 记录：

```
Type: CNAME
Name: pre
Value: cname.vercel-dns.com
```

#### 3. 在域名注册商添加 DNS 记录

登录你的域名注册商（如 Namecheap）：

1. 找到 DNS 设置
2. 添加新记录：
   ```
   Type: CNAME
   Host: pre
   Value: cname.vercel-dns.com
   TTL: Automatic
   ```

#### 4. 等待 DNS 生效

- DNS 生效通常需要 5-30 分钟
- 可以使用 `nslookup pre.haigoo` 检查是否生效

#### 5. 在 Vercel 点击 Refresh

DNS 生效后，在 Vercel Domains 页面点击 "Refresh"，状态应该变为 "Valid"

### 解决方案 C：先不配置域名，使用分支预览（最简单）

**推荐方案：暂时跳过自定义域名**

1. 删除 `pre.haigoo` 配置
2. 使用 Vercel 自动生成的预览 URL
3. 等项目稳定后再配置自定义域名

---

## 🧪 测试步骤

### 1. 创建 develop 分支（如果还没有）

```bash
cd /Users/caitlinyct/Haigoo_Admin/Haigoo_assistant

# 创建 develop 分支
git checkout -b develop

# 推送到远程
git push -u origin develop
```

### 2. 配置 Vercel Git 分支

在 Vercel Dashboard → Settings → Git：

```
Production Branch: main
```

确认 **"Automatic deployments from Git"** 已启用

### 3. 推送测试更改到 develop

```bash
# 确保在 develop 分支
git checkout develop

# 做一个小改动测试
echo "# Development Test" >> README.md

# 提交
git add .
git commit -m "test: 测试开发环境部署"

# 推送
git push origin develop
```

### 4. 查看部署状态

1. 在 Vercel Dashboard → Deployments
2. 应该看到新的部署记录
3. 环境标识为 **"Preview"**
4. 分支显示为 **"develop"**

### 5. 访问开发环境

点击部署记录，会看到访问 URL：
```
https://haigoo-git-develop-xxxxx.vercel.app
```

访问这个 URL，应该能看到你的应用

### 6. 测试 Redis 连接

访问健康检查接口：

```bash
curl https://haigoo-git-develop-xxxxx.vercel.app/api/health
```

**期望返回：**
```json
{
  "status": "healthy",
  "environment": "Development",
  "storage": {
    "redis": {
      "configured": true,
      "status": "connected"
    }
  }
}
```

### 7. 测试生产环境

```bash
# 切换到 main 分支
git checkout main

# 合并 develop（如果测试通过）
git merge develop

# 推送到生产
git push origin main
```

访问生产环境：
```
https://haigoo.vercel.app/api/health
```

**期望返回：**
```json
{
  "status": "healthy",
  "environment": "Production",
  "storage": {
    "redis": {
      "configured": true,
      "status": "connected"
    }
  }
}
```

---

## 📋 完整检查清单

### 环境变量配置

- [ ] 添加了 `REDIS_URL` 到 Preview 环境（引用 `pre_haigoo_REDIS_URL`）
- [ ] 添加了 `REDIS_URL` 到 Production 环境
- [ ] 验证了变量在正确的环境中

### Git 分支配置

- [ ] 创建了 `develop` 分支
- [ ] 推送了 `develop` 到远程
- [ ] Vercel 已识别 `develop` 分支

### 部署测试

- [ ] develop 分支推送触发了预览部署
- [ ] 可以访问预览 URL
- [ ] `/api/health` 返回正确的环境信息
- [ ] Redis 连接状态为 "connected"

### 数据隔离验证

- [ ] 在开发环境创建了测试数据
- [ ] 确认测试数据不出现在生产环境
- [ ] 两个环境可以独立访问

---

## 💡 建议的工作流程

### 日常开发

```bash
# 1. 切换到开发分支
git checkout develop

# 2. 创建功能分支
git checkout -b feature/新功能

# 3. 开发并提交
# ... 编写代码 ...
git add .
git commit -m "feat: 实现新功能"

# 4. 合并到 develop
git checkout develop
git merge feature/新功能

# 5. 推送（自动部署到开发环境）
git push origin develop

# 6. 在开发环境测试
# 访问 Vercel 提供的预览 URL

# 7. 测试通过后，合并到 main
git checkout main
git merge develop
git push origin main  # 部署到生产环境
```

---

## 🆘 常见问题

### Q1: 为什么要添加 REDIS_URL？

**A**: Vercel 自动生成的变量名（`pre_haigoo_REDIS_URL`）与我们代码中使用的变量名（`REDIS_URL`）不一致。通过引用的方式，我们可以：
- 保持代码不变
- 使用 Vercel 自动管理的连接信息
- 避免手动复制粘贴连接字符串

### Q2: 域名配置是必需的吗？

**A**: 不是。域名配置是可选的。使用 Vercel 自动生成的预览 URL 完全可以满足开发测试需求：
- 开发环境：`haigoo-git-develop-xxx.vercel.app`
- 生产环境：`haigoo.vercel.app`

等项目稳定后再配置自定义域名也不迟。

### Q3: 如何查看当前使用的是哪个 Redis？

**A**: 
1. 访问 `/api/health` 接口
2. 查看返回的 `environment` 字段
3. 在 Upstash 控制台查看各数据库的访问统计

### Q4: 两个环境会共享数据吗？

**A**: 不会。它们是完全独立的：
- 不同的 Upstash 数据库实例
- 不同的连接 URL
- 不同的存储空间
- 完全隔离

---

## 🎯 推荐的立即操作

### 最简单的方案（推荐）

1. **添加标准环境变量**（5分钟）
   - 添加 `REDIS_URL` (Preview) 引用 `pre_haigoo_REDIS_URL`
   - 添加 `REDIS_URL` (Production) 引用生产 Redis

2. **暂时删除自定义域名**（1分钟）
   - 删除 `pre.haigoo` 配置
   - 使用 Vercel 自动生成的 URL

3. **测试部署**（10分钟）
   - 推送代码到 develop
   - 访问预览 URL
   - 测试 `/api/health`

4. **验证隔离**（5分钟）
   - 在开发环境注册测试用户
   - 确认不出现在生产环境

### 之后再做（可选）

- 配置自定义域名（需要 DNS 权限）
- 添加更多环境变量
- 设置部署保护
- 配置监控告警

---

**下一步：** 按照上面的 "第一步" 添加 `REDIS_URL` 环境变量，然后测试部署。

有任何问题随时问我！🚀

