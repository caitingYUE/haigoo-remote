/**
 * 环境配置文件
 * 用于统一管理不同环境下的配置
 */

export const ENV = {
  // 环境判断
  isDevelopment: process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === 'preview',
  isProduction: process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production',
  isLocal: !process.env.VERCEL,

  // 基础配置
  nodeEnv: process.env.NODE_ENV || 'development',
  vercelEnv: process.env.VERCEL_ENV || 'development',
  
  // 站点配置
  siteUrl: process.env.SITE_URL || process.env.VERCEL_URL || 'http://localhost:3001',
  
  // Redis 配置
  redisUrl: process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || null,
  
  // Vercel KV 配置
  kvUrl: process.env.KV_REST_API_URL || null,
  kvToken: process.env.KV_REST_API_TOKEN || null,
  
  // 认证配置
  jwtSecret: process.env.JWT_SECRET || 'local-dev-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '30d',
  
  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  
  // SMTP 配置
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587'),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  fromEmail: process.env.FROM_EMAIL || 'noreply@haigoo.com',
}

/**
 * 获取当前环境名称
 */
export const getEnvironmentName = (): string => {
  if (ENV.isLocal) return 'Local'
  if (ENV.isProduction) return 'Production'
  if (ENV.isDevelopment) return 'Development'
  return 'Unknown'
}

/**
 * 获取环境显示颜色（用于日志）
 */
export const getEnvironmentColor = (): string => {
  if (ENV.isProduction) return '\x1b[31m' // 红色
  if (ENV.isDevelopment) return '\x1b[33m' // 黄色
  return '\x1b[36m' // 青色（本地）
}

/**
 * 打印环境信息（非生产环境）
 */
export const logEnvironmentInfo = () => {
  if (ENV.isProduction) return // 生产环境不打印详细信息

  const color = getEnvironmentColor()
  const reset = '\x1b[0m'
  const envName = getEnvironmentName()

  console.log('\n' + '='.repeat(60))
  console.log(`${color}[Environment] ${envName} Mode${reset}`)
  console.log(`[Environment] Node Version: ${process.version}`)
  console.log(`[Environment] Site URL: ${ENV.siteUrl}`)
  console.log(`[Environment] Redis: ${ENV.redisUrl ? '✓ Configured' : '✗ Not configured'}`)
  console.log(`[Environment] Vercel KV: ${ENV.kvUrl ? '✓ Configured' : '✗ Not configured'}`)
  console.log(`[Environment] Google OAuth: ${ENV.googleClientId ? '✓ Configured' : '✗ Not configured'}`)
  console.log(`[Environment] SMTP: ${ENV.smtpHost ? '✓ Configured' : '✗ Not configured'}`)
  console.log('='.repeat(60) + '\n')
}

/**
 * 验证必需的环境变量
 */
export const validateEnvironment = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = []

  // 生产环境必需的配置
  if (ENV.isProduction) {
    if (!ENV.redisUrl && !ENV.kvUrl) {
      errors.push('生产环境必须配置 Redis 或 Vercel KV')
    }
    if (ENV.jwtSecret === 'local-dev-secret-key-change-in-production') {
      errors.push('生产环境必须配置真实的 JWT_SECRET')
    }
    if (!ENV.smtpHost) {
      errors.push('生产环境建议配置 SMTP 服务')
    }
  }

  // 开发环境建议的配置
  if (ENV.isDevelopment) {
    if (!ENV.redisUrl && !ENV.kvUrl) {
      console.warn('[Warning] 开发环境未配置 Redis/KV，将使用内存存储')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * 获取数据库Key前缀（用于隔离不同环境的数据）
 */
export const getDataKeyPrefix = (): string => {
  if (ENV.isProduction) return 'haigoo:prod:'
  if (ENV.isDevelopment) return 'haigoo:dev:'
  return 'haigoo:local:'
}

// 导出配置对象
export default ENV

