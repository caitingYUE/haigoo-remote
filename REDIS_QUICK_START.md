# Redis 配置快速开始 ⚡

## 🎯 5分钟快速配置

### Step 1: 创建 Upstash 账户（1分钟）

1. 访问 https://console.upstash.com/
2. 使用 GitHub 登录
3. 验证邮箱

### Step 2: 创建两个数据库（2分钟）

#### 数据库 1 - 开发环境

```
点击 "Create Database"

Name:       haigoo-development
Type:       Regional
Region:     选择离你最近的（如 us-west-1）
Eviction:   No Eviction ✓
TLS:        Enabled ✓

点击 Create
```

**复制这个（重要！）：**
```
redis://default:你的密码@dev-xxxxx.upstash.io:6379
```

#### 数据库 2 - 生产环境

```
返回首页，再次点击 "Create Database"

Name:       haigoo-production
Type:       Regional  
Region:     同样区域
Eviction:   No Eviction ✓
TLS:        Enabled ✓

点击 Create
```

**复制这个（重要！）：**
```
redis://default:你的密码@prod-xxxxx.upstash.io:6379
```

### Step 3: 配置到 Vercel（2分钟）

1. 访问 https://vercel.com/dashboard
2. 选择项目 → Settings → Environment Variables

#### 添加开发环境变量

```
点击 "Add New"

Key:        REDIS_URL
Value:      redis://default:开发密码@dev-xxxxx.upstash.io:6379
Environment: ☐ Production
             ☑ Preview      ← 只勾选这个
             ☐ Development

点击 Save
```

#### 添加生产环境变量

```
再次点击 "Add New"

Key:        REDIS_URL
Value:      redis://default:生产密码@prod-xxxxx.upstash.io:6379
Environment: ☑ Production   ← 只勾选这个
             ☐ Preview
             ☐ Development

点击 Save
```

---

## ✅ 验证配置

### 本地测试

```bash
# 1. 创建 .env.local
echo "REDIS_URL=redis://default:开发密码@dev-xxxxx.upstash.io:6379" > .env.local

# 2. 启动服务
npm run dev

# 3. 测试连接
curl http://localhost:3000/api/health
```

### 开发环境测试

```bash
# 推送到 develop 分支
git checkout develop
git push origin develop

# 等待部署后测试
curl https://haigoo-dev.vercel.app/api/health
```

---

## 📋 配置清单

- [ ] ✅ 在 Upstash 创建了 2 个数据库
- [ ] ✅ 复制了 2 个 REDIS_URL
- [ ] ✅ 在 Vercel 配置了开发环境变量（Preview）
- [ ] ✅ 在 Vercel 配置了生产环境变量（Production）
- [ ] ✅ 本地测试通过
- [ ] ✅ 开发环境测试通过

---

## 🎁 免费套餐说明

Upstash 免费套餐包含：
- ✅ 10,000 命令/天（足够使用）
- ✅ 256 MB 存储
- ✅ 无限数据库数量
- ✅ 全球所有区域
- ✅ 永久免费

---

## 🆘 遇到问题？

### 连接失败

1. 检查 URL 格式是否正确（必须包含 `redis://`）
2. 确认密码没有多余空格
3. 确认端口是 6379
4. 重新部署 Vercel 项目

### 找不到环境变量

1. 确认在 Vercel 中选择了正确的 Environment
2. 部署后环境变量才会生效
3. 使用 `vercel env pull` 拉取最新变量

### 需要更详细的说明

查看完整文档：
- [REDIS_SETUP_GUIDE.md](./REDIS_SETUP_GUIDE.md) - 详细配置指南
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - 完整设置指南

---

## 📸 关键截图参考

### Upstash 创建数据库

```
┌─────────────────────────────────────────────┐
│  Create Database                            │
├─────────────────────────────────────────────┤
│  Name: [haigoo-development        ]         │
│  Type: [Regional ▼]                         │
│  Region: [us-west-1 ▼]                      │
│  ☑ TLS Enabled                              │
│  ☑ No Eviction                              │
│                                             │
│  [Create Database]                          │
└─────────────────────────────────────────────┘
```

### Vercel 环境变量配置

```
┌─────────────────────────────────────────────┐
│  Add New Environment Variable               │
├─────────────────────────────────────────────┤
│  Key                                        │
│  REDIS_URL                                  │
│                                             │
│  Value                                      │
│  redis://default:***@dev-xxx.upstash.io...  │
│                                             │
│  Environment                                │
│  ☐ Production                               │
│  ☑ Preview          ← 开发环境只选这个        │
│  ☐ Development                              │
│                                             │
│  [Save]                                     │
└─────────────────────────────────────────────┘
```

---

**提示**: 配置完成后，记得测试连接！使用 `curl https://your-url/api/health` 检查 Redis 状态。

🎉 配置完成！现在你有了完全隔离的开发和生产 Redis 环境！

