# 🌍 Haigoo Remote Assistant

海外远程工作助手 - 基于AI的智能简历优化和职位匹配平台

## 📖 项目简介

Haigoo Remote Assistant 是一个专为海外远程工作者设计的智能助手平台，集成了AI驱动的简历优化、职位匹配、面试准备等功能，帮助用户在全球远程工作市场中脱颖而出。

## ✨ 核心功能

### 🎯 智能简历优化
- **AI驱动分析**: 基于阿里百炼大模型，深度分析简历内容
- **个性化建议**: 针对特定职位提供定制化优化建议
- **关键词优化**: 智能识别并优化ATS系统关键词
- **格式美化**: 专业的简历格式和布局优化

### 💼 职位智能匹配
- **精准匹配**: AI分析技能与职位需求的匹配度
- **个性化推荐**: 基于用户背景推荐最适合的远程职位
- **实时更新**: 持续更新全球远程工作机会
- **详细分析**: 提供职位要求与个人能力的详细对比

### 🎤 面试准备助手
- **模拟面试**: AI驱动的面试问题生成和回答建议
- **技能评估**: 针对性的技能测试和改进建议
- **文化适应**: 跨文化工作环境的适应性指导

### 📊 个人档案管理
- **技能追踪**: 记录和管理个人技能发展历程
- **成就展示**: 专业的个人品牌建设工具
- **进度监控**: 求职进度和目标达成情况跟踪

## 🛠️ 技术栈

### 前端技术
- **React 18** + **TypeScript** - 现代化前端框架
- **Vite** - 快速构建工具
- **Tailwind CSS** - 原子化CSS框架
- **React Router** - 单页应用路由管理

### AI服务
- **阿里百炼大模型** - 核心AI能力提供商
- **智能对话系统** - 自然语言处理和生成
- **文本分析引擎** - 简历和职位描述分析

### 部署与运维
- **Vercel** - 现代化部署平台
- **GitHub Actions** - 持续集成/持续部署
- **环境变量管理** - 安全的配置管理

## 🚀 快速开始

### 环境要求
- Node.js >= 16.0.0
- npm >= 8.0.0

### 安装依赖
```bash
npm install
```

### 环境配置
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，配置API密钥
VITE_ALIBABA_BAILIAN_API_KEY=your_api_key_here
VITE_ALIBABA_BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/api/v1
```

### 本地开发
```bash
# 启动开发服务器
npm run dev

# 访问应用
# http://localhost:5173
```

### 生产构建
```bash
# 构建生产版本
npm run build

# 预览构建结果
npm run preview
```

## 📁 项目结构

```
src/
├── components/          # 可复用组件
│   ├── Header.tsx      # 导航头部
│   ├── Footer.tsx      # 页脚组件
│   ├── JobCard.tsx     # 职位卡片
│   └── ...
├── pages/              # 页面组件
│   ├── HomePage.tsx    # 首页
│   ├── JobsPage.tsx    # 职位列表
│   ├── ProfilePage.tsx # 个人档案
│   └── ...
├── services/           # API服务层
│   ├── ai-service.ts   # AI服务接口
│   ├── job-service.ts  # 职位服务
│   └── ...
├── hooks/              # 自定义Hooks
├── contexts/           # React Context
├── types/              # TypeScript类型定义
└── assets/             # 静态资源
```

## 🌐 在线体验

- **生产环境**: [https://haigoo-remote-assistant.vercel.app](https://haigoo-remote-assistant.vercel.app)
- **GitHub仓库**: [https://github.com/caitingYUE/haigoo-remote-assistant](https://github.com/caitingYUE/haigoo-remote-assistant)

## 🔧 开发指南

### 代码规范
- 使用 TypeScript 进行类型安全开发
- 遵循 ESLint 和 Prettier 代码规范
- 组件采用函数式组件 + Hooks 模式
- 使用 Tailwind CSS 进行样式开发

### 提交规范
```bash
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建/工具链相关
```

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 创建 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系我们

- **项目维护者**: [caitingYUE](https://github.com/caitingYUE)
- **问题反馈**: [GitHub Issues](https://github.com/caitingYUE/haigoo-remote-assistant/issues)

---

⭐ 如果这个项目对您有帮助，请给我们一个星标！