# 样式规范（首页岗位浏览）

目标：与参考站点的极简风格保持一致，提升可读性、信息密度与响应式体验；适用首页岗位列表与通用组件。

## 字体与字号
- 基础字体：系统字体栈（默认 Tailwind 配置）。
- 标题 `h1`：`text-4xl md:text-5xl`，字重 `font-bold`，字距 `tracking-tight`。
- 副标题：`text-lg md:text-xl`，字重 `font-normal`。
- Tab 文本：`text-sm md:text-base`，字重 `font-medium`。
- 列表卡片标题：`text-base md:text-lg`，字重 `font-semibold`。

## 颜色方案
- 主文本：`text-gray-900`（暗色模式 `text-white`）。
- 次级文本：`text-gray-600`（暗色模式 `text-gray-300`）。
- 辅助文本：`text-gray-500`（暗色模式 `text-gray-400`）。
- Tab 选中：文本 `text-gray-900`，底部边线 `border-gray-900`（暗色模式用 `text-white`/`border-white`）。
- 链接/交互悬停：从 `text-gray-600` 过渡到 `text-gray-900`，`transition-colors duration-200`。

## 间距与布局
- 页面容器：`container mx-auto px-4 pt-16 pb-8`。
- Hero 区块：标题与副标题间距 `mb-4`，区块与列表间距 `mb-6`。
- Tab 区块：左右间距 `gap-6`，底部对齐以底线为准，内边距仅 `pb-1`。
- 列表网格：`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`，上间距 `mt-2`。

## Tab 规范（无边框文本样式）
- 结构：按钮元素（`<button>`），无背景与边框，文本为主。
- 选中态：`text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white`。
- 未选中态：`text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white`。
- 动效：`transition-colors duration-200`；切换保持平滑。
- 统计：在文案后追加中文圆括号计数，如 `客户支持（33）`。

## 响应式与信息密度
- 断点：`sm`、`md`、`lg` 按默认 Tailwind；标题与网格在 `md/lg` 增加字号与列数。
- 信息密度：一屏显示 24 条，可点击“加载更多”每次增加 24 条。

## 动效与反馈
- 加载态：居中旋转指示（`animate-spin`）。
- 点击：Tab 切换只改变文本颜色与底线；列表卡片保持轻量阴影或边线（沿用现有组件）。

## 组件复用建议
- 尽量复用 `JobCard`；避免在首页定义卡片样式的私有变体，保持统一。
- 如需全局主题调整，建议在 Tailwind 配置或 CSS 变量层面统一，而不是在组件内分别定制。

## 文案
- 页面主标题：`发现海内外优质远程岗位`。
- 副标题：`每日更新数千个远程岗位`。