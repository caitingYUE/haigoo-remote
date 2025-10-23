# AI服务模块

这是一个完整的AI服务模块，基于阿里百炼模型API，为简历优化、职位匹配、面试准备等功能提供支持。

## 快速开始

### 1. 环境配置

首先，确保已正确配置环境变量：

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填入你的API密钥
ALIBABA_BAILIAN_API_KEY=your_api_key_here
ALIBABA_BAILIAN_BASE_URL=https://dashscope.aliyuncs.com/api/v1
ALIBABA_BAILIAN_APP_NAME=Haigoo_Assistant
ALIBABA_BAILIAN_VERSION=1.0.0
```

### 2. 基本使用

```typescript
import { resumeService, jobService } from './services'

// 简历优化
const optimizeResult = await resumeService.optimizeResume({
  resumeContent: '你的简历内容',
  jobDescription: '目标职位描述',
  optimizationType: 'job-specific'
})

// 职位匹配
const matchResult = await jobService.analyzeJobMatch({
  resumeContent: '你的简历内容',
  jobDescription: '职位描述'
})
```

## 模块结构

```
src/services/
├── index.ts              # 统一导出入口
├── config.ts             # API配置管理
├── types.ts              # TypeScript类型定义
├── http-client.ts        # HTTP客户端封装
├── error-handler.ts      # 错误处理和重试机制
├── ai-service.ts         # AI服务核心模块
├── resume-service.ts     # 简历相关服务
├── job-service.ts        # 职位相关服务
├── examples.ts           # 使用示例
└── README.md            # 文档说明
```

## 核心服务

### AI服务 (AIService)

基础的AI服务，提供与阿里百炼API的交互能力。

```typescript
import { aiService } from './services'

// 发送消息
const response = await aiService.sendMessage([
  aiService.createSystemMessage('你是一个专业的简历顾问'),
  aiService.createUserMessage('请帮我优化这份简历')
])

// 检查服务健康状态
const isHealthy = await aiService.checkServiceHealth()

// 获取可用模型
const models = aiService.getAvailableModels()
```

### 简历服务 (ResumeService)

提供简历优化和分析功能。

```typescript
import { resumeService } from './services'

// 简历优化
const result = await resumeService.optimizeResume({
  resumeContent: '原始简历内容',
  jobDescription: '目标职位描述',
  targetPosition: '目标职位名称',
  optimizationType: 'job-specific' // 'general' | 'job-specific' | 'skills' | 'format'
})

if (result.success) {
  console.log('优化后的简历:', result.data.optimizedResume)
  console.log('改进建议:', result.data.suggestions)
  console.log('评分:', result.data.score)
}
```

### 职位服务 (JobService)

提供职位匹配、推荐、面试准备等功能。

```typescript
import { jobService } from './services'

// 职位匹配分析
const matchResult = await jobService.analyzeJobMatch({
  resumeContent: '简历内容',
  jobDescription: '职位描述',
  requirements: ['技能要求1', '技能要求2']
})

// 职位推荐
const recommendResult = await jobService.recommendJobs({
  userProfile: {
    skills: ['JavaScript', 'React', 'Node.js'],
    experience: '工作经验描述',
    preferences: {
      location: '北京',
      salary: { min: 15000, max: 30000 },
      jobType: '全职',
      industry: ['互联网', '金融科技']
    }
  },
  limit: 5
})

// 面试准备
const interviewResult = await jobService.prepareInterview({
  jobDescription: '职位描述',
  resumeContent: '简历内容',
  interviewType: 'technical' // 'technical' | 'behavioral' | 'general'
})

// 技能评估
const assessmentResult = await jobService.assessSkills({
  skills: ['JavaScript', 'React', 'Node.js'],
  experience: '工作经验描述',
  jobRequirements: ['职位技能要求']
})
```

## 错误处理

模块内置了完善的错误处理和重试机制：

```typescript
import { errorHandler, ErrorType } from './services'

// 使用错误处理器执行操作
const result = await errorHandler.executeWithRetry(
  async () => {
    // 你的异步操作
    return await someApiCall()
  },
  {
    maxRetries: 3,
    baseDelay: 1000,
    retryableErrors: [ErrorType.NETWORK_ERROR, ErrorType.TIMEOUT]
  }
)

// 使用装饰器自动重试
class MyService {
  @withRetry({ maxRetries: 3 })
  async myMethod() {
    // 方法会自动重试
  }
}
```

## 类型定义

所有服务都有完整的TypeScript类型支持：

```typescript
import type {
  ResumeOptimizationRequest,
  ResumeOptimizationResponse,
  JobMatchRequest,
  JobMatchResponse,
  ApiResponse,
  ApiError
} from './services'

// 所有API响应都遵循统一格式
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  errorType?: string
  errorCode?: string
}
```

## 配置选项

### API配置

```typescript
import { ALIBABA_BAILIAN_CONFIG } from './services'

// 查看当前配置
console.log(ALIBABA_BAILIAN_CONFIG)

// 配置包含：
// - apiKey: API密钥
// - baseUrl: API基础URL
// - models: 可用模型列表
// - timeout: 请求超时时间
// - retries: 重试次数
// - maxTokens: 最大token数
// - temperature: 生成温度
```

### 重试配置

```typescript
const customRetryConfig = {
  maxRetries: 5,           // 最大重试次数
  baseDelay: 2000,         // 基础延迟时间(ms)
  maxDelay: 30000,         // 最大延迟时间(ms)
  backoffMultiplier: 2,    // 退避倍数
  retryableErrors: [       // 可重试的错误类型
    'NETWORK_ERROR',
    'TIMEOUT',
    'RATE_LIMIT'
  ]
}
```

## 使用示例

查看 `examples.ts` 文件获取完整的使用示例：

```typescript
import { runAllExamples } from './services/examples'

// 运行所有示例
await runAllExamples()
```

## 注意事项

1. **API密钥安全**: 确保API密钥存储在环境变量中，不要提交到版本控制
2. **请求频率**: 注意API调用频率限制，避免触发限流
3. **错误处理**: 始终检查API响应的 `success` 字段
4. **Token限制**: 注意输入文本的长度，避免超过模型的token限制
5. **网络环境**: 确保网络环境可以访问阿里云API服务

## 调试技巧

1. **启用详细日志**:
   ```typescript
   // 在开发环境中启用详细日志
   console.log('API请求:', request)
   console.log('API响应:', response)
   ```

2. **检查服务状态**:
   ```typescript
   const isHealthy = await aiService.checkServiceHealth()
   if (!isHealthy) {
     console.error('AI服务不可用')
   }
   ```

3. **验证配置**:
   ```typescript
   import { validateConfig } from './services'
   
   const configValid = validateConfig()
   if (!configValid) {
     console.error('配置验证失败')
   }
   ```

## 性能优化

1. **批量处理**: 对于多个请求，考虑批量处理以减少网络开销
2. **缓存结果**: 对于相同的输入，可以缓存API响应结果
3. **并发控制**: 控制并发请求数量，避免触发限流
4. **超时设置**: 合理设置请求超时时间

## 贡献指南

1. 遵循现有的代码风格和命名规范
2. 添加适当的类型定义和注释
3. 编写单元测试覆盖新功能
4. 更新相关文档

## 许可证

本项目采用 MIT 许可证。