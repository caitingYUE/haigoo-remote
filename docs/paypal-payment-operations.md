# PayPal 网站支付上线手册

## 当前实现范围

- Web SDK v6 + Orders v2，一次性付款，币种固定为 CNY。
- 仅支持 `club_starter_monthly`、`club_half_year`、`club_annual`。
- 浏览器只获得 Client ID；Client Secret、OAuth Token 和 Webhook 验证全部留在服务端。
- 服务端确认 Capture 为 `COMPLETED` 后，通过数据库原子函数创建权益段。
- 同档续费和跨档购买都排在当前非失效权益段末尾；待生效同档不可重复购买。
- 首版不包含订阅与自动续费。

## 网站侧入口与职责

- `Club 权益`：只负责介绍权益和选择方案；方案卡保留原有产品表达，点击后再选择开通方式。
- `开通方式`：PayPal 可用时提供在线付款，并始终保留顾问协助入口；PayPal 不可用时直接以顾问协助作为主操作。
- `兑换会员码`：沿用原兑换码链路，与 PayPal 权益段共同排期，不能因上线支付而移除或降级。
- `我的订单`：独立承载在线订单状态、续费/再次购买、退款申请和订单帮助。顾问线下协助的服务不冒充在线订单。
- 支付弹窗只展示用户做决定所需的方案、金额、周期、权益开始时间和开通方式；退款规则、服务端状态、对账与幂等规则不进入结账文案。

## 需求复核后的风险控制

- PayPal 账户审核未完成或配置请求失败时，页面必须自动降级到顾问协助，不能留下不可点击的支付死路。
- Capture 返回不明确、凭证缺失或出现 `ORDER_ALREADY_CAPTURED` 时统一进入 `capture_pending`，交由 Webhook/定时对账确认，前端提示勿重复付款。
- 退款请求发生网络或服务端未知结果时保持 `pending`，不得标记失败后重新生成退款请求，避免重复退款。
- 乱序的 `PENDING`/`DECLINED` Webhook 不得覆盖已完成订单；争议解决后恢复为已完成或相应退款状态，权益只在退款或撤销成立后调整。
- Starter 使用按天权益。迁移必须先移除旧表的 `duration_months IN (1, 6, 12)` 约束，否则 30 天支付权益无法写入。
- 当前订单页一次加载最近 20 笔；正式开放前应确认订单量预期，超过该规模时补充分页或“加载更多”。

## 部署顺序

1. 先在预发布数据库备份并演练，再使用项目既有数据库发布流程执行 `server-utils/dal/migrations/066_paypal_payments.sql`。当前迁移尚未在生产执行。
2. 在 Sandbox App 创建 Webhook，回调地址为 `https://<domain>/api/paypal-webhook`。
3. 配置服务端环境变量，但保持 `PAYPAL_PAYMENTS_ENABLED=false`。
4. 在非生产环境打开功能，完成首次购买、同档续费、跨档排期、取消、重复 Capture、Webhook 重放和退款测试。
5. PayPal 账户审核通过后创建独立 Live App/Webhook，确认账户可以接收 CNY。
6. 用独立买家完成低金额 Live 付款、自动开通、退款和权益回收，再对白名单开放。
7. 观察小时级 `membership-lifecycle` 对账结果中的 `paypal.entitlementAnomalies`；为零且无失败 Webhook 后再全量开放。

## 环境变量

```text
PAYPAL_ENV=sandbox|live
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
PAYPAL_WEBHOOK_ID=...
PAYPAL_PAYMENTS_ENABLED=false|true
```

这些变量均不得使用 `VITE_` 前缀。Client Secret 与 OAuth Token 不得出现在浏览器响应、前端构建、埋点或日志中。如果截图中展示的字段经确认是 Secret，或 Secret 曾进入聊天、仓库、日志，应先轮换再继续测试。

## Webhook 订阅事件

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.PENDING`
- `PAYMENT.CAPTURE.DECLINED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`
- `PAYMENT.REFUND.COMPLETED`
- `PAYMENT.REFUND.FAILED`
- `CUSTOMER.DISPUTE.CREATED`
- `CUSTOMER.DISPUTE.UPDATED`
- `CUSTOMER.DISPUTE.RESOLVED`

Webhook 必须通过 PayPal `verify-webhook-signature` 返回 `SUCCESS` 才处理。事件按 PayPal Event ID 去重；失败事件允许重试，已成功事件只返回幂等结果。

## 运行时检查

- `GET /api/paypal?action=config`：只应返回公开 Client ID 和开关状态。
- `GET /api/admin-ops?action=payment-orders`：管理员检查待确认、退款和争议订单。
- `/api/cron/membership-lifecycle`：小时级查询长时间 `capture_pending` 订单、过期未支付订单及“已付款但无权益段”异常。
- 日志只使用内部订单号、HTTP 状态、PayPal Debug ID 与脱敏错误；禁止记录完整付款人资料和原始 Webhook PII。

## 上线阻断条件

- PayPal 账户仍限制收款或 Live App 未完成审核。
- CNY Capture 无法稳定进入 `COMPLETED`。
- Webhook 签名或退款回调未验证通过。
- 任意重试会重复发放权益、重复退款，或 `entitlementAnomalies` 非零。
- 截图或历史配置中的凭据性质未确认、疑似 Secret 未轮换。

官方参考：

- [Web SDK v6](https://developer.paypal.com/v5-v6)
- [Orders v2 Checkout](https://developer.paypal.com/api/rest/integration/orders-api/api-use-cases/standard/)
- [REST Webhook 验证](https://developer.paypal.com/api/rest/webhooks/rest/)
- [REST API 幂等](https://developer.paypal.com/api/rest/reference/idempotency/)
