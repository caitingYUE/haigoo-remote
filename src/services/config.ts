/**
 * API 配置文件
 * 管理所有API相关的配置信息
 */

// 环境变量类型声明
declare global {
  interface ImportMetaEnv {
    readonly VITE_ALIBABA_BAILIAN_API_KEY: string
    readonly VITE_ALIBABA_BAILIAN_BASE_URL: string
    readonly VITE_APP_NAME: string
    readonly VITE_APP_VERSION: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

// 阿里百炼API配置
export const ALIBABA_BAILIAN_CONFIG = {
  // ⚠️ Security: Do not expose API Key in frontend code!
  // The frontend should call /api/ai proxy instead.
  apiKey: '', 
  baseUrl: import.meta.env.VITE_ALIBABA_BAILIAN_BASE_URL || 'https://dashscope.aliyuncs.com/api/v1',
  models: {
    // 通用对话模型
    qwen: 'qwen-plus',
    // 代码生成模型
    codeQwen: 'qwen-coder-plus',
    // 长文本模型
    qwenLong: 'qwen-long',
    // 数学模型
    qwenMath: 'qwen-math-plus'
  }
} as const

// API请求配置
export const API_CONFIG = {
  timeout: 30000, // 30秒超时
  retryAttempts: 3, // 重试次数
  retryDelay: 1000, // 重试延迟(毫秒)
  maxTokens: 2000, // 最大token数
  temperature: 0.7, // 创造性参数
} as const

// 验证API配置
export const validateConfig = (): boolean => {
  // Frontend always passes validation as it uses proxy
  return true
}

// 获取完整的API URL
export const getApiUrl = (endpoint: string): string => {
  return `${ALIBABA_BAILIAN_CONFIG.baseUrl}${endpoint}`
}

// 获取请求头
export const getHeaders = (): Record<string, string> => {
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
}