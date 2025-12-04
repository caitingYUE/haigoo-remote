#!/bin/bash

# ================================
# 部署前检查脚本
# 用于验证代码是否准备好部署到生产环境
# ================================

set -e  # 遇到错误立即退出

echo "========================================="
echo "🔍 开始部署前检查..."
echo "========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查计数器
WARNINGS=0
ERRORS=0

# 1. 检查当前分支
echo "1️⃣  检查 Git 分支..."
CURRENT_BRANCH=$(git branch --show-current)
echo "   当前分支: ${CURRENT_BRANCH}"

if [ "$CURRENT_BRANCH" = "main" ]; then
    echo -e "   ${YELLOW}⚠️  警告: 您在 main 分支上，这将部署到生产环境${NC}"
    WARNINGS=$((WARNINGS + 1))
elif [ "$CURRENT_BRANCH" = "develop" ]; then
    echo -e "   ${GREEN}✓ 开发分支，将部署到开发环境${NC}"
else
    echo -e "   ${YELLOW}⚠️  警告: 您在功能分支上，建议先合并到 develop${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 2. 检查未提交的更改
echo "2️⃣  检查未提交的更改..."
if git diff-index --quiet HEAD --; then
    echo -e "   ${GREEN}✓ 没有未提交的更改${NC}"
else
    echo -e "   ${RED}✗ 错误: 存在未提交的更改${NC}"
    echo "   请先提交所有更改："
    echo "   git add ."
    echo "   git commit -m 'your message'"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 3. 检查是否与远程同步
echo "3️⃣  检查与远程仓库同步状态..."
git fetch origin $CURRENT_BRANCH --quiet
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ "$LOCAL" = "$REMOTE" ]; then
    echo -e "   ${GREEN}✓ 与远程仓库同步${NC}"
elif [ "$LOCAL" = "$(git merge-base @ @{u})" ]; then
    echo -e "   ${YELLOW}⚠️  警告: 本地落后于远程，建议先 pull${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "   ${YELLOW}⚠️  警告: 本地有未推送的提交${NC}"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 4. 检查 TypeScript 编译
echo "4️⃣  检查 TypeScript 编译..."
if npm run type-check &> /dev/null; then
    echo -e "   ${GREEN}✓ TypeScript 编译通过${NC}"
else
    echo -e "   ${RED}✗ 错误: TypeScript 编译失败${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 5. 检查 ESLint
echo "5️⃣  检查代码规范 (ESLint)..."
if npm run lint &> /dev/null; then
    echo -e "   ${GREEN}✓ 代码规范检查通过${NC}"
else
    echo -e "   ${YELLOW}⚠️  警告: 代码规范检查有警告${NC}"
    echo "   运行 'npm run lint' 查看详情"
    WARNINGS=$((WARNINGS + 1))
fi
echo ""

# 6. 检查测试（如果有）
if grep -q "\"test\":" package.json; then
    echo "6️⃣  运行测试..."
    if npm test &> /dev/null; then
        echo -e "   ${GREEN}✓ 测试通过${NC}"
    else
        echo -e "   ${RED}✗ 错误: 测试失败${NC}"
        ERRORS=$((ERRORS + 1))
    fi
    echo ""
fi

# 7. 检查敏感信息
echo "7️⃣  检查敏感信息泄露..."
SENSITIVE_PATTERNS=(
    "password.*=.*['\"].*['\"]"
    "secret.*=.*['\"].*['\"]"
    "api_key.*=.*['\"].*['\"]"
    "token.*=.*['\"].*['\"]"
)

SENSITIVE_FOUND=false
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if git grep -i -E "$pattern" -- '*.ts' '*.tsx' '*.js' '*.jsx' &> /dev/null; then
        if [ "$SENSITIVE_FOUND" = false ]; then
            echo -e "   ${RED}✗ 警告: 发现可能的敏感信息${NC}"
            SENSITIVE_FOUND=true
        fi
        WARNINGS=$((WARNINGS + 1))
    fi
done

if [ "$SENSITIVE_FOUND" = false ]; then
    echo -e "   ${GREEN}✓ 未发现明显的敏感信息${NC}"
fi
echo ""

# 8. 检查环境变量文件
echo "8️⃣  检查环境变量配置..."
if [ -f ".env" ] || [ -f ".env.local" ]; then
    echo -e "   ${YELLOW}⚠️  警告: 发现本地环境变量文件${NC}"
    echo "   请确保 .env 文件已添加到 .gitignore"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "   ${GREEN}✓ 未发现本地环境变量文件${NC}"
fi
echo ""

# 9. 检查依赖更新
echo "9️⃣  检查依赖包..."
if npm outdated &> /dev/null; then
    echo -e "   ${GREEN}✓ 所有依赖包都是最新的${NC}"
else
    echo -e "   ${YELLOW}⚠️  提示: 有可更新的依赖包${NC}"
    echo "   运行 'npm outdated' 查看详情"
fi
echo ""

# 总结
echo "========================================="
echo "📊 检查总结"
echo "========================================="
echo -e "错误: ${RED}${ERRORS}${NC}"
echo -e "警告: ${YELLOW}${WARNINGS}${NC}"
echo ""

# 最终决策
if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ 检查失败: 发现 ${ERRORS} 个错误，请修复后再部署${NC}"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  检查通过但有 ${WARNINGS} 个警告，建议修复后部署${NC}"
    echo ""
    read -p "是否继续部署？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "部署已取消"
        exit 1
    fi
else
    echo -e "${GREEN}✅ 所有检查通过，可以安全部署！${NC}"
fi

echo ""
echo "========================================="
echo "🚀 部署指南"
echo "========================================="
if [ "$CURRENT_BRANCH" = "main" ]; then
    echo "生产环境部署命令："
    echo "  git push origin main"
elif [ "$CURRENT_BRANCH" = "develop" ]; then
    echo "开发环境部署命令："
    echo "  git push origin develop"
else
    echo "建议先合并到 develop："
    echo "  git checkout develop"
    echo "  git merge $CURRENT_BRANCH"
    echo "  git push origin develop"
fi
echo ""

