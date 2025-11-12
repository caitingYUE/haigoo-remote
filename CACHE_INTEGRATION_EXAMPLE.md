# 页面缓存集成示例

本文档提供具体的代码修改示例，展示如何在现有的三个主要页面中集成缓存机制。

## 1. HomePage 集成（首页 - 推荐岗位）

### 修改策略
- **缓存策略**: 永久缓存（ttl: 0），只有点击刷新按钮才更新
- **持久化**: 是（persist: true），页面刷新后数据仍然存在
- **命名空间**: `homepage`

### 代码修改

**修改文件**: `src/pages/HomePage.tsx`

#### 1.1 导入依赖

```typescript
// 在文件顶部添加
import { usePageCache } from '../hooks/usePageCache'
```

#### 1.2 替换数据加载逻辑

**原来的代码** (约第88-170行):
```typescript
export default function HomePage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [todayRecommendations, setTodayRecommendations] = useState<Job[]>([])
  
  // 获取处理后的职位数据
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await processedJobsService.getProcessedJobs(1, 30)
        if (response.jobs.length > 0) {
          const translatedJobs = await jobTranslationService.translateJobs(response.jobs)
          setJobs(translatedJobs)
          setLastUpdateTime(new Date())
        }
      } catch (err) {
        console.error('获取职位数据失败:', err)
        setError('获取职位数据失败')
      } finally {
        setLoading(false)
      }
    }
    
    fetchJobs()
  }, [])
  
  // ...其他代码
}
```

**修改后的代码**:
```typescript
export default function HomePage() {
  // 使用缓存 Hook 替代原有的状态管理
  const {
    data: jobs,
    loading,
    error: loadError,
    refresh,
    isFromCache,
    cacheAge
  } = usePageCache<Job[]>('homepage-recommendations', {
    fetcher: async () => {
      // 保留原有的数据加载逻辑
      const response = await processedJobsService.getProcessedJobs(1, 30)
      if (response.jobs.length > 0) {
        const translatedJobs = await jobTranslationService.translateJobs(response.jobs)
        return translatedJobs
      }
      return []
    },
    ttl: 0, // 永不过期，只有手动刷新才更新
    persist: true, // 持久化到 localStorage
    namespace: 'homepage',
    onSuccess: (jobs) => {
      setLastUpdateTime(new Date())
      console.log(`✅ 首页加载了 ${jobs.length} 个岗位推荐${isFromCache ? '（来自缓存）' : '（新数据）'}`)
    },
    onError: (err) => {
      console.error('❌ 获取职位数据失败:', err)
    }
  })
  
  // 保留其他原有状态
  const [todayRecommendations, setTodayRecommendations] = useState<Job[]>([])
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [savedJobs, setSavedJobs] = useState<Set<string>>(new Set())
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null)
  // ...其他状态保持不变
  
  // 将 error 转换为字符串格式（保持原有逻辑兼容）
  const error = loadError?.message || null
  
  // ...其他代码保持不变
}
```

#### 1.3 添加刷新按钮

在页面顶部添加刷新按钮（约第290行，`<div className="space-y-12">` 之前）:

```typescript
{/* 页面头部：标题 + 刷新按钮 + 缓存状态 */}
<div className="flex items-center justify-between mb-6">
  <div>
    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
      今日推荐
    </h2>
    {isFromCache && cacheAge && (
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
        数据已缓存 • 更新于 {Math.floor(cacheAge / 1000 / 60)} 分钟前
      </p>
    )}
  </div>
  
  <button
    onClick={refresh}
    disabled={loading}
    className="flex items-center gap-2 px-4 py-2 bg-haigoo-primary text-white rounded-lg hover:bg-haigoo-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
    aria-label="刷新推荐岗位"
  >
    <svg 
      className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
      />
    </svg>
    {loading ? '刷新中...' : '刷新'}
  </button>
</div>
```

## 2. JobsPage 集成（全部岗位页面）

### 修改策略
- **缓存策略**: 10分钟过期（ttl: 10 * 60 * 1000）
- **持久化**: 是
- **命名空间**: `jobs`
- **筛选**: 在前端进行，不重新加载数据

### 代码修改

**修改文件**: `src/pages/JobsPage.tsx`

#### 2.1 导入依赖

```typescript
import { usePageCache } from '../hooks/usePageCache'
```

#### 2.2 替换数据加载逻辑

**原来的代码** (约第100-140行):
```typescript
const [jobs, setJobs] = useState<Job[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  const fetchJobs = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await processedJobsService.getAllProcessedJobs()
      const translatedJobs = await jobTranslationService.translateJobs(response.jobs)
      setJobs(translatedJobs)
    } catch (err) {
      console.error('加载岗位失败:', err)
      setError('加载岗位数据失败')
    } finally {
      setLoading(false)
    }
  }
  
  fetchJobs()
}, [])
```

**修改后的代码**:
```typescript
const {
  data: jobs,
  loading,
  error: loadError,
  refresh,
  isFromCache,
  cacheAge
} = usePageCache<Job[]>('all-jobs', {
  fetcher: async () => {
    const response = await processedJobsService.getAllProcessedJobs()
    return await jobTranslationService.translateJobs(response.jobs)
  },
  ttl: 10 * 60 * 1000, // 10分钟缓存
  persist: true,
  namespace: 'jobs',
  onSuccess: (jobs) => {
    console.log(`✅ 加载了 ${jobs.length} 个岗位${isFromCache ? '（来自缓存）' : ''}`)
  }
})

const error = loadError?.message || null
```

#### 2.3 添加刷新按钮

在搜索栏旁边添加刷新按钮（约第200行）:

```typescript
{/* 搜索和刷新栏 */}
<div className="flex gap-4 mb-6">
  {/* 搜索框 */}
  <div className="flex-1 relative">
    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
    <input
      ref={searchInputRef}
      type="text"
      placeholder="搜索岗位标题、公司名称..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-haigoo-primary focus:border-transparent"
    />
  </div>
  
  {/* 刷新按钮 */}
  <button
    onClick={refresh}
    disabled={loading}
    className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
    title={isFromCache ? `缓存数据，${Math.floor((cacheAge || 0) / 1000 / 60)}分钟前更新` : '最新数据'}
  >
    <svg 
      className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth={2} 
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
      />
    </svg>
    {loading ? '刷新中' : '刷新'}
  </button>
</div>

{/* 缓存状态提示 */}
{isFromCache && !loading && jobs && jobs.length > 0 && (
  <div className="mb-4 text-sm text-gray-500">
    💾 显示缓存数据（{Math.floor((cacheAge || 0) / 1000 / 60)} 分钟前）
  </div>
)}
```

## 3. RemoteExperiencePage 集成（远程经验分享页面）

### 修改策略
- **缓存策略**: 30分钟过期（内容更新不频繁）
- **持久化**: 是
- **命名空间**: `remote-experience`

### 代码修改

**修改文件**: `src/pages/RemoteExperiencePage.tsx`

#### 3.1 导入依赖

```typescript
import { usePageCache } from '../hooks/usePageCache'
```

#### 3.2 替换数据加载逻辑

如果当前使用 mock 数据：

```typescript
// 原来
const [posts, setPosts] = useState<Post[]>(mockPosts)

// 修改为
const {
  data: posts,
  loading,
  refresh
} = usePageCache<Post[]>('remote-experience-posts', {
  fetcher: async () => {
    // TODO: 替换为实际的 API 调用
    // const response = await experienceService.getPosts()
    // return response.posts
    
    // 临时返回 mock 数据
    return mockPosts
  },
  ttl: 30 * 60 * 1000, // 30分钟缓存
  persist: true,
  namespace: 'remote-experience'
})
```

## 4. 添加全局缓存管理（可选）

可以在 Header 组件中添加全局缓存管理功能：

**文件**: `src/components/Header.tsx`

```typescript
import { pageCacheService } from '../services/page-cache-service'

// 在某个地方添加清除缓存的功能（例如用户设置）
const handleClearAllCache = () => {
  if (confirm('确定要清除所有页面缓存吗？')) {
    pageCacheService.clear()
    window.location.reload() // 刷新页面
  }
}

// 或者添加到开发者工具
if (process.env.NODE_ENV === 'development') {
  // 在浏览器控制台暴露缓存管理工具
  (window as any).__pageCache = {
    service: pageCacheService,
    info: () => pageCacheService.getInfo(),
    clear: () => pageCacheService.clear(),
    clearNamespace: (ns: string) => pageCacheService.clear(ns)
  }
  
  console.log('💡 页面缓存工具已就绪，使用 window.__pageCache 访问')
}
```

## 5. 测试检查清单

集成完成后，请测试以下场景：

### ✅ 基础功能
- [ ] 首次访问页面，数据正常加载
- [ ] 切换到其他页面，再切回来，数据立即显示（来自缓存）
- [ ] 点击刷新按钮，数据重新加载
- [ ] 刷新浏览器，缓存的数据仍然存在（persist: true 的页面）

### ✅ 缓存过期
- [ ] 等待缓存过期后（如果设置了 ttl），数据自动重新加载
- [ ] ttl: 0 的页面，缓存永不过期，只能手动刷新

### ✅ 错误处理
- [ ] 网络错误时，显示错误信息
- [ ] 有缓存数据时，即使网络错误也能显示旧数据
- [ ] 错误恢复后，可以正常刷新

### ✅ 用户体验
- [ ] 加载状态正确显示
- [ ] 缓存状态提示清晰
- [ ] 刷新按钮响应及时
- [ ] 页面切换流畅，无白屏

## 6. 性能监控

添加性能监控代码（可选）：

```typescript
// src/utils/performance-monitor.ts
export function monitorCachePerformance() {
  const { service, info } = (window as any).__pageCache || {}
  
  if (!service) return
  
  setInterval(() => {
    const cacheInfo = info()
    console.table(cacheInfo.entries.map(e => ({
      key: e.key,
      age: `${Math.floor(e.age / 1000)}s`,
      size: `${(e.size / 1024).toFixed(2)}KB`
    })))
  }, 10000) // 每10秒输出一次
}
```

## 7. 故障排查

### 问题：缓存没有生效

```typescript
// 检查步骤
console.log('缓存是否存在:', pageCacheService.has('homepage-recommendations'))
console.log('缓存年龄:', pageCacheService.getAge('homepage-recommendations'))
console.log('缓存信息:', pageCacheService.getInfo())
```

### 问题：数据不刷新

```typescript
// 手动清除缓存
pageCacheService.delete('homepage-recommendations')
// 或
pageCacheService.clear('homepage')
```

### 问题：localStorage 满了

```typescript
// 查看缓存大小
const info = pageCacheService.getInfo()
const totalSize = info.entries.reduce((sum, e) => sum + e.size, 0)
console.log('总缓存大小:', (totalSize / 1024 / 1024).toFixed(2), 'MB')

// 清理旧缓存
pageCacheService.clear()
```

## 8. 总结

按照以上步骤完成集成后：

1. ✅ **HomePage**: 推荐数据永久缓存，切换页面秒开
2. ✅ **JobsPage**: 岗位列表10分钟缓存，减少服务器压力
3. ✅ **RemoteExperiencePage**: 经验分享30分钟缓存
4. ✅ **刷新按钮**: 用户可以手动更新数据
5. ✅ **缓存状态**: 显示数据来源和更新时间

用户体验显著提升！🎉

