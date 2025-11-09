#!/bin/bash

# ================================
# 生产数据同步到开发环境脚本
# 从生产环境复制部分数据到开发环境用于测试
# ================================

# 配置
PROD_URL="https://haigoo.vercel.app"  # 生产环境
DEV_URL="https://haigoo-remote-git-develop-caitlinyct.vercel.app"  # 开发环境
DATA_LIMIT=100  # 复制的数据条数

echo "========================================="
echo "🔄 开始从生产环境同步数据到开发环境"
echo "========================================="
echo ""
echo "源（生产）: $PROD_URL"
echo "目标（开发）: $DEV_URL"
echo "数据量: 最多 $DATA_LIMIT 条"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 步骤1: 从生产环境获取数据
echo "📥 步骤 1/3: 从生产环境获取数据..."
echo ""

PROD_DATA=$(curl -s "$PROD_URL/api/data/processed-jobs?limit=$DATA_LIMIT")

# 检查是否成功获取
if [ -z "$PROD_DATA" ]; then
    echo -e "${RED}❌ 错误: 无法从生产环境获取数据${NC}"
    echo "请检查："
    echo "1. 生产环境 URL 是否正确"
    echo "2. 生产环境是否有数据"
    echo "3. 网络连接是否正常"
    exit 1
fi

# 解析数据数量
JOBS_COUNT=$(echo "$PROD_DATA" | jq -r '.data | length' 2>/dev/null)

if [ -z "$JOBS_COUNT" ] || [ "$JOBS_COUNT" = "null" ]; then
    echo -e "${YELLOW}⚠️  警告: 无法解析数据或数据格式不正确${NC}"
    echo "生产环境返回的数据:"
    echo "$PROD_DATA" | head -20
    echo ""
    echo "可能的原因："
    echo "1. 生产环境还没有数据"
    echo "2. API 返回格式不正确"
    echo "3. 需要先在生产环境添加数据"
    echo ""
    read -p "是否继续使用测试数据？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "操作已取消"
        exit 1
    fi
    JOBS_COUNT=0
else
    echo -e "${GREEN}✓ 成功获取 $JOBS_COUNT 条职位数据${NC}"
fi

# 步骤2: 准备数据（如果需要处理）
echo ""
echo "🔧 步骤 2/3: 准备数据..."

# 提取 jobs 数组
JOBS_ARRAY=$(echo "$PROD_DATA" | jq -r '.data')

if [ "$JOBS_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ 数据准备完成${NC}"
    
    # 显示一些样本信息
    echo ""
    echo "📊 数据预览（前3条）:"
    echo "$JOBS_ARRAY" | jq -r '.[0:3] | .[] | "  - \(.title) at \(.company)"' 2>/dev/null || echo "  (无法解析预览)"
    echo ""
else
    echo -e "${YELLOW}⚠️  生产环境无数据，将使用测试数据${NC}"
    # 使用测试数据
    JOBS_ARRAY='[
      {
        "id": "sync-test-1",
        "title": "高级前端工程师 (远程)",
        "company": "TechCorp",
        "location": "远程 - 全球",
        "category": "前端开发",
        "experienceLevel": "Senior",
        "isRemote": true,
        "salary": "40-60K RMB/月",
        "jobType": "全职",
        "description": "负责前端产品开发，使用 React、TypeScript 等现代技术栈。",
        "requirements": ["5年以上前端开发经验", "精通 React 和 TypeScript"],
        "benefits": ["远程办公", "弹性工作时间", "技术培训"],
        "tags": ["React", "TypeScript", "远程"],
        "url": "https://example.com/job1",
        "source": "测试数据",
        "publishedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
        "status": "active"
      },
      {
        "id": "sync-test-2",
        "title": "全栈开发工程师",
        "company": "StartupXYZ",
        "location": "远程 - 中国",
        "category": "全栈开发",
        "experienceLevel": "Mid",
        "isRemote": true,
        "salary": "30-50K RMB/月",
        "jobType": "全职",
        "description": "参与产品全栈开发，使用 Node.js、React 技术栈。",
        "requirements": ["3年以上全栈开发经验", "熟悉 Node.js 和前端框架"],
        "benefits": ["弹性工作", "股票期权", "年度奖金"],
        "tags": ["Node.js", "React", "MongoDB"],
        "url": "https://example.com/job2",
        "source": "测试数据",
        "publishedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
        "status": "active"
      }
    ]'
    JOBS_COUNT=2
fi

# 步骤3: 推送到开发环境
echo ""
echo "📤 步骤 3/3: 推送数据到开发环境..."
echo ""

# 发送数据
RESPONSE=$(curl -s -X POST "$DEV_URL/api/data/processed-jobs" \
  -H "Content-Type: application/json" \
  -d "$JOBS_ARRAY")

# 检查响应
if echo "$RESPONSE" | grep -q "success"; then
    SAVED_COUNT=$(echo "$RESPONSE" | jq -r '.saved' 2>/dev/null || echo "$JOBS_COUNT")
    echo -e "${GREEN}✅ 成功！已将 $SAVED_COUNT 条数据同步到开发环境${NC}"
    echo ""
    echo "返回信息:"
    echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
else
    echo -e "${RED}❌ 失败！数据推送出错${NC}"
    echo ""
    echo "错误响应:"
    echo "$RESPONSE"
    echo ""
    echo "可能的原因："
    echo "1. 开发环境 Redis 未配置"
    echo "2. API 权限问题"
    echo "3. 数据格式不兼容"
    echo ""
    echo "调试建议："
    echo "1. 检查开发环境健康状态:"
    echo "   curl $DEV_URL/api/health"
    echo ""
    echo "2. 查看 Vercel 部署日志"
    echo ""
    echo "3. 确认环境变量配置正确"
    exit 1
fi

# 验证数据
echo ""
echo "🔍 验证开发环境数据..."

DEV_STATS=$(curl -s "$DEV_URL/api/storage/stats")
DEV_TOTAL=$(echo "$DEV_STATS" | jq -r '.total' 2>/dev/null || echo "unknown")

echo "开发环境当前数据量: $DEV_TOTAL"
echo ""

# 完成
echo "========================================="
echo -e "${GREEN}🎉 数据同步完成！${NC}"
echo "========================================="
echo ""
echo "📍 现在可以访问以下链接测试："
echo ""
echo "开发环境:"
echo "  - 首页: $DEV_URL"
echo "  - 职位列表: $DEV_URL/jobs"
echo "  - 数据统计: $DEV_URL/api/storage/stats"
echo ""
echo "生产环境（参考）:"
echo "  - 首页: $PROD_URL"
echo "  - 职位列表: $PROD_URL/jobs"
echo ""
echo "💡 提示:"
echo "  - 开发环境和生产环境的数据完全隔离"
echo "  - 在开发环境的任何操作都不会影响生产环境"
echo "  - 如需重新同步，再次运行此脚本即可"
echo ""

