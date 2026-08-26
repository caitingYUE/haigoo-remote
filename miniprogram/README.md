# Haigoo Remote 微信小程序

## 运行架构

小程序不直连 Haigoo 网站或任何外部招聘域名。所有请求通过关联微信云开发环境的 `Taro.cloud.callContainer` 发往 `cloudrun/` 中的云托管 BFF：

- `GET /mini/jobs`：岗位列表、搜索、分类和精选。
- `GET /mini/jobs/:id`：岗位详情。
- `POST /mini/auth/session`：微信 code 登录。
- `POST /mini/account/bind`：一次性绑定已有网站账号。
- `POST /mini/account/register`：创建网站账号并绑定当前微信。
- `GET` / `POST /mini/subscriptions`：会员岗位订阅与最新岗位更新。
- `GET` / `POST /mini/favorites`：读取或更新与网站共享的岗位收藏。
- `GET /mini/applications`：读取与网站共享的申请记录。
- `POST /mini/jobs/:id/application`：校验权益后返回可复制的申请信息。

云托管使用 HMAC 访问主站私有 `/api/mini` 接口；Neon 仍是唯一业务数据源，CloudBase 仅缓存岗位读模型与公司 Logo。

## 发布配置

1. 在微信云托管部署仓库根目录的 `cloudrun/` 服务，并配置其中 `.env.example` 列出的环境变量。
2. 在 Vercel 配置与云托管相同的 `MINI_GATEWAY_SHARED_SECRET` 以及 `WECHAT_MINI_APP_ID`，然后依次执行小程序迁移 `054_mini_wechat_identities.sql`、`055_mini_job_views.sql`、`056_mini_launch_readiness.sql` 与 `057_mini_security_and_consistency.sql`。`058_trusted_company_referral_contacts.sql` 属于网站可信企业内推能力，不是当前仅支持官网和邮箱申请的小程序首发阻断项。从早期快照创建的测试库还必须确认网站基础迁移 `019`、`021`、`023`、`026`、`037`、`038` 已应用。
3. 在本目录 `.env.production` 填入关联的 `TARO_APP_CLOUD_ENV`；服务名默认使用 `haigoo-mini`。
4. 首次打开小程序时服务会自动完成全量预热；之后每五分钟最多向主站拉取一次增量。首版无需额外暴露公网定时接口。

`project.config.json` 保持 `urlCheck: true`。正式版不需要，也不能依赖“关闭合法域名校验”。

## 构建

- 日常开发监听：`npm run dev:weapp`（显式使用 `NODE_ENV=development`，输出到 `dist/`）。
- 微信开发者工具日常只导入本目录 `miniprogram/`，根目录的 `project.config.json` 会加载开发产物 `dist/`，该产物固定连接 `haigoo-dev/haigoo-mini`。
- 上传体验版前：先更新本目录 `package.json` 的版本号，再执行 `npm run build:weapp:experience`。产物写入 `dist-experience/`，并准备独立项目 `.wechat-experience/`；质量闸门会确认它只连接开发云环境。
- 提审或发布正式版前：执行 `npm run build:weapp:prod`。产物写入 `dist-prod/`，并准备独立项目 `.wechat-production/`；质量闸门会确认它只连接正式云环境。
- 微信开发者工具/CLI 必须按发布目标选择 `.wechat-experience/` 或 `.wechat-production/`，不能交叉使用。日常开发项目、体验项目和正式项目的产物互不覆盖。
- 体验包构建并完成后使用 `npm run upload:weapp:experience` 上传；正式候选包使用 `npm run upload:weapp:prod`。上传封装会再次验证编译环境并自动选择对应项目目录。

## 本地联调

开发调用链按数据类型隔离：

- 岗位只读：`微信开发者工具 -> haigoo-dev/haigoo-mini -> https://haigooremote.com -> 正式岗位数据`
- 用户测试数据：`微信开发者工具 -> haigoo-dev/haigoo-mini -> https://mini-preview.haigooremote.com -> Vercel Preview 数据库`

`mini-preview.haigooremote.com` 是受 Vercel Deployment Protection 保护的稳定开发入口；云托管通过 `VERCEL_AUTOMATION_BYPASS_SECRET` 访问。不要把临时的 `*.vercel.app` 部署地址直接写入云托管：腾讯云大陆容器访问该地址曾出现 `ETIMEDOUT`，且临时部署更新后地址会变化。

正式岗位通道使用独立的 `MINI_GATEWAY_READONLY_SECRET`，服务端只允许该密钥调用 `sync`。收藏、申请、订阅、登录、浏览额度和埋点仍写入 Preview 测试库，不会污染正式用户数据。
开发环境收藏和申请会把正式岗位的最小快照随签名请求写入 Preview；订阅展示则根据 Preview 中保存的主题从 CloudBase 正式岗位缓存匹配，因此不会依赖 Preview 数据库中的旧测试岗位。生产环境仍使用正式投递历史。

常用操作：

1. 只修改小程序页面、样式或交互：在本目录执行 `npm run dev:weapp`，微信开发者工具导入本目录并重新编译即可。
2. 修改 `cloudrun/`：仓库根目录执行 `npm run deploy:mini-cloudrun:dev`。
3. 修改 Vercel `/api/mini` 或数据库读取逻辑：仓库根目录执行 `npm run deploy:mini-preview`。脚本会先部署并签名验证不可变 Preview URL，成功后才把稳定子域名切到新部署，再执行一次验证。
4. 任意时候可在仓库根目录执行 `npm run check:mini-gateway:dev`，确认开发 Gateway、签名、保护绕过和测试数据库连通性；成功结果应返回 HTTP 200 和测试库岗位总数。
5. 执行 `npm run check:mini-jobs:dev` 可验证正式岗位只读通道；执行 `npm run check:mini-cache:dev` 可核对 CloudBase 岗位列表、详情、热门数量和全量同步状态。

开发工具出现 `fetch failed` 时，优先查看 `haigoo-dev/haigoo-mini` 日志：

- `ETIMEDOUT`：检查 `HAIGOO_API_ORIGIN` 是否仍为 `https://mini-preview.haigooremote.com`。
- HTTP `401`：检查开发 CloudRun 与 Vercel Preview 的 Gateway Shared Secret 是否一致，以及保护绕过密钥是否仍有效。
- 页面仍显示旧环境：停止旧的 `dev:weapp` 监听并重新启动，再确认 `dist/common.js` 中只包含开发环境 ID。
- `base.wxml Template 'tmpl_0_i' not found`：NutUI 图标必须在 `src/app.ts` 中配置为原生 `view` 节点；同时保持项目私有配置中的 `compileHotReLoad` 为 `false`，再重新编译。
- 新版页面提示“内容暂时无法打开”且日志状态为 HTTP `404`：开发 CloudRun 仍是旧版本，登录 CloudBase CLI 后运行 `npm run deploy:mini-cloudrun:dev`；不要把本地测试版临时切到生产服务。

## 申请与账号

未登录访客只展示“全部”分类前 20 个岗位；登录并绑定账号后，免费用户最多查看 100 个不同岗位。只有首次进入岗位详情才消耗额度，列表加载、搜索和刷新均不扣减，同一岗位不会重复计数；Club 权益有效期间不受该限制，网站端不受影响。首次申请时，用户可绑定已有网站账号或创建一个新账号；之后复用原有 Club 权益状态、免费查看额度与申请记录。官网链接和招聘邮箱只在服务端完成权益校验后返回；小程序不会嵌入外部招聘网站 WebView，也不会展示上游不存在的申请方式。

岗位列表每页加载 20 条并在触底时继续分页；未登录访客不继续分页，登录用户可继续加载。默认排序沿用网站的业务排序，用户可切换为按发布时间倒序。分类规则与网站首页人工精选模块一致：`🔥 热门` 只展示带热门标记的岗位，其余六个分类作用于完整岗位池，不要求岗位同时属于精选。

收藏、官网申请和邮箱申请均写入网站账号使用的同一数据表；个人中心的“收藏岗位”和“申请入口记录”会进入小程序求职记录页。由于微信小程序不能任意打开外部招聘域名，官网申请会复制已校验链接并给出明确引导，同时记录到网站和小程序共享的申请历史。

## 视频接入决策

首版不接入视频，也不嵌入腾讯视频 iframe。后续如需增加课程，应采用微信原生 `video` 配合腾讯云点播或官方播放器插件，并先完成版权、主体和视频类目资质准备。
