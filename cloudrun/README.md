# Haigoo 微信云托管 BFF

在微信云托管中以本目录构建服务，配置 `.env.example` 所列环境变量，并将小程序关联到同一 CloudBase 环境。

- 小程序只通过 `Taro.cloud.callContainer` 访问 `/mini/*`，不配置 Vercel 域名。
- `/mini/favorites`、`/mini/applications` 与 `/mini/subscriptions` 均通过微信身份映射到网站 `user_id`，收藏、投递和订阅数据在两端共享。
- 云托管用 HMAC 调用主站 `/api/mini`；`MINI_GATEWAY_SHARED_SECRET` 必须与 Vercel 环境变量一致。
- 开发环境需要真实岗位做回归时，将 `HAIGOO_JOBS_API_ORIGIN` 指向正式站，并为 `MINI_JOBS_GATEWAY_SHARED_SECRET` 配置只允许 `sync` 动作的独立密钥。账号、收藏、申请、订阅、浏览额度和埋点仍通过 `HAIGOO_API_ORIGIN` 写入 Preview 测试库，不得复用生产通用 Gateway 密钥。
- 开发 CloudRun 指向受 Vercel Deployment Protection 保护的 Preview 时，在 Vercel 项目中创建 Automation Bypass，并将同一值仅配置到开发 CloudRun 的 `VERCEL_AUTOMATION_BYPASS_SECRET`；生产环境不配置该变量。
- 冷缓存时先直接从主站读取当前请求页并返回；全量缓存改为后台每批最多 3 页、8 路写入，Logo 以 2 路独立队列补齐，不阻塞岗位接口。Logo 使用轻量去重任务和流式上传，并拒绝超过 `MINI_LOGO_MAX_BYTES` 的响应，避免耗尽云托管 Node 内存。之后每五分钟最多向主站拉取一次增量。
- 重新部署后，可由可信的内部调用方携带 `X-Mini-Sync-Secret` 请求 `POST /internal/sync?full=true`。它会从第一页同步到最后一页并等待缓存完成；岗位源地址变化也会自动触发全量重建和陈旧测试岗位清理。
- 生产环境上线首周保持最小实例数 1。进程启动时会预热缓存，并每小时执行一次增量/到期全量同步；全量同步结束后会清理已下线岗位及其历史 Logo。若最小实例数降为 0，应改用云函数定时触发受保护的 `/internal/sync`。
- `cloudbaserc.json` 对应 `haigoo-dev/haigoo-mini`；`cloudbaserc.prod.json` 对应 `cloud1/haigoo-mini-prod`。两个环境必须使用不同的 Gateway、Session 和 Sync 密钥。
