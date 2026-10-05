# 小程序测试账号与数据库隔离

测试身份只允许写入独立 Preview 数据库。不得用正式库做会员烟测，也不得以“VERCEL_ENV=preview”代替数据库目标核对。

## 初始化

明确指定预发配置文件；文件至少包含 VERCEL_ENV=preview、DATABASE_URL 和 WECHAT_MINI_APP_ID。数据库地址必须与正式库不同；同一 endpoint 的不同数据库名、用户或 pooled/unpooled 别名不算独立环境。配置文件中其他数据库变量如存在，也必须指向同一个 Preview endpoint。

```sh
MINI_SMOKE_ALLOW_SETUP=true node scripts/setup-mini-smoke-identities.mjs \
  --env-file=/absolute/path/to/preview.env \
  --dry-run
```

dry-run 只检查配置，不创建 SQL 客户端、不访问数据库。验证通过后，去掉 --dry-run 才会初始化三个测试身份。

正式库比较配置默认读取项目根目录 .env.production.local，且必须标记 VERCEL_ENV=production。CI 或其他路径可显式传入 --production-env-file=/absolute/path/to/production.env；缺少比较配置时拒绝执行。连接凭据只用于内存中的 endpoint 对比，不写入日志或另存文件。

初始化不再导入 dotenv/config，不接受默认 .env 或继承环境里的数据库地址。旧的仅靠环境变量运行方式会报错，不能静默回退。

## 发布和其他验收入口

- scripts/deploy-mini-preview.mjs 在读取 CloudRun 配置、构建、初始化或部署前先验证数据库隔离，再将明确的 --env-file 传给初始化。
- scripts/verify-mini-experience-smoke.mjs 和 scripts/verify-mini-refund-preview.mjs 使用同一隔离检查；退款验收不再默认读取 process.env。
- scripts/verify-mini-experience-smoke.mjs 的 local-handler 路径统一所有数据库连接变量，防止业务模块采用不同优先级时选中继承的正式库配置。
- 既有岗位同步 Preview 校验复用数据库隔离逻辑，并保留原有 JWT、缓存隔离要求。

所有这些脚本支持 --production-env-file。远程验收的 --origin 仍须使用经过部署核验的 Preview 入口；本地文件检查不能证明任意远程 URL 实际连接的数据库。

## 后台数据口径

以 auth_provider=mini_smoke 识别脚本测试身份，不按邮箱后缀猜测。普通用户即使邮箱是 .test，也不会被此规则自动隐藏。

- 用户列表、搜索、分页总数、导出及旧版全量用户 API 排除该身份。
- 用户总数、活跃人数、新增人数、官网/小程序关联人数统计采用相同过滤。
- 会员激活/当前会员统计与会员 CRM 列表排除该身份。
- 直接按 ID 进行管理员审计仍可保留；此过滤不会删除账号或撤销已有会员权益。

后台过滤是误判防护，不能代替写库隔离。正式库已有三个测试身份的证据保留在 docs/reports/2026-10-05-mini-smoke-account-security-assessment.md；本次代码修复没有删除、停用或改动它们。部署之后后台过滤才会在正式服务生效。

## 回归检查

```sh
node scripts/test-mini-smoke-isolation.mjs
node test-admin-test-account-isolation.js
node scripts/test-job-sync-preview.mjs
node scripts/check-admin-release-contracts.mjs
node test-member-crm.js
node test-mini-gateway-signature.js
```

前两项分别用合成配置/实际初始化 CLI dry-run，以及本地 PostgreSQL（PGlite）检查隔离。不会连接线上数据库、调用支付或发布服务。
