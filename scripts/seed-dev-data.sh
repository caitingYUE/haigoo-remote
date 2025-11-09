#!/bin/bash

# ================================
# 开发环境数据初始化脚本
# 快速添加测试职位数据
# ================================

# 配置
DEV_URL="https://haigoo-git-develop-caitlingvue-caitlinycts-projects.vercel.app"  # 替换为你的实际开发环境 URL
# 如果是本地测试，使用: DEV_URL="http://localhost:3000"

echo "========================================="
echo "🌱 开始初始化开发环境数据..."
echo "目标: $DEV_URL"
echo "========================================="
echo ""

# 测试职位数据
TEST_JOBS='[
  {
    "id": "test-job-1",
    "title": "Senior Frontend Engineer (Remote)",
    "company": "TechCorp Inc.",
    "location": "Remote - Global",
    "category": "前端开发",
    "experienceLevel": "Senior",
    "isRemote": true,
    "salary": "100-150K USD",
    "jobType": "全职",
    "description": "We are looking for an experienced Frontend Engineer to join our remote team. You will work on building modern web applications using React, TypeScript, and Next.js.",
    "requirements": [
      "5+ years of frontend development experience",
      "Strong knowledge of React and TypeScript",
      "Experience with Next.js or similar frameworks",
      "Excellent communication skills"
    ],
    "benefits": [
      "Competitive salary",
      "Flexible working hours",
      "Health insurance",
      "Professional development budget"
    ],
    "tags": ["React", "TypeScript", "Next.js", "Remote"],
    "url": "https://example.com/jobs/senior-frontend",
    "source": "Test Data",
    "publishedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "status": "active"
  },
  {
    "id": "test-job-2",
    "title": "Full Stack Developer",
    "company": "StartupXYZ",
    "location": "Remote - US Only",
    "category": "全栈开发",
    "experienceLevel": "Mid",
    "isRemote": true,
    "salary": "80-120K USD",
    "jobType": "全职",
    "description": "Join our fast-growing startup as a Full Stack Developer. Work with modern technologies and shape the future of our product.",
    "requirements": [
      "3+ years of full stack development",
      "Experience with Node.js and React",
      "Knowledge of PostgreSQL or MySQL",
      "Experience with cloud platforms (AWS/GCP)"
    ],
    "benefits": [
      "Equity options",
      "Remote work",
      "Annual bonus",
      "Learning stipend"
    ],
    "tags": ["Node.js", "React", "PostgreSQL", "AWS"],
    "url": "https://example.com/jobs/fullstack-dev",
    "source": "Test Data",
    "publishedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "status": "active"
  },
  {
    "id": "test-job-3",
    "title": "Backend Engineer - Python",
    "company": "DataFlow Systems",
    "location": "Remote - Europe",
    "category": "后端开发",
    "experienceLevel": "Mid",
    "isRemote": true,
    "salary": "70-100K EUR",
    "jobType": "全职",
    "description": "We need a talented Backend Engineer with Python expertise to build scalable APIs and data processing pipelines.",
    "requirements": [
      "Strong Python programming skills",
      "Experience with Django or FastAPI",
      "Knowledge of microservices architecture",
      "Experience with Docker and Kubernetes"
    ],
    "benefits": [
      "Remote-first company",
      "30 days vacation",
      "Conference budget",
      "Home office setup"
    ],
    "tags": ["Python", "Django", "FastAPI", "Docker", "Kubernetes"],
    "url": "https://example.com/jobs/python-backend",
    "source": "Test Data",
    "publishedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "status": "active"
  },
  {
    "id": "test-job-4",
    "title": "DevOps Engineer",
    "company": "CloudNative Co.",
    "location": "Remote - Worldwide",
    "category": "运维开发",
    "experienceLevel": "Senior",
    "isRemote": true,
    "salary": "110-160K USD",
    "jobType": "全职",
    "description": "Looking for a DevOps Engineer to manage our cloud infrastructure and CI/CD pipelines. Experience with Kubernetes and AWS required.",
    "requirements": [
      "5+ years DevOps experience",
      "Expert in Kubernetes and Docker",
      "Strong AWS/GCP knowledge",
      "Experience with Terraform and Ansible"
    ],
    "benefits": [
      "Work from anywhere",
      "Top-tier compensation",
      "Latest equipment provided",
      "Training budget"
    ],
    "tags": ["DevOps", "Kubernetes", "AWS", "Terraform", "CI/CD"],
    "url": "https://example.com/jobs/devops-engineer",
    "source": "Test Data",
    "publishedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "status": "active"
  },
  {
    "id": "test-job-5",
    "title": "UI/UX Designer",
    "company": "DesignHub",
    "location": "Remote - Asia Pacific",
    "category": "设计",
    "experienceLevel": "Mid",
    "isRemote": true,
    "salary": "60-90K USD",
    "jobType": "全职",
    "description": "Creative UI/UX Designer needed to craft beautiful and intuitive user experiences for our web and mobile applications.",
    "requirements": [
      "3+ years UI/UX design experience",
      "Proficiency in Figma and Sketch",
      "Strong portfolio showcasing web/mobile designs",
      "Understanding of user-centered design principles"
    ],
    "benefits": [
      "Flexible schedule",
      "Remote work",
      "Design tools subscription",
      "Creative freedom"
    ],
    "tags": ["UI/UX", "Figma", "Sketch", "Design", "Remote"],
    "url": "https://example.com/jobs/uiux-designer",
    "source": "Test Data",
    "publishedAt": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
    "status": "active"
  }
]'

# 发送数据到 API
echo "📤 发送测试职位数据..."
echo ""

RESPONSE=$(curl -s -X POST "$DEV_URL/api/data/processed-jobs" \
  -H "Content-Type: application/json" \
  -d "$TEST_JOBS")

# 检查响应
if echo "$RESPONSE" | grep -q "success"; then
  echo "✅ 成功！测试数据已添加"
  echo ""
  echo "返回信息:"
  echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
  echo ""
  echo "========================================="
  echo "🎉 初始化完成！"
  echo "========================================="
  echo ""
  echo "现在可以访问以下页面查看数据："
  echo "- 职位列表: $DEV_URL/jobs"
  echo "- 首页推荐: $DEV_URL"
  echo "- 数据统计: $DEV_URL/api/storage/stats"
  echo ""
else
  echo "❌ 失败！请检查以下信息："
  echo ""
  echo "响应内容:"
  echo "$RESPONSE"
  echo ""
  echo "可能的原因："
  echo "1. URL 不正确（请检查 DEV_URL 变量）"
  echo "2. API 未正确配置"
  echo "3. Redis 连接问题"
  echo ""
  echo "调试建议："
  echo "1. 访问 $DEV_URL/api/health 检查服务状态"
  echo "2. 查看 Vercel 部署日志"
  echo "3. 检查环境变量配置"
fi

echo ""

