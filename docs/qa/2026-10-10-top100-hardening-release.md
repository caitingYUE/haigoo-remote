# Top100 加固发布 · 2026-10-10

已上线：https://haigooremote.com/trusted-companies/top-100

运行源码：8008ff39c34172a6018f4bf5e402307c9bc5b0b6，任务分支codex/member-company-top100已推送。部署dpl_Cyw4dQ1oji2A623GNKHwrj3PsZij，候选https://haigoo-remote-nwm6msfc9-caitlinyct.vercel.app，正式域名inspect为READY并绑定本部署。

回退保留：dpl_2zLMCAEz2Hgt9zt6FZbb5zauM9gs / https://haigoo-remote-ol9oe08o9-caitlinyct.vercel.app。上线前两次确认正式基线没有其他发布；回退前也应确认没有后续发布。没有数据库迁移，无数据库回滚。

## 结果

完成原方案范围内逻辑和交互加固：权威只读会员核验、401/403/错误恢复、账号与过期内容清理、跨标签同步、分页竞态隔离、企业研究展开、安全返回、会员升级回榜核验、企业/版本反馈上下文、稳定草稿及提交超时恢复。保留原排名、六维权重、正式会员口径及导航位置；没有加入新依赖。

实际候选720个源文件与最终dry清单哈希完全一致，缺失/额外/不匹配均0。相对真实旧生产716个源文件，新增4个运行源文件、修改既有13个、删除0。研究原始导出、会员资料/日志、环境文件、测试身份、截图、docs、dist未上传。主工作区其他未完成变更没有进入发布。

## 验证

本地生产构建和三组相关测试通过；受控真实浏览器覆盖账号、权限、异常、分页、回链、草稿及24秒反馈延迟（20秒超时恢复）。桌面/手机中英文验证与一次scoped detector []。 fresh独立finish reviewer最终disposition ship，两项material fixes均resolved；局部surface文档同步，根DESIGN未覆盖。

Vercel Node24候选构建成功。候选匿名访问302跳转既有SSO保护；没有读取/创建绕过凭据或降低保护。候选阶段应用HTTP不可验，按用户既有明确上线授权promote后即刻正式域名只读验收。

9项正式HTTP检查全部通过：guest/无效token401且private,no-store，无效POST405；后台未登录401、小程序无签名401；中英文页面200且noindex, follow；raw研究路径仅返回SPA HTML；公开岗位200且取得1条。正式浏览器确认导航进入完整访客权益页，私有企业行0条。生产会员登录态端到端未执行，完整链路以隔离测试账号验收；没有真实支付、外部申请或生产反馈提交。

真实数据库仅以不存在ID只读验证新权限SELECT兼容schema，未读取实际用户资料或修改会员。

Vercel依赖安装仍报告原锁文件中的34项audit警告；本轮未新增/升级依赖，未声称全仓库依赖安全审计完成。此为既有依赖维护事项，不能从安装摘要推断其生产可利用性。

研究数据仍为2026-10-10.v1：49家有大陆线索、51家资格待确认、77家合同类型未知；员工评分/规模/多数成立时间沿用后台，未全面实时复核。代码没有把未知包装成确定签约或可从大陆申请。

资料：hardening-audit.md、hardening-finish-review.md、hardening-production-checks.json、hardening-file-verification.json。
