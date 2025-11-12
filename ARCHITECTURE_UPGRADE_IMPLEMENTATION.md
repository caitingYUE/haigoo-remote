# 🚀 Haigoo 架构升级实施方案

## 📝 总览

本文档详细说明了从"前端翻译"迁移到"后端预翻译"的完整实施步骤。

### 升级目标
- ✅ 页面加载时间从 5-10秒 降低到 < 1秒
- ✅ 翻译API成本降低 99%
- ✅ 用户体验显著提升
- ✅ 服务器负载优化

---

## 🗺️ 实施路线图

```
Phase 1: 后端翻译服务搭建 (Week 1)
├── 创建 Node.js 翻译服务
├── 修改 processed-jobs API
└── 测试翻译流程

Phase 2: 数据处理流程改造 (Week 2)
├── 集成翻译到数据处理
├── 添加翻译状态标记
└── 实现批量翻译优化

Phase 3: 定时任务机制 (Week 2-3)
├── 创建定时刷新机制
├── 添加手动触发功能
└── 监控和日志

Phase 4: 前端简化 (Week 3)
├── 移除前端翻译逻辑
├── 直接使用 translations 字段
└── 更新UI组件

Phase 5: 测试和上线 (Week 4)
├── 预发环境测试
├── 性能监控
├── 正式上线
└── 数据迁移
```

---

## 📦 Phase 1: 后端翻译服务搭建

### 1.1 创建 Node.js 翻译服务

**文件**: `api/services/translation-service.js`

```javascript
/**
 * 后端翻译服务
 * 使用 DeepL API 进行批量翻译
 */

// 翻译API配置
const DEEPL_API_KEY = process.env.DEEPL_API_KEY || process.env.VITE_DEEPL_API_KEY
const DEEPL_API_URL = 'https://api-free.deepl.com/v2/translate'

/**
 * 批量翻译文本
 * @param {string[]} texts - 需要翻译的文本数组
 * @param {string} targetLang - 目标语言 (默认: 'ZH')
 * @param {string} sourceLang - 源语言 (默认: 'EN')
 * @returns {Promise<string[]>} 翻译后的文本数组
 */
async function translateBatch(texts, targetLang = 'ZH', sourceLang = 'EN') {
  if (!texts || texts.length === 0) {
    return []
  }

  // 过滤空文本
  const validTexts = texts.filter(t => t && t.trim())
  if (validTexts.length === 0) {
    return texts.map(() => '')
  }

  try {
    // DeepL API 支持批量翻译，最多50个文本
    const chunks = chunkArray(validTexts, 50)
    const allTranslations = []

    for (const chunk of chunks) {
      const formData = new URLSearchParams()
      formData.append('auth_key', DEEPL_API_KEY)
      formData.append('target_lang', targetLang)
      formData.append('source_lang', sourceLang)
      
      chunk.forEach(text => {
        formData.append('text', text)
      })

      const response = await fetch(DEEPL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData
      })

      if (!response.ok) {
        throw new Error(`DeepL API error: ${response.status}`)
      }

      const data = await response.json()
      const translations = data.translations.map(t => t.text)
      allTranslations.push(...translations)
    }

    return allTranslations
  } catch (error) {
    console.error('批量翻译失败:', error)
    // 翻译失败时返回原文
    return texts
  }
}

/**
 * 翻译单个岗位数据
 * @param {object} job - 岗位数据
 * @returns {Promise<object>} 包含翻译的岗位数据
 */
async function translateJob(job) {
  try {
    // 准备需要翻译的字段
    const textsToTranslate = []
    const textKeys = []

    // 标题
    if (job.title) {
      textsToTranslate.push(job.title)
      textKeys.push('title')
    }

    // 描述（限制长度）
    if (job.description) {
      const desc = job.description.substring(0, 500)
      textsToTranslate.push(desc)
      textKeys.push('description')
    }

    // 地点
    if (job.location) {
      textsToTranslate.push(job.location)
      textKeys.push('location')
    }

    // 工作类型
    if (job.type || job.jobType) {
      textsToTranslate.push(job.type || job.jobType)
      textKeys.push('type')
    }

    // 批量翻译
    const translations = await translateBatch(textsToTranslate)

    // 构建翻译对象
    const translationObj = {}
    textKeys.forEach((key, index) => {
      if (key === 'title' || key === 'description' || key === 'location' || key === 'type') {
        translationObj[key] = translations[index] || textsToTranslate[index]
      }
    })

    // 公司名称不翻译，保留原文
    if (job.company) {
      translationObj.company = job.company
    }

    return {
      ...job,
      translations: translationObj,
      translatedAt: new Date().toISOString(),
      isTranslated: true
    }
  } catch (error) {
    console.error(`翻译岗位失败 [${job.id}]:`, error)
    // 翻译失败，返回原数据并标记
    return {
      ...job,
      translations: null,
      isTranslated: false
    }
  }
}

/**
 * 批量翻译岗位数据
 * @param {object[]} jobs - 岗位数据数组
 * @returns {Promise<object[]>} 翻译后的岗位数组
 */
async function translateJobs(jobs) {
  if (!jobs || jobs.length === 0) {
    return []
  }

  console.log(`开始批量翻译 ${jobs.length} 个岗位...`)
  const startTime = Date.now()

  try {
    // 并发翻译，但限制并发数
    const batchSize = 5
    const translatedJobs = []

    for (let i = 0; i < jobs.length; i += batchSize) {
      const batch = jobs.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(job => translateJob(job))
      )
      translatedJobs.push(...batchResults)
      
      // 进度日志
      console.log(`翻译进度: ${translatedJobs.length}/${jobs.length}`)
    }

    const duration = Date.now() - startTime
    console.log(`✅ 批量翻译完成: ${translatedJobs.length} 个岗位, 耗时: ${duration}ms`)

    return translatedJobs
  } catch (error) {
    console.error('批量翻译岗位失败:', error)
    return jobs
  }
}

// 工具函数：数组分块
function chunkArray(array, size) {
  const chunks = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}

module.exports = {
  translateBatch,
  translateJob,
  translateJobs
}
```

### 1.2 修改 processed-jobs API

**文件**: `api/data/processed-jobs.js`

需要修改的地方：

1. **导入翻译服务**
```javascript
const { translateJobs } = require('../services/translation-service')
```

2. **在 POST 处理中添加翻译**
```javascript
// 在保存前翻译数据
if (process.env.ENABLE_AUTO_TRANSLATION === 'true') {
  console.log('开始自动翻译岗位数据...')
  normalized = await translateJobs(normalized)
}
```

3. **添加 translations 字段到数据结构**
```javascript
const normalized = jobs.map(j => ({
  // ... 现有字段
  translations: j.translations || null,
  isTranslated: j.isTranslated || false,
  translatedAt: j.translatedAt || null
}))
```

### 1.3 更新环境变量

**文件**: `.env.local` 和 Vercel 环境变量

```bash
# DeepL API Key（用于翻译）
DEEPL_API_KEY=your_deepl_api_key_here
VITE_DEEPL_API_KEY=your_deepl_api_key_here

# 启用自动翻译
ENABLE_AUTO_TRANSLATION=true
```

---

## 📦 Phase 2: 数据处理流程改造

### 2.1 修改数据处理服务

**文件**: `src/services/data-management-service.ts`

修改 `processRawData` 方法，在后台管理触发处理时同时翻译：

```typescript
async processRawData(): Promise<{ success: boolean; processedCount: number; error?: string }> {
  try {
    const rawData = await this.loadRawData()
    
    if (rawData.length === 0) {
      return { success: true, processedCount: 0 }
    }

    // 处理数据
    const processed = this.extractJobsFromRawData(rawData)
    
    // 🆕 调用后端API进行翻译和保存
    // 后端API会自动翻译（如果启用了ENABLE_AUTO_TRANSLATION）
    await this.saveProcessedJobs(processed)
    
    return { success: true, processedCount: processed.length }
  } catch (error) {
    console.error('处理原始数据失败:', error)
    return { 
      success: false, 
      processedCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}
```

---

## 📦 Phase 3: 定时任务机制

### 3.1 创建定时刷新API

**文件**: `api/cron/sync-jobs.js`

```javascript
/**
 * Vercel Cron Job: 定时同步和翻译岗位数据
 * 配置在 vercel.json 中
 */

const { translateJobs } = require('../services/translation-service')

export default async function handler(req, res) {
  // 验证 Cron Job 授权
  const authHeader = req.headers.authorization
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    console.log('🔄 开始定时任务: 同步和翻译岗位数据')
    const startTime = Date.now()

    // 1. 获取处理后的岗位数据
    const jobsResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/data/processed-jobs`)
    const { data: jobs } = await jobsResponse.json()

    if (!jobs || jobs.length === 0) {
      return res.json({ 
        success: true, 
        message: '没有需要翻译的岗位数据',
        timestamp: new Date().toISOString()
      })
    }

    // 2. 筛选出未翻译的岗位
    const untranslatedJobs = jobs.filter(job => !job.isTranslated)
    console.log(`发现 ${untranslatedJobs.length} 个未翻译的岗位`)

    if (untranslatedJobs.length === 0) {
      return res.json({
        success: true,
        message: '所有岗位已翻译',
        totalJobs: jobs.length,
        timestamp: new Date().toISOString()
      })
    }

    // 3. 批量翻译
    const translatedJobs = await translateJobs(untranslatedJobs)

    // 4. 合并并保存
    const allJobs = jobs.map(job => {
      const translated = translatedJobs.find(t => t.id === job.id)
      return translated || job
    })

    // 5. 保存回数据库
    const saveResponse = await fetch(`${process.env.VERCEL_URL || 'http://localhost:3000'}/api/data/processed-jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobs: allJobs, mode: 'replace' })
    })

    if (!saveResponse.ok) {
      throw new Error('保存翻译后的数据失败')
    }

    const duration = Date.now() - startTime

    return res.json({
      success: true,
      message: '定时任务完成',
      stats: {
        totalJobs: jobs.length,
        translatedJobs: translatedJobs.length,
        duration: `${duration}ms`
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('定时任务失败:', error)
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
```

### 3.2 配置 Vercel Cron

**文件**: `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-jobs",
      "schedule": "0 2 * * *"
    }
  ]
}
```

每天凌晨 2:00 自动运行翻译任务。

### 3.3 添加手动触发功能

在后台管理页面添加"刷新并翻译"按钮：

**文件**: `src/pages/AdminTeamPage.tsx`

```typescript
// 添加手动触发翻译的函数
const handleRefreshAndTranslate = async () => {
  try {
    setIsRefreshing(true)
    
    // 调用定时任务API
    const response = await fetch('/api/cron/sync-jobs', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VITE_CRON_SECRET}`
      }
    })
    
    if (!response.ok) {
      throw new Error('刷新失败')
    }
    
    const result = await response.json()
    console.log('刷新完成:', result)
    
    // 刷新页面数据
    await loadProcessedData()
    
    alert('数据刷新和翻译完成！')
  } catch (error) {
    console.error('刷新失败:', error)
    alert('刷新失败: ' + error.message)
  } finally {
    setIsRefreshing(false)
  }
}

// UI 按钮
<button
  onClick={handleRefreshAndTranslate}
  disabled={isRefreshing}
  className="btn btn-primary"
>
  {isRefreshing ? '刷新中...' : '🔄 刷新并翻译数据'}
</button>
```

---

## 📦 Phase 4: 前端简化

### 4.1 移除前端翻译逻辑

**修改文件**:
- `src/pages/HomePage.tsx`
- `src/pages/JobsPage.tsx`

**修改前**:
```typescript
const {
  data: jobs,
  loading
} = usePageCache<Job[]>('homepage-recommendations', {
  fetcher: async () => {
    const response = await processedJobsService.getProcessedJobs(1, 30)
    // ❌ 前端翻译
    const translatedJobs = await jobTranslationService.translateJobs(response.jobs)
    return translatedJobs
  }
})
```

**修改后**:
```typescript
const {
  data: jobs,
  loading
} = usePageCache<Job[]>('homepage-recommendations', {
  fetcher: async () => {
    // ✅ 直接获取已翻译的数据
    const response = await processedJobsService.getProcessedJobs(1, 30)
    return response.jobs
  }
})
```

### 4.2 更新UI渲染

确保所有地方都使用 `translations` 字段：

```typescript
// 标题
<h3>{job.translations?.title || job.title}</h3>

// 描述
<p>{job.translations?.description || job.description}</p>

// 地点
<span>{job.translations?.location || job.location}</span>

// 公司（不翻译）
<span>{job.company}</span>
```

### 4.3 移除不需要的服务

可以考虑删除或归档：
- `src/services/job-translation-service.ts` (可选，作为备用)
- `src/services/multi-translation-service.ts` (可选，作为备用)

---

## 📦 Phase 5: 测试和上线

### 5.1 测试清单

#### 后端测试
- [ ] 翻译服务单元测试
- [ ] API 翻译功能测试
- [ ] 定时任务测试
- [ ] 数据持久化测试

#### 前端测试
- [ ] 页面加载速度测试
- [ ] 数据显示正确性测试
- [ ] 缓存机制测试
- [ ] 降级方案测试

#### 性能测试
- [ ] 页面加载时间 (目标: < 1秒)
- [ ] API 响应时间
- [ ] 翻译任务执行时间
- [ ] 内存和CPU使用率

### 5.2 部署流程

#### Step 1: 部署后端服务

```bash
# 1. 创建翻译服务文件
mkdir -p api/services
# 上传 translation-service.js

# 2. 修改 processed-jobs API
# 更新 api/data/processed-jobs.js

# 3. 创建定时任务
mkdir -p api/cron
# 上传 sync-jobs.js

# 4. 配置 vercel.json
# 添加 cron 配置

# 5. 设置环境变量
# 在 Vercel Dashboard 中设置:
# - DEEPL_API_KEY
# - ENABLE_AUTO_TRANSLATION=true
# - CRON_SECRET=your_secret_here
```

#### Step 2: 部署前端

```bash
# 1. 修改前端代码
# 移除翻译逻辑，直接使用 translations 字段

# 2. 提交代码
git add .
git commit -m "架构升级：后端预翻译机制"
git push origin develop

# 3. Vercel 自动部署
```

#### Step 3: 数据迁移

```bash
# 手动触发一次翻译，确保现有数据都有翻译
curl -X POST https://haigoo.vercel.app/api/cron/sync-jobs \
  -H "Authorization: Bearer your_cron_secret"
```

### 5.3 监控和回滚

#### 监控指标
- 页面加载时间 (Vercel Analytics)
- API 调用成功率
- 翻译任务执行状态
- 错误日志

#### 回滚方案
如果出现问题，可以：
1. 在环境变量中设置 `ENABLE_AUTO_TRANSLATION=false`
2. 前端临时恢复翻译逻辑
3. 使用 git revert 回滚代码

---

## 📊 预期成果

### 性能提升

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| **首页加载** | 5-10秒 | < 1秒 | **90%** ↓ |
| **全部岗位加载** | 8-15秒 | < 2秒 | **85%** ↓ |
| **翻译API调用** | 30次/用户 | 30次/天 | **99%** ↓ |
| **服务器负载** | 高 | 低 | **80%** ↓ |

### 成本节省

假设：
- 每个用户访问需翻译 30 个岗位
- 每次翻译成本 ¥0.01
- 每天 100 个用户访问

**优化前成本**: 100 用户 × 30 岗位 × ¥0.01 = **¥30/天**

**优化后成本**: 1 次定时任务 × 30 岗位 × ¥0.01 = **¥0.3/天**

**节省**: **¥29.7/天** ≈ **¥10,800/年**

### 用户体验提升

- ✅ 无需等待翻译过程
- ✅ 页面即开即用
- ✅ 更流畅的浏览体验
- ✅ 支持更多并发用户

---

## 🎯 下一步行动

### 立即开始

1. **Week 1: 搭建后端翻译服务**
   - [ ] 创建 `api/services/translation-service.js`
   - [ ] 修改 `api/data/processed-jobs.js`
   - [ ] 配置环境变量
   - [ ] 测试翻译功能

2. **Week 2: 集成定时任务**
   - [ ] 创建 `api/cron/sync-jobs.js`
   - [ ] 配置 `vercel.json`
   - [ ] 测试定时任务
   - [ ] 添加手动触发按钮

3. **Week 3: 前端简化**
   - [ ] 移除前端翻译逻辑
   - [ ] 更新 UI 渲染
   - [ ] 测试页面功能

4. **Week 4: 上线**
   - [ ] 预发环境测试
   - [ ] 性能监控
   - [ ] 正式部署
   - [ ] 数据迁移

---

## 📞 支持和反馈

如有任何问题或建议，请随时反馈。让我们一起打造更快、更好的 Haigoo！🚀

---

**文档版本**: v1.0  
**最后更新**: 2025-11-12  
**作者**: Haigoo Team

