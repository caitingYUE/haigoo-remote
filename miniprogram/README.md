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
2. 在 Vercel 配置与云托管相同的 `MINI_GATEWAY_SHARED_SECRET` 以及 `WECHAT_MINI_APP_ID`，然后依次执行迁移 `054_mini_wechat_identities.sql` 与 `055_mini_job_views.sql`。
3. 在本目录 `.env.production` 填入关联的 `TARO_APP_CLOUD_ENV`；服务名默认使用 `haigoo-mini`。
4. 首次打开小程序时服务会自动完成全量预热；之后每五分钟最多向主站拉取一次增量。首版无需额外暴露公网定时接口。

`project.config.json` 保持 `urlCheck: true`。正式版不需要，也不能依赖“关闭合法域名校验”。

## 构建

- 日常开发监听：`npm run dev:weapp`（显式使用 `NODE_ENV=development`）。
- 上传体验版、提审或发布前：`npm run build:weapp:prod`（显式使用 `NODE_ENV=production`，会启用生产压缩）。

## 申请与账号

首次浏览岗位时，小程序会静默完成微信登录；免费用户最多解锁 100 个不同岗位（列表、搜索与直接打开详情均计入，同一岗位不会重复计数），会员不受此限制，网站端不受影响。首次申请时，用户可绑定已有网站账号或创建一个新账号；之后复用原有会员状态、免费申请额度与投递相关记录。官网链接、招聘邮箱和内推说明只在服务端完成权益校验后返回；小程序不会嵌入外部招聘网站 WebView。

岗位列表每页加载 20 条并在触底时继续分页；免费用户最多加载其 100 个不同岗位额度，会员可继续加载云端缓存中的全部岗位。默认排序沿用网站的业务排序，用户可切换为按发布时间倒序。分类规则与网站首页人工精选模块一致：`🔥 热门` 只展示带热门标记的岗位，其余六个分类作用于完整岗位池，不要求岗位同时属于精选。

收藏、官网申请、邮箱申请和内推申请均写入网站账号使用的同一数据表；个人中心的“收藏岗位”和“我的投递”会进入小程序求职记录页。由于微信小程序不能任意打开外部招聘域名，官网申请会复制已校验链接并给出明确引导，同时记录到网站和小程序共享的申请历史。

## 视频接入决策

首版不接入视频，也不嵌入腾讯视频 iframe。后续如需增加课程，应采用微信原生 `video` 配合腾讯云点播或官方播放器插件，并先完成版权、主体和视频类目资质准备。
