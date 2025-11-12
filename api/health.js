/**
 * Health check endpoint
 * 增强版：显示环境配置和功能状态，便于调试预发/生产环境
 */
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  // 判断当前环境
  const nodeEnv = process.env.NODE_ENV || 'development'
  const vercelEnv = process.env.VERCEL_ENV || 'development'
  const isProduction = nodeEnv === 'production' && vercelEnv === 'production'
  const isPreview = vercelEnv === 'preview'
  const isLocal = !process.env.VERCEL
  
  let environmentName = 'Unknown'
  if (isLocal) environmentName = 'Local'
  else if (isProduction) environmentName = 'Production'
  else if (isPreview) environmentName = 'Preview'
  else environmentName = 'Development'
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    
    // 🆕 环境信息（增强）
    environment: {
      name: environmentName,
      nodeEnv: nodeEnv,
      vercelEnv: vercelEnv,
      isProduction: isProduction,
      isPreview: isPreview,
      isLocal: isLocal,
      vercelUrl: process.env.VERCEL_URL || 'Not set',
      siteUrl: process.env.SITE_URL || process.env.VERCEL_URL || 'Not set'
    },
    
    // Node.js版本
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    },
    
    // 🆕 关键功能配置状态
    features: {
      // 数据存储
      redis: Boolean(
        process.env.REDIS_URL || 
        process.env.haigoo_REDIS_URL || 
        process.env.HAIGOO_REDIS_URL || 
        process.env.UPSTASH_REDIS_URL
      ),
      vercelKV: Boolean(
        process.env.KV_REST_API_URL && 
        process.env.KV_REST_API_TOKEN
      ),
      
      // 🆕 翻译功能（关键）
      autoTranslation: process.env.ENABLE_AUTO_TRANSLATION === 'true',
      
      // 🆕 Cron任务
      cronSecret: Boolean(process.env.CRON_SECRET),
      
      // 认证相关
      googleOAuth: Boolean(process.env.GOOGLE_CLIENT_ID),
      jwtSecret: Boolean(process.env.JWT_SECRET),
      
      // SMTP邮件
      smtp: Boolean(process.env.SMTP_HOST)
    },
    
    // API端点列表
    endpoints: {
      'health': '/api/health',
      'cron-sync-jobs': '/api/cron/sync-jobs',
      'processed-jobs': '/api/data/processed-jobs',
      'recommendations': '/api/recommendations',
      'rss-proxy': '/api/rss-proxy',
      'parse-resume': '/api/parse-resume-new',
      'storage-stats': '/api/storage/stats'
    },
    
    // 🆕 环境变量配置建议
    recommendations: []
  }
  
  // 🆕 根据环境给出配置建议
  if (isProduction) {
    if (!health.features.redis && !health.features.vercelKV) {
      health.recommendations.push('⚠️ 生产环境建议配置 Redis 或 Vercel KV 以持久化数据')
    }
    if (!health.features.autoTranslation) {
      health.recommendations.push('⚠️ 自动翻译功能未启用，请设置 ENABLE_AUTO_TRANSLATION=true')
    }
    if (!health.features.cronSecret) {
      health.recommendations.push('⚠️ Cron任务密钥未配置，请设置 CRON_SECRET')
    }
  }
  
  if (isPreview) {
    if (!health.features.autoTranslation) {
      health.recommendations.push('❌ Preview环境：自动翻译功能未启用！请在Vercel环境变量中为Preview环境设置 ENABLE_AUTO_TRANSLATION=true')
    }
    if (!health.features.cronSecret) {
      health.recommendations.push('⚠️ Preview环境：Cron任务密钥未配置，手动触发翻译功能可能受限，请设置 CRON_SECRET')
    }
    if (!health.features.redis && !health.features.vercelKV) {
      health.recommendations.push('💡 Preview环境：未配置存储，数据将使用内存存储（重启后丢失）')
    }
  }
  
  // 添加状态总结
  health.summary = `Environment: ${environmentName} | Translation: ${health.features.autoTranslation ? '✅' : '❌'} | Storage: ${health.features.vercelKV ? 'KV✅' : health.features.redis ? 'Redis✅' : '❌'}`
  
  res.status(200).json(health)
}
