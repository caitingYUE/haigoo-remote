后端数据层深度复盘 (Data Layer Review)
1. 概述 (Overview)
本报告对 Job Listing 后端数据层进行了深入分析，涵盖了数据的获取、处理和存储机制。主要数据源分为两类：RSS 公共数据流 (Public RSS Feeds) 和 可信企业爬虫 (Trusted Company Crawlers)。

通过对数据库实际案例的分析，我们发现两类数据源在数据质量、结构化程度和稳定性上存在显著差异。

2. RSS 数据流分析 (RSS Data Analysis)
RSS 数据主要来源于第三方聚合平台（如 Himalayas, WeWorkRemotely, Remotive）。

原始表: raw_rss
处理表: jobs
标识: source_type = 'third-party'
案例分析 A: Himalayas (公司名丢失)
Himalayas 是目前最大的 RSS 数据源，但存在严重的解析缺陷。

Raw ID: raw_2t9u3h
Title: "Patient Services Liaison"
Company: "Unknown Company" (数据库中显示)
数据统计: 数据库中约 420+ 条 Unknown Company/NULL 的数据，100% 来源于 Himalayas。
结论: 必须重构 Himalayas 的解析逻辑，否则该源的数据几乎不可用。
案例分析 B: Remotive (处理停滞)
Remotive 源存在大量数据堆积在原始表（Raw Table）中未能转入处理表（Jobs Table）。

统计: Raw 表中有 ~29 条记录，但 Jobs 表中仅有 4 条。
Raw Case: raw_x9l1w2 ("Senior Performance Marketer...") 状态仍为 
raw
。
结论: 数据管道阻塞，需排查 process-rss 脚本。
案例分析 C: WeWorkRemotely (低活跃度)
WWR 数据质量较好，但活跃数据极其稀少（~10 条）。

3. 可信企业爬虫分析 (Trusted Company Crawler Analysis)
该模块直接针对 "Trusted Companies" 的官网招聘页面进行抓取标识为 source_type = 'official'。

我们对爬虫进行了分层分析：

第一梯队：高质量抓取 (High Quality)
通用爬虫（Generic Crawler）对这些站点适配良好。

EverAI: 完美提取 JD 和 AI 相关标签。
Salesforce: 意外惊喜。作为大厂，爬虫成功提取了 HTML 格式的完整 JD。
Appwrite: JD 长度 3000+ 字符，内容详实。
MixRank: JD 长度 3000+ 字符，内容详实。
Canonical: JD 长度 6000+ 字符，非常详尽。
第二梯队：内容质量存疑 (Quality Issues)
抓取到了内容，但内容本身价值有限或存在偏差。

Kraken: 仅抓取到 "FullTime | Remote" 元数据，丢失 JD 正文。
MongoDB: 抓取到了 "Legal" 相关的服务条款文本（218字符），而非职位描述。这是典型的抓取到了错误的 DOM 区域（Footer 或 Cookie Consent）。
Docker: 抓取到了 "Customer Success" 的营销文本（141字符），而非具体 JD。
第三梯队：完全失败 (Total Failure)
爬虫无法提取任何有效描述。

Stripe: JD 为 null。
AlphaSights: JD 为 null。
原因: 官网高度动态化（SPA/React），Cheerio 无法处理动态 DOM。
4. 问题总结与建议 (Issues & Recommendations)
核心问题 (Key Issues)
优先级	问题描述	涉及数据源	影响
P0	公司名解析失败	Himalayas (RSS)	100% 的 Unknown Company 来源，必须修复。
P1	JD 抓取失败/为空	Stripe, AlphaSights	职位无法投递。
P1	JD 抓取错误 (非正文)	MongoDB, Docker	抓取到页脚或营销文案，误导用户。
P1	数据管道阻塞	Remotive (RSS)	新职位无法入库。
P2	仅抓取元数据	Kraken	信息量过低。
改进建议 (Action Items)
Himalayas 专项修复: 引入 NLP 或通过 title 分割规则提取公司名。
爬虫智能升级:
关键词校验: 在保存前检查抓取内容长度（如 < 500 字符）或是否包含非 JD 关键词（如 "Cookie Policy"），若命中则标记为 Review 或不入库。
动态渲染支持: 针对 Stripe/AlphaSights 类站点，必须引入 Puppeteer/Playwright。
数据清洗: 下架所有 Description < 100 字符的 "Trusted" 职位，避免破坏“可信”心智。