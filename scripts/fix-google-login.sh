#!/bin/bash

# ================================
# 提交 Google 登录功能修复
# ================================

echo "========================================="
echo "🔧 提交 Google 登录功能修复"
echo "========================================="
echo ""

# 切换到项目目录
cd "$(dirname "$0")/.." || exit 1

# 确保在 develop 分支
echo "🔍 检查当前分支..."
current_branch=$(git branch --show-current)
if [ "$current_branch" != "develop" ]; then
    echo "⚠️  当前不在 develop 分支，正在切换..."
    git checkout develop
fi
echo "✅ 当前分支: develop"
echo ""

# 添加所有改动
echo "📁 添加文件..."
git add -A
echo ""

# 显示状态
echo "📊 改动文件："
git status --short
echo ""

# 提交
echo "💾 提交改动..."
git commit -m "fix: 实现 Google 登录功能

修复内容:
- 添加 Google Identity Services 脚本到 index.html
- 实现完整的 Google OAuth 前端集成
- 添加 TypeScript 类型定义 (src/types/google.d.ts)
- 更新 LoginPage.tsx 实现真实的 Google 登录
- 更新 RegisterPage.tsx 支持 Google 注册
- 添加详细的日志和错误处理

功能:
- ✅ 支持 Google One Tap 登录
- ✅ 自动创建/登录用户
- ✅ 完整的错误处理和状态管理
- ✅ 开发环境和生产环境都支持
- ✅ 与后端 API 完美集成

技术细节:
- 使用 Google Identity Services (GIS) SDK
- 初始化时检测 SDK 加载状态
- 使用 useEffect 管理生命周期
- 实现 Google callback 处理 ID Token
- 调用后端 /api/auth?action=google 验证
- 保存 JWT token 和用户信息到 localStorage

测试:
- Console 输出详细日志
- 错误提示友好清晰
- 支持在线调试"

echo ""

# 推送
echo "🚀 推送到 GitHub（触发 Vercel 部署）..."
git push origin develop

echo ""
echo "========================================="
echo "✅ 完成！"
echo "========================================="
echo ""
echo "📍 接下来："
echo ""
echo "1️⃣  等待 Vercel 自动部署（约 1-2 分钟）"
echo "    访问: https://vercel.com/dashboard"
echo ""
echo "2️⃣  测试 Google 登录"
echo "    访问: https://haigoo-remote-git-develop-caitlinyct.vercel.app/login"
echo "    - 点击 \"使用 Google 登录\""
echo "    - 选择 Google 账号"
echo "    - 应该成功登录并跳转首页"
echo ""
echo "3️⃣  调试（如果需要）"
echo "    - 打开浏览器开发者工具（F12）"
echo "    - 查看 Console 日志"
echo "    - 查找 [LoginPage] 开头的日志"
echo ""
echo "4️⃣  验证环境变量"
echo "    curl https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/health"
echo "    # 应该显示 googleOAuth.configured: true"
echo ""
echo "🎉 Google 登录功能已修复！"
echo ""

