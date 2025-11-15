# Vercel 预发环境配置 - 快速指南

## 🎯 核心问题

**症状**: 预发环境（Preview）的后端API无法正常工作，翻译功能失效

**根本原因**: Vercel环境变量未为Preview环境单独配置

---

## ✅ 解决方案（5分钟完成）

### 第1步：登录Vercel Dashboard

```
https://vercel.com/dashboard
→ 选择项目
→ Settings → Environment Variables
```

---

### 第2步：添加Preview环境变量

添加以下两个**必需**变量：

| 变量名 | 值 | 环境选择 |
|--------|-----|----------|
| `ENABLE_AUTO_TRANSLATION` | `true` | ☑️ Preview ☑️ Development |
| `CRON_SECRET` | `any-secret-string` | ☑️ Preview ☑️ Development |

**重要**：
- 确保勾选 **Preview** 和 **Development** 复选框
- **不要** 勾选 Production（生产环境单独配置）
- 值必须是字符串 `"true"`，不是布尔值

---

### 第3步：重新部署

**方式A（推荐）**: Vercel Dashboard手动重新部署
```
Deployments → 找到最新的Preview部署 → 点击 "Redeploy"
```

**方式B**: 推送空提交触发自动部署
```bash
git checkout develop
git commit --allow-empty -m "chore: trigger redeploy for preview env vars"
git push origin develop
```

---

### 第4步：验证配置

访问健康检查API（替换为你的实际URL）：
```
https://你的项目名-git-develop-你的用户名.vercel.app/api/health
```

**检查关键字段**：
```json
{
  "environment": {
    "name": "Preview",          // ✅ 必须是 "Preview"
    "isPreview": true           // ✅ 必须是 true
  },
  "features": {
    "autoTranslation": true,    // ✅ 必须是 true
    "cronSecret": true          // ✅ 必须是 true
  },
  "recommendations": []         // ✅ 必须为空（无警告）
}
```

---

## 🧪 功能测试

### 1. 测试后端翻译

访问管理后台：
```
https://你的预发域名/admin_team
→ 职位数据 → 处理后数据
→ 点击 "翻译数据" 按钮
→ 应显示翻译成功的统计
```

### 2. 测试前端展示

访问前台页面：
```
https://你的预发域名/
→ 推荐页面和全部岗位页面
→ 应显示中文翻译的内容
```

---

## 🔍 快速诊断

### 问题诊断流程图

```
访问 /api/health
    ↓
autoTranslation = true?
    ├─ NO → 环境变量未配置或未生效
    │        → 检查Vercel环境变量
    │        → 确认勾选了Preview环境
    │        → 重新部署
    └─ YES → 环境变量配置正确
              ↓
         前台显示中文?
              ├─ NO → 后端未翻译数据
              │        → 手动触发翻译
              │        → POST /api/cron/sync-jobs
              └─ YES → ✅ 一切正常！
```

---

## 📚 相关文档

- **详细配置指南**: [PREVIEW_ENVIRONMENT_SETUP.md](./PREVIEW_ENVIRONMENT_SETUP.md)
- **快速诊断脚本**: [QUICK_ENV_CHECK.md](./QUICK_ENV_CHECK.md)
- **双环境部署策略**: [DEPLOYMENT_STRATEGY.md](./DEPLOYMENT_STRATEGY.md)

---

## ❓ 常见问题

**Q: 为什么需要单独配置Preview环境？**

A: Vercel将环境分为Production、Preview、Development三类，每个环境的变量独立。即使配置了Production的变量，Preview环境也不会自动继承。

---

**Q: 配置后仍不生效怎么办？**

A: 
1. 确认已重新部署（环境变量修改后必须重新部署）
2. 清空浏览器缓存
3. 检查 `/api/health` 确认变量是否生效

---

**Q: 需要配置存储（Redis/KV）吗？**

A: 
- **可选**但推荐
- 不配置：数据存储在内存中，服务重启后丢失
- 配置后：数据持久化，更接近生产环境

---

**Q: Preview和Production可以共用环境变量吗？**

A: 
- **不推荐**
- 应该使用独立的存储实例和密钥
- 避免测试数据污染生产环境

---

## ✨ 最佳实践

### 推荐的环境变量配置

| 变量 | Production | Preview | Development |
|------|-----------|---------|-------------|
| `ENABLE_AUTO_TRANSLATION` | ✅ `true` | ✅ `true` | ✅ `true` |
| `CRON_SECRET` | ✅ `prod_secret` | ✅ `preview_secret` | ✅ `dev_secret` |
| `KV_REST_API_URL` | ✅ 生产KV | ✅ 预发KV | ❌ |
| `KV_REST_API_TOKEN` | ✅ 生产Token | ✅ 预发Token | ❌ |

---

**配置完成后，预发环境和生产环境将完全独立运行，互不干扰！** ✅