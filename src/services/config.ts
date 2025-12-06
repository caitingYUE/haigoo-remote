/**
 * API 配置文件
 * 管理所有API相关的配置信息
 */

// 环境变量类型声明
declare global {
  interface ImportMetaEnv {
    readonly VITE_ALIBABA_BAILIAN_API_KEY: string
    readonly VITE_ALIBABA_BAILIAN_BASE_URL: string
    readonly VITE_DEEPSEEK_API_KEY: string
    readonly VITE_DEEPSEEK_BASE_URL: string
    readonly VITE_APP_NAME: string
    readonly VITE_APP_VERSION: string
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv
  }
}

// 阿里百炼API配置
export const ALIBABA_BAILIAN_CONFIG = {
  apiKey: import.meta.env.VITE_ALIBABA_BAILIAN_API_KEY,
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

// DeepSeek API配置
export const DEEPSEEK_CONFIG = {
  apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY,
  baseUrl: import.meta.env.VITE_DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
  models: {
    // DeepSeek V3 (通用对话)
    chat: 'deepseek-chat',
    // DeepSeek R1 (推理模型)
    reasoner: 'deepseek-reasoner'
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
  const hasBailian = !!ALIBABA_BAILIAN_CONFIG.apiKey && !!ALIBABA_BAILIAN_CONFIG.baseUrl
  const hasDeepSeek = !!DEEPSEEK_CONFIG.apiKey && !!DEEPSEEK_CONFIG.baseUrl

  if (!hasBailian && !hasDeepSeek) {
    console.error('未配置任何AI服务API密钥，请检查环境变量 VITE_ALIBABA_BAILIAN_API_KEY 或 VITE_DEEPSEEK_API_KEY')
    return false
  }
  
  return true
}

// 获取完整的API URL
export const getApiUrl = (endpoint: string): string => {
  return `${ALIBABA_BAILIAN_CONFIG.baseUrl}${endpoint}`
}

// 获取请求头
export const getHeaders = (): Record<string, string> => {
  return {
    'Authorization': `Bearer ${ALIBABA_BAILIAN_CONFIG.apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
}