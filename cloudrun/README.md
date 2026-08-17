# Haigoo 微信云托管 BFF

在微信云托管中以本目录构建服务，配置 `.env.example` 所列环境变量，并将小程序关联到同一 CloudBase 环境。

- 小程序只通过 `Taro.cloud.callContainer` 访问 `/mini/*`，不配置 Vercel 域名。
- `/mini/favorites`、`/mini/applications` 与 `/mini/subscriptions` 均通过微信身份映射到网站 `user_id`，收藏、投递和订阅数据在两端共享。
- 云托管用 HMAC 调用主站 `/api/mini`；`MINI_GATEWAY_SHARED_SECRET` 必须与 Vercel 环境变量一致。
- 开发环境需要真实岗位做回归时，将 `HAIGOO_JOBS_API_ORIGIN` 指向正式站，并为 `MINI_JOBS_GATEWAY_SHARED_SECRET` 配置只允许 `sync` 动作的独立密钥。账号、收藏、申请、订阅、浏览额度和埋点仍通过 `HAIGOO_API_ORIGIN` 写入 Preview 测试库，不得复用生产通用 Gateway 密钥。
- 开发 CloudRun 指向受 Vercel Deployment Protection 保护的 Preview 时，在 Vercel 项目中创建 Automation Bypass，并将同一值仅配置到开发 CloudRun 的 `VERCEL_AUTOMATION_BYPASS_SECRET`；生产环境不配置该变量。
- 冷缓存时先直接从主站读取当前请求页并返回；全量缓存由后台每批最多处理 3 页、4 路写入，Logo 以单路独立队列补齐，不阻塞岗位接口。Logo 使用去重与 24 小时失败退避、流式上传，并拒绝超过 `MINI_LOGO_MAX_BYTES` 的响应，避免反复调用和耗尽云托管 Node 内存。
- 小程序 1.0 不再读取岗位路由，因此 `MINI_ENABLE_LEGACY_JOB_CACHE` 默认必须为 `false`；旧岗位接口仍保留，但不会在启动和定时器中主动读写 CloudBase 文档数据库。只有明确回滚到旧客户端时才临时开启。
- 企业 Logo 和笔记封面只在首次缺失时写入云存储，并把 `fileID` 持久化到单一内容资产索引；后续容器冷启动先读取索引，避免重复上传。客户端会批量把 `cloud://` 转成带缓存的临时 HTTPS 后再渲染。
- 同步任务使用 `mini_sync_state/jobs` 中的数据库事务租约做跨实例互斥。开发环境最大实例数为 1，生产即使临时扩容到 2 个实例，也不会重复执行同一轮同步。
- 全量同步清理过期岗位前会检查删除比例；默认单次候选删除超过 20% 时熔断并记录状态，避免上游空响应或错误分页清空有效缓存。
- 重新部署后，可由可信的内部调用方携带 `X-Mini-Sync-Secret` 请求 `POST /internal/sync?full=true`。它会从第一页同步到最后一页并等待缓存完成；岗位源地址变化也会自动触发全量重建和陈旧测试岗位清理。
- 若未来临时启用旧岗位缓存，生产环境启动时只在缓存超过一小时未更新时执行增量，定时器每小时检查一次；全量同步默认每 24 小时最多一次。
- `cloudbaserc.json` 对应 `haigoo-dev/haigoo-mini`；`cloudbaserc.prod.json` 对应 `cloud1/haigoo-mini-prod`。两个环境必须使用不同的 Gateway、Session 和 Sync 密钥。
