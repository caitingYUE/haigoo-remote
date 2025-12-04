# Haigoo 颜色规范文档 v4.0（统一靛青/石板配色）

## 核心品牌色彩系统（与页面现有实现对齐）

### 主品牌与页面变量
```css
--brand-indigo: #4F46E5;
--brand-indigo-hover: #4338CA;
--brand-indigo-50: #EEF2FF;
--brand-slate-900: #0F172A;
--brand-slate-50: #F8FAFC;
--brand-border: #E2E8F0;
--landing-bg-start:#A6E3FF;
--landing-bg-end:#FDE5C7;
```

### 功能色（保留）
```css
--haigoo-success: #10B981;
--haigoo-warning: #F59E0B;
--haigoo-error: #EF4444;
--haigoo-info: #06B6D4;
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

## 导航与背景规范

### 页面与Header背景
```css
.landing-bg-page { background: linear-gradient(180deg, var(--landing-bg-start) 0%, var(--landing-bg-end) 60%, #FFFFFF 100%); }
.header-grad { background: linear-gradient(180deg, var(--landing-bg-start) 0%, var(--landing-bg-end) 60%, #FFFFFF 100%); }
```

### Tab 状态示例（靛青系）
```css
.tab-default { background-color: var(--brand-indigo-50); color: var(--brand-indigo); border: 1px solid var(--brand-border); transition: var(--transition-standard); }
.tab-hover { background-color: var(--brand-indigo); color: #fff; border: 1px solid var(--brand-indigo); box-shadow: 0 4px 12px rgba(79,70,229,0.25); transform: translateY(-1px); transition: var(--transition-standard); }
.tab-active { background-color: var(--brand-indigo-hover); color: #fff; border: 1px solid var(--brand-indigo-hover); box-shadow: 0 6px 16px rgba(67,56,202,0.35); transform: translateY(-2px) scale(1.02); transition: var(--transition-standard); }
.tab-focus { outline: 2px solid var(--brand-indigo); outline-offset: 2px; box-shadow: 0 0 0 4px rgba(79,70,229,0.1); }
```

### Active状态 (Active State)
```css
.tab-active {
  background-color: var(--brand-indigo-hover);
  color: #FFFFFF;
  border: 1px solid var(--brand-indigo-hover);
  box-shadow: 0 6px 16px rgba(67,56,202,0.35);
  transform: translateY(-2px) scale(1.02);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

### Focus状态 (Focus State)
```css
.tab-focus {
  outline: 2px solid var(--brand-indigo);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1);
}
```

## 标签与卡片用色规范

### 岗位类型标签
```css
--tag-development: #3B82F6;      /* 开发类 - 蓝色 */
--tag-design: #8B5CF6;           /* 设计类 - 紫色 */
--tag-marketing: #EC4899;        /* 市场类 - 粉色 */
--tag-sales: #10B981;            /* 销售类 - 绿色 */
--tag-support: #F59E0B;          /* 支持类 - 橙色 */
--tag-management: #6B7280;       /* 管理类 - 灰色 */
```

### 技能标签统一样式
```css
.tag-skill { background: var(--brand-indigo-50); color: var(--brand-indigo); }
.tag-more { background: var(--haigoo-gray-100); color: var(--haigoo-gray-500); }
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
  /* 主品牌色（v4） */
  --brand-indigo: #4F46E5;
  --brand-indigo-hover: #4338CA;
  --brand-indigo-50: #EEF2FF;
  --brand-slate-900: #0F172A;
  --brand-slate-50: #F8FAFC;

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

**版本**: 4.0  
**更新日期**: 2025年12月  
**负责人**: Haigoo 设计与前端团队  
**审核状态**: 已对齐靛青/石板配色方案
