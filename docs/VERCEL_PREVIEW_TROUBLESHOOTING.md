# Vercel Preview 部署故障排查指南

## 🚨 问题描述
您在 Vercel Dashboard 中只能看到 **Production** (main分支) 的部署记录，而看不到 **Preview** (develop分支) 的部署记录，即使代码已经成功推送到 `develop` 分支。

## 🔍 可能原因及解决方案

### 原因 1：Git 分支配置错误 (最常见)
Vercel 默认会自动为所有非 Production 分支创建 Preview 部署，但如果项目设置中启用了 "Ignored Build Step" 或者没有关联该分支，可能会被忽略。

**解决方案**：
1. 登录 Vercel Dashboard。
2. 进入 **Settings** -> **Git**。
3. 检查 **Production Branch** 是否设置为 `main`。
4. 检查 **Ignored Build Step** 部分。如果这里有自定义命令（例如 `if [ "$VERCEL_GIT_COMMIT_REF" != "main" ]; then exit 0; else exit 1; fi`），它会阻止非 main 分支的构建。
   - **操作**：如果是这种情况，请暂时清空该命令，或者修改逻辑以允许 `develop` 分支构建。

### 原因 2：项目未启用 Preview 部署
某些企业版或特定配置下，Preview 部署可能被关闭。

**解决方案**：
1. 检查 **Deployments** 页面顶部的过滤器，确保没有只选中 "Production"。
2. 在 **Settings** -> **General** 中，确认没有禁用 Preview 环境。

### 原因 3：分支未被 Vercel 识别
如果 `develop` 分支是最近创建的，Vercel 可能还没同步到。

**解决方案**：
手动触发一次 Preview 部署（我们已经在命令行中尝试过，如果还不行，请按以下步骤操作）：
1. 在 Vercel Dashboard 的 **Project** 页面。
2. 点击 **Deployments** 标签页。
3. 点击右上角的 **...** (三个点) 按钮，选择 **Create Deployment**。
4. 选择 `develop` 分支并点击 **Deploy**。

### 原因 4：团队/权限限制
如果您的 Vercel 账号权限不足，可能无法看到其他人的 Preview 部署（虽然通常至少能看到记录）。

## 🛠 验证步骤
1. 请登录 Vercel 后台。
2. 按照上述 **原因 1** 检查 Git 设置。
3. 如果一切正常，请尝试手动触发一次部署（**原因 3**）。

---
**当前状态更新**：
- ✅ 代码已合并到 `main` 并推送到 Production 环境。
- ✅ 包含修复：EverAI/Whatnot/Slasify 爬虫优化。
- ⏳ Preview 环境问题需要您在 Vercel 后台进行上述检查。
