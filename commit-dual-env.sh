#!/bin/bash

cd /Users/caitlinyct/Haigoo_Admin/Haigoo_assistant

echo "添加新文件到 git..."
git add DEPLOYMENT_STRATEGY.md
git add SETUP_GUIDE.md
git add config/environment.ts
git add env.development.example
git add env.production.example
git add scripts/deploy-check.sh
git add scripts/setup-dev-env.sh
git add commit-dual-env.sh

echo "提交更改..."
git commit -m "feat: 实现双环境部署策略

主要更新：
1. 创建完整的双环境部署文档
   - DEPLOYMENT_STRATEGY.md: 详细的部署策略
   - SETUP_GUIDE.md: 一步步设置指南

2. 添加环境配置
   - config/environment.ts: 统一的环境配置管理
   - env.development.example: 开发环境变量示例
   - env.production.example: 生产环境变量示例

3. 添加辅助脚本
   - scripts/deploy-check.sh: 部署前检查脚本
   - scripts/setup-dev-env.sh: 开发环境快速设置

4. Git 分支策略
   - main: 生产环境
   - develop: 开发/测试环境
   - feature/*: 功能开发分支

5. 数据隔离
   - 独立的 Redis 实例
   - 独立的环境变量
   - 独立的 OAuth 配置

下一步：
1. 创建 develop 分支
2. 在 Vercel 配置环境变量
3. 创建独立的数据库实例
4. 测试部署"

echo "推送到远程..."
git push origin main

echo "完成！"
echo ""
echo "========================================="
echo "接下来的步骤："
echo "========================================="
echo "1. 阅读 SETUP_GUIDE.md 了解详细设置步骤"
echo "2. 运行 scripts/setup-dev-env.sh 创建 develop 分支"
echo "3. 在 Vercel Dashboard 配置环境变量"
echo "4. 测试开发环境部署"
echo ""

