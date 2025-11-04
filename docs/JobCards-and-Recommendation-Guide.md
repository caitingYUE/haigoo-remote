# 岗位卡片视觉与技术方案、推荐方案与数据注意事项（综合版）

更新时间：2025-11-04

本文档汇总当前前端卡片的视觉与技术实现、简化版推荐方案与数据注意事项，以及交接所需的关键技术点。旨在帮助后续开发快速理解现状并保持一致的实现与体验。

## 1. 卡片视觉与技术方案

### 1.1 卡片类型与布局结构
- Top推荐卡（首页 Top3）
  - 标题一行截断（`line-clamp-1`）。
  - 公司行统一：`Building` 图标（`w-4 h-4`）+ 公司名称文本，文本应用 `truncate` 与 `min-w-0`。
  - 描述段落：两行截断（`line-clamp-2`）。
  - 地点与薪资行：在描述下方，地点左侧，薪资右侧；地点文本统一 `min-w-0 + truncate + whitespace-nowrap + overflow-hidden`，`MapPin` 图标 `w-4 h-4 flex-shrink-0`。
  - 技能/标签：最多 3 项 + `+N`。

- 普通推荐卡（首页更多推荐）
  - 与 Top推荐卡保持一致的公司行、描述段落与地点/薪资行（地点在描述下方）。
  - 标签区在卡片底部，见“1.3 标签系统”。

- 历史推荐卡（昨天/更早）
  - 与当天推荐卡保持同布局：公司行 → 描述 → 地点（+可选薪资） → 标签 → 底部操作。
  - 不在公司行下方展示类型等信息，避免与当天卡不一致。

- 列表卡（Jobs 列表页）
  - 公司行包含 `Building` 图标与公司名称。
  - 核心信息行包含薪资、地点（同历史卡片样式）、工作类型、发布时间等。
  - 描述与技能区域分节显示。

代码路径参考：
- `src/pages/HomePage.tsx`（首页 Top3/更多推荐卡片渲染）
- `src/components/RecommendationCard.tsx`（推荐卡组件，历史/当天使用）
- `src/components/JobCard.tsx`（列表卡组件）
- `src/utils/date-formatter.ts`（发布时间文案与分组基准）

### 1.2 通用样式与图标规范
- 图标尺寸统一：`Building` 与 `MapPin` 均为 `w-4 h-4`，并给 `MapPin` 添加 `flex-shrink-0` 防止压缩。
- 文本溢出处理：公司名与地点文本统一 `min-w-0 + truncate + whitespace-nowrap + overflow-hidden`，杜绝长文本撑破卡片。
- 薪资显示：仅当 `salary.min > 0` 时显示；单位按币种展示（CNY 用 `¥` 并在组件内统一格式化）。
- 交互与无障碍：标题、公司、地点行提供合适的 `aria-label`；卡片容器使用 `role="article"`，辅助阅读器友好。

### 1.3 标签系统（含兜底策略）
- 标签渲染遵循：最多显示 3 个技能标签，超过用 `+N` 表示剩余数量。
- 兜底策略（避免卡片不对称）：
  - 当岗位没有任何技能标签时，在推荐卡的标签区展示一个兜底标签 `remote`。
  - 一旦岗位有至少一个标签，则不展示兜底标签。
- 相关代码：
  - `src/components/RecommendationCard.tsx`（已实现兜底标签逻辑）
  - `src/components/JobTag.tsx`、`src/utils/tagSystem.ts`（标准化标签与容器）

### 1.4 日期文案与分组一致性
- 问题背景：按“小时差”判断会导致跨午夜出现“昨天推荐显示今天”的错误文案。
- 现行方案：`DateFormatter.formatPublishTime` 按“日历日”比较，确保“今天/昨天/更早”的分区与文案一致。
- 表现规则：
  - 当天：显示“今天”。
  - 前一天：显示“昨天”。
  - 否则：显示 `MM-DD`。

## 2. 简化版推荐方案与数据注意事项

### 2.1 数据来源与流转（简化）
- RSS/数据聚合：通过 `api/rss-proxy.js` 进行跨域代理获取 RSS 或外部数据源。
- 前端聚合与适配：`src/services` 下的 `job-aggregator.ts`、`job-service.ts` 等完成数据整合与映射。
- 历史推荐接口（本地开发）：`server.js` 提供简化的 `/api/recommendations` GET/POST（内存存储），用于开发与演示。
- 生产部署（建议）：结合 `vercel.json` 中的 Serverless Functions 与 Vercel KV 进行持久化（详见 `VERCEL_DEPLOYMENT_GUIDE.md`）。

### 2.2 分组与展示
- 按 `postedAt` 的日历日分组为“今天/昨天/更早”。
- 卡片展示与文案由 `DateFormatter.formatPublishTime` 保证一致性，避免跨时区/跨午夜问题。

### 2.3 数据字段注意事项
- `job.location`：可能极长；已在 UI 侧统一截断（避免撑破卡片）。
- `job.skills`：可能为空；推荐卡标签区会显示兜底 `remote`，有标签时不显示兜底。
- `job.salary`：可能缺失或为 0；仅在 `min > 0` 时展示薪资。
- `job.company`：可能为空；公司首字母头像使用首字符，文本截断处理。
- `job.type` / `job.experienceLevel`：存在枚举映射；中文标签通过映射表统一（见组件内 map）。
- `postedAt`：请保证为可被 `new Date()` 正确解析的字符串或时间戳；不合法日期将导致分组与文案异常。

## 3. 其他需要注意与记录的技术方案

### 3.1 部署与路由
- `vercel.json`：
  - `rewrites`：`/(.*)` → `/index.html` 保持 SPA 路由。
  - `/api/*` 路由与 CORS 头部已配置，`maxDuration` 默认 30s。
- 环境变量（Vercel 项目设置）：
  - 必需：`VITE_ALIBABA_BAILIAN_API_KEY`、`VITE_ALIBABA_BAILIAN_BASE_URL`、`VITE_APP_NAME`、`VITE_APP_VERSION`、`NODE_ENV`。
  - 建议：`VITE_API_BASE_URL`、`VITE_RSS_PROXY_URL`（指向生产域名与 API）。

### 3.2 视觉与一致性
- 图标与文本尺寸统一，避免卡片因数据差异出现不对称或跳动。
- 地点行统一放在描述段落下方（历史与当天一致）。
- 公司名称行均包含 `Building` 图标，文本统一截断。

### 3.3 可访问性（A11y）
- 卡片容器：`role="article"`。
- 文案：为标题、公司名、地点、发布时间添加 `aria-label` 或 `title`。
- 交互元素（按钮/外链）：支持键盘操作与 `aria-label` 描述。

### 3.4 性能与稳定性
- 文本截断与 `flex-shrink-0` 防止布局抖动。
- 标签容器采用轻量布局算法（`tagSystem.ts`），避免超长标签影响渲染性能。
- 建议对外部数据做最小校验（字段存在性与格式），减少运行期异常。

## 4. 代码改动摘要（便于交接）
- `src/utils/date-formatter.ts`：发布时间按“日历日”判断，修复跨午夜文案错误。
- `src/pages/HomePage.tsx`：公司名称行补齐 `Building` 图标并统一截断；与当天卡一致的地点/薪资行样式。
- `src/components/RecommendationCard.tsx`：
  - 将地点（+可选薪资）移动到描述下方；
  - 统一地点行样式与 `MapPin` 尺寸；
  - 当无标签时显示兜底 `remote`，有标签则不显示兜底。
- `src/components/JobCard.tsx`：列表卡公司行与地点/薪资样式统一，标签系统采用标准化组件。

## 5. 后续扩展建议
- 统一 Job 结构枚举映射（类型/经验级别）到 `utils` 层，减少组件内重复 map。
- 引入 Vercel KV 持久化历史推荐，配合轻缓存策略（详见 `VERCEL_DEPLOYMENT_GUIDE.md`）。
- 为 JobDetail 等页面复用 `DateFormatter.formatPublishTime`，保持文案一致。
- 为标签系统引入“来源/行业/公司规模”等扩展分类，并在 `tagSystem.ts` 内集中维护。

---

维护人：Haigoo 开发团队（待更新）
版本：v1.0（综合说明）