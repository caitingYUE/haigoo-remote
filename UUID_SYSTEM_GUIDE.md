# UUID 用户标识系统指南

## 📋 概述

在 Haigoo 平台中，每个用户都有一个全局唯一的 UUID（User ID），这个 UUID 作为用户在整个平台的唯一标识，用于：

- 用户身份识别
- 职位推荐算法
- 岗位投递记录
- 用户行为追踪
- 数据分析和统计

---

## 🔑 UUID 规范

### UUID 生成

用户注册时，系统使用 `crypto.randomUUID()` 自动生成：

```javascript
// 后端生成（api/auth.js）
import crypto from 'crypto'

const userId = crypto.randomUUID()
// 示例: "550e8400-e29b-41d4-a716-446655440000"
```

### UUID 格式

- **标准：** UUID v4 (RFC 4122)
- **格式：** `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
- **长度：** 36 字符（含连字符）
- **示例：** `550e8400-e29b-41d4-a716-446655440000`

---

## 📊 数据结构

### 用户对象中的 UUID

```typescript
interface User {
  id: string                    // ← UUID（全局唯一标识）
  email: string                 // 邮箱（登录凭证）
  username: string              // 用户名（显示名称）
  avatar: string                // 头像URL
  authProvider: 'google' | 'email'  // 认证方式
  // ... 其他字段
}
```

### 存储结构

**Redis/Vercel KV 存储：**

```
Key: haigoo:user:{email}           # 用户数据（按邮箱）
Value: JSON.stringify(user)        # 包含 user.id (UUID)

Key: haigoo:userId:{uuid}          # UUID映射
Value: {email}                     # 用于通过UUID查询用户
```

**示例：**
```
haigoo:user:user@example.com → { id: "550e8400-...", email: "user@example.com", ... }
haigoo:userId:550e8400-...    → "user@example.com"
```

---

## 🎯 UUID 使用场景

### 1. 用户身份验证

```typescript
// JWT Token Payload
interface TokenPayload {
  userId: string    // UUID
  email: string
  iat: number
  exp: number
}

// 生成 token
const token = generateToken({ 
  userId: user.id,  // UUID
  email: user.email 
})
```

### 2. 职位推荐算法

```typescript
// 推荐算法输入
interface RecommendationInput {
  userId: string       // UUID（唯一标识）
  userProfile: object  // 用户画像
  jobHistory: object[] // 浏览历史
}

// 推荐记录
interface RecommendationLog {
  userId: string       // UUID
  jobId: string
  score: number
  timestamp: string
}
```

### 3. 岗位投递记录

```typescript
// 投递记录
interface JobApplication {
  id: string           // 投递ID
  userId: string       // UUID（申请人）
  jobId: string        // 职位ID
  status: string       // 状态
  appliedAt: string    // 投递时间
}

// 存储结构
Key: haigoo:application:{applicationId}
Value: { userId: "550e8400-...", jobId: "...", ... }

Key: haigoo:user_applications:{uuid}
Value: [applicationId1, applicationId2, ...]  // 用户的所有投递
```

### 4. 用户行为追踪

```typescript
// 行为事件
interface UserEvent {
  userId: string       // UUID
  eventType: string    // 事件类型（浏览、收藏、投递等）
  targetId: string     // 目标ID（职位ID等）
  timestamp: string
  metadata: object
}

// 示例：职位浏览记录
{
  userId: "550e8400-...",
  eventType: "job_view",
  targetId: "job_12345",
  timestamp: "2025-11-07T10:30:00Z",
  metadata: { source: "recommendation", position: 3 }
}
```

### 5. 数据分析统计

```typescript
// 用户统计
interface UserStats {
  userId: string       // UUID
  totalApplications: number
  totalViews: number
  savedJobs: number
  profileCompleteness: number
  lastActiveAt: string
}
```

---

## 🔍 UUID 查询方式

### 通过 UUID 查询用户

```javascript
// 后端 API
GET /api/users?id={uuid}

// 实现
async function getUserById(userId) {
  // 1. 通过 UUID 映射获取邮箱
  const email = await redis.get(`haigoo:userId:${userId}`)
  if (!email) return null
  
  // 2. 通过邮箱获取用户完整信息
  const userData = await redis.get(`haigoo:user:${email}`)
  return JSON.parse(userData)
}
```

### 通过邮箱查询 UUID

```javascript
async function getUuidByEmail(email) {
  const userData = await redis.get(`haigoo:user:${email}`)
  if (!userData) return null
  
  const user = JSON.parse(userData)
  return user.id  // UUID
}
```

---

## 🛡️ UUID 安全性

### 优点

1. **不可预测：** UUID 随机生成，无法通过递增或其他规律猜测
2. **全局唯一：** 碰撞概率极低（2^122 分之一）
3. **信息隔离：** UUID 本身不包含用户敏感信息
4. **跨系统兼容：** 符合 RFC 4122 标准，便于系统集成

### 注意事项

1. **不要暴露在 URL 中：** 避免将 UUID 作为公开 URL 参数
2. **访问控制：** 通过 JWT token 验证用户身份，不单纯依赖 UUID
3. **日志脱敏：** 在日志中记录 UUID 时，可考虑脱敏或加密

---

## 📦 API 接口规范

### 用户相关 API

```
GET  /api/auth?action=me                # 获取当前用户（通过 JWT token）
GET  /api/users                         # 获取用户列表（管理员）
GET  /api/users?id={uuid}               # 获取特定用户
PATCH /api/auth?action=update-profile   # 更新用户资料
```

### 请求示例

**获取当前用户：**
```bash
curl -H "Authorization: Bearer {token}" \
  https://haigoo.vercel.app/api/auth?action=me
```

**获取特定用户（管理员）：**
```bash
curl https://haigoo.vercel.app/api/users?id=550e8400-e29b-41d4-a716-446655440000
```

### 响应格式

```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "username": "User_abc123",
    "avatar": "https://api.dicebear.com/...",
    "emailVerified": true,
    "createdAt": "2025-11-07T10:00:00Z",
    "lastLoginAt": "2025-11-07T12:00:00Z",
    "status": "active"
  }
}
```

---

## 🔄 UUID 迁移和兼容性

### 现有数据迁移

如果需要为现有用户添加 UUID：

```javascript
// 迁移脚本示例
async function migrateUsersToUUID() {
  const users = await getAllUsers()
  
  for (const user of users) {
    if (!user.id) {
      // 为没有 UUID 的用户生成
      user.id = crypto.randomUUID()
      await saveUser(user)
      
      // 创建 UUID 映射
      await redis.set(`haigoo:userId:${user.id}`, user.email)
    }
  }
}
```

### 向后兼容

为保持向后兼容，系统同时支持：
- 通过 UUID 查询：`/api/users?id={uuid}`
- 通过邮箱查询：后端内部使用，前端不暴露

---

## 📈 未来扩展

### 计划功能

1. **用户画像系统：** 基于 UUID 构建用户兴趣画像
2. **推荐算法优化：** 使用 UUID 追踪用户行为，优化推荐
3. **数据分析平台：** 基于 UUID 聚合用户数据，生成洞察报告
4. **跨平台同步：** UUID 作为统一标识，支持多平台数据同步

### 技术优化

1. **UUID 索引：** 在数据库中为 UUID 建立索引，提升查询性能
2. **UUID 短链：** 为分享链接生成短 UUID（base62 编码）
3. **UUID 分片：** 大规模数据场景下，使用 UUID 前缀进行数据分片

---

## 🧪 测试和验证

### 测试 UUID 生成

```javascript
// 测试 UUID 格式
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUUID(uuid) {
  return uuidRegex.test(uuid)
}

// 测试
const userId = crypto.randomUUID()
console.assert(isValidUUID(userId), 'Invalid UUID format')
```

### 验证 UUID 唯一性

```javascript
// 生成 1 百万个 UUID，检查碰撞
const uuids = new Set()
for (let i = 0; i < 1000000; i++) {
  const uuid = crypto.randomUUID()
  if (uuids.has(uuid)) {
    console.error('UUID collision detected!')
  }
  uuids.add(uuid)
}
console.log('Generated 1M unique UUIDs without collision')
```

---

## ✅ 最佳实践总结

1. ✅ **始终使用 `user.id` (UUID)** 作为用户标识，而不是邮箱或用户名
2. ✅ **在所有后端 API 和数据库中使用 UUID** 作为关联外键
3. ✅ **前端通过 AuthContext 获取 `authUser.id`** 访问当前用户 UUID
4. ✅ **日志和分析系统使用 UUID** 追踪用户行为
5. ✅ **定期备份 UUID 映射关系** 防止数据丢失

---

## 🆘 常见问题

### Q: 如何在前端获取当前用户的 UUID？

```typescript
import { useAuth } from '../contexts/AuthContext'

function MyComponent() {
  const { user } = useAuth()
  const userId = user?.id  // UUID
  
  // 使用 userId 进行 API 调用、数据追踪等
}
```

### Q: 用户更换邮箱后 UUID 会变吗？

不会。UUID 是用户的永久标识，不会因为邮箱、用户名等信息变更而改变。

### Q: 如何在管理后台查看用户 UUID？

访问 `/admin/users` 页面，用户列表中会显示每个用户的 UUID。

### Q: UUID 和邮箱，哪个更适合作为用户标识？

**UUID** 更适合作为内部标识（数据库关联、API调用），**邮箱**用于登录和用户查找。两者配合使用，互为补充。

---

## 📚 参考资料

- [RFC 4122 - UUID Specification](https://www.rfc-editor.org/rfc/rfc4122)
- [Node.js crypto.randomUUID()](https://nodejs.org/api/crypto.html#cryptorandomuuidoptions)
- [TypeScript UUID Type Definition](https://github.com/DefinitelyTyped/DefinitelyTyped)

---

**最后更新：** 2025-11-07
**维护者：** Haigoo Team

