#!/bin/bash

cd /Users/caitlinyct/Haigoo_Admin/Haigoo_assistant

echo "Adding files to git..."
git add src/components/Header.tsx src/pages/ProfilePage.tsx

echo "Committing changes..."
git commit -m "feat: 统一头像下拉框与个人资料页面导航栏

主要改进：
1. 统一菜单项名称和数量：
   - 简历优化 → 简历管理
   - 申请记录 → 我的申请  
   - AI洞察 → AI职业洞察
   - 新增：职位订阅、推荐墙

2. 实现 URL 参数路由：
   - 从头像下拉框点击菜单项会跳转到对应的 tab
   - 支持直接通过 URL 访问特定 tab（如 /profile?tab=resume）
   - URL 参数变化时自动切换到对应 section

3. 改进用户体验：
   - 两处菜单完全一致，避免用户混淆
   - 点击跳转流畅，状态同步准确
   - 支持浏览器前进/后退导航"

echo "Pushing to remote..."
git push origin main

echo "Done!"

