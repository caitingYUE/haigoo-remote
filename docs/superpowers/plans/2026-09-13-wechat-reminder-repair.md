# 微信上新提醒修复 Implementation Plan

**Goal:** 修复已审计的提醒漏洞，可靠记录公开上新、正确选择接收者、恢复明确失败并防止盲目重复发送。

**Architecture:** PostgreSQL 岗位状态转换触发器写入持久事件，后台消费者原子生成收件箱；既有 Cron 路由增加受 Bearer secret 保护的发送任务。用数据库全局租约串行消费，授权版本和发送状态避免并发覆盖；不增加队列服务或运行时依赖。

**Tech Stack:** PostgreSQL / Neon、Node.js、Taro、PGlite 隔离回归。

**Spec:** `docs/qa/2026-09-13-wechat-reminders.md`；用户已要求修复报告中的漏洞。

## Global Constraints

- 本次开发和验证不向真实用户发送消息，不执行生产迁移或开启生产消费者。
- 只对首次公开申请/重新开放记录事件；部署前存量与体验镜像导入不群发。
- 一次授权对应下一次提醒；新授权不能被旧发送结果清除。
- 明确临时错误最多重试 5 次；发送超时或响应不可解析标记 unknown，禁止自动重放。
- 单轮消费者最多工作 200 秒，分批续处理；租约 330 秒，大于 Vercel 300 秒执行上限。

## Task 1: 持久事件与消费状态

Files: `server-utils/dal/migrations/089_mini_wechat_reminder_delivery.sql`、`lib/services/job-sync-service.js`。

- [x] 增加事件快照/准备标志、授权版本/订阅时间、发送尝试/结果/租约；旧事件不自动补群发。
- [x] 岗位 INSERT/UPDATE 从不可见到有效公开岗位触发事件；相同资料更新不重复；企业激活/申请邮箱补全覆盖相关岗位。
- [x] 移除爬虫独立发信入口，镜像岗位明确排除。
- [x] 用隔离数据库执行真实迁移，验证首次入库、后审核、重新开放、回滚、重复更新、镜像跳过。

## Task 2: 原子准备与可续跑消费

Files: `lib/services/mini-company-match-service.js`、`lib/services/mini-wechat-reminder-service.js`、`lib/cron-handlers/mini-wechat-reminders.js`、`api/cron/index.js`、`vercel.json`。

- [x] 提取微信模板/发送实现至专项模块；事件准备使用单条 SQL 原子更新准备标志与收件箱。
- [x] SQL 领取时重新核对用户状态、小程序身份、岗位可见性、当前关注/会员方向和授权版本。
- [x] 单消费者租约、逐条领取、成功/永久失败/有限重试/不确定结果分别落库；跨轮继续处理第 101 人。
- [x] 成功只清除对应授权版本；43101 失效旧授权，保留发送期间新增授权；过期 processing 保守转 unknown。
- [x] 定时任务必须核验 CRON_SECRET，伪造 x-vercel-cron 无效；发送开关默认关闭，日志不包含密钥/openid。
- [x] 实测临时失败恢复、超过 100 人、重复消费者、撤销/重新授权、模板异常和超时不重复发。

## Task 3: 产品表达与交付

Files: 小程序提醒组件/企业详情、`scripts/test-mini-wechat-reminder-audit.mjs`、QA 文档。

- [x] 修改“一次提醒”文案，保持既有 UI 框架；明确下次需再次授权。
- [x] 将缺陷复现转为通过条件的回归测试；校验内容、链接、身份与会员边界。
- [x] 执行相关合同、网站类型/构建、小程序构建，修复相关失败。
- [x] 记录完成项与待部署步骤：先迁移、后代码和定时任务，最后指定测试账号真机验证后启用发送。
