# Haigoo 小程序正式发布手册

## 1. 固定架构

- 开发：`haigoo-dev-d2gctbzxma401b345 / haigoo-mini`
- 生产：`cloud1-d8ggt7rbl273f83c7 / haigoo-mini-prod`
- 小程序只通过 `wx.cloud.callContainer` 调用云托管，CloudRun 公网访问保持关闭。
- 开发 CloudRun 的用户测试数据通过 HMAC 调用 `https://mini-preview.haigooremote.com/api/mini`；岗位只读同步通过受限密钥调用 `https://haigooremote.com/api/mini`。生产 CloudRun 全部调用正式站。
- `mini-preview` 是现有主域名下的开发子域名，不是新购买的顶级域名；当前架构仍不需要购买新域名。

## 2. 发布前密钥与数据

- Vercel Production/Preview 必须配置不同的 `JWT_SECRET`；不得使用本地开发回退值。
- 开发 CloudRun 的 `MINI_GATEWAY_SHARED_SECRET` 对应 Vercel 的同名变量；生产 CloudRun 的该变量对应 Vercel `MINI_GATEWAY_PRODUCTION_SECRET`。
- 开发和生产分别生成 `MINI_SESSION_SECRET`、`MINI_SYNC_SECRET`。
- 开发 CloudRun 通过 `VERCEL_AUTOMATION_BYPASS_SECRET` 访问受保护的 Vercel Preview；该密钥不得配置到生产服务。
- 开发 CloudRun 使用 `MINI_JOBS_GATEWAY_SHARED_SECRET` 读取正式岗位；Vercel Production 对应 `MINI_GATEWAY_READONLY_SECRET`，代码只允许该密钥执行 `sync`，不得用生产通用 Gateway 密钥代替。
- 两个环境使用同一个微信 AppID 时可使用同一个 AppSecret，但不得写入仓库。
- 生产 CloudRun 只连接正式 Gateway；开发环境不得写入正式收藏、申请、订阅或浏览额度数据。
- 发布前应用数据库迁移 `054`、`055`、`056`、`057`、`058`，记录执行时间和执行人。若测试库来自较早快照，还要核对网站基础迁移 `019`、`021`、`023`、`026`、`037`、`038`，否则会员岗位、企业内推、Logo 和小程序埋点会静默走兼容回退。
- 发布前创建 Neon 恢复点并导出 CloudBase `mini_jobs`、`mini_job_list`、`mini_sync_state`。

## 3. CloudRun 发布

1. `cloud1` 云托管资源已开通，生产服务 `haigoo-mini-prod` 已创建；后续发布前继续确认套餐、余额与自动续费。
2. 在 `cloudrun/` 安装锁定依赖并运行 `npm run check`。
3. 首次生产部署已经完成。重建新服务时执行 `node scripts/deploy-mini-cloudrun.mjs --target=production --configure-vercel`；脚本只打包运行文件，显式关闭公网、设置最小实例 1、固定正式 Gateway，并生成独立密钥。
4. 仅在首次生成或轮换生产 Gateway 密钥后执行 Vercel Production 重新部署，让新密钥进入函数运行时；完成前不要将小程序切到生产环境。
5. 后续生产代码更新执行 `node scripts/deploy-mini-cloudrun.mjs --target=production`；测试环境更新执行 `node scripts/deploy-mini-cloudrun.mjs --target=development`。
6. 检查 `/health`、启动日志和首次全量同步结果。
7. 确认岗位总数与主站一致、详情可读、Logo 失败时有本地图标兜底。
8. 生产冒烟测试完成后保存镜像版本号；回滚时切换到上一镜像，不覆盖数据库。

截至 2026-07-28，生产服务状态为 `normal`，最小实例 1、最大实例 2、公网访问关闭，正式 Gateway 签名请求返回 200，无签名请求返回 401，首次全量缓存为 412 个岗位。

开发 CloudRun 的账号与交互接口使用受保护的稳定 Preview Gateway `mini-preview.haigooremote.com`；Preview 使用独立测试数据库且已应用小程序迁移 054–058，并补齐其快照缺失的基础迁移 019、021、023、026、037、038。岗位缓存使用正式站只读通道，账号、收藏、申请、订阅和浏览额度仍与生产隔离。不要改回临时 `*.vercel.app` 地址；腾讯云大陆容器对该地址曾出现 `ETIMEDOUT`。

混合数据源下，CloudRun 会把收藏/申请所需的最小岗位快照通过账号 Gateway 的签名请求传给 Preview；只读密钥本身不能调用这些写动作。开发订阅结果按 Preview 中保存的主题从正式岗位缓存实时匹配，生产环境仍以正式订阅投递历史为准。

Vercel Mini Gateway 有改动时执行 `npm run deploy:mini-preview`。脚本先验证新的不可变 Preview 部署，再更新稳定子域名，失败时不会覆盖上一个可用部署。CloudRun 代码有改动时执行 `npm run deploy:mini-cloudrun:dev`。执行 `npm run check:mini-gateway:dev` 可核对当前开发链路。

首次配置正式岗位只读源时执行 `node scripts/deploy-mini-cloudrun.mjs --target=development --configure-jobs-source`。后续用 `npm run check:mini-jobs:dev` 验证正式岗位接口，用 `npm run check:mini-cache:dev` 验证开发缓存；截至 2026-07-28，开发缓存为 412 条岗位、242 条热门岗位，列表与详情集合均已完成全量重建。

## 4. 小程序构建与提交

1. `npm run type-check`。
2. 在 `miniprogram/` 执行 `npm run build:weapp:prod`。
   - 脚本使用 Taro 官方 `--no-check` 参数跳过存在 macOS 原生崩溃的 Doctor 远程 schema 校验；TypeScript、JSON、上线契约和真实构建仍需全部通过。
   - 开发产物保留在 `dist/`；正式产物写入 `dist-prod/`，并生成可独立导入的 `.wechat-production/`，不会再被本地 `--watch` 覆盖。
3. 微信开发者工具导入 `miniprogram/.wechat-production/`，执行代码依赖分析，主包目标不超过 1.8 MiB。
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
