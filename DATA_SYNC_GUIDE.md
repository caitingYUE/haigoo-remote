# 生产数据同步到开发环境指南

## 🎯 目标

将生产环境的部分真实数据复制到开发环境，用于测试，同时保持两个环境完全隔离。

---

## ✅ 推荐方案：数据副本策略

### 核心原则

```
┌─────────────────────┐         ┌─────────────────────┐
│   生产环境 (Prod)    │         │   开发环境 (Dev)     │
│                     │         │                     │
│  🗄️ 真实数据         │  ─复制→  │  📋 数据副本         │
│  (完整、只读)        │         │  (部分、可修改)      │
│                     │         │                     │
│  ❌ 不可修改          │         │  ✅ 可以随意测试      │
└─────────────────────┘         └─────────────────────┘
```

### 优点

✅ **真实数据**：使用生产环境的实际数据测试  
✅ **完全隔离**：开发环境的操作不会影响生产  
✅ **控制数量**：只复制需要的数据量（如100条）  
✅ **可重复**：随时可以重新同步最新数据  

### 风险控制

✅ **单向复制**：只从生产→开发，永不反向  
✅ **数据脱敏**：如需要，可以在复制时脱敏敏感信息  
✅ **定期清理**：定期重新同步，避免数据过时  

---

## 🚀 快速开始（2分钟）

### 方法一：使用自动化脚本（推荐）

```bash
cd /Users/caitlinyct/Haigoo_Admin/Haigoo_assistant

# 确保脚本可执行
chmod +x scripts/sync-prod-to-dev.sh

# 运行同步
./scripts/sync-prod-to-dev.sh
```

### 方法二：手动复制（如果生产环境已有数据）

#### 步骤 1: 从生产环境导出数据

```bash
# 导出最多100条数据
curl "https://haigoo.vercel.app/api/data/processed-jobs?limit=100" > prod-data.json
```

#### 步骤 2: 查看数据

```bash
# 查看数据量
cat prod-data.json | jq '.data | length'

# 预览前3条
cat prod-data.json | jq '.data[0:3]'
```

#### 步骤 3: 导入到开发环境

```bash
# 提取 jobs 数组并导入
cat prod-data.json | jq '.data' | curl -X POST \
  "https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/data/processed-jobs" \
  -H "Content-Type: application/json" \
  -d @-
```

---

## 📋 详细步骤说明

### 配置说明

脚本中的关键配置（`scripts/sync-prod-to-dev.sh`）：

```bash
PROD_URL="https://haigoo.vercel.app"  # 生产环境
DEV_URL="https://haigoo-remote-git-develop-caitlinyct.vercel.app"  # 开发环境
DATA_LIMIT=100  # 复制的数据条数
```

### 执行流程

```
1️⃣ 从生产环境获取数据（GET /api/data/processed-jobs?limit=100）
   ↓
2️⃣ 验证和准备数据（检查格式、显示预览）
   ↓
3️⃣ 推送到开发环境（POST /api/data/processed-jobs）
   ↓
4️⃣ 验证结果（GET /api/storage/stats）
```

### 预期输出

```
=========================================
🔄 开始从生产环境同步数据到开发环境
=========================================

源（生产）: https://haigoo.vercel.app
目标（开发）: https://haigoo-remote-git-develop-caitlinyct.vercel.app
数据量: 最多 100 条

📥 步骤 1/3: 从生产环境获取数据...

✓ 成功获取 100 条职位数据

🔧 步骤 2/3: 准备数据...

✓ 数据准备完成

📊 数据预览（前3条）:
  - Senior Frontend Engineer at TechCorp
  - Full Stack Developer at StartupXYZ
  - Backend Engineer at DataFlow

📤 步骤 3/3: 推送数据到开发环境...

✅ 成功！已将 100 条数据同步到开发环境

返回信息:
{
  "success": true,
  "saved": 100,
  "total": 100,
  "provider": "redis"
}

🔍 验证开发环境数据...
开发环境当前数据量: 100

=========================================
🎉 数据同步完成！
=========================================

📍 现在可以访问以下链接测试：

开发环境:
  - 首页: https://haigoo-remote-git-develop-caitlinyct.vercel.app
  - 职位列表: https://haigoo-remote-git-develop-caitlinyct.vercel.app/jobs
```

---

## 🔧 高级配置

### 调整数据数量

编辑 `scripts/sync-prod-to-dev.sh`：

```bash
DATA_LIMIT=50   # 减少到50条
# 或
DATA_LIMIT=200  # 增加到200条
```

### 添加数据过滤

如果只想复制特定类型的数据：

```bash
# 只复制前端开发职位
curl "https://haigoo.vercel.app/api/data/processed-jobs?category=前端开发&limit=50"

# 只复制高级职位
curl "https://haigoo.vercel.app/api/data/processed-jobs?experienceLevel=Senior&limit=30"
```

### 数据脱敏（如需要）

如果需要隐藏敏感信息：

```bash
# 使用 jq 修改数据
cat prod-data.json | jq '.data | map(
  .company = "测试公司" |
  .url = "https://example.com/job-" + .id
)' > sanitized-data.json
```

---

## 🐛 故障排查

### 问题 1: 生产环境无数据

**症状**：脚本显示 "生产环境无数据"

**原因**：生产环境 Redis 还没有职位数据

**解决方案**：

**选项 A：先在生产环境添加数据**

1. 访问生产环境管理后台
2. 使用 RSS 同步功能获取真实数据
3. 或手动添加一些职位数据

**选项 B：使用测试数据**

脚本会自动提供测试数据作为后备：

```bash
⚠️  生产环境无数据，将使用测试数据
是否继续使用测试数据？(y/N):
```

输入 `y` 继续

### 问题 2: 推送到开发环境失败

**症状**：步骤 3 显示错误

**可能原因**：
1. 开发环境 Redis 未配置
2. 环境变量未正确引用
3. 数据格式问题

**解决步骤**：

1. **检查开发环境健康状态**
```bash
curl https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/health
```

期望返回：
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

2. **确认环境变量配置**

在 Vercel Dashboard → Environment Variables 确认：
- `REDIS_URL` (Preview) 已配置
- 指向了正确的 Redis 实例

3. **重新部署开发环境**
```bash
git push origin develop
```

### 问题 3: 数据量不匹配

**症状**：复制了100条，但只显示50条

**原因**：可能有重复数据被去重了

**这是正常的**：API 会自动去重，以确保数据质量

### 问题 4: jq 命令未找到

**症状**：`command not found: jq`

**解决**：

**macOS**:
```bash
brew install jq
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt-get install jq
```

---

## 📊 数据管理策略

### 推荐的数据同步频率

```
开发新功能时    → 同步一次，获取最新数据
测试完成后      → 可以清空开发环境数据
准备发布前      → 再次同步，验证生产场景
发布后         → 不需要同步（生产环境是真实数据）
```

### 数据清理

**清空开发环境数据**（如需要重新开始）：

```bash
curl -X DELETE "https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/data/processed-jobs"
```

**重新同步**：

```bash
./scripts/sync-prod-to-dev.sh
```

---

## 🔐 安全注意事项

### ✅ 应该做的

1. **单向复制**
   - 只从 生产 → 开发
   - 永远不要从 开发 → 生产

2. **数据隔离**
   - 确认两个环境使用不同的 Redis 实例
   - 确认环境变量正确配置

3. **定期同步**
   - 定期重新同步以获取最新数据
   - 不要依赖过时的数据测试

### ❌ 不应该做的

1. **不要共享 Redis**
   - 不要让开发和生产使用同一个 Redis 实例

2. **不要反向同步**
   - 不要将开发环境的测试数据推送到生产

3. **不要直连生产数据库**
   - 始终通过 API 复制数据，而不是直接访问数据库

---

## ✅ 验证清单

完成数据同步后，请验证：

- [ ] 开发环境可以访问
- [ ] 首页显示职位推荐
- [ ] 职位列表显示数据
- [ ] 职位详情可以查看
- [ ] 筛选功能正常工作
- [ ] 搜索功能正常工作
- [ ] 数据来自 Redis（检查 /api/health）

---

## 🎯 最佳实践建议

### 数据量建议

```
功能开发    → 10-20 条（快速迭代）
集成测试    → 50-100 条（常规场景）
性能测试    → 500-1000 条（压力测试）
UI 测试     → 5-10 条（视觉验证）
```

### 工作流程

```bash
# 1. 开始新功能开发
git checkout develop
./scripts/sync-prod-to-dev.sh  # 同步数据

# 2. 开发和测试
# ... 编写代码和测试 ...

# 3. 如果需要重新开始
curl -X DELETE "DEV_URL/api/data/processed-jobs"
./scripts/sync-prod-to-dev.sh

# 4. 测试通过，合并到生产
git checkout main
git merge develop
git push origin main
```

---

## 📚 相关文档

- [DUAL_ENV_README.md](./DUAL_ENV_README.md) - 双环境概览
- [SETUP_GUIDE.md](./SETUP_GUIDE.md) - 完整设置指南
- [REDIS_SETUP_GUIDE.md](./REDIS_SETUP_GUIDE.md) - Redis 配置
- [TEST_DATA_GUIDE.md](./TEST_DATA_GUIDE.md) - 测试数据指南

---

## 🚀 立即开始

```bash
# 一键同步生产数据到开发环境
./scripts/sync-prod-to-dev.sh
```

就是这么简单！🎉

