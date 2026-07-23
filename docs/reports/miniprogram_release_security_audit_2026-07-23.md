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

## 上线安全闸门

- [x] Vercel Production 与 Preview 均存在不同的强随机 `JWT_SECRET`。
- [ ] 开发和生产 Gateway/Session/Sync Secret 完全不同。
- [x] 数据库迁移 056 已应用；429、协议留痕和幂等写入仍需真机接口回归。
- [ ] 微信后台隐私保护指引与小程序内政策一致。
- [ ] CloudRun 公网访问关闭，最小实例、监控、余额告警和回滚镜像已确认。
