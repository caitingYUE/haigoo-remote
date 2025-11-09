# 开发环境测试数据初始化指南

## 🎯 问题

开发环境部署成功，但是没有职位数据显示"暂无匹配的职位"。

## ✅ 解决方案

有3种方法可以快速添加测试数据：

---

## 方法一：使用脚本快速添加（推荐 - 最快）

### 步骤 1: 找到你的开发环境 URL

1. 访问 Vercel Dashboard → Deployments
2. 找到 develop 分支的最新部署
3. 复制 URL（类似：`https://haigoo-git-develop-xxx.vercel.app`）

### 步骤 2: 修改脚本

编辑 `scripts/seed-dev-data.sh` 文件第 8 行：

```bash
DEV_URL="https://你的实际URL"  # 替换为你的开发环境 URL
```

### 步骤 3: 运行脚本

```bash
cd /Users/caitlinyct/Haigoo_Admin/Haigoo_assistant

# 确保脚本可执行
chmod +x scripts/seed-dev-data.sh

# 运行脚本
./scripts/seed-dev-data.sh
```

### 期望结果

```
========================================
🌱 开始初始化开发环境数据...
目标: https://haigoo-git-develop-xxx.vercel.app
========================================

📤 发送测试职位数据...

✅ 成功！测试数据已添加

返回信息:
{
  "success": true,
  "saved": 5,
  "total": 5,
  "provider": "redis"
}

========================================
🎉 初始化完成！
========================================

现在可以访问以下页面查看数据：
- 职位列表: https://haigoo-git-develop-xxx.vercel.app/jobs
- 首页推荐: https://haigoo-git-develop-xxx.vercel.app
- 数据统计: https://haigoo-git-develop-xxx.vercel.app/api/storage/stats
```

---

## 方法二：使用 curl 手动添加

### 直接运行命令

```bash
# 替换 YOUR_DEV_URL 为你的实际 URL
curl -X POST "YOUR_DEV_URL/api/data/processed-jobs" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "id": "test-1",
      "title": "Senior Frontend Developer (Remote)",
      "company": "TechCorp",
      "location": "Remote - Global",
      "category": "前端开发",
      "experienceLevel": "Senior",
      "isRemote": true,
      "salary": "100-150K USD",
      "jobType": "全职",
      "description": "Looking for an experienced Frontend Developer...",
      "requirements": ["5+ years experience", "React expert"],
      "benefits": ["Remote work", "Competitive salary"],
      "tags": ["React", "TypeScript", "Remote"],
      "url": "https://example.com/job1",
      "source": "Test",
      "publishedAt": "2024-01-09T00:00:00Z",
      "status": "active"
    },
    {
      "id": "test-2",
      "title": "Full Stack Engineer",
      "company": "StartupXYZ",
      "location": "Remote - US",
      "category": "全栈开发",
      "experienceLevel": "Mid",
      "isRemote": true,
      "salary": "80-120K USD",
      "jobType": "全职",
      "description": "Join our fast-growing startup...",
      "requirements": ["3+ years experience", "Node.js + React"],
      "benefits": ["Equity", "Remote work"],
      "tags": ["Node.js", "React", "MongoDB"],
      "url": "https://example.com/job2",
      "source": "Test",
      "publishedAt": "2024-01-09T00:00:00Z",
      "status": "active"
    }
  ]'
```

---

## 方法三：通过管理后台添加（需要UI）

### 访问管理后台

```
https://your-dev-url/admin/data
```

### 使用步骤

1. 登录（如果需要）
2. 点击 "添加职位" 或 "导入数据"
3. 填写职位信息
4. 保存

---

## 验证数据已添加

### 1. 检查存储统计

```bash
curl https://your-dev-url/api/storage/stats
```

期望返回：
```json
{
  "success": true,
  "total": 5,
  "provider": "redis",
  "lastUpdated": "2024-01-09T..."
}
```

### 2. 访问职位列表页面

```
https://your-dev-url/jobs
```

应该能看到刚添加的职位。

### 3. 检查首页推荐

```
https://your-dev-url/
```

应该能看到智能推荐的职位。

---

## 🔄 使用 RSS 同步真实数据（可选）

如果你想从真实的 RSS 源同步数据：

### 方法 A：前端触发（如果有同步按钮）

1. 访问管理后台
2. 找到 "RSS 同步" 或 "数据同步" 按钮
3. 点击开始同步
4. 等待几分钟完成

### 方法 B：后端 API 触发

```bash
# 如果你的应用有 RSS 同步 API
curl -X POST "https://your-dev-url/api/sync-rss"
```

**注意**：RSS 同步可能需要几分钟，并且会获取大量真实职位数据。

---

## 🐛 故障排查

### 问题 1: 脚本执行失败

**症状**：运行脚本后显示错误

**解决**：
1. 检查 DEV_URL 是否正确
2. 确认开发环境已部署成功
3. 检查是否有网络连接

```bash
# 测试连接
curl https://your-dev-url/api/health
```

### 问题 2: 数据添加成功但页面不显示

**症状**：API 返回成功，但页面仍显示"暂无职位"

**可能原因**：
1. 缓存问题 - 刷新页面（Ctrl+F5）
2. 筛选条件过严 - 重置所有筛选
3. Redis 连接问题 - 检查环境变量

**解决步骤**：

1. 强制刷新页面
2. 检查浏览器控制台是否有错误
3. 查看 API 响应：
   ```bash
   curl https://your-dev-url/api/data/processed-jobs
   ```

### 问题 3: Redis 连接失败

**症状**：API 返回 "Storage provider: memory"

**原因**：环境变量未正确配置

**解决**：
1. 检查 Vercel 环境变量中的 `REDIS_URL`
2. 确认 `REDIS_URL` 在 Preview 环境中已配置
3. 重新部署：
   ```bash
   git push origin develop
   ```

### 问题 4: 权限错误

**症状**：403 Forbidden 或 401 Unauthorized

**解决**：
- 如果 API 需要认证，在 curl 命令中添加 token：
  ```bash
  curl -X POST "..." \
    -H "Authorization: Bearer YOUR_TOKEN" \
    -H "Content-Type: application/json" \
    -d '...'
  ```

---

## 📊 数据示例

### 最小职位数据结构

```json
{
  "id": "unique-id",
  "title": "Job Title",
  "company": "Company Name",
  "location": "Location",
  "description": "Job description...",
  "url": "https://...",
  "source": "Source Name",
  "publishedAt": "2024-01-09T00:00:00Z",
  "status": "active"
}
```

### 完整职位数据结构

```json
{
  "id": "unique-id",
  "title": "Senior Software Engineer",
  "company": "TechCorp Inc.",
  "location": "Remote - Global",
  "category": "软件开发",
  "experienceLevel": "Senior",
  "isRemote": true,
  "salary": "120-180K USD",
  "jobType": "全职",
  "description": "We are looking for...",
  "requirements": ["5+ years", "Strong coding skills"],
  "benefits": ["Health insurance", "401k"],
  "tags": ["JavaScript", "React", "Node.js"],
  "url": "https://example.com/job",
  "source": "WeWorkRemotely",
  "publishedAt": "2024-01-09T10:00:00Z",
  "status": "active",
  "createdAt": "2024-01-09T10:00:00Z",
  "updatedAt": "2024-01-09T10:00:00Z"
}
```

---

## 🎯 推荐工作流

### 开发新功能时

1. **使用测试数据**（快速）
   ```bash
   ./scripts/seed-dev-data.sh
   ```

2. **开发和测试**
   - 测试职位列表显示
   - 测试筛选功能
   - 测试详情页面

3. **验证通过后同步到生产**
   ```bash
   git checkout main
   git merge develop
   git push origin main
   ```

### 测试真实场景时

1. **使用 RSS 同步**（获取真实数据）
2. **测试大量数据下的性能**
3. **验证数据质量**

---

## ✅ 完成检查清单

- [ ] 已找到开发环境 URL
- [ ] 已修改脚本中的 URL
- [ ] 已运行 seed-dev-data.sh
- [ ] API 返回成功响应
- [ ] 职位列表页面显示数据
- [ ] 首页推荐显示数据
- [ ] 详情页可以正常访问

---

**下一步**：运行 `./scripts/seed-dev-data.sh` 快速添加测试数据！🚀

如果遇到问题，查看上面的"故障排查"部分或查看 Vercel 部署日志。

