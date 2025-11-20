# Haigoo Remote — 产品需求文档（PRD）

## 1. 背景与目标
- 背景：当前岗位列表加载慢、收藏链路不稳定、岗位详情弹窗层级问题、存在废弃路由页面，以及面向不同地区用户的岗位可见性不清晰。
- 目标：
  - 提升首屏加载与交互体验（岗位分页与渐进加载）。
  - 打通“岗位详情—收藏—我的收藏”全链路，并稳定服务端接口。
  - 统一使用弹窗详情，清理废弃页面与路由。
  - 面向用户地域（国内/海外）提供清晰的岗位分组入口与筛选结果。
  - 提供后台可维护的地址分类词典，前端依词典自动匹配。

## 2. 用户与场景
- 用户画像：
  - 海外远程求职者（在国内）
  - 海外远程求职者（人在海外）
  - 招聘运营/产品运营（后台维护岗位与地址分类）
- 典型场景：
  - 在列表页发现岗位，打开弹窗详情，收藏或申请。
  - 在“我的收藏”查看已收藏岗位，打开弹窗详情，申请或取消收藏。
  - 在后台增删改地址分类关键字，前端展示即时生效。

## 3. 范围与不做事项
- 范围：列表页、岗位详情弹窗、收藏链路、后台地址分类、服务端相关接口。
- 不做：
  - 简历解析/AI Copilot 功能迭代（已移除废弃页面与入口）。
  - 岗位数据源新增（现有数据源维持）。
  - 跨平台移动端适配（PC 优先，移动端基础适配跟随）。

## 4. 关键功能与需求
### 4.1 地域 Tabs（人在国内 / 在海外）
- 展示位置：列表页顶部标题下居中，胶囊风格，两个 Tab，当前选中高亮。
- 切换行为：切换 `region` 路由参数（`/jobs?region=domestic|overseas`）。
- 前端匹配逻辑：
  - 词典字段：`domesticKeywords`、`overseasKeywords`、`globalKeywords`。
  - 命中规则：
    - 国内页：命中 `domesticKeywords` 或 `globalKeywords`
    - 海外页：命中 `overseasKeywords` 或 `globalKeywords`
  - Global 不含仅“remote”字样；包含 `anywhere/everywhere/worldwide/global/不限地点`。
- 验收标准：
  - 任一岗位含 `China/中国/APAC/UTC+8/北京/上海...` → 国内页可见。
  - 任一岗位含 `USA/UK/Canada/Mexico/India/EMEA/EU/...` → 海外页可见。
  - `anywhere/everywhere/worldwide/global/不限地点` → 两页均可见。
  - Tabs 样式与交互在两页一致，位置居中。
  - 代码参考：`src/pages/JobsPage.tsx:374`（Tabs UI）、`src/pages/JobsPage.tsx:306-315`（分类命中）。

### 4.2 岗位列表与弹窗详情
- 列表：岗位卡片瀑布/网格样式，支持搜索/筛选；点击卡片打开弹窗详情。
- 弹窗详情：Portal 挂载至 `document.body`，遮罩层级 `z-[1000]`，打开时锁定 `body` 滚动；支持申请外链跳转与收藏按钮。
- 验收标准：
  - 弹窗层级不被提醒、头像等覆盖；背景不可滚动。
  - 申请按钮 `window.open(job.sourceUrl)` 安全跳转。
  - 代码参考：`src/components/JobDetailModal.tsx:28`（锁滚动）、`src/components/JobDetailModal.tsx:38`（Portal+层级）。

### 4.3 收藏链路（岗位详情—收藏—我的收藏）
- 端到端行为：
  - 详情或列表点击“收藏”→ 服务端写入（Redis/KV/内存兜底）→ 前端刷新收藏集高亮。
  - 我的收藏页按收藏 `jobId` 批量查询岗位，展示卡片列表，点击打开弹窗详情。
- 服务端接口：合并在 `user-profile`：
  - `favorites_add` / `favorites_remove`（POST），`jobId` 同时在 URL 参数与请求体传递。
  - `favorites`（GET）：批量按 `ids` 查询 `processed-jobs`，统一结构返回。
- 验收标准：
  - 收藏/取消收藏成功后，列表与详情心形状态同步更新。
  - 我的收藏页不再大量“已失效”，正常显示岗位信息。
  - 代码参考：`api/user-profile.js:343-396`（收藏增删）、`api/user-profile.js:235-340`（收藏列表）。

### 4.4 后台地址分类管理
- 页面：`/admin/location-categories`（需登录）。
- 功能：三列文本区，逐行维护 `国内/海外/Global` 关键字；保存后写 KV 与内存缓存。
- 接口（合并到 `user-profile`）：
  - GET `/api/user-profile?action=location_categories_get`
  - PUT `/api/user-profile?action=location_categories_set`
- 验收标准：
  - 保存成功后立即影响前端分类命中，刷新列表可见效果。
  - 代码参考：`src/pages/AdminLocationPage.tsx:1`、`api/user-profile.js:236+`（读取/写入动作）。

### 4.5 清理废弃页面与路由
- 移除：`/copilot`、`/job/:id`、`/job/:jobId/apply` 路由和对应页面文件。
- 所有入口统一走弹窗详情（`JobDetailModal`）。
- 验收标准：
  - 访问上述旧路由不可达；站内无旧入口残留。
  - 代码参考：`src/App.tsx:62`（路由），删除文件见提交历史。

## 5. 非功能性要求（NFR）
- 性能：
  - 列表页首屏渲染时间（LCP）≤ 2.5s；首屏数据量建议 ≤ 48 卡片，后续“加载更多”。
  - 收藏接口响应时间 P95 ≤ 500ms；批量查询 `favorites` 总耗时 P95 ≤ 1000ms。
- 稳定性：
  - 服务端失败时返回明确错误，不回退到错误数据源。
  - Serverless 函数数量 ≤ 12（Vercel Hobby 限制）。
- 安全：
  - 所有收藏与后台写入动作需登录，使用 `Authorization: Bearer`。
  - 外链跳转 `noopener,noreferrer`。

## 6. 数据与接口
- 前端 Job 结构关键字段：`id/title/company/location/type/skills/isRemote/category/sourceUrl/expiresAt`。
- 服务端接口（统一在 `user-profile`）：
  - `favorites_add`、`favorites_remove`（POST）
  - `favorites`（GET，批量按 `ids`）
  - `location_categories_get`（GET）、`location_categories_set`（PUT）
- 岗位数据接口：`/api/data/processed-jobs` 支持分页/过滤与按 `ids` 批量查询。

## 7. 交互流程（简）
- 列表页：进入 → 顶部 Tabs 默认“人在国内” → 搜索/筛选 → 点击卡片 → 弹窗详情 → 收藏/申请。
- 我的收藏：进入 → 骨架屏加载 → 卡片列表 → 点击卡片 → 弹窗详情 → 申请/取消收藏。
- 后台分类：进入 → 编辑关键字 → 保存 → 前端列表刷新后分类生效。

## 8. 成功指标（KPIs）
- LCP、TTI 达标；列表页交互流畅度（FPS ≥ 50）。
- 收藏链路失败率 ≤ 1%；收藏操作成功提示可见率 100%。
- 地域 Tabs 的点击率与跳出率监控（埋点加入）。

## 9. 发布与回滚
- 预发：推送 `develop` 自动部署；生产：推送 `main` 自动部署。
- 回滚策略：保留上一个生产版本，部署失败或严重问题时回滚。
- 重要限制：Serverless Functions ≤ 12；必要时合并接口到聚合路由。

## 10. 风险与缓解
- 地址匹配误判：扩大默认词典覆盖面，后台可手工修正；后续引入时区与国家标准库。
- 大规模数据导致卡顿：分页与“加载更多”，图片懒加载，缓存命中。
- 第三方数据不一致：接口明确错误返回，前端提示重试。

## 11. 验收清单（DoD）
- 两个 Tabs 样式一致、居中；分类命中正确（含 Global）。
- 弹窗层级问题彻底解决；申请外链安全跳转。
- 收藏增删与列表高亮一致；我的收藏批量拉取正常。
- 后台地址分类可编辑与保存；前端分类即时生效。
- 废弃路由完全移除；构建与部署均通过，函数数不超限。

---
文档维护：产品/研发共同维护。如有需求调整，请在本文件更新并同步提交。