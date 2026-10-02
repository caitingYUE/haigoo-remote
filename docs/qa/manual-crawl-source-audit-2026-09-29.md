# 不可爬虫企业复核（2026-09-29）

## 范围与结论

从预发只读查询到 14 家人工标记为 rejected 的活跃企业：包含截图中的首批企业，以及随后测试的 Cochrane、Deutsche Bank。4 家 LinkedIn 来源按需求排除；其余逐家核验。交互方案保持不变，抓取结果仍须人工预检通过、人工保存或发布。

本轮没有修改任何企业的人工资格、招聘 URL 或已发布岗位。以下“恢复”仅表示能够提取供人工核对的样本，不代表已通过预检，也不代表适合直接发布。

| 企业 | 原因 | 本轮结果 |
| --- | --- | --- |
| Hackmamba | Astro 页面使用 `.prose` 内容容器；标题在局部 header 中，旧规则漏掉正文和标题 | 4 个真实岗位均能读取正文（约 2,000–3,400 字符）；保留对应岗位身份 |
| AB Agri | 列表的 Apply 链接被误判为独立岗位，跳转注册页；More Info 覆盖真实标题 | 排除申请/注册入口，采用详情真实标题；第一批 5 个岗位正文完整 |
| 花旗 | 官方 JSON-LD 把 Early Career / Professional 招聘类别填入 hiringOrganization，触发归属冲突 | 仅对 jobs.citi.com 来源、citigroup.com 企业官网和这两个已观察标签修正校验；其他雇主仍阻断。第一批 5 个正文完整 |
| Cochrane | Deel 网页把完整岗位嵌在 React Flight 数据里，旧规则只检查可见 HTML | 解析公开数据记录，不执行脚本；校验企业 slug、岗位 ID、公开状态和招聘板块，读取 6 个正文完整的岗位 |
| Cummins 康明斯 | Jobsyn 动态页面外壳没有可见岗位 | 使用官网公开搜索 API，保留原“中国 + Off-site Remote”筛选；本地完整读取 6 个岗位、1 页，单岗位官方详情确认 open |
| Pearson 培生 | Jobsyn 动态页面外壳没有可见岗位 | 使用官网公开搜索 API，保留 Remote 筛选；本地完整读取 90 个岗位、6 页，无重复 ID，单岗位官方详情确认 open |
| Braintrust | 公开 API 可以读，但这是多企业招聘市场，例如返回雇主 Begin Learning 的岗位 | 不将多雇主岗位归到 Braintrust。预检明确提示需要企业自招入口；需另行设计平台来源与实际雇主归属映射才能导入该市场 |
| Scalerrs | 原来的 rollout B 配置直接标成 manual；官网当前明确声明没有开放职位 | 允许人工触发的旧 rollout 来源重新进行 HTML 检查，显示“当前没有开放岗位”，不虚构样本、不据此下线旧岗位 |
| The Authentic Asian | 动态页面；浏览器核验明确显示两个岗位均暂停接收申请 | 原因不是单纯“无法抓到”：当前没有可直接开放申请的样本。保留人工状态；本轮未部署通用浏览器渲染服务 |
| NewPath Conveyancing | 招聘 URL 为空 | 复核官网只有业务、介绍和联系入口，未找到可验证的公开招聘页；需要补充有效招聘 URL |
| Ola Chat / Randstad Enterprise / ARC Group / Deutsche Bank | LinkedIn 来源 | 按需求排除，保持原人工状态 |

数据数量随第三方招聘站更新；上表为本轮实际读取时的数量。

## 修复与边界

- 正文选择不再删除整页 ASP.NET form；只移除输入控件，支持明确的正文容器，不拼接不同容器构造岗位。
- 标题来自岗位详情，避免把“More Info”等按钮文案存成岗位标题。
- Jobsyn 校验站点固定企业 ID、返回的筛选 canonical、分页偏移和完整数量。分页字符串数字兼容，但范围不一致、跨企业、空页或重复身份仍报错。
- 官方单岗位详情可能以 gzip 返回。HTTP 客户端新增 gzip / Brotli / deflate 解压，压缩前后均受读取上限约束。
- Jobsyn 已有岗位检查只认可对应企业、对应 GUID 的正文；明确 deleted_at 才判定撤下，接口失败、404、身份不一致均保留为无法确定。
- Deel 列表存在同一岗位 ID 可证明仍在招；列表缺失不能单独证明失效。
- 修复 singular `/career/` 岗位身份识别；通用申请入口不参与单岗位失效判断。
- 仅旧 `manual + rolloutTier:B` 且检测为 HTML 的来源允许在人工工作流中重新尝试，原配置及资格版本比较保留；LinkedIn 和共享招聘平台限制不变。

## 开源方案评估

查阅官方项目资料后，本轮选择先修复现有 Cheerio + HTTP 的站点适配，未安装新的 skill，也未引入运行中的浏览器服务：当前可恢复的 6 家无需执行网页 JavaScript。

| 项目 | 适用能力 | 本项目取舍 |
| --- | --- | --- |
| [Crawlee](https://github.com/apify/crawlee) | Node.js/TypeScript；HTTP 和 Playwright 浏览器抓取、队列、限流及失败处理 | 若后续遇到只有浏览器能读到且仍开放招聘的来源，优先评估其 PlaywrightCrawler。需要独立浏览器运行环境，并接入已有人工触发、取消、重试和证据流程 |
| [Crawl4AI](https://github.com/unclecode/crawl4ai) | Python 浏览器抓取、动态内容和 Markdown 提取 | 能解决浏览器渲染，但当前服务为 Node.js，增加 Python 服务不是本批来源恢复的必要条件 |
| [Mozilla Readability](https://github.com/mozilla/readability) | 从 DOM 提取文章正文 | 不负责运行网页 JavaScript，也不判断岗位身份、雇主、有效性；可作为以后一般正文提取的候选，不能替代岗位适配与校验 |

参考招聘站公开客户端：Cummins / Pearson 使用 `prod-search-api.jobsyn.org` 搜索及 `microsites.dejobs.org` 单岗位详情；Cochrane 网页公开响应自带岗位记录。没有绕过登录、验证码或访问限制。

## 验证

- `npm run test:manual-crawl`：通过，覆盖真实数据库函数、人工资格门槛、公司归属、Citi 有限修正及负例、旧 rollout 来源显式重新预检。
- 解析回归：普通正文容器、ASP.NET form、申请入口排除、岗位标题、空招聘列表、分片及中文 UTF-8 Flight 文本、Deel 企业/公开状态、Jobsyn 分页与跨雇主负例。
- 压缩和失效回归：三种压缩格式、解压上限、明确撤下、身份不符、接口 404 和缺失数据不误判。
- `npm run test:job-sync`、`npm run test:job-sync-preview`、`npm run build`：通过。
- 本地真实来源：6 家修复来源均已有有效正文样本；康明斯和培生已完成全部筛选结果分页及单岗位验证。
- 预发发布检查新增以上 6 家的真实只读抓取；发布前后检查原岗位与企业数据指纹。发布结果以 `job-sync-preview-release.json` 为准。

发布完成：2026-09-29 12:56（北京时间），版本 `haigoo-remote-ivri1cde8-caitlinyct.vercel.app` 已切换到 `mini-preview.haigooremote.com`。预发实测有效样本分别为 Hackmamba 4、AB Agri 5、花旗 5、Cochrane 6、康明斯 6、培生 15（第一批）；此前正常来源回归通过。RWS 已关闭样本、Telnyx 与 Griffith 在招样本的失效检查均符合官方接口结果。发布前后 410 家企业及 1,981 个岗位的数量、内容指纹完全一致；自动定时任务关闭。

## 操作说明

修复发布后，在企业旁点击刷新图标，发起新一轮单企业预检，查看正文和字段后人工点击“通过”。原“不可爬虫”不会被代码自动改成“可爬虫”。建议先复测 Hackmamba、AB Agri、花旗、Cochrane、康明斯、培生。

已经结束的历史记录保留原错误及当时证据，不会被本次修复静默改写。更新检查、保存待审核、发布、删除均继续由管理员手动触发。
