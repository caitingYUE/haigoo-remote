# Vercel 部署数据存储指南

## 概述

本指南详细说明如何在 Vercel 上部署 Haigoo 职位聚合应用，并配置适合生产环境的数据存储解决方案。

## 当前数据存储方案分析

### 本地开发 vs Vercel 部署

| 特性 | 本地开发 (localStorage) | Vercel 部署 (推荐方案) |
|------|------------------------|----------------------|
| 数据持久性 | ❌ 浏览器本地，刷新保留 | ✅ 云端存储，全局共享 |
| 多用户访问 | ❌ 每个用户独立数据 | ✅ 所有用户共享数据 |
| 数据同步 | ❌ 仅本地有效 | ✅ 实时同步到云端 |
| 存储容量 | ❌ 5-10MB 限制 | ✅ 几乎无限制 |
| 性能 | ✅ 快速本地访问 | ✅ 优化的云端访问 |
| 成本 | ✅ 免费 | 💰 按使用量计费 |

## 推荐的 Vercel 存储方案

### 1. Vercel KV (Redis) - 推荐 ⭐⭐⭐⭐⭐

**适用场景**: 高频读写、实时数据、缓存

```bash
# 安装依赖
npm install @vercel/kv
```

**配置环境变量**:
```env
# .env.local
KV_URL="redis://..."
KV_REST_API_URL="https://..."
KV_REST_API_TOKEN="..."
KV_REST_API_READ_ONLY_TOKEN="..."
```

**优势**:
- ✅ 超快的读写性能
- ✅ 自动扩展
- ✅ 内置缓存优化
- ✅ 简单的 API
- ✅ 免费额度: 30,000 次请求/月

**成本**: 
- 免费: 30K 请求/月, 256MB 存储
- Pro: $0.25/100K 请求, $0.25/GB/月

### 2. Vercel Postgres - 备选方案 ⭐⭐⭐⭐

**适用场景**: 复杂查询、关系数据、长期存储

```bash
# 安装依赖
npm install @vercel/postgres
```

**优势**:
- ✅ 完整的 SQL 支持
- ✅ 复杂查询和索引
- ✅ 数据完整性保证
- ✅ 备份和恢复

**成本**:
- 免费: 60 小时计算时间/月, 256MB 存储
- Pro: $0.25/小时, $0.25/GB/月

### 3. Supabase - 第三方方案 ⭐⭐⭐

**适用场景**: 需要实时功能、认证、文件存储

```bash
# 安装依赖
npm install @supabase/supabase-js
```

**优势**:
- ✅ 实时订阅
- ✅ 内置认证
- ✅ 文件存储
- ✅ 慷慨的免费额度

## 实施步骤

### 步骤 1: 选择存储方案

根据您的需求选择合适的存储方案：

```typescript
// src/services/storage-config.ts
export const storageConfig = {
  // 开发环境
  development: {
    provider: 'localStorage' as const
  },
  // 生产环境 - Vercel KV
  production: {
    provider: 'vercel-kv' as const,
    config: {
      url: process.env.KV_URL,
      token: process.env.KV_REST_API_TOKEN
    }
  }
};
```

### 步骤 2: 安装必要依赖

```bash
# 选择一个存储方案安装
npm install @vercel/kv          # Vercel KV
# 或
npm install @vercel/postgres    # Vercel Postgres  
# 或
npm install @supabase/supabase-js  # Supabase
```

### 步骤 3: 配置环境变量

在 Vercel 项目设置中添加环境变量：

**Vercel KV**:
```
KV_URL=redis://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
```

**Vercel Postgres**:
```
POSTGRES_URL=postgresql://...
POSTGRES_PRISMA_URL=postgresql://...
POSTGRES_URL_NON_POOLING=postgresql://...
```

### 步骤 4: 更新存储服务

```typescript
// src/services/job-aggregator.ts
import { createStorageAdapter } from './cloud-storage-adapter';

export class JobAggregator {
  private storageAdapter = createStorageAdapter({
    provider: process.env.NODE_ENV === 'production' ? 'vercel-kv' : 'localStorage'
  });

  // ... 其他代码保持不变
}
```

### 步骤 5: 部署到 Vercel

```bash
# 部署到 Vercel
vercel --prod

# 或使用 Git 集成自动部署
git push origin main
```

## 数据迁移策略

### 从 localStorage 迁移到云存储

```typescript
// 一次性迁移脚本
async function migrateToCloud() {
  const localData = localStorage.getItem('haigoo:jobs');
  if (localData) {
    const jobs = JSON.parse(localData);
    await cloudStorageAdapter.saveJobs(jobs);
    console.log(`已迁移 ${jobs.length} 个职位到云存储`);
  }
}
```

## 性能优化建议

### 1. 数据缓存策略

```typescript
// 实现多层缓存
class OptimizedStorageService {
  private memoryCache = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5分钟

  async loadJobs(): Promise<Job[]> {
    // 1. 检查内存缓存
    const cached = this.memoryCache.get('jobs');
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    // 2. 从云存储加载
    const jobs = await this.cloudStorage.loadJobs();
    
    // 3. 更新缓存
    this.memoryCache.set('jobs', {
      data: jobs,
      timestamp: Date.now()
    });

    return jobs;
  }
}
```

### 2. 批量操作优化

```typescript
// 批量保存，减少 API 调用
async function batchSaveJobs(jobs: Job[]) {
  const BATCH_SIZE = 100;
  const batches = [];
  
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    batches.push(jobs.slice(i, i + BATCH_SIZE));
  }

  await Promise.all(
    batches.map(batch => storageAdapter.addJobs(batch))
  );
}
```

### 3. 数据压缩

```typescript
// 压缩存储数据
import { compress, decompress } from 'lz-string';

async function saveCompressedJobs(jobs: Job[]) {
  const compressed = compress(JSON.stringify(jobs));
  await kv.set('jobs:compressed', compressed);
}
```

## 监控和维护

### 1. 存储使用量监控

```typescript
async function getStorageStats() {
  const stats = await storageAdapter.getStats();
  return {
    totalJobs: stats.totalJobs,
    storageSize: JSON.stringify(await storageAdapter.loadJobs()).length,
    lastSync: await storageAdapter.getLastSyncTime()
  };
}
```

### 2. 自动清理策略

```typescript
// 定期清理过期数据
async function cleanupOldJobs() {
  const jobs = await storageAdapter.loadJobs();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const recentJobs = jobs.filter(job => 
    new Date(job.publishedAt) > oneMonthAgo
  );

  await storageAdapter.saveJobs(recentJobs);
  console.log(`清理了 ${jobs.length - recentJobs.length} 个过期职位`);
}
```

## 成本估算

### Vercel KV 成本示例

假设每天同步 1000 个职位，每个用户访问 50 次：

```
月度操作数:
- 写入: 1000 职位/天 × 30 天 = 30,000 次
- 读取: 50 访问/用户/天 × 100 用户 × 30 天 = 150,000 次
- 总计: 180,000 次操作/月

成本:
- 免费额度: 30,000 次 (免费)
- 超出部分: 150,000 次 × $0.25/100K = $0.375/月
- 存储: 10MB × $0.25/GB = $0.0025/月
- 总成本: ~$0.38/月
```

## 最佳实践

### 1. 环境配置

```typescript
// 根据环境自动选择存储方案
const getStorageConfig = () => {
  if (process.env.VERCEL_ENV === 'production') {
    return { provider: 'vercel-kv' };
  }
  if (process.env.VERCEL_ENV === 'preview') {
    return { provider: 'vercel-kv' }; // 预览环境也使用 KV
  }
  return { provider: 'localStorage' }; // 本地开发
};
```

### 2. 错误处理和回退

```typescript
class RobustStorageService {
  private primaryStorage = new VercelKVProvider();
  private fallbackStorage = new LocalStorageProvider();

  async saveJobs(jobs: Job[]): Promise<void> {
    try {
      await this.primaryStorage.saveJobs(jobs);
    } catch (error) {
      console.warn('主存储失败，使用备用存储:', error);
      await this.fallbackStorage.saveJobs(jobs);
    }
  }
}
```

### 3. 数据验证

```typescript
// 保存前验证数据
function validateJobs(jobs: Job[]): Job[] {
  return jobs.filter(job => 
    job.title && 
    job.company && 
    job.publishedAt &&
    new Date(job.publishedAt).getTime() > 0
  );
}
```

## 总结

对于 Vercel 部署，推荐使用 **Vercel KV** 作为主要存储方案：

1. **性能优异**: Redis 基础，毫秒级响应
2. **成本合理**: 免费额度足够小型应用
3. **易于集成**: 官方支持，配置简单
4. **自动扩展**: 无需手动管理容量

通过本指南的配置，您的应用将具备：
- ✅ 生产级数据持久性
- ✅ 多用户数据共享
- ✅ 高性能数据访问
- ✅ 成本可控的扩展性

现在您可以放心地将应用部署到 Vercel，享受云端数据存储的所有优势！