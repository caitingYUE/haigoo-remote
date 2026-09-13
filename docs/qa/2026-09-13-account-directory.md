# 企业列表自动同步与账号链路验收

日期：2026-09-13。前端版本：1.0.38。

更新：用户已在本任务明确确认真实验收通过。该结论来自用户验收反馈；下方保留自动化、隔离数据库及模拟器验证的原始范围。

## 用户要求与实现

- 企业/岗位信息由企业页自动检查并同步。页面可见时每 2 分钟检查一次；返回页面或切换筛选时，缓存超过 2 分钟才请求。短时间返回复用缓存，保留手动下拉刷新。
- 更新不清空已有列表，保留已加载分页；分页加载中不启动自动检查。更新中显示 36rpx 窄条，完成或失败立即移除，平时不占位；不再显示常驻“检查更新”。
- 返回内容不变时保留原对象，忽略只变化的 serverTime；自动检查失败保留内容且不弹 toast。离开页面停止定时检查。
- 这是定期拉取而非服务端推送，数据可见时间还受现有后台目录缓存/同步周期影响。

## 账号问题与修复

| 问题 | 修复位置与行为 |
| --- | --- |
| 绑定/注册晚返回可能恢复已退出账号 | mini-auth-service：账号操作互斥、登录生命周期和账号范围校验，校验与写入在同一回调内完成 |
| 云运行时初始化期间切换账号，旧操作可能使用新 token | api-client：请求开始时记录 token，发送前再次检查，变化则不发送 |
| 密码输错导致退出登录 | 前端区分 INVALID_CREDENTIALS 与会话过期，并兼容旧后端中文错误；后端返回明确错误码 |
| 反复点击弹出多个注销确认/重复提交 | 账号表单、账号设置使用同步 ref 锁；两次注销确认都支持取消 |
| 退出后仍可返回旧账号页面 | 退出/解绑/注销成功后 reLaunch；清理当前账号本机 Match 快照及待处理意图，服务器记录由具体操作决定 |
| 并发绑定预检查之后覆盖既有连接 | 网关 INSERT ON CONFLICT 增加账号条件并检查 RETURNING；注册绑定同样保护 |
| 注销/解绑使用旧 token 对应的微信新连接账号 | CloudRun 转发签名会话 userId，网关校验 expectedUserId；兼容旧 CloudRun 不带字段的滚动部署 |
| 停用账号仍可通过已有微信连接操作 | session 和 requireBoundUser 拒绝非 active 账号 |
| 未验证邮箱过期后重复注册会删除原账号及资料 | 网站注册保留所有已存在账号，返回登录/重置密码/重发验证邮件提示 |
| 网站特定测试邮箱登录自动升管理员 | 删除 test@example.com 登录时强制授权分支 |
| 绑定成功也要求再次验证邮箱，邮件失败仍提示已发送 | 绑定/注册成功页区分操作，展示注册服务返回的邮件送达说明 |

注销沿用现有用户删除 SQL：单条 PostgreSQL CTE + 外键级联；30 天邮箱限制由原有注销处理器建立，失败后撤销限制。本轮未改数据库 schema，也未操作任何生产用户或发送真实邮件。

## 已执行的验证

### 模拟器原生渲染

实际微信开发者工具运行生产编译产物的隔离副本；账号页未执行真实登录。企业数据与会话通过内存替身注入，非生产数据、非真机结果。生产上传包未注入替身。

- [企业页正常状态](2026-09-13-account-directory/companies-idle-native-fixture.png)
- [企业页更新状态](2026-09-13-account-directory/companies-updating-native-fixture.png)
- [企业页更新完成](2026-09-13-account-directory/companies-finished-native-fixture.png)
- [账号绑定页](2026-09-13-account-directory/account-bind-native.png)

模拟器测得更新条宽 390px、高 18px；请求期间列表节点持续存在，完成后更新条节点不存在。

### 运行与数据库测试

`node test-mini-account-client-races.js`：真实 TS 服务与页面回调、隔离存储和 API 替身；测试晚返回、重复提交、退出缓存清理、密码错误/会话过期区分、初始化期间账号切换、注销两次取消、确认期间换账号、断网保留、解绑退出导航。

`node test-mini-account-lifecycle.js --pglite=/private/tmp/haigoo-account-qa/node_modules/@electric-sql/pglite/dist/index.js`：执行生产函数体与实际 PostgreSQL SQL，PGlite 内存数据库使用迁移 054/056，历史业务表用最小隔离 schema；密码哈希采用真实 bcrypt，邮件、DAL 适配和限流结果用替身。覆盖注册同意/密码校验、邮箱标准化、注册与绑定、重复注册保留会员资料、单微信/单账号绑定冲突、条件 UPSERT、错误密码、停用账号、限流拒绝、解绑/重绑、旧身份失效、验证链接过期/重发、密码重置/旧密码失效/令牌不可重用、邮件发送故障、数据库触发器强制注销失败及回滚、删除级联、其他账号隔离、30 天限制及到期后新注册。

相关回归 19 项通过：navigation-stability、membership-refresh、auth-consent、account-client-races、retained-loading、review-races、1027-feedback、career-watch、match-immersive-v2、release-readiness、membership-consistency、company-contacts-and-follows、runtime-compat、match-follow-loop、favorites-feedback、company-cache、company-detail-polish、gateway-signature、content-contract。

TypeScript、3 个后端修改文件的语法检查、git diff --check、1.0.38 production 构建和资源门禁通过。构建仍有原有 CSS 抽取顺序提示。

## 发布边界与待验收

- 1.0.38 上传情况见 `docs/releases/1.0.38-device-acceptance.md`。
- 后端修改尚未部署：`api/auth.js`、`lib/api-handlers/mini-gateway.js`、`cloudrun/index.mjs`。前端上传不会发布这些修改；数据库测试通过不表示生产修复已生效。
- 本次覆盖小程序现有微信登录、邮箱账号注册/绑定，以及网站邮箱验证/重置密码处理器；不包含 Google OAuth 或独立修改账号邮箱（小程序未提供该入口）。
- 用户已确认真实验收通过，不再作为本轮准备阻塞项。后端上线后仍须核对实际部署版本及只读接口合同，不能以本地测试代替部署成功确认。
- 注销 SQL 测试不替代对生产全部历史表迁移状态和云文件清理策略的核验；未使用真实账户执行注销。
