## 错误根因
- 构建日志显示 TS2451：Cannot redeclare block-scoped variable 'handleSave'（src/components/JobDetailModal.tsx:186,189）。这是因为文件内存在两个 `const handleSave = () => {...}` 声明，或在 `export default JobDetailModal` 之后残留了一段重复的收藏按钮代码再次声明了同名变量。

## 修复方案
1. 统一处理函数
- 在 `src/components/JobDetailModal.tsx` 只保留一个 `handleSave` 声明，放在其它 handler 附近（如 `handleShare/handleApply` 之后）。
- 删除任何第二处的 `const handleSave` 声明及其附带的残留 JSX（尤其是在 `export default JobDetailModal` 之后的片段）。

2. 树形结构清理
- 确认 `export default JobDetailModal` 为文件末尾唯一导出语句，导出后不再包含任何 JSX/函数片段。
- 头部工具栏的收藏按钮调用该唯一的 `handleSave`，`aria-pressed` 与样式取自 `isSaved`。

3. 传参与请求
- 保持 `JobsPage.tsx` 对弹窗传参：`onSave={() => toggleSaveJob(selectedJob.id)}`、`isSaved={savedJobs.has(selectedJob.id)}`；列表卡片也传 `onSave/isSaved`。
- 请求统一为 `POST /api/user-profile?action=favorites_add|favorites_remove&jobId=<id>`（同时 body 传 `{ jobId }`），令牌取 `useAuth().token || localStorage('haigoo_auth_token') || cookie('haigoo_auth_token')`。

4. 验证与部署
- 本地编译 `tsc && vite build` 确认不再报 TS2451。
- 推送到 `develop` 触发预发构建；在预发端到端验证 Network 请求与“我的收藏”展示。

## 预期效果
- 构建通过；详情页收藏按钮出现且点击后发起 `favorites_add/remove` 请求；个人中心正确显示收藏与“已失效”。