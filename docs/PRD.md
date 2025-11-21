# Haigoo Remote — 产品需求文档（PRD）

## 1. 产品功能概要
- 聚合远程岗位数据并标准化处理：统一字段映射、标签打标、质量评分与区域分类（国内/海外）。
- 提供岗位浏览与筛选、岗位详情弹窗、收藏与订阅，后台支持RSS源与地址词库维护、处理后数据校验与导出。
- 新增会员权益：精选与内推岗位优先推送、AI简历优化、个性化邮件与飞书推送；试用与续费定价明确。
- 部署采用预发/生产双环境，所有改动先预发验证后上线；定时任务与API路由通过平台配置。

## 2. 产品需求详细描述

### 2.1 数据与人岗匹配算法设计
- 数据来源与采集
  - RSS聚合源按类别维护，容错解析与降级回退，参考 `src/services/rss-service.ts:304–448, 758–1015`。
  - 地址关键词分类接口：`GET /api/location-categories`，封装于 `src/services/processed-jobs-service.ts:204–213`。
  - 定时同步任务：`vercel.json:3–8` 配置 `/api/cron/sync-jobs` 夜间批量同步。
- 数据模型与格式要求
  - 原始RSS岗位：`src/types/rss-types.ts:7–30`，最小字段集 `title/company/location/description/url/publishedAt/source`，可含 `tags/requirements/benefits/isRemote/region?`。
  - 统一岗位：`src/types/unified-job-types.ts:4–54, 24–28`，标准化字段并包含 `region?`、`locationRestriction`、`skillTags`、`languageRequirements`、`dataQuality`。
  - 前端岗位：`src/types/index.ts:1–43` 展示层结构，支持 `region?` 与 `translations?`。
- 处理链路与质量控制
  - 解析→映射→评分→去重→留存：`rss-service` 容错解析；`job-mapping-service.ts:31–83, 303–339` 字段映射与评分；`data-retention-service.ts:28–40, 97–144` 留存管理。
  - 区域分类写入：`job-mapping-service.ts:33, 89` 基于地址与标签命中词库（国内/海外/全球），未命中用启发式兜底；页面转换亦保留，`src/services/job-aggregator.ts:517–548, 558`。
- 人岗匹配算法（V1 需求，待开发）
  - 信号：技能栈、工作方式与地点限制、区域/时区、语言要求、经验级别、薪资预期、行业偏好、用户画像与行为。
  - 流程：先约束过滤（必须条件）→ 加权评分排序（技能/经验/行业/语言等）→ TOP-N输出与解释因子；支持冷启动与AB测试。
  - 指标：点击率、申请率、收藏率、转化率、满意度；离线回放与在线监控。

### 2.2 网站前端功能、交互和视觉规范
- 页面结构
  - 首页分区与导航：`src/pages/LandingPage.tsx`，国内/海外视觉入口统一；SVG资源与主题色一致。
  - 岗位浏览页：分类/经验/地点/远程筛选，搜索，分页；区域Tabs默认国内，参数化切换，`src/pages/JobsPage.tsx:31–88`。
  - 岗位详情弹窗：Portal挂载、遮罩层级、滚动锁定、安全外链与收藏操作。
  - 管理后台：处理后数据校验与导出、分布图与来源图，`src/components/AdminPanel.tsx:556–651`。
- 交互规范
  - 筛选回填与组合；中英文搜索；分页状态保留；操作按钮图标与反馈统一。
  - 区域分类列显示“国内/海外/未分类”，`src/components/AdminPanel.tsx:591, 610`。
  - 标签渲染无兜底“remote”，卡片高度保持一致，已改造。
- 视觉规范
  - 统一设计Token：颜色/字体/间距，参考 `src/components/AdminPanel.css`；组件底部对齐与区块分隔明确。
  - 列表密度基线 12–16px；模块标题层级清晰；图表按比例渲染。
  - 首页岗位浏览样式规范参考 `docs/style-guide.md`。

### 2.3 网站后端功能、交互和视觉规范
- API与路由
  - 处理后岗位：`GET /api/data/processed-jobs?page&limit&region&...`，封装 `src/services/processed-jobs-service.ts:33–153`，含超时与Abort。
  - 地址分类：`GET/POST /api/user-profile?action=location_categories_*`，页面交互 `src/pages/AdminDashboardPage.tsx:238–283`。
  - RSS源管理与同步：管理后台维护源与批量操作；定时任务见 `vercel.json:3–8`。
- 交互规范与错误降级
  - 失败返回可读文本；非JSON响应安全降级空列表，`src/services/processed-jobs-service.ts:92–107`。
  - 参数校验与权限；分页一致性；多值过滤按重复键传递。
- 安全与权限
  - 登录态校验；受保护路由 `src/App.tsx:41–46`；令牌 `haigoo_auth_token`，`AdminDashboardPage.tsx:262–270`。
  - 写接口鉴权（JWT/Token）；外链安全。

### 2.4 数据库与存储模块设计
- 实体与关系
  - RawRssJob、UnifiedJob、User/Profile、Resume、Subscription、Member、LocationCategories、RecommendationHistory、NewsletterQueue、FeishuQueue。
  - 唯一约束：岗位URL+来源哈希（`job-aggregator.ts:620–636`）；原始ID与统一ID关联；`region`、`category`、`isRemote` 供检索。
- 存储策略
  - 七日留存与最大记录控制，`data-retention-service.ts:28–40, 146–164`；过期与裁剪按时间排序。
  - 云端KV/Redis优先（`REDIS_URL`），本地回退 localStorage（预发验证/演示）。

### 2.5 网站部署、环境变量设计
- 环境与流程
  - 预发（develop）与生产（main），新功能先预发验证；构建 `npm run build`；路由与定时任务 `vercel.json:3–31`。
- 关键环境变量
  - 基础：`NODE_ENV`、`API_BASE_URL`、`APP_URL`。
  - 身份/授权：`JWT_SECRET`、`GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`（参考 `GOOGLE_OAUTH_SETUP_GUIDE.md`）。
  - 存储/缓存：`REDIS_URL`、`VERCEL_KV_REST_API_URL`、`VERCEL_KV_REST_TOKEN`（参考 `cloud-storage-adapter.ts`）。
  - 邮件：`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS`、`EMAIL_FROM`。
  - 飞书：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_BOT_WEBHOOK_URL`。
  - 翻译/AI：如 `BAILIAN_API_KEY`（参考 `src/services/ai-service.ts` 与 `src/services/job-service.ts:1–19`）。
- 部署策略
  - 仅在预发环境进行功能验证；通过后合入生产分支自动上线；监控失败重试与告警。

### 2.6 会员功能设计与定价机制
- 会员权益（第一版）
  - 精选岗位与内推优先推荐（每日10–20条）、专属订阅、AI简历优化、会员售后服务。
  - 更高推送频率与个性化权重；会员群互动与答疑。
- 定价与周期
  - 试用首月 9.9 元；续费 39.9 元/月、99 元/季度、299 元/年。
- 权限与风控
  - 自动续费与到期提醒；异常行为检测（批量申请、频繁抓取）。

### 2.7 个性化邮件订阅与飞书推送
- 邮件 Newsletter
  - 非会员每日1条基础岗位；会员每日10–20条精选岗位；同城/远程偏好与技能匹配优先。
  - 发送窗口与退订机制；模板本地化与A/B测试（主题、摘要、标签）。
- 飞书推送
  - 非会员每日1条1V1推送；会员加入飞书群享受每日10–20条个性化推送与售后。
  - 消息格式：标题/公司/地点/标签/链接；支持快捷反馈（收藏/不感兴趣）。
- 内容选择策略
  - 基于匹配评分TOP-N + 多样性约束（去重技能/公司）；冷启动采用热门/新鲜岗位兜底。
  - 发送队列与失败重试；超频保护与黑名单域过滤。

### 2.8 进度、排期与上线节奏
- 当前进度
  - 去掉岗位“remote”标签兜底，卡片高度不变（已完成，`src/components/SingleLineTags.tsx`、`src/components/JobCard.tsx`、`src/components/JobDetailModal.tsx`）。
  - 统一数据模型与映射增加区域分类 `region`，后台表新增“区域分类”列（已完成，`src/types/unified-job-types.ts:24–28`、`src/services/job-mapping-service.ts:33, 89`、`src/components/AdminPanel.tsx:591, 610`）。
  - 处理后岗位接口支持 `region` 筛选（已适配，`src/services/processed-jobs-service.ts:25, 56, 109–141`）。
  - 人岗匹配算法与会员体系基础功能尚未集中开发（规划中）。
- 近期里程碑（预发验证→生产上线）
  - W1：地址词库完善与筛选联动验证；处理后数据转化率排查与埋点拒绝原因。
  - W2：匹配算法V1与订阅个性化策略；预发AB测试与阈值调优。
  - W3：会员计费与权限拦截、邮件与飞书打通；上线售后支持流程。
  - W4：RSS源扩充与质量提升；数据监控与告警完善。
- 上线节奏
  - 每周一/四预发发布窗口；通过后每周五合入线上；紧急修复按需加发布。

### 2.9 产品后续迭代计划
- 匹配算法升级：向量检索与语义匹配、经验/行业迁移特征、解释性输出与用户调参。
- 订阅增强：时区/语言偏好、推送窗口自定义、兴趣标签与负反馈学习。
- 数据生态：RSS源健康评分、重复去重与质量提升、国际化多语言映射完善。
- 会员拓展：企业内推合作、求职训练营、面试题库与模拟面试。
- 运营与监控：全链路埋点、转化漏斗、告警与自愈；推荐历史与回溯工具。
- 安全与合规：隐私合规、反爬与限流、黑名单校验。

---
维护与交接：本PRD供产品/研发/运营共用，涉及功能变更请更新本文件并同步到预发验证。