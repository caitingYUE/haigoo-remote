# 预发环境完整配置指南

## 📋 问题诊断

当前问题：
- ✅ 前端有预发环境（Preview Deployment）
- ❌ 后端API在预发环境无法正常工作
- **根本原因**：Vercel环境变量未为Preview环境配置

---

## 🎯 解决方案

### 核心概念

在Vercel中，每个项目有三种环境：
1. **Production** - 生产环境（main分支）
2. **Preview** - 预发环境（develop分支及其他分支）
3. **Development** - 本地开发环境

**关键点**：环境变量需要为每个环境单独配置！

---

## 🔐 必需的环境变量配置

### 步骤1：登录Vercel Dashboard

1. 访问：https://vercel.com/dashboard
2. 选择项目：`Haigoo_assistant` 或 `haigoo-remote`
3. 进入：**Settings** → **Environment Variables**

---

### 步骤2：为Preview环境配置关键变量

#### 2.1 翻译功能（最关键）

```bash
变量名: ENABLE_AUTO_TRANSLATION
值: true
环境: ☑️ Preview  ☑️ Development  (不要勾选 Production，Production单独配置)
```

#### 2.2 Cron任务密钥

```bash
变量名: CRON_SECRET
值: your-secure-cron-secret-for-preview  (建议与生产环境不同)
环境: ☑️ Preview  ☑️ Development
```

#### 2.3 数据存储（Redis/KV）- 可选但推荐

**选项A：使用Vercel KV（推荐）**

```bash
# 在Vercel Dashboard中创建新的KV存储
1. Storage → Create Database → KV
2. 名称: haigoo-preview-kv
3. 创建后会自动生成环境变量:
   - KV_REST_API_URL
   - KV_REST_API_TOKEN
4. 确保这些变量绑定到 Preview 环境
```

**选项B：使用Upstash Redis（推荐 REST 方式）**

```bash
# REST 方式（Vercel/无持久连接环境更稳定）
UPSTASH_REDIS_REST_URL=https://eu2-rest-YOURDB.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_UPSTASH_TOKEN
环境: ☑️ Preview  ☑️ Development

# 如需 TCP（不推荐在 Serverless/Edge 环境）
REDIS_URL=redis://preview-redis.upstash.io:6379
环境: 可选
```

#### 2.4 其他可选变量

```bash
# JWT密钥（如有用户认证）
变量名: JWT_SECRET
值: preview-jwt-secret-key-different-from-prod
环境: ☑️ Preview  ☑️ Development

# 网站URL（自动生成，一般不需要手动设置）
变量名: SITE_URL
值: https://haigoo-git-develop-your-team.vercel.app
环境: ☑️ Preview  ☑️ Development

# Google OAuth（如使用）
变量名: GOOGLE_CLIENT_ID
值: your-google-client-id
环境: ☑️ Preview  ☑️ Development  ☑️ Production
```

---

### 步骤3：环境变量配置检查表

在Vercel Dashboard中，确认以下配置：

| 变量名 | Production | Preview | Development | 备注 |
|--------|-----------|---------|-------------|------|
| `ENABLE_AUTO_TRANSLATION` | ✅ `true` | ✅ `true` | ✅ `true` | **必需** |
| `CRON_SECRET` | ✅ `prod_secret_xxx` | ✅ `preview_secret_xxx` | ✅ `dev_secret_xxx` | **必需** |
| `KV_REST_API_URL` | ✅ (生产KV) | ✅ (预发KV) | ❌ | 推荐 |
| `KV_REST_API_TOKEN` | ✅ (生产Token) | ✅ (预发Token) | ❌ | 推荐 |
| `UPSTASH_REDIS_REST_URL` | ✅ (生产) | ✅ (预发) | ✅ (开发) | 推荐 |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ (生产) | ✅ (预发) | ✅ (开发) | 推荐 |
| `REDIS_URL` | ✅ (生产Redis) | ✅ (预发Redis) | ❌ | 可选 |
| `JWT_SECRET` | ✅ (生产密钥) | ✅ (预发密钥) | ✅ (开发密钥) | 如有认证 |
| `GOOGLE_CLIENT_ID` | ✅ | ✅ | ✅ | 如有OAuth |

---

## 🚀 部署和测试流程

### 1. 配置环境变量后重新部署

```bash
# 方式1: 在Vercel Dashboard手动重新部署
Deployments → 找到最新的Preview部署 → 点击 "Redeploy"

# 方式2: 推送代码触发自动部署
git checkout develop
git commit --allow-empty -m "chore: trigger redeploy for env vars"
git push origin develop
```

### 2. 验证环境配置

访问预发环境的健康检查API：

```bash
# 替换为你的实际预发URL
curl https://haigoo-git-develop-your-team.vercel.app/api/health
```

**期望响应**：

```json
{
  "status": "healthy",
  "environment": "development",  // 或 "preview"
  "timestamp": "2025-11-12T...",
  "features": {
    "upstashRedisRest": true,   // 或 false
    "redis": false,             // 如使用 TCP 则为 true
    "vercelKV": false,          // 如使用 KV 则为 true
    "preferredTranslationProvider": "libretranslate"
  }
}
```

### 3. 测试后端翻译功能（LibreTranslate 优先，经 /api/translate 代理）

在预发环境的管理后台测试：

```bash
# 访问管理后台
https://haigoo-git-develop-your-team.vercel.app/admin_team

# 步骤：
1. 登录管理后台
2. 进入 "职位数据" → "处理后数据" 标签
3. 点击 "翻译数据" 按钮
4. 观察控制台日志和返回结果
5. 检查数据是否成功翻译为中文（响应头含 `X-Storage-Provider` 与 `X-Diag-Upstash-REST-Configured`）
```

### 4. 验证前端数据展示

```bash
# 访问前台页面
https://haigoo-git-develop-your-team.vercel.app/

# 检查：
1. 推荐页面是否显示翻译后的中文岗位
2. "全部岗位" 页面是否显示翻译后的中文岗位
3. 控制台是否有 "存储适配器未初始化" 等错误
4. 数据是否来自后端API（而非实时RSS拉取）
```

---

## 🐛 常见问题排查

### 问题1: 预发环境仍显示英文数据

**原因**：环境变量配置后未重新部署

**解决**：
```bash
# 在Vercel Dashboard中点击 Redeploy
# 或者推送一个空提交触发重新部署
git commit --allow-empty -m "chore: redeploy"
git push origin develop
```

---

### 问题2: 后台没有"翻译数据"按钮

**原因**：前端代码可能有缓存，或环境变量未生效

**解决**：
1. 清空浏览器缓存
2. 硬刷新（Ctrl+Shift+R 或 Cmd+Shift+R）
3. 检查控制台是否有JavaScript错误
4. 确认后端API `/api/data/processed-jobs` 返回正常

---

### 问题3: "存储适配器未初始化，无法加载数据"

**原因**：前端调度器被禁用后，存储适配器未正确初始化

**解决**：
- 这个错误是预期的，因为我们已经禁用了前端RSS拉取
- 只要后端API正常，前端页面就能正常显示数据
- 可以忽略这个控制台警告

---

### 问题4: Cron任务未执行

**原因**：
1. `CRON_SECRET` 未配置
2. Vercel Cron仅在Production环境自动执行
3. Preview环境需要手动触发

**解决**：
```bash
# Preview环境通过管理后台手动触发翻译
# 或通过API手动触发:
curl -X POST https://your-preview-url.vercel.app/api/cron/sync-jobs \
  -H "Content-Type: application/json"
```

---

## 📊 环境隔离验证

### 确认环境隔离

运行以下检查，确保生产和预发环境完全隔离：

```bash
# 生产环境健康检查
curl https://haigoo.vercel.app/api/health

# 预发环境健康检查
curl https://haigoo-git-develop-your-team.vercel.app/api/health

# 对比两者的环境标识和存储配置
```

**预期结果**：
- 生产环境显示 `"environment": "production"`
- 预发环境显示 `"environment": "development"` 或 `"preview"`
- 两者的存储配置应该不同（不同的Redis/KV实例）

---

## 🎯 快速配置模板

### 最小化配置（仅翻译功能）

如果只需要翻译功能正常工作，只配置以下两个变量：

```bash
ENABLE_AUTO_TRANSLATION=true  (Preview环境)
CRON_SECRET=any-secret-string  (Preview环境)
```

### 推荐配置（完整功能）

```bash
# 核心功能
ENABLE_AUTO_TRANSLATION=true
CRON_SECRET=preview-cron-secret-2024

# 翻译任务控制（新增，建议设置）
# 减少429与500：服务端串行请求，约18次/分钟
TRANSLATE_CONCURRENCY=1
TRANSLATE_REQUESTS_PER_MINUTE=18

# 内部鉴权（新增，可选）
# 设置后，后端调用 /api/translate 时将携带 Authorization 头，
# Edge 代理会跳过基于IP的限流，避免与浏览器用户混淆。
TRANSLATE_INTERNAL_SECRET=preview-internal-secret-2024

# 分页与保存分片（新增，可选）
# 每页拉取的岗位数量；建议 200。
CRON_PAGE_SIZE=200
# 每次保存的分片大小；建议从 100 开始，遇到 413 会自动缩小。
CRON_SAVE_CHUNK=100

# 数据存储（优先选择 Upstash REST 或 Vercel KV）
KV_REST_API_URL=https://...  (Vercel KV自动生成)
KV_REST_API_TOKEN=...  (Vercel KV自动生成)
# 或（推荐）
UPSTASH_REDIS_REST_URL=https://eu2-rest-YOURDB.upstash.io
UPSTASH_REDIS_REST_TOKEN=YOUR_UPSTASH_TOKEN
# 备用（如确有 TCP 需求）
REDIS_URL=redis://preview.upstash.io:6379

# 可选功能
JWT_SECRET=preview-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id
```

---

## 📝 配置完成后的检查清单

- [ ] 在Vercel Dashboard中配置了 `ENABLE_AUTO_TRANSLATION=true` for Preview
- [ ] 在Vercel Dashboard中配置了 `CRON_SECRET` for Preview
- [ ] 重新部署了Preview环境
- [ ] 访问 `/api/health` 确认环境识别正确
- [ ] 在管理后台测试了"翻译数据"功能
- [ ] 在前台验证了"推荐页面"显示中文数据
- [ ] 在前台验证了"全部岗位"页面显示中文数据
- [ ] 控制台无严重错误（可忽略"存储适配器未初始化"警告）
- [ ] 访问 `GET /api/cron/sync-jobs`（诊断）返回 `translationServiceType=real`
- [ ] `POST /api/cron/sync-jobs` 执行成功且统计中无大规模失败
- [ ] 若设置了 `TRANSLATE_INTERNAL_SECRET`，代理日志无 429（内部调用已绕过IP限流）

---

## 🔗 相关资源

- [Vercel环境变量文档](https://vercel.com/docs/projects/environment-variables)
- [Vercel预览部署文档](https://vercel.com/docs/deployments/preview-deployments)
- [项目双环境部署策略](./DEPLOYMENT_STRATEGY.md)

---

## 🆘 仍有问题？

### 调试步骤：

1. **检查环境变量是否生效**
   ```bash
   # 在 api/health.js 中临时添加：
   console.log('ENABLE_AUTO_TRANSLATION:', process.env.ENABLE_AUTO_TRANSLATION)
   console.log('VERCEL_ENV:', process.env.VERCEL_ENV)
   ```

2. **检查Vercel日志**
   - Vercel Dashboard → Deployments → 选择Preview部署 → Function Logs
   - 查看 `/api/cron/sync-jobs` 的执行日志

3. **检查前端控制台**
   - F12 打开开发者工具
   - 查看 Network 标签，确认API请求和响应
   - 查看 Console 标签，确认错误信息

---

**最后更新**: 2025-11-12
**适用版本**: Haigoo v2.0+
# 翻译服务提供商（可选覆盖）

```bash
# 默认优先 LibreTranslate，通过 /api/translate 代理
PREFERRED_TRANSLATION_PROVIDER=libretranslate

# 如需切换为 Google 或 MyMemory：
# PREFERRED_TRANSLATION_PROVIDER=google
# PREFERRED_TRANSLATION_PROVIDER=mymemory
```

### 强制启用/关闭 Mock 翻译（预发/调试用）

```bash
# 默认关闭；当设置为以下任意真值时，将强制使用 Mock：1/true/yes/on/mock
# 关闭时：系统会优先加载真实服务 lib/services/translation-service.cjs，失败才回退到 Mock
FORCE_MOCK_TRANSLATION=false
```

