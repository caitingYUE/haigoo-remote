# Haigoo Remote Assistant 开发交接文档

## 📋 项目概览

### 项目基本信息
- **项目名称**: Haigoo Remote Assistant
- **项目定位**: 海外远程工作助手
- **技术栈**: React + TypeScript + Vite + Tailwind CSS + Zustand + Vercel Functions/Edge（Express 仅用于本地开发）
- **部署平台**: Vercel
- **代码仓库**: https://github.com/caitingYUE/haigoo-remote
- **在线地址**: https://haigoo.vercel.app

### 核心功能
1. **智能简历优化** - 基于AI的简历分析和优化建议
2. **职位智能匹配** - RSS聚合多个远程工作平台的职位信息
3. **面试准备助手** - AI驱动的面试问题和准备指导
4. **个人档案管理** - 用户技能和经验管理

## 🏗️ 项目架构

### 技术栈详情
```
前端技术栈:
├── React 18.2.0          # 核心框架
├── TypeScript 5.2.2      # 类型安全
├── Vite 5.0.0           # 构建工具
├── Tailwind CSS 3.3.6   # 样式框架
├── Zustand 4.4.7        # 状态管理
├── React Router 6.20.1  # 路由管理
├── React Hook Form 7.48.2 # 表单处理
├── Axios 1.6.2          # HTTP客户端
└── Lucide React 0.294.0 # 图标库

轻服务/生产技术栈:
├── Vercel Serverless Functions  # API端点（/api/*）
├── Vercel Edge Functions        # 轻量代理/跨域处理
├── fetch                        # HTTP请求（Edge/Node）
└── xmldom 0.6.0                 # XML解析（如在服务端解析）

本地开发服务器（仅开发）:
├── Node.js 22.x         # 运行环境
├── Express 5.1.0        # 本地代理（server.js）
└── CORS 2.8.5           # 跨域处理

AI服务:
└── 阿里百炼大模型       # 核心AI能力
```

### 项目结构
```
haigoo-assistant/
├── api/                    # Vercel Serverless Functions
│   ├── rss-proxy.js       # RSS代理服务
│   └── translate.js       # 翻译服务
├── docs/                  # 项目文档
│   ├── Technical-Architecture-Documentation.md
│   ├── Data-Format-Specification.md
│   ├── Frontend-Display-Rules-Documentation.md
│   └── Developer-Handover-Documentation.md
├── src/
│   ├── components/        # 可复用组件
│   │   ├── JobCard.tsx   # 职位卡片
│   │   ├── JobDetailModal.tsx # 职位详情弹窗
│   │   ├── FilterDropdown.tsx # 筛选下拉框
│   │   └── ...
│   ├── pages/            # 页面组件
│   │   ├── HomePage.tsx  # 首页
│   │   ├── JobsPage.tsx  # 职位列表页
│   │   ├── AdminDashboardPage.tsx # 管理后台
│   │   └── ...
│   ├── services/         # 业务逻辑服务
│   │   ├── rss-service.ts # RSS数据获取
│   │   ├── job-aggregator.ts # 职位数据聚合
│   │   ├── ai-service.ts # AI服务接口
│   │   └── ...
│   ├── types/           # TypeScript类型定义
│   ├── utils/           # 工具函数
│   └── hooks/           # 自定义Hooks
├── package.json         # 依赖配置
├── vite.config.ts      # Vite配置
├── vercel.json         # Vercel部署配置
├── server.js           # 本地开发服务器（仅开发）
└── .env.example        # 环境变量模板
```

## 🚀 开发环境搭建

### 环境要求
- **Node.js**: >= 16.0.0 (推荐使用 22.x)
- **npm**: >= 8.0.0
- **Git**: 最新版本

### 快速开始
```bash
# 1. 克隆项目
git clone https://github.com/caitingYUE/haigoo-remote.git
cd haigoo-remote

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，配置必要的API密钥

# 4. 启动开发服务器
npm run dev           # 前端开发服务器 (端口3000)
# 可选：启动本地RSS代理（仅开发，为解决跨源限制）
node server.js        # 本地代理服务器 (端口3001)

# 5. 访问应用
# 前端: http://localhost:3000
# 开发代理: http://localhost:3001 （仅本地调试）
# 生产API: https://<your-vercel-app>.vercel.app/api/rss-proxy
```

### 环境变量配置
```bash
# 必需配置（AI服务）
VITE_ALIBABA_BAILIAN_API_KEY=your_api_key_here
VITE_ALIBABA_BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/api/v1

# 应用信息
VITE_APP_NAME=Haigoo Assistant
VITE_APP_VERSION=1.0.0

# 运行环境
NODE_ENV=development

# 说明：生产环境默认使用 Vercel Functions 提供的相对路径 API（如 /api/rss-proxy），
# 无需配置 VITE_API_BASE_URL/VITE_RSS_PROXY_URL。若需自定义域或独立后端，再添加对应变量。
```

## 📦 部署流程

### Vercel 部署 (推荐)

#### 方式一：通过 Vercel 网站部署
1. **登录 Vercel**
   - 访问 [vercel.com](https://vercel.com)
   - 使用 GitHub 账号登录

2. **导入项目**
   - 点击 "New Project"
   - 选择 GitHub 仓库: `haigoo-remote`
   - 点击 "Import"

3. **配置项目**
   ```
   Project Name: haigoo-remote
   Framework Preset: Vite
   Root Directory: ./
   Build Command: npm run build
   Output Directory: dist
   ```

4. **环境变量配置**
   在 Vercel 项目设置中添加：
   ```
   VITE_ALIBABA_BAILIAN_API_KEY=your_api_key_here
   VITE_ALIBABA_BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/api/v1
   VITE_APP_NAME=Haigoo Assistant
   VITE_APP_VERSION=1.0.0
   NODE_ENV=production
   ```

5. **部署**
   - 点击 "Deploy"
   - 等待部署完成（约 2-3 分钟）

#### 方式二：通过 Vercel CLI 部署
```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录 Vercel
vercel login

# 部署项目
vercel --prod
```

### 部署后配置
1. **获取部署 URL**
   ```
   https://haigoo.vercel.app
   ```

2. **API端点**
   - 生产环境默认使用 `https://<你的Vercel域>/api/rss-proxy`
   - 前端代码已使用相对路径 `'/api/rss-proxy'`（通过 Vercel Functions 提供）或在开发时代理到 `http://localhost:3001`

3. **重新部署**
   更新环境变量后，触发重新部署以应用更改

## 🔧 开发注意事项

### 代码规范
- **TypeScript**: 严格类型检查，所有组件必须有明确的类型定义
- **ESLint**: 遵循项目配置的代码质量规则
- **组件命名**: 使用 PascalCase，文件名与组件名保持一致
- **函数命名**: 使用 camelCase，函数名要清晰表达功能
- **常量命名**: 使用 UPPER_SNAKE_CASE

### 项目特殊配置
1. **RSS 代理服务**
   - 位置: `api/rss-proxy.js`
   - 功能: 解决跨域问题，代理RSS源请求（生产由 Vercel Functions/Edge 提供）
   - 超时设置: 20秒
   - 用户代理轮换: 防止被封禁

2. **状态管理**
   - 使用 Zustand 进行全局状态管理
   - 本地存储使用 localStorage
   - 数据持久化策略: 3天历史数据保留

3. **数据流向**
   ```
   RSS源 → RSS代理服务 → 数据聚合器 → 标准化处理 → 前端展示
   ```

### 关键服务说明

#### RSS服务 (`rss-service.ts`)
- **功能**: 获取和解析RSS数据
- **支持的RSS源**:
  - WeWorkRemotely
  - Remotive
  - Himalayas
  - AngelList
- **数据处理**: XML解析、字段提取、错误处理

#### 职位聚合器 (`job-aggregator.ts`)
- **功能**: 数据转换和标准化
- **核心方法**:
  - `convertRSSJobToPageJob()`: RSS数据转换为页面数据
  - `extractSalaryInfo()`: 薪资信息提取
  - `calculateRecommendationScore()`: 推荐分数计算

#### AI服务 (`ai-service.ts`)
- **功能**: 集成阿里百炼大模型
- **主要功能**:
  - 简历优化建议
  - 职位匹配分析
  - 面试准备指导

### 数据格式规范

#### RSS原始数据格式
```typescript
interface RSSJob {
  title: string;
  link: string;
  description: string;
  pubDate: string;
  source: string;
  guid?: string;
}
```

#### 标准化职位数据格式
```typescript
interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  jobType: JobType;
  category: JobCategory;
  salary?: SalaryInfo;
  tags: string[];
  description: string;
  requirements: string[];
  benefits: string[];
  applyUrl: string;
  publishedAt: Date;
  source: string;
  isRemote: boolean;
  experienceLevel: ExperienceLevel;
  remoteLocationRestriction?: string;
  recommendationScore: number;
}
```

## 🧪 测试和调试

### 测试工具
项目包含多个测试和调试脚本：
- `comprehensive-debug.js`: 全面调试工具
- `test-recommendation-fix.js`: 推荐功能测试
- `test-data-retention.js`: 数据保留测试
- `browser-test-complete-flow.js`: 完整流程测试

### 调试方法
```javascript
// 在浏览器控制台中使用
comprehensiveDebug();        // 全面检查当前状态
testAndDebug();             // 测试数据生成并调试
manualGenerateTestData();   // 手动生成测试数据
```

### 常见问题排查

#### RSS数据获取失败
1. 检查代理服务是否正常运行
2. 验证RSS源URL是否可访问
3. 查看网络请求是否被CORS阻止
4. 检查用户代理是否被封禁

#### 数据显示异常
1. 检查数据转换逻辑
2. 验证localStorage中的数据格式
3. 查看控制台错误信息
4. 检查组件状态更新

#### 部署问题
1. 验证环境变量配置
2. 检查构建过程是否成功
3. 确认Serverless Functions配置
4. 查看Vercel部署日志

## 📚 相关文档

### 核心文档
- [技术架构文档](./Technical-Architecture-Documentation.md)
- [数据格式规范](./Data-Format-Specification.md)
- [前台展示规则](./Frontend-Display-Rules-Documentation.md)
- [部署指南](../README-DEPLOYMENT.md)

### 设计文档
- [设计原则](./Design-Principles.md)
- [UI设计规范](./UI-Design-Specification.md)
- [颜色规范](./Color-Specification.md)

## 🔄 维护和更新

### 定期维护任务
1. **依赖更新**: 每月检查并更新npm依赖
2. **RSS源维护**: 定期检查RSS源可用性
3. **数据清理**: 清理过期的本地存储数据
4. **性能监控**: 监控页面加载时间和API响应时间

### 功能扩展指南
1. **添加新RSS源**:
   - 在 `rss-service.ts` 中添加新的RSS源配置
   - 实现对应的数据解析逻辑
   - 更新数据格式映射

2. **添加新页面**:
   - 在 `pages/` 目录创建新组件
   - 在 `App.tsx` 中添加路由配置
   - 更新导航菜单

3. **扩展AI功能**:
   - 在 `ai-service.ts` 中添加新的AI接口
   - 实现对应的提示词模板
   - 添加错误处理和重试机制

### 性能优化建议
1. **代码分割**: 使用 React.lazy() 实现路由级别的代码分割
2. **图片优化**: 使用 SVG 图标，避免大尺寸图片
3. **缓存策略**: 合理使用 localStorage 和 sessionStorage
4. **API优化**: 实现请求去重和缓存机制

## 🚨 紧急联系和支持

### 关键联系信息
- **项目负责人**: [待填写]
- **技术负责人**: [待填写]
- **部署平台**: Vercel (https://vercel.com)
- **代码仓库**: GitHub (https://github.com/caitingYUE/haigoo-remote)

### 紧急处理流程
1. **生产环境故障**:
   - 立即检查 Vercel 部署状态
   - 查看错误日志和监控数据
   - 必要时回滚到上一个稳定版本

2. **数据丢失**:
   - 检查本地存储数据
   - 重新同步RSS数据
   - 恢复用户配置信息

3. **API服务异常**:
   - 检查阿里百炼API配额和状态
   - 验证环境变量配置
   - 重启相关服务

---

**文档版本**: v1.0  
**创建日期**: 2024年12月  
**最后更新**: 2024年12月  
**维护者**: Haigoo开发团队

> 💡 **提示**: 本文档应随项目发展持续更新，确保信息的准确性和时效性。