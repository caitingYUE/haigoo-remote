# 小程序 1.0.39 正式部署计划

**目标：** 用户于 2026-09-14 确认真机验收完成；部署正式后端并上传正式候选包，由用户自行提交微信审核。

**架构：** 复用 Neon 迁移工具、Vercel 云端候选构建及验证后 promote、现有正式 CloudRun 代理和微信 production 上传脚本。

**约束：** 保留现有用户数据和授权；不回放历史岗位；不触发真实通知测试；不代用户提交审核或发布微信正式版。新候选保留当前已提交的管理员岗位写入修复。

- [x] 核对 Git、正式部署基线、数据库、CloudRun 与微信配置，记录回退目标。
- [x] 运行提醒、管理员岗位写入、发布合同回归及正式小程序构建。
- [x] 在正式库执行迁移 089 并验证；核对正式微信模板和提醒配置。
- [x] 创建 Vercel 正式候选（`npx vercel deploy --prod --skip-domain --yes`）；只读接口检查通过后 promote。
- [x] 复测正式 CloudRun 链路，执行 `npm --prefix miniprogram run upload:weapp:prod`。
- [x] 保存发布清单、验证证据和提交审核说明，清理临时凭据。

结果见 `docs/releases/1.0.39-production-candidate.md`。正式 CloudRun 源码未变化，健康接口验证一致后复用现有服务。微信后台 UI 核对受工具 URL 访问限制，已停止 UI 操作，上传凭证来自 CLI 明确成功结果。
