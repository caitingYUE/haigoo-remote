# Vercel 部署检查清单

## 部署前检查

### 1. 依赖包检查
```bash
# 确认以下包已安装并在 package.json 中
npm list pdf-parse mammoth jszip
```

**必需依赖：**
- ✅ pdf-parse@2.4.5
- ✅ mammoth@1.11.0  
- ✅ jszip@3.10.1
- ✅ busboy@1.6.0
- ✅ file-type@21.0.0
- ✅ mime-types@3.0.1

### 2. 文件检查
```bash
# 确认文件存在
ls -la api/parse-resume-new.js
ls -la api/health.js
ls -la src/services/resume-parser-enhanced.ts
ls -la src/services/resume-storage-service.ts
```

### 3. 配置检查

**vercel.json 检查：**
```json
{
  "functions": {
    "api/parse-resume-new.js": {
      "maxDuration": 30,
      "runtime": "nodejs18.x"
    },
    "api/health.js": {
      "maxDuration": 10
    }
  }
}
```

**package.json 检查：**
```json
{
  "engines": {
    "node": "20.x"
  }
}
```

---

## 部署步骤

### 1. 提交代码

```bash
# 查看变更
git status

# 添加文件
git add .

# 提交（使用准备好的提交信息）
git commit -F COMMIT_MESSAGE.txt

# 推送到远程
git push origin main
```

### 2. 等待 Vercel 自动部署

访问：https://vercel.com/dashboard

**预期流程：**
1. ⏳ Building... (约 1-2 分钟)
2. ⏳ Deploying... (约 30 秒)
3. ✅ Deployment Ready

**如果构建失败：**
```bash
# 查看构建日志
vercel logs --follow
```

---

## 部署后验证

### 1. 健康检查

```bash
# 测试健康检查接口
curl https://haigoo.vercel.app/api/health
```

**预期响应：**
```json
{
  "status": "ok",
  "timestamp": "2025-01-06T...",
  "uptime": 123.456,
  "environment": "production",
  "node_version": "v20.x.x",
  "endpoints": {
    "parse-resume-new": "/api/parse-resume-new",
    "processed-jobs": "/api/data/processed-jobs",
    "recommendations": "/api/recommendations",
    "rss-proxy": "/api/rss-proxy"
  },
  "features": {
    "redis": true,
    "kv": true
  }
}
```

### 2. 测试解析接口

```bash
# 创建测试文件
echo "姓名：张三
性别：男
地点：北京
职位：前端工程师
求职意向：高级前端开发" > test-upload.txt

# 测试上传
curl -X POST https://haigoo.vercel.app/api/parse-resume-new \
  -F "file=@test-upload.txt" \
  -v
```

**预期响应：**
```json
{
  "success": true,
  "data": {
    "text": "姓名：张三\n性别：男...",
    "filename": "test-upload.txt",
    "fileType": "txt",
    "length": 123
  }
}
```

### 3. 浏览器测试

**测试页面：**
1. https://haigoo.vercel.app/test-resume-parser.html
2. https://haigoo.vercel.app/resume-library

**操作步骤：**
1. 打开简历库页面
2. 点击"上传文件"
3. 选择简历文件（PDF/DOCX/TXT）
4. 等待解析完成
5. 查看结果

**预期结果：**
- ✅ 文件上传成功
- ✅ 解析完成
- ✅ 数据正确显示
- ✅ localStorage 保存成功

---

## 常见问题

### 问题 1：构建失败 - 依赖包错误

**错误信息：**
```
Error: Cannot find module 'pdf-parse'
```

**解决方法：**
```bash
# 本地安装依赖
npm install pdf-parse mammoth jszip

# 提交 package-lock.json
git add package-lock.json
git commit -m "fix: add missing dependencies"
git push
```

### 问题 2：Function 超时

**错误信息：**
```
FUNCTION_INVOCATION_TIMEOUT
```

**原因：**
- 文件太大（>10MB）
- 网络慢

**解决方法：**
1. 增加 maxDuration（已设置为 30 秒）
2. 限制文件大小
3. 优化解析算法

### 问题 3：CORS 错误

**错误信息：**
```
Access to fetch at 'https://haigoo.vercel.app/api/parse-resume-new' 
from origin 'https://haigoo.vercel.app' has been blocked by CORS policy
```

**检查 vercel.json：**
```json
{
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Access-Control-Allow-Origin", "value": "*" },
        { "key": "Access-Control-Allow-Methods", "value": "GET, POST, OPTIONS" },
        { "key": "Access-Control-Allow-Headers", "value": "Content-Type" }
      ]
    }
  ]
}
```

### 问题 4：Edge vs Serverless Runtime

**症状：**
- 某些 Node.js 包无法使用
- 构建警告：`Module not found`

**原因：**
Edge Runtime 不支持所有 Node.js API

**解决：**
确保 `api/parse-resume-new.js` 配置为 Serverless：
```json
{
  "functions": {
    "api/parse-resume-new.js": {
      "runtime": "nodejs18.x"  // Serverless, not Edge
    }
  }
}
```

---

## 环境变量（可选）

如果需要使用 Redis 存储简历：

### Vercel Dashboard 设置

1. 进入项目设置
2. 点击 "Environment Variables"
3. 添加以下变量：

```
REDIS_URL=redis://...
# 或
haigoo_REDIS_URL=redis://...
```

### 验证环境变量

```bash
curl https://haigoo.vercel.app/api/health
```

检查响应中的：
```json
{
  "features": {
    "redis": true,  // 应该是 true
    "kv": true
  }
}
```

---

## 性能监控

### 查看 Function 日志

```bash
# 实时日志
vercel logs --follow

# 过滤特定 Function
vercel logs --follow | grep parse-resume
```

### 查看 Function 使用情况

访问：https://vercel.com/dashboard → 项目 → Analytics

**关注指标：**
- Function Invocations（调用次数）
- Function Duration（执行时间）
- Function Errors（错误率）
- Bandwidth（带宽使用）

---

## 回滚方案

如果新版本有问题，快速回滚：

### 方法 1：Vercel Dashboard

1. 访问 https://vercel.com/dashboard
2. 进入项目
3. 点击 "Deployments"
4. 找到上一个稳定版本
5. 点击 "..." → "Promote to Production"

### 方法 2：Git Revert

```bash
# 查看提交历史
git log --oneline

# 回滚到上一个版本
git revert HEAD
git push

# 或者 Reset（谨慎使用）
git reset --hard HEAD~1
git push --force  # 需要权限
```

---

## 验收标准

### 必须通过（P0）

- ✅ 健康检查返回 200
- ✅ 能够上传 TXT 文件
- ✅ 能够上传 DOCX 文件
- ✅ 能够上传 PDF 文件
- ✅ 解析结果正确

### 建议通过（P1）

- ✅ Function 执行时间 < 10 秒
- ✅ 错误率 < 5%
- ✅ 支持批量上传

### 可选（P2）

- ⚠️ Redis 存储集成
- ⚠️ 解析准确率 > 90%

---

## 部署检查表

**部署前：**
- [ ] 代码已测试
- [ ] 依赖已安装
- [ ] vercel.json 已配置
- [ ] 提交信息已准备

**部署中：**
- [ ] 推送代码成功
- [ ] Vercel 构建成功
- [ ] 部署完成

**部署后：**
- [ ] 健康检查通过
- [ ] 解析接口测试通过
- [ ] 浏览器测试通过
- [ ] 日志无异常

---

**更新时间**：2025-01-06  
**版本**：v1.0

