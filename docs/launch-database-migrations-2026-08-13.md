# 上线数据库迁移清单（2026-08-13）

本清单只记录待执行项与核验方式。当前本地检查未连接或写入 Neon。

## 本次网站合规上线的执行范围

本次只上线网站前后端合规与非会员体验改造。岗位推荐、PayPal 支付、小程序均不在本次上线范围内。

### 必须执行

按以下顺序逐个执行：

1. `071_monthly_website_apply_quota.sql`
   - 新增并扩展 `users.free_website_apply_period_key`，保存以注册时间为锚点的 30 天申请周期。
   - 每期官网直申与邮箱申请合计 20 次，进入下一周期后归零，未使用次数不结转。
   - 部署时保留已有用户的当期使用次数和岗位记录，避免规则切换额外补发额度。
   - 新增原子消耗函数，阻止并发申请突破每期 20 次上限。
2. `072_membership_notification_log.sql`
   - 正式创建会员生效/到期通知的幂等日志表，避免线上请求临时执行 DDL。

### 本次明确不执行

- `066_paypal_payments.sql`：PayPal 已冻结，且 `PAYPAL_PAYMENTS_ENABLED` 与 `VITE_ENABLE_PAYPAL_CHECKOUT` 保持 `false`。该迁移会改写会员 entitlement 约束并新增支付表/函数，必须在 PayPal 专项上线窗口单独执行。
- `server-utils/dal/neon-ddl.sql`：这是全量/兼容性 DDL，不是本次发布脚本，禁止直接在生产整文件执行。
- `034_seed_membership_test_users.sql`、`053_seed_monthly_starter_test_user.sql` 及其他测试/小程序迁移：除非目标环境明确需要测试数据或小程序发布，否则不执行。

### 基线依赖核验

`071` 依赖历史迁移 `017_add_website_apply_free_usage.sql` 与 `025_user_entitlement_limits.sql` 已存在；`072` 依赖现有 `notifications` 表。若目标库是全新库或 `schema_migrations` 为空，不能只执行本页两个文件，必须先按仓库迁移顺序完成建库基线，再执行本次增量。

## 本地静态检查

以下命令只解析 SQL，不读取环境变量，也不会连接数据库：

```bash
node scripts/run-sql-migration.mjs --dry-run 066_paypal_payments.sql
node scripts/run-sql-migration.mjs --dry-run 071_monthly_website_apply_quota.sql
node scripts/run-sql-migration.mjs --dry-run 072_membership_notification_log.sql
```

本次网站发布只需要对 `071`、`072` 做 dry-run；`066` 仅用于未来 PayPal 专项发布前的预检。

## 上线窗口核验

执行迁移前：

```sql
SELECT migration_name, applied_at
FROM schema_migrations
WHERE migration_name IN (
  '017_add_website_apply_free_usage.sql',
  '025_user_entitlement_limits.sql',
  '028_payment_records_metadata.sql',
  '059_wechat_virtual_payments.sql',
  '061_reconcile_mini_payment_schema.sql',
  '064_membership_redemption_codes.sql',
  '071_monthly_website_apply_quota.sql',
  '072_membership_notification_log.sql'
)
ORDER BY migration_name;
```

执行网站迁移后：

```sql
SELECT
  to_regclass('public.membership_notification_log') AS membership_notification_log,
  to_regprocedure('public.consume_free_application_quota(character varying,character varying,character varying,integer,integer,jsonb)') AS consume_free_application_quota;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name = 'free_website_apply_period_key';
```

所有迁移均通过 `scripts/run-sql-migration.mjs` 逐个执行，并在同一事务中写入 `schema_migrations`。任一步失败时停止后续迁移，保留错误日志并检查目标库当前结构。

执行示例（生产环境变量只在发布终端注入，不提交到仓库）：

```bash
node scripts/run-sql-migration.mjs 071_monthly_website_apply_quota.sql
node scripts/run-sql-migration.mjs 072_membership_notification_log.sql
```

每一步执行前后都保存 `schema_migrations`、`users.free_website_apply_*` 的计数快照。迁移完成后再发布前端；若 `071` 失败，停止发布，不要手工补写用户额度。
