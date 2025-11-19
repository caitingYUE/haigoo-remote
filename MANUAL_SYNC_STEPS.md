# 🔄 手动数据同步步骤

如果自动脚本遇到问题，可以使用以下手动步骤完成数据同步。

---

## 方法 1: 使用 Node.js 脚本（推荐）

```bash
cd /Users/caitlinyct/Haigoo_Admin/Haigoo_assistant

# 运行 Node.js 同步脚本
node scripts/sync-data.js
```

这个脚本会自动完成所有步骤。

---

## 方法 2: 使用 Bash 脚本

```bash
cd /Users/caitlinyct/Haigoo_Admin/Haigoo_assistant

# 运行 Bash 同步脚本
bash scripts/sync-prod-to-dev.sh
```

---

## 方法 3: 手动执行命令（3步完成）

### 步骤 1: 从生产环境获取数据

```bash
curl "https://haigoo.vercel.app/api/data/processed-jobs?limit=100" -o prod-data.json
```

**验证数据**:
```bash
# 查看数据量
cat prod-data.json | jq '.data | length'

# 预览前3条
cat prod-data.json | jq '.data[0:3] | .[] | "\(.title) at \(.company)"'
```

---

### 步骤 2: 提取 jobs 数组

```bash
cat prod-data.json | jq '.data' > jobs-only.json
```

**检查**:
```bash
cat jobs-only.json | jq 'length'
```

---

### 步骤 3: 推送到开发环境

```bash
curl -X POST \
  "https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/data/processed-jobs" \
  -H "Content-Type: application/json" \
  -d @jobs-only.json
```

**期望返回**:
```json
{
  "success": true,
  "saved": 100,
  "total": 100,
  "provider": "redis"
}
```

---

### 步骤 4: 验证结果

```bash
# 查看数据统计
curl "https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/storage/stats" | jq

# 检查健康状态
curl "https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/health" | jq
```

---

## 方法 4: 如果生产环境暂无数据，使用测试数据

### 创建测试数据文件

```bash
cat > test-jobs.json << 'EOF'
[
  {
    "id": "test-job-1",
    "title": "高级前端工程师 (远程)",
    "company": "TechCorp",
    "location": "远程 - 全球",
    "category": "前端开发",
    "experienceLevel": "Senior",
    "isRemote": true,
    "salary": "40-60K RMB/月",
    "jobType": "全职",
    "description": "负责前端产品开发，使用 React、TypeScript 等现代技术栈。",
    "requirements": ["5年以上前端开发经验", "精通 React 和 TypeScript"],
    "benefits": ["远程办公", "弹性工作时间", "技术培训"],
    "tags": ["React", "TypeScript", "远程"],
    "url": "https://example.com/job1",
    "source": "测试数据",
    "publishedAt": "2025-11-09T10:00:00Z",
    "status": "active"
  },
  {
    "id": "test-job-2",
    "title": "全栈开发工程师",
    "company": "StartupXYZ",
    "location": "远程 - 中国",
    "category": "全栈开发",
    "experienceLevel": "Mid",
    "isRemote": true,
    "salary": "30-50K RMB/月",
    "jobType": "全职",
    "description": "参与产品全栈开发，使用 Node.js、React 技术栈。",
    "requirements": ["3年以上全栈开发经验", "熟悉 Node.js 和前端框架"],
    "benefits": ["弹性工作", "股票期权", "年度奖金"],
    "tags": ["Node.js", "React", "MongoDB"],
    "url": "https://example.com/job2",
    "source": "测试数据",
    "publishedAt": "2025-11-09T10:00:00Z",
    "status": "active"
  },
  {
    "id": "test-job-3",
    "title": "Python 后端工程师",
    "company": "DataCo",
    "location": "远程 - 亚太地区",
    "category": "后端开发",
    "experienceLevel": "Mid",
    "isRemote": true,
    "salary": "35-55K RMB/月",
    "jobType": "全职",
    "description": "负责后端 API 开发，使用 Python、Django/Flask 框架。",
    "requirements": ["3年以上 Python 开发经验", "熟悉 RESTful API 设计"],
    "benefits": ["远程工作", "学习预算", "健康保险"],
    "tags": ["Python", "Django", "API"],
    "url": "https://example.com/job3",
    "source": "测试数据",
    "publishedAt": "2025-11-09T10:00:00Z",
    "status": "active"
  }
]
EOF
```

### 推送测试数据

```bash
curl -X POST \
  "https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/data/processed-jobs" \
  -H "Content-Type: application/json" \
  -d @test-jobs.json
```

---

## 🔍 验证清单

数据同步完成后，请检查：

### 1. API 健康检查

```bash
curl "https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/health"
```

**期望返回**:
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

### 2. 数据统计

```bash
curl "https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/storage/stats"
```

**期望返回**:
```json
{
  "total": 100,
  "provider": "redis",
  "lastSync": "2025-11-09T..."
}
```

### 3. 获取第一条数据验证

```bash
curl "https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/data/processed-jobs?limit=1" | jq
```

应该返回一条完整的职位数据。

### 4. Web 界面验证

在浏览器中访问：

- **首页**: https://haigoo-remote-git-develop-caitlinyct.vercel.app
- **职位列表**: https://haigoo-remote-git-develop-caitlinyct.vercel.app/jobs

应该能看到职位推荐和列表。

---

## ❓ 常见问题

### Q: 如果 jq 命令不存在？

**安装 jq**:

**macOS**:
```bash
brew install jq
```

**或者不使用 jq，直接查看原始 JSON**:
```bash
curl "URL" | python3 -m json.tool
```

### Q: 如果推送失败？

**检查错误信息**:
```bash
curl -X POST \
  "https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/data/processed-jobs" \
  -H "Content-Type: application/json" \
  -d @jobs-only.json \
  -v
```

添加 `-v` 参数查看详细错误信息。

**常见原因**:
1. Redis 未配置 → 检查 Vercel 环境变量
2. 数据格式错误 → 检查 JSON 格式
3. 网络问题 → 重试或检查网络连接

### Q: 如何清空开发环境数据重新开始？

```bash
# 暂时还没有批量删除 API，可以通过 Upstash 控制台清空 Redis
# 或者等待实现 DELETE 端点
```

---

## 🎯 推荐执行顺序

1. **首先尝试方法 1（Node.js 脚本）**
   ```bash
   node scripts/sync-data.js
   ```

2. **如果失败，尝试方法 2（Bash 脚本）**
   ```bash
   bash scripts/sync-prod-to-dev.sh
   ```

3. **如果还是失败，使用方法 3（手动步骤）**
   一步步手动执行 curl 命令

4. **如果生产环境无数据，使用方法 4（测试数据）**
   先用测试数据验证开发环境正常工作

---

## ✅ 成功标志

当您看到以下内容时，说明同步成功：

✅ API 返回 `"success": true` 和 `"saved": N`  
✅ stats 显示正确的数据量  
✅ 网页上能看到职位列表  
✅ 健康检查显示 Redis 已连接  

---

需要帮助？检查：
- [DATA_SYNC_GUIDE.md](./DATA_SYNC_GUIDE.md) - 完整指南
- [QUICK_START_DATA_SYNC.md](./QUICK_START_DATA_SYNC.md) - 快速开始

