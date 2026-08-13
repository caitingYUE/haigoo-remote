---
name: haigoo-ui-ux
description: >
  Haigoo Remote / Haigoo Career 专属 UI/UX 与中文体验设计 Skill。
  用于设计、重构或审查 Haigoo 的网页、移动端、个人工作台、远程岗位、
  企业内容、职业成长、咨询与学习页面。核心目标是在国际化 Editorial
  审美、中国用户熟悉的产品交互、Haigoo 的温暖人格和真实工具价值之间取得平衡。
---

# Haigoo UI/UX Skill

## 1. 什么时候必须使用这个 Skill

当任务涉及以下任一场景时，优先使用本 Skill：

- 新建或重构 Haigoo 页面
- 调整首页、远程岗位、远程企业、职业成长、个人中心、咨询页
- 修改导航、布局、信息层级、交互方式
- 修改按钮、标签、筛选、空状态、提示语、表单文案
- 调整移动端体验
- 设计 Career Notes / Career Workspace
- 审查页面是否“太欧美”“太 SaaS”“太冷”“太卡片化”
- 审查页面是否牺牲了中文用户的操作效率
- 为 Haigoo 建立或更新 Design System
- 对 Codex / CodeBuddy 已生成页面做二次 UX localization

如果同时存在以下 Skill，建议协同使用：

- `frontend-design`：负责视觉完成度、避免模板化 AI 审美
- `web-design-guidelines`：负责交互、可访问性、Web UX 基础规范
- `ux-writing-skill`：负责按钮、状态、提示、界面微文案
- `ui-ux-pro-max`：负责布局、设计系统、模式探索

本 Skill 的优先级是：

> **Haigoo 品牌与中文用户体验约束 > 通用视觉风格建议**

---

## 2. Haigoo 的核心设计定义

Haigoo 不是传统招聘网站，也不是职业培训平台，更不是典型 AI SaaS。

Haigoo 的体验应当同时具备：

**Editorial Beauty × Chinese Product Usability × Haigoo Warmth × Global Career Professionalism**

理想感受：

> **远看像一本有审美的全球职业杂志，近看是一个非常顺手的中文职业工具。**

用户第一次打开时应该觉得：

> “这个产品有自己的气质。”

用户真正使用时应该觉得：

> “我马上知道去哪、怎么看、下一步做什么。”

长期回来时应该觉得：

> “这里一直有人维护，也记得我做过什么。”

---

## 3. 不要把 Haigoo 做成什么

禁止默认把 Haigoo 设计成以下风格：

- 欧美时尚杂志网站的中文翻译版
- Monocle / Kinfolk 式纯 editorial portfolio
- BOSS直聘 / 猎聘式招聘门户
- 紫色渐变 AI SaaS
- 大量 Bento Grid
- 每个模块都是大圆角 Card
- 课程销售落地页
- 高压转化 Funnel
- HR 企业官网
- 冷冰冰的管理后台
- 过度可爱、贴纸化、儿童化海狗 UI
- “科技感 = 霓虹 + 玻璃 + 渐变”
- 为了高级感而牺牲信息效率的设计

---

## 4. Haigoo 的品牌气质

关键词：

- 开放
- 自由
- 平静
- 温暖
- 聪明
- 国际化
- 有判断力
- 有生命力
- 不催促
- 不贩卖焦虑
- 不居高临下
- 不像传统 HR

视觉方向：

**Warm Editorial × Global Career × Quiet Premium**

推荐：

- warm ivory / warm white
- deep ink navy
- restrained Haigoo purple
- mist blue
- soft sand
- muted sage
- natural daylight
- sea / window / travel / desk / city / mountain
- fine borders
- strong typography
- editorial grid
- subtle grain
- restrained motion
- occasional handwritten accent
- sparse mascot usage

---

## 5. 中文优先，英文负责气氛

中文必须承担主要信息。

英文只承担：

- 品牌气质
- 小型 editorial metadata
- 国际感
- 视觉节奏

不要让用户必须理解英文才能完成操作。

推荐：

- 最近更新 / *Recently updated*
- 企业观察 / *Company notes*
- 正在观看 / *Watching*

不推荐把以下英文作为主信息层级反复出现：

- RECENTLY UPDATED
- COMPANY NOTES
- REAL MOMENTS
- PUBLIC SOURCE
- DIRECT APPLY

英文 Eyebrow 可以存在，但必须克制。

---

## 6. 页面密度必须按任务变化

不要让全站都使用同一种 Editorial 留白。

建立 **Editorial Density Gradient**：

| 页面 | 推荐密度 |
|---|---|
| 首页 Hero | 低密度 / 高氛围 |
| 首页岗位区 | 中密度 |
| 远程岗位 | 中高密度 / 高扫描效率 |
| 远程企业 | 中密度 |
| 企业详情 | 中密度 / Editorial |
| 职业成长 | 中低密度 / Editorial |
| 视频学习页 | 中密度 / 内容 + 工具 |
| 我的 Haigoo | 高功能密度 |
| 咨询页 | 中低密度 / 温暖对话 |
| Career Notes | 中高密度 / 工作台 |

原则：

> **品牌区域可以留白，工具区域必须高效。**

---

## 7. 美感不能降低操作效率

用户应当能快速回答：

- 最近有什么新岗位？
- 这个岗位在哪里远程？
- 是哪家公司？
- 什么时候更新？
- 来源是什么？
- 怎么去官网？
- 我收藏了什么？
- 我投过哪些？
- 我上次看到哪里？
- 我下一步该做什么？

如果视觉设计让这些答案变得更难找到，就需要调整。

---

## 8. 中国用户要“一眼知道能做什么”

重要操作必须显式。

不要让关键 Action 只表现为：

- `→`
- `↗`
- hover
- 很小的文字链接
- 需要理解版式才能发现的入口

优先使用清楚的中文动作：

- 查看岗位 →
- 查看企业 →
- 前往官网 ↗
- 收藏
- 记录申请
- 继续观看 →
- 查看笔记 →
- 查看全部 →
- 继续整理 →

箭头可以陪伴文字，但不能替代动作。

---

## 9. 熟悉的 Product Affordance 优先

高频工具区域优先使用用户熟悉的交互：

- tabs
- segmented controls
- filter chips
- sticky toolbar
- status pills
- clearly labeled buttons
- pagination / load more
- visible active state
- clear empty state
- bottom sheet on mobile
- tooltips where needed

不要为了 editorial 新鲜感发明新的基础交互。

---

## 10. Progressive Disclosure

Haigoo 不应该：

- 什么都一次性堆出来
- 也不应该把所有东西藏起来

原则：

**常用信息直接出现，次要信息再展开。**

岗位默认可见：

- 公司
- 职位
- 职能
- 工作类型
- Remote 范围
- 更新时间
- 来源
- 查看岗位 / 官网入口

次级信息可展开：

- 语言
- 薪资
- 更详细摘要
- 时区
- 补充标签

---

## 11. Remote Jobs 页面

远程岗位是工具，不是杂志封面。

目标：

> **扫描快、判断快、跳转快。**

推荐：

- Editorial list / compact row
- 细分割线
- 聚合 metadata
- 5–7 个岗位可在常见 desktop viewport 中被有效浏览
- 不要每个岗位都变成大 Card
- 不要把 metadata 拆散到相距很远的 3–4 个列

推荐结构：

```text
公司名

职位名称

产品 · 全职
中国远程 · 英文工作

更新于 4月17日 · 企业官网

                         查看岗位 →
```

允许轻量语义色：

- 全球远程：very light blue
- 中国远程：very light sage
- APAC：very light lavender
- New：very light warm yellow
- Freelance：warm neutral

必须低饱和。

禁止彩虹 badge 系统。

---

## 12. Remote Companies 页面

视觉上可以更 Editorial，但上层必须有工具层。

推荐结构：

1. 页面标题与说明
2. 可见筛选
3. 简单排序
4. Editorial Company Grid / List

如真实数据支持，可使用：

- 全部
- 全球远程
- APAC
- 亚洲团队
- AI
- SaaS
- 教育
- 消费
- 更多

排序：

- 最近更新
- 企业名称

原则：

> **Utility layer above, editorial content below.**

---

## 13. 首页

首页是品牌感最强的页面。

允许：

- 大标题
- 海景 / 旅居 / 自然摄影
- serif / handwritten accent
- 低密度
- 大留白

但必须较早出现真实工具。

建议保留：

- Hero Search
- 职位分类
- 最近更新的岗位
- 真实更新信号

如数据库有真实数据，可显示：

- 今天更新 X 个远程机会
- 本周新增 X 个
- 最近更新于 X 小时前

禁止 hardcode 假数字。

---

## 14. “生命信号”

Haigoo 必须看起来有人维护。

优先通过真实数据表达，而不是营销文案。

推荐：

- 今天更新
- 本周新增
- 3小时前更新
- 最近浏览
- 继续观看
- 最近收藏
- 申请进度
- 上次看到 12:43
- 已整理 X 条企业笔记

这些是 **Life Signals**。

它们比“我们持续为你精选全球好机会”更可信。

---

## 15. 我的 Haigoo

“我的”首先是用户自己的空间。

用户进入后，第一屏应该出现：

- 最近收藏
- 申请记录
- 最近学习
- 继续观看
- 最近浏览
- Club 历史权益（仅历史会员）

不要让：

- 咨询服务
- 关于我们
- 账号设置

成为页面视觉主角。

推荐：

> 晚上好，{name}。  
> 最近看过的机会和内容，都帮你留在这里了。

目标感受：

> **Haigoo remembers me.**

不要展示：

- Free User
- 升级会员
- pricing
- upsell

如果用户是历史 Club Member，可克制显示：

> ✦ Haigoo Club Member

或：

> ✦ Founding Club Member

仅展示真实已有权益。

---

## 16. 职业成长页

这是最适合保留 Editorial 感的区域。

可以：

- 大标题
- Serif
- 内容专题
- 杂志式版面
- 视频封面
- CEO 访谈
- Field Notes

但需要增加产品感。

如果有历史记录：

> 继续上次学习

展示：

- 标题
- 观看进度
- 上次时间
- 继续观看 →

让“杂志”变成“我的杂志”。

---

## 17. 视频 / 内容详情页

保持两栏 Editorial 体验，但增强工具价值。

如数据支持，增加：

### 本期你会听到

```text
00:48 为什么无障碍阅读是产品原则
03:21 免费用户与付费用户
05:46 Remote-first 与 Async-first
08:12 为什么反对低效会议
```

点击 timestamp 跳转。

右侧已有内容能力应表现为“看视频时的工具”：

- 企业文化
- 商业思维
- 跟读片段
- 其他资料
- 收藏

必要时使用 sticky secondary nav。

---

## 18. 咨询页面

咨询页应当：

- 专业
- 平静
- 有对话感
- 不像高端咨询公司官网
- 不像小红书卖课页

保留：

> 职业卡住的时候，先把问题说清楚。

推荐辅助表达：

> 最近大家常来聊这些：

- 投了很多，却不知道问题到底出在哪里。
- 想换方向，但又不想把过去几年全部推倒重来。
- 人在海外，不确定下一步应该往哪里走。
- 经历不少，却不知道怎么把它讲清楚。

可以补一句：

> 你不需要提前想清楚问题，带着现在的困惑来就可以。

避免巨大 QR Code 作为视觉中心。

二维码 / 联系方式使用：

- Drawer
- Modal
- Secondary section

---

## 19. Haigoo 的亲和力不是“可爱”

亲和力来自：

- 记得用户
- 自然中文
- 清楚动作
- 小型反馈
- 真实更新
- 轻微人格
- 温暖摄影
- 恰当海狗 mascot

Mascot 推荐出现：

- greeting
- empty state
- onboarding
- 404
- success
- occasional editorial note

不要出现：

- 每个 card
- 每个 job row
- 每个 icon
- 企业研究核心内容

原则：

> **把海狗当成“一个人”，不是装饰贴纸。**

---

## 20. Typography

Editorial 字体用于：

- Hero
- 品牌标题
- Feature story
- 内容专题

高可读中文 Sans 用于：

- 导航
- 岗位
- 企业 metadata
- filter
- button
- workspace
- settings
- forms

避免整站 giant serif。

避免低对比小号文字。

---

## 21. Design Token 指导

不要无理由重做品牌色。

推荐体系：

### Background

- warm ivory
- warm white
- occasional mist surface

### Text

- deep ink navy
- muted blue-gray secondary

### Accent

- Haigoo purple：只用于 active / link / small highlight
- mist blue
- soft sand
- muted sage

### Radius

- large container: 20–24px
- card: 14–18px
- button / pill: full radius when appropriate

不要所有容器都使用同一个巨大圆角。

### Shadow

尽量轻。

优先依靠：

- whitespace
- border
- background difference
- typography

建立层级。

---

## 22. Motion

Haigoo 应该“有响应”，不是“会表演”。

推荐：

- hover: 150–220ms
- arrow translate: 3–4px
- subtle underline
- pressed state
- save state transition
- smooth progress
- restrained drawer/modal transition

不要：

- heavy parallax
- cursor effects
- giant scroll animation
- springy startup motion
- unnecessary Framer Motion

尊重 `prefers-reduced-motion`。

---

## 23. Mobile 原则

移动端不是 desktop 纵向堆叠。

测试至少：

- 375
- 390
- 430
- 768

移动端应：

- 更早看到真实内容
- 缩小 Hero 标题
- 搜索靠前
- filter 使用 bottom sheet
- sticky filter trigger
- metadata 聚合
- action 文案明确
- 不依赖 hover
- 减少巨大空白
- 控制横向 chip
- 44px+ touch target
- thumb-friendly

---

## 24. Haigoo 中文 UX Writing

语气：

- 清楚
- 平静
- 自然
- 聪明
- 温暖
- 有判断力
- 不端着
- 不卖焦虑

推荐：

- 继续看
- 最近更新
- 去企业官网看看
- 收藏过的岗位都在这里
- 已经申请？顺手记一下
- 上次看到这里
- 最近看过的内容
- 先看看这个岗位在找什么
- 你不需要提前想清楚问题

禁止默认使用：

- 赋能
- 解锁无限可能
- 一站式
- 精准匹配
- 开启职业新篇章
- 助力
- 高效赋能
- 引领
- 全方位
- 重塑

避免英文直译式中文。

---

## 25. Haigoo 当前 Jobs 合规交互边界

在当前阶段，UI/UX 修改不得重新引入：

- 付费解锁岗位
- 付费增加岗位访问额度
- 个性化岗位推荐
- 简历 → 岗位匹配
- 候选人筛选
- “适合你的岗位”
- 猜你喜欢
- 内推
- Recruiter / HR 联系人解锁
- 岗位 → 咨询付费 Funnel
- Job page 直接推广收费咨询
- 私域岗位群
- 代投
- 招聘撮合
- 企业招聘发布入口

允许：

- 用户主动筛选
- 客观分类
- 时间排序
- 收藏
- 浏览记录
- 用户自己记录申请状态
- 官方来源
- 企业官网申请跳转
- 职业成长内容
- 独立咨询页面
- 历史会员已有权益

如果任何视觉“优化”重新制造了商业招聘转化，应当拒绝该设计。

---

## 26. 设计与改版工作流程

每次改版都先执行：

### Step 1 — Audit

先审查：

- 信息密度
- 层级
- 可扫描性
- Action discoverability
- 中文本地化
- English overuse
- excessive whitespace
- excessive cards
- mobile
- accessibility
- compliance interaction boundary

不要直接写代码。

### Step 2 — Preserve

明确哪些现有视觉资产必须保留。

如果当前页面已经形成 Haigoo 品牌识别，不要为了“更统一”推翻。

### Step 3 — Improve

优先调整：

- layout
- density
- typography
- action labels
- hierarchy
- microcopy
- progressive disclosure
- responsive

### Step 4 — Screenshot Review

至少对比：

- desktop
- mobile
- before
- after

### Step 5 — Quality Gate

逐项判断：

1. 还保留 Editorial 高级感吗？
2. 中文用户一眼知道怎么操作吗？
3. 有效信息是否更早出现？
4. 高频页面是否更高效？
5. 页面是否有生命力？
6. “我的”是否真的像用户自己的空间？
7. 是否过度卡片化？
8. 是否过度英文？
9. 是否过度留白？
10. 是否又变成普通 SaaS？
11. 是否重新引入招聘商业转化？
12. 用户会愿意每周回来使用，而不只是第一次觉得好看吗？

如果第 12 项答案是否定，继续迭代。

---

## 27. 最终验收标准

新版 Haigoo 不应该让人觉得：

> “这是一个设计得很漂亮的欧美网站中文版。”

也不应该让人觉得：

> “这是一个普通的中文招聘工具。”

最终应该是：

> **“这是一个中国人做的、理解华语职场人的全球职业产品，但审美和视野是国际化的。”**

设计目标排序：

1. Utility makes users return
2. Familiarity makes users stay
3. Beauty makes users notice

三者缺一不可。
