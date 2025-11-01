# Haigoo 颜色规范文档 v2.0

## 核心品牌色彩系统

### 主品牌色 (Primary Brand Colors)
```css
--haigoo-primary: #8B5CF6;           /* 主品牌紫色 */
--haigoo-primary-hover: #7C3AED;     /* Hover状态 (-20% 亮度) */
--haigoo-primary-active: #6D28D9;    /* Active状态 (-40% 亮度) */
--haigoo-primary-light: #A78BFA;     /* 浅色变体 */
--haigoo-primary-dark: #5B21B6;      /* 深色变体 */
```

### 辅助色彩 (Secondary Colors)
```css
--haigoo-secondary: #EC4899;         /* 辅助粉色 */
--haigoo-accent: #06B6D4;            /* 强调青色 */
--haigoo-success: #10B981;           /* 成功绿色 */
--haigoo-warning: #F59E0B;           /* 警告橙色 */
--haigoo-error: #EF4444;             /* 错误红色 */
```

### 中性色系 (Neutral Colors)
```css
--haigoo-gray-50: #F9FAFB;
--haigoo-gray-100: #F3F4F6;
--haigoo-gray-200: #E5E7EB;
--haigoo-gray-300: #D1D5DB;
--haigoo-gray-400: #9CA3AF;
--haigoo-gray-500: #6B7280;
--haigoo-gray-600: #4B5563;
--haigoo-gray-700: #374151;
--haigoo-gray-800: #1F2937;
--haigoo-gray-900: #111827;
```

## Tab 导航交互状态规范

### 默认状态 (Default State)
```css
.tab-default {
  background-color: var(--haigoo-gray-50);
  color: var(--haigoo-primary);
  border: 1px solid var(--haigoo-gray-200);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Hover状态 (Hover State)
```css
.tab-hover {
  background-color: var(--haigoo-primary);
  color: #FFFFFF;
  border: 1px solid var(--haigoo-primary);
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.25);
  transform: translateY(-1px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Active状态 (Active State)
```css
.tab-active {
  background-color: var(--haigoo-primary-active);
  color: #FFFFFF;
  border: 1px solid var(--haigoo-primary-active);
  box-shadow: 0 6px 16px rgba(109, 40, 217, 0.35);
  transform: translateY(-2px) scale(1.02);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Focus状态 (Focus State)
```css
.tab-focus {
  outline: 2px solid var(--haigoo-primary);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.1);
}
```

## 标签系统颜色规范

### 岗位类型标签
```css
--tag-development: #3B82F6;      /* 开发类 - 蓝色 */
--tag-design: #8B5CF6;           /* 设计类 - 紫色 */
--tag-marketing: #EC4899;        /* 市场类 - 粉色 */
--tag-sales: #10B981;            /* 销售类 - 绿色 */
--tag-support: #F59E0B;          /* 支持类 - 橙色 */
--tag-management: #6B7280;       /* 管理类 - 灰色 */
```

### 工作模式标签
```css
--tag-remote: #06B6D4;           /* 远程工作 - 青色 */
--tag-hybrid: #8B5CF6;           /* 混合模式 - 紫色 */
--tag-onsite: #6B7280;           /* 现场工作 - 灰色 */
```

### 紧急程度标签
```css
--tag-urgent: #EF4444;           /* 紧急 - 红色 */
--tag-normal: #6B7280;           /* 普通 - 灰色 */
--tag-flexible: #10B981;         /* 灵活 - 绿色 */
```

## 可访问性规范

### 对比度要求
- 正常文本：最小对比度 4.5:1
- 大文本：最小对比度 3:1
- 交互元素：最小对比度 3:1

### 色盲友好设计
- 避免仅依赖颜色传达信息
- 使用图标和文字辅助说明
- 提供高对比度模式选项

## CSS 变量定义

```css
:root {
  /* 主品牌色 */
  --haigoo-primary: #8B5CF6;
  --haigoo-primary-hover: #7C3AED;
  --haigoo-primary-active: #6D28D9;
  
  /* 中性色 */
  --haigoo-gray-50: #F9FAFB;
  --haigoo-gray-100: #F3F4F6;
  --haigoo-gray-200: #E5E7EB;
  --haigoo-gray-700: #374151;
  
  /* 过渡动画 */
  --transition-standard: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  --transition-fast: all 0.15s ease-out;
  --transition-slow: all 0.5s ease-in-out;
}
```

## 实施检查清单

- [ ] 所有Tab状态都有明确的视觉反馈
- [ ] 过渡动画时长为0.3秒
- [ ] 颜色对比度符合WCAG 2.1 AA标准
- [ ] 支持键盘导航和屏幕阅读器
- [ ] 在不同设备和浏览器中测试一致性
- [ ] 提供暗色模式适配方案

---

**版本**: 2.0  
**更新日期**: 2024年11月  
**负责人**: 技术负责人兼设计总监  
**审核状态**: 待审核