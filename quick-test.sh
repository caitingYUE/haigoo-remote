#!/bin/bash

# 简历解析功能快速测试脚本
# 用法：./quick-test.sh

set -e

echo "🧪 简历解析功能快速测试"
echo "========================"
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数
PASSED=0
FAILED=0

# 辅助函数
test_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

test_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

test_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# 1. 检查依赖
echo "📦 检查依赖包..."
if npm list pdf-parse mammoth jszip 2>&1 | grep -q "pdf-parse"; then
    test_pass "pdf-parse 已安装"
else
    test_fail "pdf-parse 未安装"
fi

if npm list mammoth 2>&1 | grep -q "mammoth"; then
    test_pass "mammoth 已安装"
else
    test_fail "mammoth 未安装"
fi

if npm list jszip 2>&1 | grep -q "jszip"; then
    test_pass "jszip 已安装"
else
    test_fail "jszip 未安装"
fi

echo ""

# 2. 检查文件
echo "📄 检查文件完整性..."
files=(
    "api/parse-resume-new.js"
    "api/health.js"
    "src/services/resume-parser-enhanced.ts"
    "test-resume-parser.html"
    "test-resume.txt"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        test_pass "$file 存在"
    else
        test_fail "$file 不存在"
    fi
done

echo ""

# 3. 检查 vercel.json 配置
echo "⚙️  检查 Vercel 配置..."
if grep -q "parse-resume-new" vercel.json; then
    test_pass "vercel.json 包含 parse-resume-new 配置"
else
    test_fail "vercel.json 缺少 parse-resume-new 配置"
fi

echo ""

# 4. 测试本地服务器（如果在运行）
echo "🌐 测试本地 API（如果服务器在运行）..."
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    test_pass "本地服务器 (3001) 正在运行"
    
    # 测试健康检查
    HEALTH=$(curl -s http://localhost:3001/api/health)
    if echo "$HEALTH" | grep -q "ok"; then
        test_pass "健康检查通过"
    else
        test_fail "健康检查失败"
    fi
    
    # 测试简历解析接口
    if [ -f "test-resume.txt" ]; then
        PARSE_RESULT=$(curl -s -X POST http://localhost:3001/api/parse-resume-new \
            -F "file=@test-resume.txt")
        if echo "$PARSE_RESULT" | grep -q '"success":true'; then
            test_pass "简历解析接口正常"
        else
            test_fail "简历解析接口异常: $PARSE_RESULT"
        fi
    fi
else
    test_info "本地服务器未运行（这是正常的，如果你还没启动服务器）"
    test_info "运行 'node server.js' 启动本地服务器"
fi

echo ""

# 5. 测试线上环境（如果部署了）
echo "☁️  测试 Vercel 环境..."
if curl -s https://haigoo.vercel.app/api/health > /dev/null 2>&1; then
    test_pass "Vercel 服务可访问"
    
    HEALTH=$(curl -s https://haigoo.vercel.app/api/health)
    if echo "$HEALTH" | grep -q "ok"; then
        test_pass "线上健康检查通过"
    else
        test_fail "线上健康检查失败"
    fi
else
    test_info "Vercel 服务不可访问（可能还未部署或网络问题）"
fi

echo ""

# 总结
echo "========================"
echo "测试总结"
echo "========================"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 所有测试通过！${NC}"
    echo ""
    echo "下一步："
    echo "1. 启动开发服务器: npm run dev"
    echo "2. 访问测试页面: http://localhost:3000/test-resume-parser.html"
    echo "3. 或访问功能页面: http://localhost:3000/resume-library"
    echo ""
    exit 0
else
    echo -e "${RED}❌ 有 $FAILED 个测试失败${NC}"
    echo ""
    echo "请检查："
    echo "1. 确保所有依赖已安装: npm install"
    echo "2. 确保所有文件都已创建"
    echo "3. 查看上面的错误信息"
    echo ""
    exit 1
fi

