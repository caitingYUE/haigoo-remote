# Haigoo 小程序正式发布手册

## 1. 固定架构

- 开发：`haigoo-dev-d2gctbzxma401b345 / haigoo-mini`
- 生产：`cloud1-d8ggt7rbl273f83c7 / haigoo-mini-prod`
- 小程序只通过 `wx.cloud.callContainer` 调用云托管，CloudRun 公网访问保持关闭。
- CloudRun 通过 HMAC 调用 `https://haigooremote.com/api/mini`。
- 当前架构不需要购买或绑定新的 API 域名。

## 2. 发布前密钥与数据

- Vercel Production/Preview 必须配置不同的 `JWT_SECRET`；不得使用本地开发回退值。
- 开发 CloudRun 的 `MINI_GATEWAY_SHARED_SECRET` 对应 Vercel 的同名变量；生产 CloudRun 的该变量对应 Vercel `MINI_GATEWAY_PRODUCTION_SECRET`。
- 开发和生产分别生成 `MINI_SESSION_SECRET`、`MINI_SYNC_SECRET`。
- 两个环境使用同一个微信 AppID 时可使用同一个 AppSecret，但不得写入仓库。
- 生产 CloudRun 只连接正式 Gateway；开发环境不得写入正式收藏、申请、订阅或浏览额度数据。
- 发布前应用数据库迁移 `054`、`055`、`056`、`057`，记录执行时间和执行人。
- 发布前创建 Neon 恢复点并导出 CloudBase `mini_jobs`、`mini_job_list`、`mini_sync_state`。

## 3. CloudRun 发布

1. 在腾讯云控制台确认 `cloud1` 已开通云托管资源并确认套餐/计费；当前 API 返回“云托管资源未开通”。
2. 在 `cloudrun/` 安装锁定依赖并运行 `npm run check`。
3. 首次生产部署执行 `node scripts/deploy-mini-cloudrun.mjs --target=production --configure-vercel`。脚本只打包运行文件，显式关闭公网、设置最小实例 1，并生成独立密钥。
4. 首次脚本成功后立即执行 `npx vercel --prod --yes`，让新生产网关密钥进入 Vercel 函数运行时；完成前不要将小程序切到生产环境。
5. 后续生产代码更新执行 `node scripts/deploy-mini-cloudrun.mjs --target=production`；测试环境更新执行 `node scripts/deploy-mini-cloudrun.mjs --target=development`。
6. 检查 `/health`、启动日志和首次全量同步结果。
7. 确认岗位总数与主站一致、详情可读、Logo 失败时有本地图标兜底。
8. 生产冒烟测试完成后保存镜像版本号；回滚时切换到上一镜像，不覆盖数据库。

## 4. 小程序构建与提交

1. `npm run type-check`。
2. `npm run build:weapp:prod`。
   - 脚本使用 Taro 官方 `--no-check` 参数跳过存在 macOS 原生崩溃的 Doctor 远程 schema 校验；TypeScript、JSON、上线契约和真实构建仍需全部通过。
3. 微信开发者工具执行代码依赖分析，主包目标不超过 1.8 MiB。
4. 确认上传时关闭 source map，产物中的环境为 `cloud1/haigoo-mini-prod`。
5. 上传体验版，以审核账号完成只读冒烟和真机回归。
6. 在微信公众平台完成隐私保护指引、服务类目、审核说明和版本说明。
7. 审核通过后发布；首日监控登录、5xx、延迟、岗位加载、收藏和订阅写入。

## 5. 回滚与告警

- 5xx 连续 10 分钟超过 1%、P95 超过 2 秒或实例异常时停止继续放量。
- 小程序问题：回退到上一已审核版本；CloudRun 问题：回退上一镜像。
- 数据迁移只在确认应用已回退且无新版本依赖时按迁移文件中的 rollback 注释执行。
- 上线 24 小时和 7 天检查请求量、错误率、成本、资源余额、日志与用户反馈。

## 6. 人工上线闸门

- 法务/微信审核支持确认“咨询及信息筛选服务”类目与实际页面、岗位展示和申请入口一致。
- 微信隐私保护指引与小程序内隐私政策保持一致，包含 OpenID、邮箱、收藏、申请、订阅、搜索/浏览记录、日志和境外基础设施说明。
- 正式隐私政策和用户协议由公司法务复核版本号 `2026-07-23` 后启用。
- 准备未绑定、免费会员、有效会员且无订阅、有效会员且已有订阅四类审核账号。
