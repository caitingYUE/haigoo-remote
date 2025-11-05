# 前端技术实现指导文档

## 概述

基于新的UI设计规范，本文档详细说明如何在现有技术架构基础上实现推荐页和全部岗位页的两套不同卡片设计方案。

## 1. 技术架构评估结果

### 1.1 当前组件架构分析

**现状：**
- ✅ **JobCard组件**：已实现，用于全部岗位页的单一卡片设计
- ✅ **HomePage推荐卡片**：已实现TOP卡片和普通推荐卡片的内联样式
- ❌ **组件复用性**：缺乏统一的卡片组件系统，样式分散在不同文件中

**问题识别：**
1. 推荐页的卡片样式直接写在HomePage.tsx中，不利于维护
2. JobCard组件只适用于全部岗位页，无法复用于推荐页
3. 缺乏卡片类型的统一管理和样式系统

### 1.2 数据结构评估

**现状：**
- ✅ **Job接口**：已包含所有必要字段，支持推荐评分、分组等功能
- ✅ **推荐系统**：已有recommendationScore、recommendationGroup等字段
- ✅ **扩展性**：数据结构完整，无需调整

**结论：** 现有数据结构完全支持两套卡片设计方案，无需修改。

### 1.3 样式系统评估

**现状：**
- ✅ **Tailwind配置**：已配置完整的haigoo品牌色系统
- ✅ **响应式支持**：已有完整的断点和间距系统
- ✅ **暗色模式**：已配置暗色模式支持
- ❌ **卡片样式类**：缺乏统一的卡片样式类定义

**需要扩展：**
1. 添加卡片类型相关的CSS类
2. 定义渐变色系统
3. 统一悬停和焦点效果

## 2. 技术实现方案

### 2.1 组件重构方案

#### 2.1.1 创建统一的JobCard组件

```typescript
// src/components/JobCard/JobCard.tsx
interface JobCardProps {
  job: Job;
  variant: 'top-recommendation' | 'recommendation' | 'list';
  onSave?: (jobId: string) => void;
  isSaved?: boolean;
  onClick?: (job: Job) => void;
  showBadge?: boolean;
  badgeText?: string;
}
```

#### 2.1.2 组件文件结构

```
src/components/JobCard/
├── JobCard.tsx           # 主组件
├── JobCardVariants.tsx   # 变体样式定义
├── JobCardTypes.ts       # 类型定义
└── index.ts             # 导出文件
```

### 2.2 样式系统扩展

#### 2.2.1 Tailwind配置扩展

```javascript
// tailwind.config.js 需要添加的配置
module.exports = {
  theme: {
    extend: {
      // 渐变色系统
      backgroundImage: {
        'gradient-top-card': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-purple': 'linear-gradient(135deg, #9470ff 0%, #803af2 100%)',
        'gradient-salary': 'linear-gradient(135deg, #803af2 0%, #9470ff 100%)',
      },
      // 卡片阴影系统
      boxShadow: {
        'card-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        'card-top': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'card-focus': '0 0 0 3px rgba(128, 58, 242, 0.1)',
      },
      // 动画系统
      animation: {
        'card-hover': 'cardHover 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        cardHover: {
          '0%': { transform: 'translateY(0) scale(1)' },
          '100%': { transform: 'translateY(-8px) scale(1.02)' },
        }
      }
    }
  }
}
```

#### 2.2.2 CSS类系统定义

```css
/* src/styles/job-card.css */
@layer components {
  /* 基础卡片样式 */
  .job-card-base {
    @apply bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 transition-all duration-300;
  }
  
  /* TOP推荐卡片 */
  .job-card-top {
    @apply job-card-base p-8 bg-gradient-to-br from-violet-50 to-purple-50 dark:from-gray-800 dark:to-gray-900;
    @apply hover:shadow-card-top hover:-translate-y-2 hover:scale-[1.02];
  }
  
  /* 普通推荐卡片 */
  .job-card-recommendation {
    @apply job-card-base p-6 hover:shadow-card-hover hover:-translate-y-1;
  }
  
  /* 列表卡片 */
  .job-card-list {
    @apply job-card-base p-6 hover:shadow-lg hover:-translate-y-0.5 hover:border-haigoo-primary;
  }
}
```

### 2.3 组件实现细节

#### 2.3.1 JobCard主组件结构

```typescript
export default function JobCard({ job, variant, ...props }: JobCardProps) {
  const styles = getVariantStyles(variant);
  const logoSize = variant === 'top-recommendation' ? 'w-14 h-14' : 'w-12 h-12';
  
  return (
    <div className={styles.container}>
      {/* Badge */}
      {props.showBadge && (
        <div className={styles.badge}>
          {props.badgeText}
        </div>
      )}
      
      {/* 装饰元素 - 仅TOP卡片 */}
      {variant === 'top-recommendation' && (
        <DecorativeElements />
      )}
      
      {/* 卡片内容 */}
      <CardHeader job={job} logoSize={logoSize} styles={styles} />
      <CardContent job={job} variant={variant} styles={styles} />
      <CardActions job={job} variant={variant} {...props} />
    </div>
  );
}
```

#### 2.3.2 样式变体系统

```typescript
// src/components/JobCard/JobCardVariants.tsx
export const getVariantStyles = (variant: JobCardVariant) => {
  const baseStyles = {
    container: 'job-card-base cursor-pointer group',
    logo: 'rounded-xl flex items-center justify-center text-white font-semibold shadow-sm',
    title: 'font-bold group-hover:text-haigoo-primary transition-colors',
    company: 'font-medium',
    salary: 'font-bold',
    description: 'line-clamp-2 leading-relaxed',
    skills: 'px-3 py-1 rounded-full text-sm font-medium',
    button: 'py-3 px-6 rounded-xl font-semibold transition-all duration-200',
  };

  switch (variant) {
    case 'top-recommendation':
      return {
        ...baseStyles,
        container: `${baseStyles.container} job-card-top relative`,
        logo: `${baseStyles.logo} w-14 h-14 ring-2 ring-white/60`,
        title: `${baseStyles.title} text-lg text-gray-800 dark:text-white`,
        company: `${baseStyles.company} text-gray-600 dark:text-gray-300`,
        salary: `${baseStyles.salary} text-xl bg-gradient-salary bg-clip-text text-transparent`,
        skills: `${baseStyles.skills} bg-white/60 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 backdrop-blur-sm`,
        button: `${baseStyles.button} bg-gradient-purple text-white hover:shadow-lg hover:scale-[1.02]`,
      };
      
    case 'recommendation':
      return {
        ...baseStyles,
        container: `${baseStyles.container} job-card-recommendation`,
        logo: `${baseStyles.logo} w-12 h-12`,
        title: `${baseStyles.title} text-lg text-gray-900 dark:text-white`,
        company: `${baseStyles.company} text-gray-600 dark:text-gray-400`,
        salary: `${baseStyles.salary} text-xl text-violet-600 dark:text-violet-400`,
        skills: `${baseStyles.skills} bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300`,
        button: `${baseStyles.button} bg-violet-600 hover:bg-violet-700 text-white`,
      };
      
    case 'list':
      return {
        ...baseStyles,
        container: `${baseStyles.container} job-card-list`,
        logo: `${baseStyles.logo} w-12 h-12`,
        title: `${baseStyles.title} text-lg text-gray-900`,
        company: `${baseStyles.company} text-gray-600 text-sm`,
        salary: `${baseStyles.salary} text-sm text-haigoo-primary`,
        skills: `${baseStyles.skills} px-2 py-1 rounded text-xs bg-haigoo-primary/10 text-haigoo-primary`,
        button: '', // 列表卡片无按钮
      };
  }
};
```

## 3. 开发实施步骤

### 3.1 第一阶段：基础重构

1. **创建JobCard组件系统**
   - 创建组件文件结构
   - 实现基础JobCard组件
   - 定义样式变体系统

2. **扩展样式系统**
   - 更新Tailwind配置
   - 添加CSS组件类
   - 定义动画和过渡效果

### 3.2 第二阶段：页面集成

1. **更新HomePage**
   - 替换内联卡片为JobCard组件
   - 使用variant属性区分卡片类型
   - 保持现有功能不变

2. **更新JobsPage**
   - 使用新的JobCard组件
   - 应用list变体样式
   - 确保功能完整性

### 3.3 第三阶段：优化和测试

1. **响应式优化**
   - 测试各设备下的显示效果
   - 优化移动端体验
   - 确保无障碍访问

2. **性能优化**
   - 组件懒加载
   - 样式优化
   - 动画性能调优

## 4. 开发注意事项

### 4.1 兼容性保证

- 保持现有API接口不变
- 确保向后兼容性
- 渐进式迁移策略

### 4.2 代码质量

- 遵循TypeScript严格模式
- 添加完整的类型定义
- 编写单元测试

### 4.3 用户体验

- 保持加载性能
- 确保动画流畅
- 优化交互反馈

## 5. 测试策略

### 5.1 组件测试

```typescript
// 测试用例示例
describe('JobCard Component', () => {
  it('should render top recommendation variant correctly', () => {
    // 测试TOP推荐卡片渲染
  });
  
  it('should render list variant correctly', () => {
    // 测试列表卡片渲染
  });
  
  it('should handle click events properly', () => {
    // 测试点击事件处理
  });
});
```

### 5.2 视觉回归测试

- 使用Storybook展示各种变体
- 截图对比测试
- 跨浏览器兼容性测试

## 6. 文本处理和格式化

### 6.1 岗位描述文本处理

为确保卡片和详情页显示的岗位描述内容一致，所有显示岗位描述的组件都应使用统一的文本处理逻辑。

#### 核心处理函数

**主要函数：`processJobDescription`**
- 位置：`src/utils/text-formatter.ts`
- 功能：处理Markdown符号、截断文本、清理格式
- 参数配置：
  ```typescript
  processJobDescription(description: string, options: {
    formatMarkdown?: boolean;    // 是否处理Markdown格式
    maxLength?: number;          // 最大长度限制
    preserveHtml?: boolean;      // 是否保留HTML标签
  })
  ```

**辅助函数：`cleanMarkdownSymbols`**
- 位置：`src/utils/text-formatter.ts`
- 功能：清理Markdown符号，返回纯文本（不转换为HTML）
- 处理内容：
  - 移除粗体符号：`**text**` → `text`
  - 移除斜体符号：`*text*` → `text`
  - 移除删除线：`~~text~~` → `text`
  - 移除行内代码：`` `code` `` → `code`
  - 清理多余的星号和下划线

#### 各组件使用规范

**1. 推荐页卡片（HomePage）**
```typescript
// TOP卡片和普通推荐卡片
{processJobDescription(job.description, { 
  formatMarkdown: false,    // 卡片中不显示HTML格式
  maxLength: 120,          // 限制显示长度
  preserveHtml: false      // 纯文本显示
})}
```

**2. 全部岗位页卡片（JobCard）**
```typescript
{processJobDescription(job.description, { 
  formatMarkdown: false, 
  maxLength: 120, 
  preserveHtml: false 
})}
```

**3. 个人资料页收藏职位（ProfilePage）**
```typescript
{processJobDescription(job.description, { 
  formatMarkdown: false, 
  maxLength: 150,          // 稍长的显示长度
  preserveHtml: false 
})}
```

**4. 全部岗位页（JobsPage）**
```typescript
// 在数据处理时使用
description: processJobDescription(job.description || '', {
  formatMarkdown: false,
  maxLength: 100,
  preserveHtml: false
})
```

**5. 岗位详情页（JobDetailModal）**
```typescript
// 使用专门的渲染函数处理完整格式
renderFormattedText(displayText(section.content, true))
```

#### 处理效果

- **Markdown符号清理**：
  - 卡片显示：移除 `**`、`*`、`~~` 等格式符号，保留纯文本
  - 详情页显示：转换为对应的HTML标签（`<strong>`、`<em>`、`<del>`等）
- **HTML实体解码**：处理 `&amp;`、`&lt;` 等HTML实体
- **文本截断**：在单词边界处智能截断
- **空白字符处理**：合并多余空格，保留段落结构

#### 技术实现细节

**处理逻辑分支**：
1. `formatMarkdown: true` → 使用 `formatJobDescription` 转换Markdown为HTML
2. `formatMarkdown: false` → 使用 `cleanMarkdownSymbols` 清理符号返回纯文本

**关键修复**：
- 解决了卡片显示原始Markdown符号（如 `**text**`）的问题
- 确保所有显示岗位描述的组件都经过统一处理
- 在 `JobsPage.tsx` 中补充了遗漏的文本处理

#### 一致性保证

1. **统一处理逻辑**：所有卡片组件都使用相同的文本处理函数
2. **参数标准化**：根据显示场景使用标准化的参数配置
3. **格式对齐**：确保卡片显示的内容与详情页处理后的内容一致

### 6.2 实施检查清单

- [x] HomePage推荐卡片（TOP和普通）使用processJobDescription
- [x] JobCard组件使用processJobDescription  
- [x] ProfilePage收藏职位使用processJobDescription
- [x] JobsPage数据处理使用processJobDescription
- [x] 所有组件导入text-formatter工具函数
- [x] 参数配置符合各场景需求（formatMarkdown: false）
- [x] 新增cleanMarkdownSymbols函数处理纯文本清理
- [x] 修复processJobDescription函数的处理逻辑
- [x] 测试卡片和详情页显示一致性
- [x] 验证Markdown符号完全清理

## 7. 部署和监控

### 7.1 部署策略

- 功能开关控制新组件启用
- A/B测试对比用户体验
- 逐步灰度发布

### 7.2 监控指标

- 页面加载性能
- 用户交互率
- 错误率监控

## 7. 总结

通过以上技术方案，我们可以在保持现有功能完整性的基础上，实现两套不同的卡片设计方案。关键要点：

1. **组件化设计**：统一的JobCard组件支持多种变体
2. **样式系统**：基于Tailwind的可扩展样式系统
3. **渐进式迁移**：确保平滑过渡和向后兼容
4. **性能优化**：保持良好的用户体验

这套方案既满足了设计需求，又保证了代码的可维护性和扩展性。
### 单行标签组件实现说明

- 组件：`src/components/SingleLineTags.tsx`
- 目的：保证标签行在卡片内单行展示，并将超出用 `+N` 聚合显示；当无标签时使用 `remote` 兜底。
- 关键技术点：
  - 使用隐藏测量容器计算各标签与 `+N` 的真实宽度（包含内边距与圆角样式）。
  - 采用贪心算法在可视容器宽度内放置尽可能多的标签，同时预留 `+N` 的宽度。
  - 通过 `ResizeObserver` 监听容器宽度变化，实时重新计算展示数量。
  - `flex-nowrap` 与 `overflow-hidden` 确保整行不换行。
- 接入位置：`JobCard.tsx`（`size='xs'`）与 `RecommendationCard.tsx`（`size='sm'`）。