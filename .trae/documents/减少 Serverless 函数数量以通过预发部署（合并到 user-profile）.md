## 问题与限制
- Vercel Hobby 限制：每次部署最多 12 个 Serverless Functions。当前新增 `api/favorites.js` 导致函数数目超限，部署失败。
- 构建日志显示：Build 完成后在 Deploying outputs 阶段报错（函数数量限制），需要减少 `api/` 文件个数。

## 解决策略（不改变功能）
- 合并端点：把收藏功能并入现有 `api/user-profile.js`，通过 `action` 参数路由不同操作，避免新增函数：
  - `GET /api/user-profile?action=favorites` → 返回收藏数组与联动状态
  - `POST /api/user-profile?action=favorites_add` → 收藏（幂等）
  - `DELETE /api/user-profile?action=favorites_remove` → 取消收藏（幂等）
- 存储与状态计算复用：在 `api/user-profile.js` 内部实现 Redis/KV 读写与处理后岗位数据状态计算（复用目前 `api/favorites.js` 的逻辑）。
- 删除 `api/favorites.js` 文件，减少函数数量。
- 前端改造：
  - 列表页/详情弹窗：将 `/api/favorites` 改为 `/api/user-profile?action=favorites_add|favorites_remove` 和 `GET /api/user-profile?action=favorites`。
  - 个人中心收藏页：改为 `GET /api/user-profile?action=favorites` 渲染收藏卡片与状态。
- 事件刷新：收到 `processed-jobs-updated` 时，列表页与收藏页重新拉取 `favorites`，状态随后台变化同步。

## 修改清单
1. 后端：
   - 编辑 `api/user-profile.js`：添加 `favorites` 读写与状态计算函数；兼容 Redis/KV/内存。
   - 移除 `api/favorites.js` 文件。
2. 前端：
   - `src/pages/JobsPage.tsx`：
     - 收藏按钮：`POST/DELETE /api/user-profile?action=favorites_add|favorites_remove`，body `{ jobId }`，带 `Authorization`。
     - 初始化/事件刷新：`GET /api/user-profile?action=favorites` → `savedJobs` 高亮。
   - `src/pages/ProfileCenterPage.tsx`：
     - 读取收藏：`GET /api/user-profile?action=favorites` → 渲染卡片与状态。

## 验收
- 重新部署预发，函数数目 ≤ 12，部署成功。
- 端到端验证：收藏/取消→个人中心展示；后台过期/下架→刷新后状态变化。

## 回退保障
- 如仍超限：进一步合并少用的 API 到同一 `api/index.js` 或减少非关键端点；临时关闭不必要函数。