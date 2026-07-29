# Haigoo 微信云托管 BFF

在微信云托管中以本目录构建服务，配置 `.env.example` 所列环境变量，并将小程序关联到同一 CloudBase 环境。

- 小程序只通过 `Taro.cloud.callContainer` 访问 `/mini/*`，不配置 Vercel 域名。
- `/mini/favorites`、`/mini/applications` 与 `/mini/subscriptions` 均通过微信身份映射到网站 `user_id`，收藏、投递和订阅数据在两端共享。
- 云托管用 HMAC 调用主站 `/api/mini`；`MINI_GATEWAY_SHARED_SECRET` 必须与 Vercel 环境变量一致。
- 开发环境需要真实岗位做回归时，将 `HAIGOO_JOBS_API_ORIGIN` 指向正式站，并为 `MINI_JOBS_GATEWAY_SHARED_SECRET` 配置只允许 `sync` 动作的独立密钥。账号、收藏、申请、订阅、浏览额度和埋点仍通过 `HAIGOO_API_ORIGIN` 写入 Preview 测试库，不得复用生产通用 Gateway 密钥。
- 开发 CloudRun 指向受 Vercel Deployment Protection 保护的 Preview 时，在 Vercel 项目中创建 Automation Bypass，并将同一值仅配置到开发 CloudRun 的 `VERCEL_AUTOMATION_BYPASS_SECRET`；生产环境不配置该变量。
- 冷缓存时先直接从主站读取当前请求页并返回；全量缓存由后台每批最多处理 3 页、4 路写入，Logo 以单路独立队列补齐，不阻塞岗位接口。Logo 使用去重与 24 小时失败退避、流式上传，并拒绝超过 `MINI_LOGO_MAX_BYTES` 的响应，避免反复调用和耗尽云托管 Node 内存。
- 岗位缓存每小时最多拉取一次增量，只有真实字段变化才写入详情与列表集合；每天执行一次全量核对，用于恢复缺失文档和清理下线岗位。列表结果在单实例内缓存 5 分钟、同步状态缓存 1 分钟，减少高频页面请求产生的重复数据库查询。
- 同步任务使用 `mini_sync_state/jobs` 中的数据库事务租约做跨实例互斥。开发环境最大实例数为 1，生产即使临时扩容到 2 个实例，也不会重复执行同一轮同步。
- 全量同步清理过期岗位前会检查删除比例；默认单次候选删除超过 20% 时熔断并记录状态，避免上游空响应或错误分页清空有效缓存。
- 重新部署后，可由可信的内部调用方携带 `X-Mini-Sync-Secret` 请求 `POST /internal/sync?full=true`。它会从第一页同步到最后一页并等待缓存完成；岗位源地址变化也会自动触发全量重建和陈旧测试岗位清理。
- 生产环境上线首周保持最小实例数 1。进程启动时只在缓存超过一小时未更新时执行增量，定时器每小时检查一次；全量同步默认每 24 小时最多一次。若最小实例数降为 0，应改用云函数定时触发受保护的 `/internal/sync`。
- `cloudbaserc.json` 对应 `haigoo-dev/haigoo-mini`；`cloudbaserc.prod.json` 对应 `cloud1/haigoo-mini-prod`。两个环境必须使用不同的 Gateway、Session 和 Sync 密钥。
