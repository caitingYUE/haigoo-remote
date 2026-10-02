# 岗位字段映射修复（2026-09-28）

## 用户截图对应原因

左栏展示的是 RWS 整个列表响应的可读文本，右栏对应选中的单条岗位，因此会出现左侧德语音频转写岗位的 18 USD/Hour，右侧却是 Riyadh 的沙特阿拉伯语岗位。检查既有真实响应，后者的正文实际为 15 USD/Hour。

此外，原适配器读取地点、雇佣类型等结构化字段，没有从同一岗位正文的明确标签补齐缺失薪资。远程工作方式与地理地点并非同一个字段，不能用 Work from home 覆盖 Riyadh。

## 改动

- 左侧优先显示当前选中岗位的标题、申请链接和描述；整批响应保留在折叠技术详情中。切换岗位不回退显示别家企业证据。
- 在岗位适配器中统一补齐正文里明确标注的 Location、Salary / Rate、Job Type、Work Schedule、Timezone 及对应中文标签。只读取当前岗位，不使用批量响应提取字段。
- 保留来源结构化字段的优先级；多个矛盾标签不随意取一项；空值、TBD、未标明的数字或泛泛提及远程工作不推断为事实。
- 来源没给工作类型时可使用明确标签或全职/兼职工作安排；已有 Temporary/Contract 保留，字段下方另外显示 Freelance 及 Part-time 原文依据。
- 明确的 Work from home 等标签可补齐远程工作布尔值，不把工作方式转换成全球招聘资格。
- 补齐 Lever 薪资区间与 JSON-LD QuantitativeValue 薪资范围读取。保留币种、范围和周期，不自动换汇或年化。
- 只影响新提取结果，旧会话、人工编辑内容和已有岗位不重新写入。旧任务需人工重试或重新预检。

## 验证

- RWS 真实响应回放：选中 Asir 岗位映射得到 `salary=15 USD/Hour`、`location=Riyadh`、`job_type=Temporary/Contract`、`is_remote=true`；保留 Freelance 和兼职安排依据。
- 双岗位隔离测试：同一列表中阿拉伯语岗位 15 USD/Hour、德语岗位 18 USD/Hour 分别映射，未交叉覆盖。
- 覆盖中文标签、结构化字段优先、矛盾地点、未知薪资、无关数字、否定远程语句、零起点薪资范围。
- 手动工作流全套回归、适配器回归、TypeScript 和生产构建通过。发布脚本增加预发真实 RWS 薪资及同岗位原文一致性断言，失败不切换预发别名。
- 浏览器真实组件、真实响应回放验证右侧地点/薪资/类型及依据，与左侧同岗位正文一致。截图 `.impeccable/review/manual-crawl-field-mapping.png` 使用隔离企业，不代表已人工批准真实企业。

实际发布版本、真实接口检查与发布前后数据指纹以 [发布报告](job-sync-preview-release.json) 为准。

## 最终预发发布

- 完成时间：2026-09-28T11:01:49.617Z（UTC）。
- 预发地址：https://mini-preview.haigooremote.com/admin/trusted-companies
- 独立部署：https://haigoo-remote-cedi4ip58-caitlinyct.vercel.app
- 代码快照：9cfa6903535eed5fd1450cc9f3ff6e9bbee519317620f8c00e4a6275ae73588e
- 真实预发 RWS 再次返回 15 USD/Hour、Riyadh、Temporary/Contract、支持远程，且包含 Freelance 和兼职安排原文依据。
- 固定薪资金额和范围分别处理；固定 18 USD/HOUR 不会格式化为 18+。
- 部署前后均为 410 家企业、1981 条岗位，内容指纹相同。
- 旧会话保留旧快照，请人工重试或重新预检使用新规则；没有自动授予资格、保存、发布或下线岗位。
