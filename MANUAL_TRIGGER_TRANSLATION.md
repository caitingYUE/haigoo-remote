# 手动触发翻译任务 - 立即操作

## 🎯 为什么需要手动触发？

虽然环境变量已配置（`ENABLE_AUTO_TRANSLATION=true`），但：
1. **Vercel Cron任务在Preview环境不会自动执行**（只在Production环境自动执行）
2. **现有数据库中还没有翻译后的数据**
3. 需要手动触发一次翻译来处理现有数据

---

## 🚀 方法1：使用curl命令（推荐）

打开终端，执行以下命令：

```bash
# 替换为你的实际预发环境URL
curl -X POST https://haigoo-remote-39wbu7qqo-caitlinyct.vercel.app/api/cron/sync-jobs \
  -H "Content-Type: application/json"
```

**期望响应**：

```json
{
  "success": true,
  "message": "数据同步和翻译完成",
  "stats": {
    "totalJobs": 489,
    "translatedJobs": 489,
    "skippedJobs": 0,
    "failedJobs": 0
  },
  "timestamp": "2025-11-12T..."
}
```

---

## 🚀 方法2：使用浏览器开发者工具

1. **打开浏览器开发者工具**（F12）
2. **切换到 Console 标签**
3. **粘贴并执行以下代码**：

```javascript
fetch('https://haigoo-remote-39wbu7qqo-caitlinyct.vercel.app/api/cron/sync-jobs', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
})
.then(res => res.json())
.then(data => {
  console.log('✅ 翻译任务完成:', data);
  alert(`翻译完成！\n总数: ${data.stats.totalJobs}\n翻译: ${data.stats.translatedJobs}\n失败: ${data.stats.failedJobs}`);
})
.catch(err => {
  console.error('❌ 翻译失败:', err);
  alert('翻译失败: ' + err.message);
});
```

---

## 🚀 方法3：使用Postman或API测试工具

1. **打开Postman**（或其他API测试工具）
2. **创建新请求**：
   - Method: `POST`
   - URL: `https://haigoo-remote-39wbu7qqo-caitlinyct.vercel.app/api/cron/sync-jobs`
   - Headers: `Content-Type: application/json`
3. **点击 Send**
4. **查看响应**

---

## ✅ 成功标志

如果看到以下内容，说明翻译成功：

```json
{
  "success": true,
  "stats": {
    "totalJobs": 489,
    "translatedJobs": 489,  // ✅ 翻译成功的数量
    "skippedJobs": 0,       // 已有翻译的跳过数量
    "failedJobs": 0         // ✅ 应该为0
  }
}
```

---

## 🧪 翻译完成后验证

### 1. 刷新前台页面

```
https://haigoo-remote-39wbu7qqo-caitlinyct.vercel.app/
```

**检查**：
- 推荐页面是否显示中文
- 全部岗位页面是否显示中文

### 2. 访问管理后台

```
https://haigoo-remote-39wbu7qqo-caitlinyct.vercel.app/admin_team
→ 点击"职位数据"标签
→ 切换到"处理后数据"子标签
→ 查看数据是否包含中文翻译
```

### 3. 检查API响应

打开开发者工具 → Network 标签，刷新页面，查看：

```
/api/data/processed-jobs 响应中的数据应该包含：
{
  "translations": {
    "title": "中文标题",
    "description": "中文描述",
    ...
  },
  "isTranslated": true,
  "translatedAt": "2025-11-12T..."
}
```

---

## ❌ 常见错误处理

### 错误1：429 Too Many Requests

**原因**：Google翻译API请求过多

**解决**：等待5-10分钟后重试

---

### 错误2：500 Internal Server Error

**原因**：后端翻译服务异常

**检查**：
1. Vercel函数日志（Vercel Dashboard → Deployments → Runtime Logs）
2. 环境变量是否正确配置

---

### 错误3：无响应或超时

**原因**：Serverless函数冷启动或翻译数据量大

**解决**：
- 第一次执行可能需要1-2分钟
- 耐心等待完整响应
- 如果超过5分钟，检查Vercel日志

---

## 🔄 定期翻译建议

由于Preview环境的Cron不会自动执行，建议：

1. **每次推送新代码后**手动触发一次翻译
2. **测试新功能前**手动触发一次翻译
3. **发现英文数据时**手动触发一次翻译

---

## 📝 命令行快捷方式（可选）

将以下命令保存为脚本（`trigger-translation.sh`）：

```bash
#!/bin/bash
# Preview环境翻译触发脚本

PREVIEW_URL="https://haigoo-remote-39wbu7qqo-caitlinyct.vercel.app"

echo "🌍 触发翻译任务..."
response=$(curl -s -X POST "$PREVIEW_URL/api/cron/sync-jobs" \
  -H "Content-Type: application/json")

echo "$response" | jq '.'

if echo "$response" | jq -e '.success' > /dev/null; then
  echo "✅ 翻译完成！"
  echo "📊 统计：$(echo "$response" | jq -r '.stats')"
else
  echo "❌ 翻译失败！"
fi
```

**使用方法**：

```bash
chmod +x trigger-translation.sh
./trigger-translation.sh
```

---

**立即执行方法1或方法2，完成后告诉我结果！**

