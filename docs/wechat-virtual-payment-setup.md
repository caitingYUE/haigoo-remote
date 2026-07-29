# Haigoo 小程序虚拟支付配置与联调

## 已接入的链路

1. 用户在 Club 页面选择方案，并确认用户协议与隐私政策。
2. 小程序重新调用 `wx.login`，把一次性 `code`、方案 ID 和幂等键发送给 CloudRun。
3. CloudRun 用 `jscode2session` 获取当前 `openid` 与 `session_key`，校验支付身份与登录身份一致。
4. Mini Gateway 从服务端方案白名单读取商品、价格和权益期限，创建待支付订单。
5. CloudRun 使用 AppKey 和 `session_key` 分别生成 `paySig`、`signature`，小程序调用 `wx.requestVirtualPayment`。
6. 微信通过消息推送发送 `xpay_goods_deliver_notify`。
7. Vercel 回调验证微信消息签名，并核对 AppID、OpenID、订单号、商品 ID、数量、环境和金额。
8. 数据库在同一条 SQL 中将订单改为已支付并发放 Club 权益。客户端 `success` 回调不会直接开通权益。
9. 小程序轮询订单状态，到账后刷新网站与小程序共享的 Club 身份。

## 微信公众平台配置

### 1. 虚拟支付基本配置

在「支付与交易 → 虚拟支付」完成能力开通，记录以下内容：

- `OfferId`
- 沙箱 `AppKey`
- 现网 `AppKey`

AppKey 只能保存在 CloudRun 环境变量中，不能放入 Vercel 前端变量、小程序代码、Git 或聊天记录。

### 2. 道具管理

使用“道具直购”创建并发布三个商品。商品 ID 可以自定义，价格必须与服务端方案一致：

| 服务端方案 ID | 微信 `productId` | 商品名称 | 微信后台价格（元） | 接口 `goodsPrice`（分） |
| --- | --- | --- | ---: | ---: |
| `club_starter_monthly` | `club_starter_monthly` | Club Starter 30 天权益 | 99 | 9900 |
| `club_half_year` | `club_half_year` | Club Member 6 个月权益 | 499 | 49900 |
| `club_annual` | `club_annual` | Club Partner 1 年权益 | 998 | 99800 |

服务端会同时校验方案 ID、`productId`、价格、权益类型和期限；任一项不一致都会停止下单。代码不会接受客户端传入的价格，也不会在商品未配置时降级到二维码或转账。

### 3. 消息推送

在「开发管理 → 开发设置 → 消息推送」配置：

- URL：`https://haigooremote.com/api/wechat-virtual-payment-notify`
- Token：自行生成一段高强度随机字符串，并与 Vercel `WECHAT_MESSAGE_TOKEN` 保持一致
- 数据格式：JSON
- 消息加解密方式：明文模式
- 事件：至少启用 `xpay_goods_deliver_notify`；同时启用后台提供的退款和投诉事件

当前回调按微信明文消息模式进行 SHA-1 签名校验。不要在后台选择兼容模式或安全模式，否则回调会失败关闭，权益不会被错误发放。

## 环境变量

### CloudRun `haigoo-mini`（开发/沙箱）

```dotenv
WECHAT_VIRTUAL_PAYMENT_OFFER_ID=微信后台OfferId
WECHAT_VIRTUAL_PAYMENT_APP_KEY=微信后台沙箱AppKey
WECHAT_VIRTUAL_PAYMENT_ENV=1
```

### CloudRun `haigoo-mini-prod`（生产）

```dotenv
WECHAT_VIRTUAL_PAYMENT_OFFER_ID=微信后台OfferId
WECHAT_VIRTUAL_PAYMENT_APP_KEY=微信后台现网AppKey
WECHAT_VIRTUAL_PAYMENT_ENV=0
```

### Vercel Preview / Production

Preview 与 Production 应分别配置对应环境的商品 ID 映射：

```dotenv
WECHAT_MINI_APP_ID=当前小程序AppID
WECHAT_VIRTUAL_PAYMENT_PRODUCTS_JSON={"club_starter_monthly":"club_starter_monthly","club_half_year":"club_half_year","club_annual":"club_annual"}
WECHAT_MESSAGE_TOKEN=与微信消息推送后台相同的Token
WECHAT_VIRTUAL_PAYMENT_RELAY_SECRET=Preview与Production共享的独立高强度随机密钥
```

`WECHAT_MESSAGE_TOKEN` 必须配置在提供正式回调域名的 Production 环境。修改 Vercel 环境变量后需要重新部署。

Production 还需要配置：

```dotenv
WECHAT_VIRTUAL_PAYMENT_SANDBOX_CALLBACK_ORIGIN=https://mini-preview.haigooremote.com
VERCEL_AUTOMATION_BYPASS_SECRET=Preview部署保护的自动化绕过密钥
```

微信只有一个消息推送地址。正式地址收到 `Env=1` 的沙箱发货事件后，会使用 HMAC 签名安全转发到 Preview，由开发数据库完成沙箱订单与权益变更；`Env=0` 的现网事件始终只在 Production 处理。

仓库提供一条原子化配置命令。它会从开发 CloudRun 读取现有 Preview 绕过密钥，生成独立的支付回调中继密钥，并同时写入 Vercel Preview 与 Production；执行后必须立即重新部署两个 Vercel 环境：

```bash
npm run configure:mini-payment-relay
```

## 数据库迁移

开发数据库和生产数据库分别执行：

```text
server-utils/dal/migrations/059_wechat_virtual_payments.sql
server-utils/dal/migrations/060_align_wechat_virtual_payment_products.sql
```

迁移新增微信订单字段、交易号唯一索引、待支付订单索引和金额约束，不包含生产密钥。

## 联调顺序

1. 先配置沙箱商品、Preview 环境变量和开发 CloudRun，执行开发数据库迁移。
2. 部署 Vercel Preview 与开发 CloudRun。
3. 使用已绑定的免费测试账号在 Club 页面选择一个方案。
4. 确认小程序能拉起微信官方虚拟支付；取消支付后权益不得变化。
5. 完成沙箱支付，确认 `payment_records` 从 `pending` 变为 `completed`，且网站与小程序同时变为对应 Club 身份。
6. 使用同一条支付通知重放一次，确认权益期限不会重复增加。
7. 再配置现网商品、Production 环境变量和生产 CloudRun，执行生产数据库迁移。
8. 生产首单使用专门测试账号，并核对订单金额、回调、权益期限和日志后再提交新审核版本。

## 尚未启用的能力

- 主动退款 API 与退款后的精确权益回收尚未启用。正式开放购买前，需要根据微信后台实际开通的退款接口补齐，并完成一次端到端退款测试。
- 当前只支持 JSON + 明文消息推送。若改用安全模式，需要先实现并验证 EncodingAESKey 解密，不能只切换后台选项。

官方入口：

- <https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html>
- <https://developers.weixin.qq.com/community/minihome/doc/00002cf077cd4810fee42f4b865c01>
