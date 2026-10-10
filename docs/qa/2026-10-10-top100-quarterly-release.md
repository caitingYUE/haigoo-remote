# Top100季度标识与小程序权益入口发布

已上线：https://haigooremote.com/trusted-companies/top-100

生产部署：dpl_ABEnLax6PdTydmpy9Gtz1Hmjd9LZ / https://haigoo-remote-ds8k89mxl-caitlinyct.vercel.app，inspect确认READY、正式域名绑定本部署。
运行源码：2c57278588e9c96d83e6a194b6a48da5a2a2fa72，codex/member-company-top100已推送。
回退保留：dpl_Cyw4dQ1oji2A623GNKHwrj3PsZij / https://haigoo-remote-nwm6msfc9-caitlinyct.vercel.app。上线前重复核对基线未改变；回退时也应先排除后续发布。

## 用户四项要求

移除49/51汇总与内部分类计数/筛选，保留具体企业申请条件。右上角以完成日期2026-10-10显示2026 Q4统计数据、季度更新。非会员标题采用指定原文。guest/free/trial/expired权益按钮统一native二维码dialog，复用现有小程序图片，简明仅小程序开通说明；没有网页支付动作。

本轮没有更新100家研究分数和排名，snapshot仅重命名为稳定current路径，内容哈希与原生产100%相同。公共edition只有严格四个string字段，server/prebuild/staging writer均验证；quarterly脚本dry-run默认，拒绝仅改日期、旧/未来/重复/错版号、未在新季度复核的企业或额外公共字段。--write只更新本地source，经过研究审查、构建、验收再发布。

季度heartbeat top-100 ACTIVE，按北京时间每季度首月10日9点启动，下一次计划2027-01-10；有完整企业复核、官方证据、原权重、未知项、审查与可回退发布要求，未完成时保留旧季度。不会自动滚动标签。现有周报未改动。

## 验证

三个Top100测试、prebuild、Node24候选生产构建通过。一次scoped detector []。fresh独立复审最终disposition ship，四字段公共元数据finding resolved，回归clear；局部surface同步。

隔离真实浏览器：member100/free0/guest0、旧tier URL100、关键词1/clear100；1440桌面、390手机及英文QR无横向溢出；Escape/close/backdrop、返回焦点、body滚动恢复；图片加载503后重试naturalWidth430。没有真实扫码绑定或支付，没有生产会员登录态端到端。

实际上传724源文件与最终dry清单SHA完全相同，extra/missing/mismatch均0。相对现网720：受保护snapshot改名，新增公共metadata、季度更新与构建验证脚本、二维码组件，修改server/page/styles/package build hook；依赖及锁文件未改。没有上传环境、用户日志、原始研究、测试身份、docs、截图或dist。主工作区其他改动未进入部署。

候选匿名访问302跳转既有SSO，未读取/创建绕过凭据或降低保护；候选应用HTTP不宣称通过，依据源码/构建/本地验收按既有授权promote后立即完成正式检查。

正式域名10项只读HTTP全部通过：榜单guest/badtoken401+private,no-store、POST405；后台无认证401、小程序无签名401；中英页面200/noindex follow；raw current JSON路径仅SPA HTML；二维码image/webp200；公开岗位200/1条。正式浏览器确认Q4标签、指定标题、QR打开并加载430px真实资源、简短说明。源码与候选版本一致，域名实际绑定已确认。

没有数据库迁移/写入，无会员或支付配置更改；依赖安装仍有原锁文件34项audit警告，本轮没有做全仓库依赖安全审计。
