# 小程序正式版依赖与安全审计（2026-07-23）

## 已完成处置

- Taro 全套从 4.2.0 升级到 4.2.1，并完成真实微信生产构建。
- 仅保留微信平台插件，移除未使用的 H5、支付宝、抖音、QQ、百度、京东及鸿蒙插件。
- 微信上传配置启用压缩、关闭 source map；当前产物约 692 KiB。
- Vercel 生产环境改为缺少 `JWT_SECRET` 时启动失败，不再允许生产使用默认密钥。
- 账号绑定、注册和密码重置增加数据库原子限流。
- 申请入口使用幂等键，避免重复点击多次消耗申请额度。
- CloudRun 公网访问策略保持关闭；小程序只使用 `callContainer`。
- 网站生产依赖已移除未使用的 `jspdf`、`xmldom`、`nodemailer`，升级 `sharp` 至 0.35.3，并将生产依赖审计降至 0 Critical、1 High。

## npm 审计例外

### 小程序构建依赖

`npm audit --omit=dev` 仍报告 Taro 传递依赖中的 esbuild、swiper、uuid 和 webpack 公告（10 Moderate、3 Critical）。处理结论：

- Taro 4.2.1 的 `taro-loader` 明确要求 webpack 5.91.0，强制覆盖为 5.108.4 会产生不受支持的 peer 依赖，因此不使用 `--force`。
- esbuild、webpack-dev-server、webpack 属于本地构建/开发链，不在微信运行时提供网络服务。
- 生产构建无 source map，产物中没有 webpack-dev-server、lodash template 或 AutoPublicPathRuntimeModule 实现。
- 产物中的 `swiper` 仅为微信原生组件注册名称；项目未使用 npm swiper 组件或将其库代码打入业务包。
- 上述依赖由 Taro 上游锁定。后续 Taro 发布兼容补丁后应重新审计并升级。

### CloudRun 依赖

CloudRun 仍报告腾讯 `@cloudbase/node-sdk@3.18.3` 固定依赖的旧 Axios 与 lodash.set/unset 公告；3.18.3 是审计时 npm registry 的最新正式版本。处理结论：

- 不使用 `npm audit fix --force` 建议的 SDK 降级方案。
- CloudRun 不使用 Axios 请求用户提供的 URL；业务上游使用 Node 原生 `fetch` 和固定 `HAIGOO_API_ORIGIN`。
- CloudBase SDK 只连接腾讯云受控端点并写入固定集合名；客户端不能控制 SDK 请求地址或数据库字段路径。
- CloudRun 公网访问关闭、请求经微信云托管身份链路，降低可利用面。
- 腾讯 SDK 发布修复版本后优先升级并重新构建镜像。

### 网站生产依赖

`npm audit --omit=dev --json` 最终为 0 Critical、1 High。唯一剩余项是 `xlsx@0.18.5`，npm registry 无修复版本。处理结论：

- 该库只在受管理员鉴权保护的可信企业导入/导出接口使用，不进入小程序或普通用户页面运行路径。
- 不从岗位列表、搜索、收藏、申请、订阅或账号接口接收工作簿数据。
- 上线前继续限制后台账号、导入文件来源和文件大小；后续单独迁移到仍维护的工作簿解析方案。
- `sharp` 已升级到 0.35.3；未使用的 `jspdf`、`xmldom`、`nodemailer` 已移除。

## 2026-07-23 部署验证

- Vercel Production 已部署成功，`haigooremote.com/api/mini` 无签名访问返回 401。
- `haigoo-dev/haigoo-mini` 已部署最新 CloudRun 代码，状态 normal，访问类型为 `OA + MINIAPP`，公网访问关闭。
- `cloud1` 创建 `haigoo-mini-prod` 时返回“云托管资源未开通”；需先在控制台开通该环境的云托管资源并确认套餐费用，再重新执行受控部署脚本。
- 生产 Gateway 密钥已写入 Vercel Production，但生产 CloudRun 尚未创建，当前没有生产小程序流量使用该密钥。

## 2026-07-28 生产部署更新

- `cloud1/haigoo-mini-prod` 已创建并滚动部署最终 `main` 代码，状态 `normal`，最小实例 1、最大实例 2，公网访问关闭。
- `mini_jobs`、`mini_job_list`、`mini_sync_state` 已创建；首次全量同步与正式 Gateway 均返回 412 个岗位。
- Vercel Production 只保留 `MINI_GATEWAY_PRODUCTION_SECRET`，Preview 只保留 `MINI_GATEWAY_SHARED_SECRET`；开发和生产的 Gateway、Session、Sync Secret 均已确认互不相同。
- 正式数据库 054–057 迁移均已执行并写入 `schema_migrations`。
- Vercel Preview 保持 SSO Deployment Protection；Automation Bypass 已仅配置到开发 CloudRun。Preview Gateway 请求返回 200，开发密钥访问生产、生产密钥访问 Preview 均返回 401。
- Preview 使用与正式库不同的测试数据库，迁移 054–057 已执行并核验；测试库当前 Gateway 岗位总数为 1515。
- 最终小程序生产构建通过，磁盘产物约 692 KiB、无 source map，微信开发者工具实际预览包为 505926 字节，环境固定为 `cloud1/haigoo-mini-prod`。

## 上线安全闸门

- [x] Vercel Production 与 Preview 均存在不同的强随机 `JWT_SECRET`。
- [x] 开发和生产 Gateway/Session/Sync Secret 完全不同。
- [x] 数据库迁移 054–057 已应用并记录；057 的并发额度实测为两组并发请求最多合计写入 100 个唯一岗位。429、协议留痕和幂等写入仍需真机接口回归。
- [x] 开发 CloudRun 已使用受保护的独立 Preview Gateway/测试数据库，且双向交叉密钥验证均被拒绝。
- [ ] 微信后台隐私保护指引与小程序内政策一致。
- [ ] CloudRun 公网访问、最小实例和回滚版本已确认；监控、余额告警和自动续费仍需在控制台确认。

## 2026-07-29 提审候选版本

- 提审候选代码为 `1e909d56`，已推送 `main`；本次只纳入小程序体验调整和发布文档，不包含工作区内其他审计产物或图片。
- 根项目类型检查、Mini Gateway 签名测试、小程序上线契约检查、小程序类型检查和微信生产构建全部通过。
- 正式微信项目已重新生成到 `miniprogram/.wechat-production/`，约 808 KiB，不包含 source map；产物只包含生产环境 `cloud1-d8ggt7rbl273f83c7 / haigoo-mini-prod`。
- Vercel Production 已由 `main` 自动部署并处于 `Ready`；正式 `/api/mini` 对未签名请求继续返回 `401`。
- `cloud1/haigoo-mini-prod` 已滚动部署候选代码，服务状态 `normal`，访问类型为 `OA + MINIAPP`、公网关闭、最小实例 1、最大实例 2。正式签名 Gateway 返回 `200` 和 412 个真实岗位，未签名请求返回 `401`。
- 生产缓存核验通过：`mini_job_list` 与 `mini_jobs` 各 412 条、热门岗位 35 条、默认排序 412 条、CloudBase Logo 402 条；`mini_sync_state` 为 Ready、无全量同步残留，上游固定为 `https://haigooremote.com`。
- 微信开发者工具已将 `1.0.0` 上传为开发版本，版本说明为“首发提审候选：远程岗位、收藏申请、岗位订阅与 Club 权益”；微信实际接收包为 558,374 Byte（约 545.3 KiB）。

本次重新执行 `npm audit --omit=dev`：

- 网站运行依赖：0 Critical、7 High、2 Moderate。新增结果主要来自 `brace-expansion`/`react-router` 传递依赖和既有管理员导入使用的 `xlsx`；正式提审前应继续按受控入口和输入限制管理，并在兼容版本可用后升级。
- 小程序依赖：3 Critical、8 High、8 Moderate，仍全部位于 Taro/webpack 本地构建链或未打入微信运行包的依赖路径。`npm audit fix --force` 会把 Taro 降到不兼容的大版本，不能用于提审分支；维持既有构建链例外并等待 Taro 兼容更新。
- CloudRun 运行依赖：0 Critical、4 High、1 Moderate，来自腾讯 `@cloudbase/node-sdk` 固定的 Axios 与 lodash 依赖。当前 SDK 已是项目锁定兼容版本，CloudRun 公网访问关闭，客户端不能控制 SDK 目标 URL 或集合名；腾讯 SDK 发布兼容修复后应优先升级。
