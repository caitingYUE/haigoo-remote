## 问题定位
- 构建日志: TS2451 Cannot redeclare block-scoped variable 'handleSave' (src/components/JobDetailModal.tsx:186,189)。
- 说明: 组件内重复声明 `const handleSave = () => { ... }`，或在 `export default` 之后残留一段按钮代码导致再次声明与作用域异常。

## 修复方案
1. 规整组件逻辑
- 在 `src/components/JobDetailModal.tsx` 仅保留一个 `handleSave`，放在其他 handler（`handleShare/handleApply`）附近。
- 确认 props 中包含 `onSave?: (jobId: string) => void` 与 `isSaved?: boolean`，并且只声明一次。
- 在头部工具栏插入收藏按钮（Bookmark），点击触发 `handleSave`，`aria-pressed` 与高亮取自 `isSaved`。
- 清理 `export default JobDetailModal` 之后的任何残留 JSX 或函数（上次构建报错的根源）。

2. 传参与状态联动
- 在 `src/pages/JobsPage.tsx` 的弹窗调用传入 `onSave={() => toggleSaveJob(selectedJob.id)}` 与 `isSaved={savedJobs.has(selectedJob.id)}`。
- 列表卡片 `JobCard` 保持 `onSave/isSaved` 传参一致。

3. 前端发起请求与令牌
- 统一使用 `POST /api/user-profile?action=favorites_add|favorites_remove&jobId=<id>`，同时 body `{jobId}`；避免 DELETE 体解析问题。
- 令牌获取: `useAuth().token || localStorage('haigoo_auth_token') || cookie('haigoo_auth_token')`，确保已登录用户点击能发起请求。

4. 编译与部署
- 本地/CI 运行 `tsc && vite build`，确保不再有重复声明错误。
- 推送 develop 并在预发验证：
  - 详情页点击心形 → Network 出现 `favorites_add/remove` 并返回 `success:true`。
  - 个人中心“我的收藏”展示卡片，数据库缺失或过期时灰显“已失效”。

5. 若仍异常
- 元素检查: 头部工具栏 DOM 中是否有收藏按钮；确认无 `pointer-events:none` 覆盖；必要时提高工具栏 z-index。
- Network 检查: 请求是否带 Authorization 与 jobId；后端返回错误时记录日志并继续修复。