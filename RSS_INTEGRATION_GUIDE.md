# RSS集成实现指南

## 概述

本文档详细说明了Haigoo Remote Assistant项目中RSS数据集成的完整实现方案，包括架构设计、数据流程、关键组件和部署配置。

## 架构概览

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   RSS Sources   │───▶│  RSS Proxy      │───▶│   Frontend      │
│                 │    │  (Node.js)      │    │   (React)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ Job Aggregator  │
                       │   (TypeScript)  │
                       └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ Storage Layer   │
                       │ (LocalStorage/  │
                       │  Cloud Storage) │
                       └─────────────────┘
```

## 核心组件

### 1. RSS代理服务器 (server.js)

**功能**: 解决CORS问题，代理RSS请求
**端口**: 3001
**主要端点**: `/api/rss-proxy?url={RSS_URL}`

```javascript
// 关键实现
app.get('/api/rss-proxy', async (req, res) => {
  const { url } = req.query;
  // 获取RSS数据并返回XML
});
```

### 2. RSS服务 (src/services/rss-service.ts)

**功能**: RSS数据解析和标准化
**主要方法**:
- `fetchRSSFeed(url: string)`: 获取RSS数据
- `parseRSSData(xmlData: string)`: 解析XML为标准格式
- `syncAllFeeds()`: 同步所有RSS源

**支持的RSS源**:
- WeWorkRemotely (12个分类)
- Remotive (14个分类)
- Himalayas
- JobsCollider (15个分类)
- RealWorkFromAnywhere (14个分类)

### 3. 职位聚合器 (src/services/job-aggregator.ts)

**功能**: 职位数据聚合、去重、分类
**核心特性**:
- 智能分类映射
- 薪资解析 (支持多种格式和货币)
- 经验等级判断
- 远程工作识别
- 数据去重 (基于URL和来源的哈希)

**数据转换流程**:
```
RSS Item → Job Object → Storage → Frontend Display
```

### 4. 前端集成 (src/pages/JobsPage.tsx)

**功能**: 展示和筛选RSS职位数据
**新增特性**:
- RSS数据与本地数据统一展示
- 支持RSS数据字段的筛选
- 优化的JobCard组件显示

## 数据模型

### RSS Job类型 (src/types/rss-types.ts)

```typescript
interface Job {
  id: string;
  title: string;
  company: string;
  location?: string;
  category?: JobCategory;
  experienceLevel?: 'Entry' | 'Mid' | 'Senior' | 'Lead' | 'Executive';
  isRemote?: boolean;
  remoteLocationRestriction?: string;
  salary?: {
    min: number;
    max: number;
    currency: string;
  };
  description: string;
  requirements: string[];
  responsibilities: string[];
  skills: string[];
  postedAt: string;
  expiresAt?: string;
  source: string;
  sourceUrl: string;
  status: 'active' | 'closed' | 'draft';
}
```

### 数据映射

RSS数据字段映射到标准Job对象:

| RSS字段 | Job字段 | 处理逻辑 |
|---------|---------|----------|
| title | title | 直接映射 |
| description | description | HTML标签清理 |
| link | sourceUrl | 直接映射 |
| pubDate | postedAt | 日期格式化 |
| category | category | 智能分类映射 |
| - | company | 从描述中提取 |
| - | salary | 从标题/描述解析 |
| - | experienceLevel | 关键词匹配 |
| - | isRemote | 关键词识别 |

## 部署配置

### 开发环境

1. **启动RSS代理服务器**:
```bash
node server.js
# 运行在 http://localhost:3001
```

2. **启动前端开发服务器**:
```bash
npm run dev
# 运行在 http://localhost:3000
```

### 生产环境

1. **Vercel部署配置** (vercel.json):
```json
{
  "functions": {
    "api/rss-proxy.js": {
      "runtime": "nodejs18.x"
    }
  },
  "rewrites": [
    {
      "source": "/api/rss-proxy",
      "destination": "/api/rss-proxy.js"
    }
  ]
}
```

2. **环境变量**:
- 无需额外环境变量
- RSS源URL在代码中硬编码

## 性能优化

### 1. 数据缓存
- 本地存储缓存RSS数据
- 避免重复请求相同RSS源

### 2. 去重机制
- 基于URL和来源生成唯一ID
- 防止重复职位显示

### 3. 分页加载
- 前端支持分页显示
- 减少初始加载时间

### 4. 错误处理
- RSS源不可用时的降级处理
- 网络错误重试机制

## 测试

### 端到端测试

运行测试脚本验证系统功能:

```bash
node test-job-aggregator.mjs
```

测试覆盖:
- ✅ RSS代理服务器连通性
- ✅ 前端服务器响应
- ✅ RSS数据获取和解析
- ✅ 职位数据展示

### 手动测试

1. **RSS代理测试**:
```bash
curl "http://localhost:3001/api/rss-proxy?url=https://weworkremotely.com/categories/remote-programming-jobs.rss"
```

2. **前端功能测试**:
- 访问 http://localhost:3000/jobs
- 验证职位数据加载
- 测试筛选功能
- 检查JobCard显示

## 故障排除

### 常见问题

1. **CORS错误**:
   - 确保RSS代理服务器运行在3001端口
   - 检查代理服务器的CORS配置

2. **RSS数据不显示**:
   - 检查RSS源是否可访问
   - 验证数据解析逻辑
   - 查看浏览器控制台错误

3. **类型错误**:
   - 运行 `npx tsc --noEmit` 检查类型
   - 确保RSS数据类型定义正确

### 调试工具

1. **浏览器开发者工具**:
   - Network标签查看API请求
   - Console查看错误信息

2. **服务器日志**:
   - RSS代理服务器控制台输出
   - 前端开发服务器HMR日志

## 未来改进

### 短期目标
- [ ] 添加更多RSS源
- [ ] 优化数据解析准确性
- [ ] 实现数据持久化存储

### 长期目标
- [ ] 实现RSS源管理界面
- [ ] 添加职位推荐算法
- [ ] 支持用户自定义RSS源
- [ ] 实现实时数据更新

## 维护指南

### 定期维护任务

1. **RSS源检查** (每月):
   - 验证RSS源可用性
   - 更新失效的RSS URL
   - 添加新的优质RSS源

2. **性能监控** (每周):
   - 检查数据同步性能
   - 监控存储使用情况
   - 优化慢查询

3. **数据质量** (每周):
   - 检查数据解析准确性
   - 验证分类映射正确性
   - 清理重复或无效数据

### 更新流程

1. **添加新RSS源**:
   - 更新 `src/services/rss-service.ts` 中的RSS源列表
   - 测试新源的数据格式
   - 更新分类映射规则

2. **修改数据结构**:
   - 更新类型定义
   - 修改数据转换逻辑
   - 更新前端显示组件
   - 运行完整测试

---

*最后更新: 2024年1月*
*版本: 1.0*