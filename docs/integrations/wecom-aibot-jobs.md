# 企业微信智能机器人岗位推送

## 目标

当后台把岗位从“待审核”改成“已审核”时：

1. 网站后端把待推送任务写入 `wecom_aibot_push_queue`
2. 常驻 `worker` 通过企业微信长连接消费队列
3. `worker` 用 `aibot_send_msg` 把岗位卡片/Markdown 推到群里

## 为什么拆成两段

企业微信智能机器人长连接模式要求：

- 连接地址是 `wss://openws.work.weixin.qq.com`
- 建连后发送 `aibot_subscribe`
- 建议每 30 秒发送一次 `ping`
- 同一个机器人同一时间只能保留一个有效长连接

这和 Vercel Serverless 函数的短生命周期不匹配，所以必须把长连接放在单独的常驻进程里。

## 环境变量

```bash
WECOM_AIBOT_BOT_ID=你的机器人 Bot ID
WECOM_AIBOT_SECRET=你的机器人 Secret

# 可选：如果你已经知道目标群 chatid，直接填它
WECOM_AIBOT_CHAT_ID=目标群 chatid

# 可选：队列轮询与重试配置
WECOM_AIBOT_QUEUE_POLL_INTERVAL_MS=5000
WECOM_AIBOT_MAX_RETRIES=6
WECOM_AIBOT_RETRY_DELAY_SECONDS=120
```

## 如何拿到群 chatid

`aibot_send_msg` 推群消息时，企业微信要求传 `body.chatid`。

如果你现在只有 `BotID` 和 `Secret`，还没有 `chatid`，最稳妥的做法是：

1. 先启动 `worker`
2. 在目标群里 `@机器人` 发送任意一条消息
3. `worker` 会从 `aibot_msg_callback` 中拿到 `body.chatid`
4. 首次拿到后会自动写入系统设置，后续推送就能直接复用

如果你已经从群相关回调里拿到 `chatid`，可以直接配置 `WECOM_AIBOT_CHAT_ID`。

## 部署步骤

1. 执行迁移 `server-utils/dal/migrations/014_wecom_aibot_push_queue.sql`
2. 在运行环境配置上面的企业微信变量
3. 启动常驻进程：

```bash
npm run wecom-bot:worker
```

4. 在后台把某个岗位审核通过，观察队列表和企业微信群消息

## 本次代码落点

- 审核通过写队列：`lib/api-handlers/processed-jobs.js`
- 队列与消息格式：`lib/services/wecom-aibot-queue-service.js`
- 长连接客户端：`lib/services/wecom-aibot-client.js`
- 常驻 worker：`scripts/wecom-aibot-worker.js`

## 常见问题

### 1. 为什么没直接在 API 里推消息

因为长连接模式的核心是“一个常驻连接 + 心跳 + 自动重连”。把这个逻辑塞进短生命周期 API，稳定性会很差。

### 2. 为什么消息没发出去

优先检查：

- `WECOM_AIBOT_BOT_ID` / `WECOM_AIBOT_SECRET` 是否正确
- 机器人当前是否仍处于“长连接 API 模式”
- 是否已经拿到目标群 `chatid`
- `worker` 是否在线

### 3. Secret 已经在截图里暴露了怎么办

建议在企业微信后台立刻重新生成并替换 `Secret`。
