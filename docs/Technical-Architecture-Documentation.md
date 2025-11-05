# Haigoo 前后端技术架构文档

## 1. 系统架构概览

### 1.1 整体架构
```
┌─────────────────┐    ┌────────────────────────────┐    ┌─────────────────┐
│   前端 (React)   │────│  轻服务 (Vercel Functions) │────│  外部RSS源      │
│   - Vite        │    │  - Serverless/Edge        │    │  - WeWork      │
│   - TypeScript  │    │  - KV(可选)               │    │  - Remotive    │
│   - Tailwind    │    │  - Proxy/CORS             │    │  - Himalayas   │
└─────────────────┘    └────────────────────────────┘    └─────────────────┘
         │                       │
         │              ┌─────────────────┐
         └──────────────│  本地存储        │
                        │  - localStorage │
                        │  - sessionStorage│
                        └─────────────────┘
```

### 1.2 技术栈选择

#### 前端技术栈
- **框架**: React 18.2.0 + TypeScript 5.2.2
- **构建工具**: Vite 5.0.0
- **样式**: Tailwind CSS 3.3.6
- **状态管理**: Zustand 4.4.7
- **路由**: React Router DOM 6.20.1
- **表单处理**: React Hook Form 7.48.2 + Zod 3.22.4
- **图标**: Lucide React 0.294.0
- **HTTP客户端**: Axios 1.6.2

#### 后端/轻服务技术栈（生产）
- **平台**: Vercel Serverless Functions + Edge Functions
- **缓存**: Vercel KV（可选）
- **代理与跨域**: Edge Runtime 内置
- **HTTP请求**: fetch（Edge/Node）
- **XML解析**: xmldom 0.6.0（如在服务端解析）

#### 本地开发服务器（仅开发）
- **运行时**: Node.js 22.x
- **框架**: Express 5.1.0
- **跨域处理**: CORS 2.8.5

## 2. 前端架构详解

### 2.1 项目结构
```
src/
├── components/          # 可复用组件
│   ├── JobCard.tsx     # 岗位卡片组件
│   ├── JobDetailModal.tsx # 岗位详情弹窗
│   ├── FilterPanel.tsx # 筛选面板
│   └── ...
├── pages/              # 页面组件
│   ├── HomePage.tsx    # 首页
│   ├── AdminPage.tsx   # 管理页面
│   └── ...
├── services/           # 业务逻辑服务
│   ├── rss-service.ts  # RSS数据获取服务
│   ├── job-aggregator.ts # 岗位数据聚合服务
│   └── ...
├── types/              # TypeScript类型定义
│   ├── rss-types.ts    # RSS相关类型
│   └── ...
├── utils/              # 工具函数
├── hooks/              # 自定义Hook
└── contexts/           # React Context
```

### 2.2 核心组件设计

#### JobCard 组件
- **功能**: 展示单个岗位信息
- **Props**: Job对象
- **特性**: 
  - 响应式设计
  - 悬停效果
  - 键盘导航支持
  - 无障碍访问

#### JobDetailModal 组件
- **功能**: 展示岗位详细信息
- **特性**:
  - 模态弹窗
  - 滚动锁定
  - ESC键关闭
  - 外部点击关闭

### 2.3 状态管理

#### Zustand Store 结构
```typescript
interface AppState {
  // 岗位数据
  jobs: Job[];
  filteredJobs: Job[];
  
  // 筛选状态
  filters: JobFilter;
  
  // UI状态
  isLoading: boolean;
  selectedJob: Job | null;
  
  // 操作方法
  setJobs: (jobs: Job[]) => void;
  updateFilters: (filters: Partial<JobFilter>) => void;
  selectJob: (job: Job | null) => void;
}
```

## 3. 后端架构详解

### 3.1 开发环境服务器配置 (server.js，非生产)
```javascript
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件配置
app.use(cors());
app.use(express.json());

// RSS代理端点
app.get('/api/rss-proxy', async (req, res) => {
  // RSS数据获取和代理逻辑
});
```

### 3.2 API接口设计

#### RSS代理接口
- **端点**: `GET /api/rss-proxy`
- **参数**: 
  - `url`: RSS源URL
- **功能**:
  - 代理RSS请求
  - 处理CORS问题
  - 用户代理轮换
  - 超时控制
- **部署**: 生产环境由 Vercel Functions/Edge 提供该端点
- **响应**: XML或JSON（按需求）格式的RSS数据

### 3.3 错误处理机制
```javascript
// 统一错误处理
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});
```

## 4. 数据流架构

### 4.1 数据获取流程
```
1. 前端发起RSS数据请求
   ↓
2. 轻服务（Vercel Functions）代理RSS请求
   ↓
3. 获取外部RSS数据
   ↓
4. 返回XML数据给前端
   ↓
5. 前端解析XML数据
   ↓
6. 转换为标准Job格式
   ↓
7. 存储到本地存储
   ↓
8. 更新UI显示
```

### 4.2 数据缓存策略
- **本地存储**: 使用localStorage缓存岗位数据
- **缓存时效**: 24小时自动过期
- **增量更新**: 仅更新新增或变更的岗位
- **离线支持**: 缓存数据支持离线浏览

## 5. RSS数据处理架构

### 5.1 RSS服务 (rss-service.ts)

#### 支持的RSS源
```typescript
const RSS_SOURCES: RSSSource[] = [
  // WeWorkRemotely
  { name: 'WeWorkRemotely', category: '全部', url: 'https://weworkremotely.com/remote-jobs.rss' },
  { name: 'WeWorkRemotely', category: '前端编程', url: 'https://weworkremotely.com/categories/remote-front-end-programming-jobs.rss' },
  
  // Remotive
  { name: 'Remotive', category: '软件开发', url: 'https://remotive.com/remote-jobs/feed/software-dev' },
  
  // Himalayas
  { name: 'Himalayas', category: '全部', url: 'https://himalayas.app/jobs/rss' },
  
  // NoDesk
  { name: 'NoDesk', category: '全部', url: 'https://nodesk.substack.com/feed' }
];
```

#### 数据解析流程
```typescript
1. fetchRSSFeed(url) -> 获取RSS XML数据
2. parseRSSFeed(xmlData, source) -> 解析XML为RSSFeedItem[]
3. parseBySource() -> 根据不同源进行特定解析
4. 数据清洗和标准化
5. 返回标准化的Job对象
```

### 5.2 数据聚合服务 (job-aggregator.ts)

#### JobAggregator 类功能
- **数据加载**: 从localStorage加载历史数据
- **数据转换**: RSS Job → Page Job格式转换
- **薪资处理**: 薪资信息标准化
- **去重逻辑**: 基于URL和标题的去重

## 6. 部署架构

### 6.1 开发环境
```bash
# 前端开发服务器
npm run dev  # 启动Vite开发服务器 (端口3000)

# 后端服务器
node server.js  # 启动Express服务器 (端口3001)
```

### 6.2 生产环境
```bash
# 构建前端
npm run build

# 预览构建结果
npm run preview

# 生产部署
# 平台: Vercel
# 前端: 由 Vercel 构建与托管静态资源
# API: Vercel Serverless/Edge Functions（/api/rss-proxy、/api/translate、/api/recommendations）
```

### 6.3 环境配置
```javascript
// 开发环境
const API_BASE_URL = 'http://localhost:3001';

// 生产环境
const API_BASE_URL = '/api'; // 生产由Vercel Functions提供
```

## 7. 性能优化策略

### 7.1 前端优化
- **代码分割**: React.lazy() + Suspense
- **图片优化**: SVG图标，懒加载
- **缓存策略**: Service Worker缓存
- **包大小优化**: Tree shaking，按需导入

### 7.2 后端优化
- **请求缓存**: RSS数据缓存机制
- **并发控制**: 限制同时请求数量
- **错误重试**: 自动重试机制
- **超时控制**: 请求超时设置

## 8. 安全考虑

### 8.1 前端安全
- **XSS防护**: 内容转义，CSP策略
- **CSRF防护**: SameSite Cookie
- **敏感信息**: 不在前端存储敏感数据

### 8.2 后端安全
- **CORS配置**: 限制允许的域名
- **输入验证**: URL格式验证
- **速率限制**: API调用频率限制
- **错误信息**: 不暴露敏感错误信息

## 9. 监控和日志

### 9.1 错误监控
- **前端错误**: 全局错误捕获
- **后端错误**: Express错误中间件
- **网络错误**: 请求失败监控

### 9.2 性能监控
- **页面加载时间**: Performance API
- **API响应时间**: 请求耗时统计
- **资源使用**: 内存和CPU监控

## 10. 开发规范

### 10.1 代码规范
- **TypeScript**: 严格类型检查
- **ESLint**: 代码质量检查
- **Prettier**: 代码格式化
- **Git Hooks**: 提交前检查

### 10.2 组件规范
- **命名规范**: PascalCase组件名
- **Props接口**: 明确的TypeScript接口
- **默认值**: 合理的默认属性值
- **文档注释**: JSDoc注释

### 10.3 API规范
- **RESTful**: 遵循REST API设计原则
- **错误码**: 统一的HTTP状态码
- **响应格式**: 一致的JSON响应结构
- **版本控制**: API版本管理

---

**文档版本**: v1.0  
**最后更新**: 2025年11月  
**维护者**: Haigoo开发团队