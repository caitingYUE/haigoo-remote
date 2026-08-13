# 网站合规改造上线终检（2026-08-13）

## 结论

代码与数据库增量迁移已完成，可以进入发布窗口。页面级冒烟和代码级访问策略检查已通过；发布前仍需在 Preview/生产发布终端补做一次可访问 API 的账号级冒烟，作为最终放行门槛。

本次审查排除了已冻结的岗位推荐、PayPal 支付和暂不上线小程序模块。PayPal 代码与迁移保留在工作区，但不属于本次执行范围。

## 已通过

- `npm run type-check`
- `npm run build`
- `npm run test:compliance-ui`
- `npm run test:job-access-policy`
- `npm run test:free-usage-monthly-quota`
- `node test-processed-jobs-write-policy.js`
- `node test-hero-recommendation-policy.js`
- `node test-paypal-payment.js`（仅代码级回归，不代表支付上线）
- `git diff --check`
- `071`、`072` SQL dry-run 解析
- 本次改造相关文件的 ESLint：0 errors、0 warnings
- 真实浏览器页面冒烟：首页、岗位列表/详情、企业目录、登录页，以及访客点击角色筛选的登录拦截均通过；1440px 下无横向溢出，刷新后无运行时错误（仅 React Router future flag 提示）

## 必须执行的生产步骤

1. 发布前再次核验目标库基线迁移，至少确认 `017_add_website_apply_free_usage.sql`、`025_user_entitlement_limits.sql`、`028_payment_records_metadata.sql` 已登记；不得执行 `neon-ddl.sql` 整文件。
2. `071_monthly_website_apply_quota.sql`、`072_membership_notification_log.sql` 已通过 `scripts/run-sql-migration.mjs` 在目标库执行成功，且 `schema_migrations` 已登记。
3. 已核验 `consume_free_application_quota(...)`、`membership_notification_log`、`users.free_website_apply_period_key` 存在；当前用户快照为 2828 条、缺失 period key 为 0、最大已用额度为 20。发布前保留同样的生产快照。
4. 发布前用至少一条真实有效岗位合集验证：免费用户不可见/不可打开 Private 岗位；会员可见；空合集、过期合集、详情页和移动端无异常。本地已看到 3 个真实合集和 1 条 active approved `member_only` 岗位，账号级 API 边界仍需在 Preview/生产终端复核。
5. 用测试账号完成：公开岗位浏览、非会员官网申请额度、重复申请幂等、额度达到 20 次后的 403、会员岗位访问、收藏列表过滤、企业公开邮箱与联系人脱敏、会员通知幂等。
6. 确认生产环境开关保持关闭：`PAYPAL_PAYMENTS_ENABLED=false`、`VITE_ENABLE_PAYPAL_CHECKOUT=false`、`VITE_ENABLE_PERSONALIZED_JOB_DISCOVERY=false`、`VITE_ENABLE_NON_MEMBER_REFERRAL_ACCESS=false`、`VITE_ENABLE_MEMBERSHIP_PROMOTION_BANNERS=false`，以及其他 `env.production.example` 中标记为资质审核前关闭的开关。

## 已修复的发布风险

- 会员生效邮件不再硬编码旧的“联系人/精选企业/无限”等权益，改为复用统一会员方案配置。
- `071` 未部署时，生产请求不再走非原子的兼容写入路径，而是返回 503，避免并发请求突破每期 20 次上限。
- 补齐 `npm run test:free-usage-monthly-quota`，避免发布检查命令缺失。

## 未完成/残余风险

- 本地 API 进程在账号级请求期间遇到 Neon 出站连接超时，随后 Vite 代理出现 `ECONNREFUSED`；这不是页面代码错误，但本轮未能完成 API 端到端额度/会员账号冒烟。
- 浏览器扩展未能真正切换到 390px 视口，因此移动端仅完成代码与已有截图证据检查，发布前需在 Preview/真机补测。
- 全仓 `npm run lint` 仍被历史代码错误阻断；本次改造相关文件无 lint error，但不能宣称全仓 lint 通过。
- `MembershipUpgradeModal`、`HomeHero`、`ProfileCenterPage` 的兼容会员入口仍保留若干历史权益表达（如“全部申请/联系人/无限次”）。默认合规开关不会展示部分旧方案入口，但发布前必须在真实账号路径确认这些文案不会被当前默认路由触发；如会触发，应先统一到 `lib/shared/membership.js` 的当前方案文案。
- 本地页面已加载真实岗位与 3 个岗位合集；会员/免费账号的 Private 访问边界和额度接口仍需在可用的 Preview/生产 API 上留存证据。

## 发布判定

当前判定为 **Conditional Go**：代码可以提交并推送，生产部署前必须在 Preview/生产终端完成三类账号（访客、已验证免费用户、有效会员）的 API 级冒烟、移动端视口检查，并确认生产开关保持预期状态。
