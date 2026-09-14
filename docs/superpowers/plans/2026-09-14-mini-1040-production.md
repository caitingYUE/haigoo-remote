# 1.0.40 Production Deployment Plan

**Goal:** 完成已通过真机验收的 1.0.40 正式候选部署和微信上传，审核由用户提交。

**Architecture:** 先执行兼容迁移 090，使用当前已验收提交创建独立 Vercel production 候选，验证后切换正式域名。CloudRun 代理源码未变则复用；正式包上传成功以 CLI 明确回执为证。

**Spec:** docs/releases/1.0.40-production-verification.md

- [x] 核对正式环境配置、090 迁移、源码基线及现有部署。
- [x] 执行 `scripts/run-sql-migration.mjs` 的 090 迁移并验证匹配函数和关注记录数量。
- [x] 用当前提交的独立目录执行 Vercel production `--skip-domain` 部署；保留当前正式部署作回退基线。
- [x] 用 `scripts/verify-mini-gateway.mjs` 验证候选，再 promote 并运行 `scripts/test-mini-production-readonly.mjs --rounds=3`。
- [x] 执行 `npm --prefix miniprogram run upload:weapp:prod`，保留上传成功日志与包校验信息。
- [x] 更新正式发布记录，明确尚未提交微信审核。

约束：不创建订单、不修改真实用户资料、不人工发送提醒；不将体验数据库或 trial 消息配置用于正式环境。候选校验失败不切换；切换后失败回退至经 inspect 确认的原部署。保留兼容数据库新增结构。
