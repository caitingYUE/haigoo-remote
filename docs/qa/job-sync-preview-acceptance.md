# 可信企业手动爬虫：mini-preview 验收

当前设计以 `docs/superpowers/specs/2026-09-26-trusted-company-manual-crawl-design.md` 为准。旧岗位同步面板和写接口已停用；不再启用来源、运行旧 worker 或自动发布。实现验收见 `manual-crawl-acceptance-2026-09-27.md`，真实失败修复与来源验证见 `manual-crawl-recovery-2026-09-28.md`，实际发布记录见 `job-sync-preview-release.json`。

## 发布

使用 `scripts/deploy-job-sync-preview.mjs`，仅部署网站和预发迁移 091/092/093，不部署 CloudRun、微信包或生产环境。

配置保存在仓库外，权限 0600。`--env-file` 是预发配置，`--production-env-file` 可使用已有生产配置生成的不含凭据的数据库/缓存端点参考；无需下载生产密钥。生产参考只用于端点隔离比较，不建立生产连接。默认只读检查，加 `--apply` 执行测试、迁移、部署与别名切换。

```sh
npm run deploy:job-sync-preview -- --env-file=/private/tmp/preview.env --production-env-file=/private/tmp/production-endpoints.env
npm run deploy:job-sync-preview -- --env-file=/private/tmp/preview.env --production-env-file=/private/tmp/production-endpoints.env --apply
```

加 `--live-crawl-check` 会在独立预发部署读取固定真实企业来源并验证岗位有效性；它不创建会话、不授予资格、不改岗位，失败阻止切换预发别名。

发布快照排除环境文件，禁用全部预发定时任务、自动翻译和微信提醒。缺少可导出 JWT 时使用部署专用随机密钥，预发用户需要重新登录。预发保留既有 Vercel 访问保护。迁移、独立部署验证及别名切换后分别比对全部企业/岗位原有内容指纹；验证失败不切换，切换后验证失败回退。

## 人工验收

1. 登录 `https://mini-preview.haigooremote.com/admin/trusted-companies`，确认右上角仅保留两个爬虫入口「爬虫预检」「更新检查」及原企业新增入口。
2. 在当前页点击预检，逐家查看企业、招聘 URL、实际请求原文和结构化样本。无完整样本不得通过；通过只授予资格，岗位数量不变。
3. 失败时检查「重试本家」「跳过并检查下一家」，不要使用通用继续绕过失败。点击不通过后检查「继续重试」「确认不通过」；初次请求之外最多重试 5 次。确认不通过后企业有不可爬虫标记及重新预检入口。
4. 点击更新检查，只包含本页已通过企业。新增和内容变更支持编辑、保存待审核、发布、取消。已有岗位保存修改待审核后线上保持旧版本。
5. 验证待审核数字只包含已经保存的内容；点开企业处理记录继续审核，查看企业岗位可访问真实待发布岗位。
6. 403、超时、空列表或通用申请页不得自动下线。明确失效证据才提供人工转待审核或删除；删除可从处理记录恢复为待审核。
7. 关闭未保存编辑时显示确认；继续处理保留输入。停止后不再抓取，重新打开不自动恢复旧任务。

真实企业的通过、发布和失效决定须管理员核实，不应以隔离样本或接口冒烟代替。此次部署不会替管理员确认企业资格或批量修改既有岗位。
