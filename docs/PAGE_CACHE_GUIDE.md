# 📦 页面缓存机制使用指南

## 概述

为了避免频繁切换页面导致数据重新加载，我们实现了一套完整的页面缓存机制。该机制支持：

- ✅ 内存缓存（快速访问）
- ✅ 持久化缓存（localStorage，可选）
- ✅ 自定义过期时间（TTL）
- ✅ 手动刷新按钮
- ✅ 命名空间隔离
- ✅ React Hook 集成

## 核心服务

### PageCacheService

位置：`src/services/page-cache-service.ts`

提供底层缓存管理功能：

```typescript
import { pageCacheService } from '../services/page-cache-service'

// 设置缓存
pageCacheService.set('my-key', data, {
  ttl: 5 * 60 * 1000, // 5分钟过期
  persist: true, // 持久化到 localStorage
  namespace: 'homepage' // 命名空间
})

// 获取缓存
const data = pageCacheService.get('my-key', {
  namespace: 'homepage'
})

// 清除缓存
pageCacheService.delete('my-key')
pageCacheService.clear('homepage') // 清除命名空间
pageCacheService.clear() // 清除所有
```

## React Hook

### usePageCache

位置：`src/hooks/usePageCache.ts`

简化页面中的缓存使用：

#### 基础用法

```typescript
import { usePageCache } from '../hooks/usePageCache'

function MyPage() {
  const { data, loading, error, refresh } = usePageCache('my-page-data', {
    fetcher: async () => {
      // 数据加载逻辑
      return await api.getData()
    },
    ttl: 5 * 60 * 1000, // 5分钟缓存
    persist: true // 持久化
  })
  
  return (
    <div>
      <button onClick={refresh}>刷新</button>
      {loading && <div>加载中...</div>}
      {error && <div>错误: {error.message}</div>}
      {data && <div>{/* 渲染数据 */}</div>}
    </div>
  )
}
```

#### 完整示例

```typescript
const {
  data,           // 缓存的数据
  loading,        // 是否正在加载
  error,          // 错误信息
  refresh,        // 强制刷新（清除缓存）
  reload,         // 重新加载（使用缓存）
  clearCache,     // 仅清除缓存
  isFromCache,    // 是否来自缓存
  cacheAge        // 缓存年龄（毫秒）
} = usePageCache('jobs-list', {
  fetcher: async () => await jobService.getJobs(),
  
  // 缓存配置
  ttl: 5 * 60 * 1000,     // 5分钟过期
  persist: true,           // 持久化到 localStorage
  namespace: 'jobs',       // 命名空间
  
  // 自动加载配置
  autoLoad: true,          // 挂载时自动加载
  dependencies: [filters], // 依赖变化时刷新
  
  // 回调
  onSuccess: (data) => {
    console.log('数据加载成功', data)
  },
  onError: (error) => {
    console.error('数据加载失败', error)
  }
})
```

## 实战案例

### 案例 1: HomePage 集成缓存

```typescript
// src/pages/HomePage.tsx
import { usePageCache } from '../hooks/usePageCache'
import { processedJobsService } from '../services/processed-jobs-service'
import { jobTranslationService } from '../services/job-translation-service'

export default function HomePage() {
  const {
    data: jobs,
    loading,
    error,
    refresh,
    isFromCache,
    cacheAge
  } = usePageCache('homepage-jobs', {
    fetcher: async () => {
      // 原有的数据加载逻辑
      const response = await processedJobsService.getProcessedJobs(1, 30)
      const translatedJobs = await jobTranslationService.translateJobs(response.jobs)
      return translatedJobs
    },
    ttl: 0, // 永不过期，只有手动刷新才更新
    persist: true, // 持久化到 localStorage
    namespace: 'homepage',
    onSuccess: (jobs) => {
      console.log(`加载了 ${jobs.length} 个岗位`)
    }
  })
  
  return (
    <div>
      {/* 刷新按钮 */}
      <button onClick={refresh} disabled={loading}>
        {loading ? '刷新中...' : '刷新'}
      </button>
      
      {/* 缓存状态指示 */}
      {isFromCache && (
        <div>来自缓存 ({Math.floor((cacheAge || 0) / 1000)}秒前)</div>
      )}
      
      {/* 原有的页面内容 */}
      {jobs && jobs.map(job => <JobCard key={job.id} job={job} />)}
    </div>
  )
}
```

### 案例 2: JobsPage 带筛选条件

```typescript
// src/pages/JobsPage.tsx
export default function JobsPage() {
  const [filters, setFilters] = useState({
    type: 'all',
    category: 'all',
    location: 'all'
  })
  
  const {
    data: jobs,
    loading,
    refresh
  } = usePageCache('jobs-list', {
    fetcher: async () => {
      const response = await processedJobsService.getAllProcessedJobs()
      return await jobTranslationService.translateJobs(response.jobs)
    },
    ttl: 10 * 60 * 1000, // 10分钟缓存
    persist: true,
    namespace: 'jobs',
    // 当筛选条件变化时，不刷新原始数据，只在前端筛选
    // 如果需要后端筛选，可以将 filters 加入 dependencies
    dependencies: [] // 不依赖筛选条件
  })
  
  // 在前端进行筛选
  const filteredJobs = useMemo(() => {
    if (!jobs) return []
    return jobs.filter(job => {
      if (filters.type !== 'all' && job.type !== filters.type) return false
      if (filters.category !== 'all' && job.category !== filters.category) return false
      if (filters.location !== 'all' && !job.location.includes(filters.location)) return false
      return true
    })
  }, [jobs, filters])
  
  return (
    <div>
      {/* 筛选器 */}
      <Filters filters={filters} onChange={setFilters} />
      
      {/* 刷新按钮 */}
      <button onClick={refresh}>刷新数据</button>
      
      {/* 岗位列表 */}
      {filteredJobs.map(job => <JobCard key={job.id} job={job} />)}
    </div>
  )
}
```

### 案例 3: 带依赖项的自动刷新

```typescript
function UserProfilePage() {
  const { user } = useAuth()
  
  const {
    data: profile,
    loading,
    refresh
  } = usePageCache(`user-profile-${user?.id}`, {
    fetcher: async () => {
      return await userService.getProfile(user!.id)
    },
    ttl: 2 * 60 * 1000, // 2分钟缓存
    persist: false, // 不持久化（敏感数据）
    namespace: 'user',
    dependencies: [user?.id], // 用户ID变化时自动刷新
    autoLoad: !!user // 只有登录后才加载
  })
  
  if (!user) {
    return <div>请先登录</div>
  }
  
  return (
    <div>
      {loading && <Loading />}
      {profile && <ProfileCard profile={profile} />}
    </div>
  )
}
```

## 配置选项说明

### 缓存选项 (CacheOptions)

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ttl` | `number` | `300000` (5分钟) | 缓存过期时间（毫秒），设为 `0` 表示永不过期 |
| `persist` | `boolean` | `false` | 是否持久化到 localStorage |
| `namespace` | `string` | - | 命名空间，用于隔离不同模块的缓存 |

### Hook 选项 (UsePageCacheOptions)

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `fetcher` | `() => Promise<T>` | **必填** | 数据加载函数 |
| `autoLoad` | `boolean` | `true` | 是否在挂载时自动加载 |
| `dependencies` | `any[]` | `[]` | 依赖项数组，变化时刷新 |
| `onSuccess` | `(data: T) => void` | - | 加载成功回调 |
| `onError` | `(error: Error) => void` | - | 加载失败回调 |

### Hook 返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| `data` | `T | null` | 缓存的数据 |
| `loading` | `boolean` | 是否正在加载 |
| `error` | `Error | null` | 错误信息 |
| `refresh` | `() => Promise<void>` | 强制刷新（清除缓存并重新加载） |
| `reload` | `() => Promise<void>` | 重新加载（使用缓存） |
| `clearCache` | `() => void` | 仅清除缓存 |
| `isFromCache` | `boolean` | 是否来自缓存 |
| `cacheAge` | `number | null` | 缓存年龄（毫秒） |

## 最佳实践

### 1. 选择合适的缓存策略

```typescript
// ✅ 推荐：首页推荐岗位 - 永久缓存，手动刷新
usePageCache('homepage', {
  fetcher: loadHomepageJobs,
  ttl: 0,           // 永不过期
  persist: true     // 持久化
})

// ✅ 推荐：全部岗位列表 - 较长缓存，自动过期
usePageCache('jobs', {
  fetcher: loadAllJobs,
  ttl: 10 * 60 * 1000,  // 10分钟
  persist: true
})

// ✅ 推荐：用户敏感数据 - 短缓存，不持久化
usePageCache('user-profile', {
  fetcher: loadUserProfile,
  ttl: 2 * 60 * 1000,   // 2分钟
  persist: false        // 不持久化
})
```

### 2. 使用命名空间管理缓存

```typescript
// 按模块划分命名空间
const homeCache = usePageCache('data', {
  namespace: 'homepage',
  fetcher: loadHomeData
})

const jobsCache = usePageCache('data', {
  namespace: 'jobs',
  fetcher: loadJobsData
})

// 可以独立清除某个模块的缓存
pageCacheService.clear('homepage') // 只清除首页缓存
```

### 3. 提供用户反馈

```typescript
function MyPage() {
  const { data, loading, refresh, isFromCache, cacheAge } = usePageCache(...)
  
  return (
    <div>
      {/* 显示缓存状态 */}
      {isFromCache && !loading && (
        <div className="text-sm text-gray-500">
          数据已缓存 ({formatDuration(cacheAge)})
          <button onClick={refresh}>刷新</button>
        </div>
      )}
      
      {/* 加载状态 */}
      {loading && <LoadingSpinner />}
      
      {/* 数据展示 */}
      {data && <DataDisplay data={data} />}
    </div>
  )
}
```

### 4. 处理错误

```typescript
const { data, error, refresh } = usePageCache('my-data', {
  fetcher: loadData,
  onError: (error) => {
    // 错误上报
    errorReportingService.report(error)
  }
})

if (error) {
  return (
    <ErrorMessage 
      message={error.message}
      onRetry={refresh}
    />
  )
}
```

## 调试工具

### 查看缓存信息

```typescript
// 在浏览器控制台执行
import { pageCacheService } from './services/page-cache-service'

// 查看所有缓存
const info = pageCacheService.getInfo()
console.log('总缓存数:', info.totalEntries)
console.log('缓存详情:', info.entries)

// 查看特定命名空间
const homepageInfo = pageCacheService.getInfo('homepage')
console.log('首页缓存:', homepageInfo)
```

### 清除缓存

```typescript
// 清除特定页面缓存
pageCacheService.delete('homepage-jobs')

// 清除特定命名空间
pageCacheService.clear('homepage')

// 清除所有缓存
pageCacheService.clear()
```

## 迁移指南

### 将现有页面迁移到缓存机制

**修改前:**

```typescript
export default function HomePage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await processedJobsService.getProcessedJobs(1, 30)
        const translatedJobs = await jobTranslationService.translateJobs(response.jobs)
        setJobs(translatedJobs)
      } catch (err) {
        console.error('获取职位数据失败:', err)
        setError('获取职位数据失败')
      } finally {
        setLoading(false)
      }
    }
    
    fetchJobs()
  }, [])
  
  return <div>...</div>
}
```

**修改后:**

```typescript
export default function HomePage() {
  const { data: jobs, loading, error, refresh } = usePageCache('homepage-jobs', {
    fetcher: async () => {
      const response = await processedJobsService.getProcessedJobs(1, 30)
      return await jobTranslationService.translateJobs(response.jobs)
    },
    ttl: 0,
    persist: true,
    namespace: 'homepage'
  })
  
  return (
    <div>
      <button onClick={refresh}>刷新</button>
      {/* 其余代码不变 */}
    </div>
  )
}
```

## 性能优化

### 1. 合理设置 TTL

```typescript
// 高频访问，长缓存
{ ttl: 0 }                    // 首页 - 永不过期

// 中频访问，中缓存
{ ttl: 10 * 60 * 1000 }      // 列表页 - 10分钟

// 实时性要求高，短缓存
{ ttl: 1 * 60 * 1000 }       // 用户数据 - 1分钟
```

### 2. 选择性持久化

```typescript
// ✅ 持久化：公开数据，体积小
{ persist: true }  // 岗位列表

// ❌ 不持久化：敏感数据，体积大
{ persist: false } // 用户隐私信息、大文件
```

### 3. 避免过度缓存

```typescript
// ❌ 不好：缓存实时数据
usePageCache('chat-messages', { ttl: 5 * 60 * 1000 })

// ✅ 好：不缓存实时数据
const messages = useLiveData('chat-messages')
```

## 注意事项

1. **数据一致性**: 如果数据会被修改，记得在修改后清除缓存
2. **内存管理**: 大数据量建议设置 `persist: false`
3. **TTL 设置**: 根据数据更新频率合理设置
4. **命名规范**: 使用清晰的 key 和 namespace
5. **错误处理**: 始终处理 `error` 状态

## 故障排查

### 问题：缓存没有生效

```typescript
// 检查是否正确设置 ttl
console.log(pageCacheService.has('my-key'))

// 检查缓存是否过期
const age = pageCacheService.getAge('my-key')
console.log('缓存年龄:', age)
```

### 问题：localStorage 满了

```typescript
// 清理旧缓存
pageCacheService.clear()

// 或者减少持久化的数据
{ persist: false }
```

## 总结

页面缓存机制的核心价值：

- 🚀 **提升性能**: 减少不必要的网络请求
- 💾 **改善体验**: 切换页面无需等待加载
- 🔄 **灵活控制**: 支持手动刷新和自动过期
- 📦 **易于使用**: 简单的 Hook API
- 🛠️ **可调试**: 完善的调试工具

按照本指南集成缓存机制后，用户在切换页面时将获得流畅的体验！