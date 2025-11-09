#!/bin/bash

# ================================
# 开发环境快速设置脚本
# ================================

set -e

echo "========================================="
echo "🚀 Haigoo 开发环境设置"
echo "========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. 检查 Node.js 版本
echo "1️⃣  检查 Node.js 版本..."
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 20 ]; then
    echo -e "   ${GREEN}✓ Node.js 版本: $(node -v)${NC}"
else
    echo -e "   ${YELLOW}⚠️  警告: 建议使用 Node.js 20.x 或更高版本${NC}"
fi
echo ""

# 2. 创建 develop 分支（如果不存在）
echo "2️⃣  设置 Git 分支..."
if git show-ref --verify --quiet refs/heads/develop; then
    echo -e "   ${GREEN}✓ develop 分支已存在${NC}"
else
    echo "   创建 develop 分支..."
    git checkout -b develop
    git push -u origin develop
    echo -e "   ${GREEN}✓ develop 分支已创建并推送到远程${NC}"
fi
echo ""

# 3. 安装依赖
echo "3️⃣  安装项目依赖..."
npm install
echo -e "   ${GREEN}✓ 依赖安装完成${NC}"
echo ""

# 4. 创建本地环境变量文件
echo "4️⃣  配置环境变量..."
if [ ! -f ".env.local" ]; then
    if [ -f "env.development.example" ]; then
        cp env.development.example .env.local
        echo -e "   ${GREEN}✓ 已创建 .env.local 文件${NC}"
        echo -e "   ${YELLOW}⚠️  请编辑 .env.local 文件，填入实际的配置值${NC}"
    else
        echo -e "   ${YELLOW}⚠️  警告: 找不到 env.development.example 文件${NC}"
    fi
else
    echo -e "   ${GREEN}✓ .env.local 文件已存在${NC}"
fi
echo ""

# 5. 创建 config 目录（如果不存在）
echo "5️⃣  检查配置文件..."
if [ ! -d "config" ]; then
    mkdir -p config
    echo -e "   ${GREEN}✓ 已创建 config 目录${NC}"
else
    echo -e "   ${GREEN}✓ config 目录已存在${NC}"
fi
echo ""

# 6. 添加 Git 别名
echo "6️⃣  设置 Git 别名（可选）..."
echo "   添加以下别名到你的 shell 配置文件 (~/.bashrc 或 ~/.zshrc)："
echo ""
echo "   alias dev='git checkout develop && git pull origin develop'"
echo "   alias prod='git checkout main && git pull origin main'"
echo "   alias env='git branch --show-current'"
echo ""

# 7. 完成提示
echo "========================================="
echo "✅ 开发环境设置完成！"
echo "========================================="
echo ""
echo "下一步："
echo "1. 编辑 .env.local 文件，填入开发环境的配置"
echo "2. 在 Vercel Dashboard 配置开发环境变量"
echo "3. 运行 'npm run dev' 启动开发服务器"
echo "4. 访问 http://localhost:3000 查看效果"
echo ""
echo "分支管理："
echo "- 开发功能时，从 develop 创建功能分支"
echo "- 功能完成后，合并回 develop 分支"
echo "- develop 分支测试通过后，合并到 main 分支"
echo ""
echo "部署："
echo "- push 到 develop 分支 → 自动部署到开发环境"
echo "- push 到 main 分支 → 自动部署到生产环境"
echo ""

