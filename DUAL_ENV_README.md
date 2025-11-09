# 🚀 双环境部署 - 快速开始

## 📖 文档导航

| 文档 | 用途 | 阅读时间 |
|------|------|----------|
| **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** | 📋 一步步设置指南 | 10分钟 |
| **[DEPLOYMENT_STRATEGY.md](./DEPLOYMENT_STRATEGY.md)** | 📚 完整部署策略 | 20分钟 |
| [env.development.example](./env.development.example) | 🔧 开发环境变量示例 | 2分钟 |
| [env.production.example](./env.production.example) | 🔐 生产环境变量示例 | 2分钟 |

---

## ⚡ 快速开始（5分钟）

### 1. 提交当前更改

```bash
chmod +x commit-dual-env.sh
./commit-dual-env.sh
```

### 2. 创建开发环境

```bash
chmod +x scripts/setup-dev-env.sh
./scripts/setup-dev-env.sh
```

### 3. 配置 Vercel

访问 https://vercel.com/dashboard，按照 [SETUP_GUIDE.md](./SETUP_GUIDE.md) 第二步配置。

### 4. 测试部署

```bash
# 推送到开发环境
git checkout develop
git push origin develop

# 查看部署状态
# 访问 https://vercel.com/dashboard
```

---

## 🎯 核心概念

### 两套环境

```
┌─────────────────────┐         ┌─────────────────────┐
│   开发环境 (Dev)      │         │   生产环境 (Prod)     │
│                     │         │                     │
│ 分支: develop       │         │ 分支: main          │
│ URL: *-dev.vercel   │         │ URL: haigoo.vercel  │
│ 数据: 开发 Redis     │         │ 数据: 生产 Redis     │
│ 用途: 测试新功能      │         │ 用途: 真实用户       │
└─────────────────────┘         └─────────────────────┘
```

### 工作流程

```
feature/* ──┐
            │
            ├─→ develop ──→ 【开发环境】测试 ──→ main ──→ 【生产环境】
            │
feature/* ──┘
```

---

## 📋 必读清单

开始前，请确保你已经：

- [ ] 阅读了 [SETUP_GUIDE.md](./SETUP_GUIDE.md)
- [ ] 理解了分支策略（main 和 develop）
- [ ] 准备好了两套独立的 Redis 实例
- [ ] 有 Vercel 项目的管理员权限
- [ ] 了解环境变量的配置方法

---

## 🔧 本地开发

```bash
# 1. 切换到开发分支
git checkout develop

# 2. 创建功能分支
git checkout -b feature/我的新功能

# 3. 开发...
# 编写代码

# 4. 测试
npm run dev  # 本地测试

# 5. 部署到开发环境
git add .
git commit -m "feat: 实现新功能"
git checkout develop
git merge feature/我的新功能
git push origin develop  # 自动部署到开发环境

# 6. 在开发环境验证
# 访问 https://haigoo-dev.vercel.app

# 7. 验证通过后部署到生产
git checkout main
git merge develop
git push origin main  # 自动部署到生产环境
```

---

## 🔐 安全注意事项

### ⚠️ 绝对不要做

- ❌ 在代码中硬编码密钥
- ❌ 将 `.env` 文件提交到 Git
- ❌ 在开发环境使用生产凭证
- ❌ 直接在 main 分支上开发
- ❌ 跳过开发环境测试直接部署到生产

### ✅ 必须要做

- ✅ 生产和开发使用不同的密钥
- ✅ 定期轮换敏感凭证
- ✅ 在 Vercel 中配置环境变量
- ✅ 在开发环境充分测试后再部署到生产
- ✅ 保持文档更新

---

## 🆘 遇到问题？

### 常见问题速查

| 问题 | 解决方案 |
|------|----------|
| 环境变量不生效 | 检查 Vercel Dashboard 中的 Environment 选择 |
| 部署没有触发 | 检查分支名称是否正确（main 或 develop） |
| 数据混淆 | 确认 Redis URL 配置在正确的环境 |
| OAuth 登录失败 | 检查 Google OAuth 配置的回调 URL |

详细排查步骤请查看 [DEPLOYMENT_STRATEGY.md](./DEPLOYMENT_STRATEGY.md) 的常见问题部分。

---

## 📞 获取帮助

1. 查看 [SETUP_GUIDE.md](./SETUP_GUIDE.md) 常见问题部分
2. 查看 [DEPLOYMENT_STRATEGY.md](./DEPLOYMENT_STRATEGY.md) 完整文档
3. 检查 Vercel 部署日志
4. 查看 `scripts/deploy-check.sh` 的检查结果

---

## ✨ 下一步

设置完成后：

1. **创建测试账号**: 在开发环境注册一个测试账号
2. **上传测试数据**: 在开发环境上传一些测试简历
3. **验证隔离**: 确认这些数据不会出现在生产环境
4. **开发新功能**: 从 develop 分支创建 feature 分支开始开发
5. **完善文档**: 根据实际情况更新本文档

---

**重要提示**: 这是一个生产级别的双环境配置，请严格按照文档操作，确保生产环境的数据安全！

祝部署顺利！🎉

