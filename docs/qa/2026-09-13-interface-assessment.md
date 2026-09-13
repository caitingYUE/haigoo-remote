# 1.0.38 上线接口评估与故障修复

日期：2026-09-13（Asia/Shanghai）。截至本次检查，生产修复已上线，企业目录同步恢复；微信审核尚未提交。

## 截图中的目录同步失败

截图属于 `haigoo-dev` / `haigoo-mini`，不是生产服务。通过 CloudBase CLI 的既有登录凭证读取状态，发现开发服务开启每小时同步，但 Preview Vercel 函数拒绝导入；实际日志为 `action: company_catalog_import`、`message: catalog import is disabled`。

处理：核验 Preview 与生产数据库连接及主机均不同；仅给 Preview 设置 `MINI_ALLOW_CATALOG_IMPORT=true`，重新部署并将 `mini-preview.haigooremote.com` 指向 `dpl_982h3mWZAvgbofWUYxeYYbFii5fS`。执行已有同步入口导入正式环境公开目录，返回 HTTP 200、`imported: true`，154 家企业、418 个岗位，耗时 5.390s。随后只读核验 `lastSuccessAt` 已更新、`consecutiveFailures=0`、`lastFailure=''`。

同步使用既有字段白名单与事务，不复制用户、订单、支付、会话或内推联系人字段。生产服务直接读取权威目录，不开启 Preview 镜像导入；生产未配置专用快照读取凭证而被拒绝，属于预期权限边界，不是业务读取故障。依据：[同步结果](2026-09-13-interface-assessment/catalog-sync.json)、[修复后的状态](2026-09-13-interface-assessment/catalog.json)。下一次定时周期尚未观察，本次成功调用经过同一同步函数。

## 同时发现并修复的生产打包故障

此前本机 macOS 预构建的 Vercel 版本 `dpl_6B1KEjwv3NT6QbRCBvvyut7dMyyF` 在 Linux ARM64 运行时缺失 sharp 原生依赖，导致 API 模块加载失败。直接 Vercel 与经 CloudRun 两条链路均复现 500，CloudRun `/health` 却仍为 200；因此健康检查和本地构建成功不能代替业务接口检查。

先回退正式域名到 `dpl_DaSFjE3tjuJKNSPjwwSLf8RMtWwx`，确认 Match 接口恢复 200；随后改为 Vercel Linux x64 云端构建，使用 `npm ci --include=optional`，并在函数包明确包含 Linux x64 sharp 与 libvips 文件。恢复完整 TypeScript 构建门禁，修正管理图表的 Tooltip 回调类型。候选使用 `--prod --skip-domain`，通过业务与图片检查后才 promote。

原 `vercel-production-prebuilt.tar.gz` 保留用于问题追溯，已在发布清单标注 **不可部署**。本次未修改生产数据库结构或用户记录。

## 已上线版本

- 生产 Vercel：`dpl_2Dv7tzHyBdndHdvTjTqAyFkDPCt3`，`https://haigoo-remote-gep8hh0pb-caitlinyct.vercel.app`；已核对正式域名 `https://haigooremote.com` 指向该 READY 部署。
- 生产 CloudRun：`cloud1-d8ggt7rbl273f83c7` / `haigoo-mini-prod`；运行源码 `6e26516a030b8b7ec63f2b38fe015abc73683a100adaa86f97bd3eaba623824b`。
- 修复源码提交：`f0552d20581245c2bf276b31122ada934bd16daf`。原已验收小程序包仍为 1.0.38，未重传或改变包摘要。

## 实际验证

最终候选 Match、企业、会员方案、首页 4 项业务合同均通过。企业图片接口返回 200 / image/webp，468 字节，可解码为 32×32 WebP。该图片检查验证函数加载及资产读取，不代表重新处理所有图片。

正式域名切换后，通过 CloudBase SDK → CloudRun → Vercel 连续 5 轮，共 20 次游客只读请求；成功 20 次，无失败。检测时段 `2026-09-13T08:01:17.283Z` 至 `2026-09-13T08:02:53.657Z`（UTC）。

| 接口 | 成功/请求 | 中位耗时 | 最大耗时 |
| --- | --- | --- | --- |
| career_watch_options | 5/5 | 2.101s | 3.449s |
| companies | 5/5 | 1.899s | 4.721s |
| membership_plans | 5/5 | 1.847s | 4.922s |
| content_home | 5/5 | 2.377s | 3.677s |

耗时包含本机到腾讯云的网络与 SDK 转发，不含 CLI 授权和元数据获取。各接口仅 5 个样本，不作为 SLA、压力测试或长期可用性保证。首次/高分位延迟仍有约 4–5 秒，应继续保留前端已有内容和弱刷新；此次没有删减或绕过数据校验来降低时延。原始证据见 [20 次请求](2026-09-13-interface-assessment/production-readonly.json)。

额外 6 项只读边界均通过：`/health` 和 `/health/upstream` 200；无会话访问 Match/收藏、无效会话访问 Match 返回 401；不存在路径返回 404；所有请求追踪 ID 正确返回。CloudRun 到上游的单次健康探测耗时 329ms。证据：[边界检查](2026-09-13-interface-assessment/boundaries.json)。

本地完整网站构建、管理员发布合同、网关签名合同、小程序发布合同通过。用户注册/绑定/解绑/删除等链路沿用此前隔离数据库和客户端竞态测试证据：[账号验收](2026-09-13-account-directory.md)。本次未对生产真实账户进行注册、解绑、注销、付款或退款验证；已验收的真机操作与隔离测试不冒充生产写入测试。

## 复测与结论

```sh
node scripts/test-mini-production-readonly.mjs --rounds=5 --output=tmp/mini-production-readonly.json
```

该命令只调用固定的四个游客读取接口，最多 20 次，失败保留并返回非零退出状态。检查数据结构、会员方案价格、支付可用标识；输出请求耗时与成功率，不触发真实购买。

本轮页面数据接口检查通过，微信审核和正式发布状态均未变更。后续真实流量及下一次定时同步结果仍需观察。**同日后续的[微信提醒专项检查](2026-09-13-wechat-reminders.md)发现事件触发与漏发缺陷，提醒模块尚未通过；本报告不能作为该功能或整个版本已可发布的依据。**

打包依据：[sharp 平台依赖说明](https://sharp.pixelplumbing.com/install/)、[Vercel 函数文件包含配置](https://vercel.com/docs/project-configuration/vercel-json)。
