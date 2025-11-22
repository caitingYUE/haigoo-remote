#!/bin/bash

# 快速注册测试用户脚本
# 用于本地开发环境

echo "正在注册测试用户..."

RESPONSE=$(curl -s -X POST "http://localhost:3001/api/auth?action=register" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123", "username": "TestUser"}')

echo "$RESPONSE" | jq '.'

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo ""
  echo "✅ 注册成功！"
  echo "📧 邮箱: test@example.com"
  echo "🔑 密码: password123"
  echo "👤 角色: Admin"
  echo ""
  echo "现在可以在浏览器登录了: http://localhost:3000/login"
else
  echo ""
  echo "❌ 注册失败，可能用户已存在"
  echo "💡 提示: 如果用户已存在，请直接登录"
fi
