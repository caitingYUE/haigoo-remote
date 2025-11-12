/**
 * 页面缓存服务
 * 用于缓存页面数据，避免频繁切换页面导致数据重新加载
 */

export interface CacheEntry<T> {
  data: T
  timestamp: number
  key: string
}

export interface CacheOptions {
  /**
   * 缓存过期时间（毫秒）
   * 默认: 5分钟 (300000ms)
   * 设置为 0 表示永不过期（直到手动刷新）
   */
  ttl?: number
  
  /**
   * 是否持久化到 localStorage
   * 默认: false (仅内存缓存)
   */
  persist?: boolean
  
  /**
   * 缓存键的命名空间
   */
  namespace?: string
}

class PageCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map()
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5分钟
  private readonly STORAGE_PREFIX = 'haigoo:page_cache:'
  
  /**
   * 设置缓存
   */
  set<T>(key: string, data: T, options?: CacheOptions): void {
    const cacheKey = this.getCacheKey(key, options?.namespace)
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      key: cacheKey
    }
    
    // 内存缓存
    this.cache.set(cacheKey, entry)
    
    // 持久化缓存（可选）
    if (options?.persist) {
      try {
        localStorage.setItem(
          this.STORAGE_PREFIX + cacheKey,
          JSON.stringify(entry)
        )
      } catch (error) {
        console.warn('Failed to persist cache to localStorage:', error)
      }
    }
  }
  
  /**
   * 获取缓存
   */
  get<T>(key: string, options?: CacheOptions): T | null {
    const cacheKey = this.getCacheKey(key, options?.namespace)
    const ttl = options?.ttl ?? this.DEFAULT_TTL
    
    // 1. 尝试从内存缓存获取
    let entry = this.cache.get(cacheKey)
    
    // 2. 如果内存中没有，尝试从 localStorage 恢复
    if (!entry && options?.persist) {
      try {
        const stored = localStorage.getItem(this.STORAGE_PREFIX + cacheKey)
        if (stored) {
          entry = JSON.parse(stored) as CacheEntry<T>
          // 恢复到内存缓存
          this.cache.set(cacheKey, entry)
        }
      } catch (error) {
        console.warn('Failed to restore cache from localStorage:', error)
      }
    }
    
    // 3. 检查缓存是否存在
    if (!entry) {
      return null
    }
    
    // 4. 检查缓存是否过期（ttl为0表示永不过期）
    if (ttl > 0) {
      const isExpired = Date.now() - entry.timestamp > ttl
      if (isExpired) {
        this.delete(key, options)
        return null
      }
    }
    
    return entry.data as T
  }
  
  /**
   * 检查缓存是否存在且未过期
   */
  has(key: string, options?: CacheOptions): boolean {
    const data = this.get(key, options)
    return data !== null
  }
  
  /**
   * 删除指定缓存
   */
  delete(key: string, options?: CacheOptions): boolean {
    const cacheKey = this.getCacheKey(key, options?.namespace)
    
    // 从内存删除
    const deleted = this.cache.delete(cacheKey)
    
    // 从 localStorage 删除
    if (options?.persist) {
      try {
        localStorage.removeItem(this.STORAGE_PREFIX + cacheKey)
      } catch (error) {
        console.warn('Failed to remove cache from localStorage:', error)
      }
    }
    
    return deleted
  }
  
  /**
   * 清除所有缓存
   */
  clear(namespace?: string): void {
    if (namespace) {
      // 清除指定命名空间的缓存
      const prefix = this.getCacheKey('', namespace)
      const keysToDelete: string[] = []
      
      this.cache.forEach((_, key) => {
        if (key.startsWith(prefix)) {
          keysToDelete.push(key)
        }
      })
      
      keysToDelete.forEach(key => {
        this.cache.delete(key)
        try {
          localStorage.removeItem(this.STORAGE_PREFIX + key)
        } catch (error) {
          console.warn('Failed to remove cache from localStorage:', error)
        }
      })
    } else {
      // 清除所有缓存
      this.cache.clear()
      
      // 清除 localStorage 中的所有缓存
      try {
        const keysToRemove: string[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && key.startsWith(this.STORAGE_PREFIX)) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))
      } catch (error) {
        console.warn('Failed to clear localStorage cache:', error)
      }
    }
  }
  
  /**
   * 获取缓存信息（用于调试）
   */
  getInfo(namespace?: string): {
    totalEntries: number
    entries: Array<{key: string; age: number; size: number}>
  } {
    const entries: Array<{key: string; age: number; size: number}> = []
    const now = Date.now()
    
    this.cache.forEach((entry, key) => {
      if (!namespace || key.startsWith(this.getCacheKey('', namespace))) {
        entries.push({
          key,
          age: now - entry.timestamp,
          size: JSON.stringify(entry.data).length
        })
      }
    })
    
    return {
      totalEntries: entries.length,
      entries: entries.sort((a, b) => b.age - a.age)
    }
  }
  
  /**
   * 生成缓存键
   */
  private getCacheKey(key: string, namespace?: string): string {
    return namespace ? `${namespace}:${key}` : key
  }
  
  /**
   * 获取缓存的年龄（毫秒）
   */
  getAge(key: string, options?: CacheOptions): number | null {
    const cacheKey = this.getCacheKey(key, options?.namespace)
    const entry = this.cache.get(cacheKey)
    return entry ? Date.now() - entry.timestamp : null
  }
  
  /**
   * 刷新缓存（更新时间戳但保留数据）
   */
  touch(key: string, options?: CacheOptions): boolean {
    const cacheKey = this.getCacheKey(key, options?.namespace)
    const entry = this.cache.get(cacheKey)
    
    if (entry) {
      entry.timestamp = Date.now()
      this.cache.set(cacheKey, entry)
      
      if (options?.persist) {
        try {
          localStorage.setItem(
            this.STORAGE_PREFIX + cacheKey,
            JSON.stringify(entry)
          )
        } catch (error) {
          console.warn('Failed to update cache in localStorage:', error)
        }
      }
      return true
    }
    
    return false
  }
}

// 导出单例
export const pageCacheService = new PageCacheService()

