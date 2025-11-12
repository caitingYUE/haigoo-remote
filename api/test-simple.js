/**
 * 最简单的测试接口 - 逐步诊断问题
 */

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  const diagnostics = {
    step1_basic: 'OK',
    step2_moduleLoad: null,
    step3_functionCheck: null,
    step4_googleTranslate: null,
    errors: []
  }

  try {
    // Step 2: 尝试加载翻译服务模块
    let translationService = null
    try {
      translationService = require('../lib/services/translation-service')
      diagnostics.step2_moduleLoad = 'OK'
      diagnostics.step3_functionCheck = {
        hasTranslateJobs: typeof translationService.translateJobs === 'function',
        hasTranslateBatch: typeof translationService.translateBatch === 'function',
        availableFunctions: Object.keys(translationService)
      }
    } catch (error) {
      diagnostics.step2_moduleLoad = 'FAILED'
      diagnostics.errors.push({
        step: 'moduleLoad',
        message: error.message,
        stack: error.stack
      })
    }

    // Step 4: 尝试导入google-translate-api（这可能是问题所在）
    try {
      const googleTranslate = require('@vitalets/google-translate-api')
      diagnostics.step4_googleTranslate = {
        loaded: true,
        type: typeof googleTranslate,
        keys: Object.keys(googleTranslate || {})
      }
    } catch (error) {
      diagnostics.step4_googleTranslate = 'FAILED'
      diagnostics.errors.push({
        step: 'googleTranslate',
        message: error.message,
        stack: error.stack
      })
    }

    return res.json({
      success: diagnostics.errors.length === 0,
      diagnostics,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        vercel: !!process.env.VERCEL,
        vercelEnv: process.env.VERCEL_ENV
      }
    })

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: 'Critical failure',
      message: error.message,
      stack: error.stack,
      diagnostics
    })
  }
}

