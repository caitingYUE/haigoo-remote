/**
 * 测试翻译服务是否正常工作
 * 用于诊断翻译功能的问题
 */

// 使用 CommonJS 导入翻译服务
// 优先使用真实翻译服务，失败则使用Mock服务
let translateService = null
let serviceType = 'none'

try {
  translateService = require('../lib/services/translation-service')
  serviceType = 'real'
  console.log('✅ 测试接口：真实翻译服务加载成功', Object.keys(translateService))
} catch (error) {
  console.warn('⚠️ 测试接口：真实翻译服务加载失败，尝试Mock服务:', error.message)
  
  try {
    translateService = require('../lib/services/translation-service-mock')
    serviceType = 'mock'
    console.log('✅ 测试接口：Mock翻译服务加载成功', Object.keys(translateService))
  } catch (mockError) {
    console.error('❌ 测试接口：Mock翻译服务也加载失败:', mockError.message, mockError.stack)
  }
}

// 使用 CommonJS 导出
module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    // 1. 检查翻译服务是否加载
    if (!translateService) {
      return res.status(500).json({
        success: false,
        error: '翻译服务未加载',
        message: '无法导入translation-service模块'
      })
    }

    // 2. 检查translateJobs函数是否存在
    if (!translateService.translateJobs) {
      return res.status(500).json({
        success: false,
        error: 'translateJobs函数不存在',
        availableFunctions: Object.keys(translateService)
      })
    }

    // 3. 测试简单的翻译
    console.log('🧪 开始测试翻译功能...')
    const testJob = {
      id: 'test-1',
      title: 'Senior Software Engineer',
      description: 'We are looking for a senior software engineer',
      location: 'Remote',
      company: 'Test Company',
      isTranslated: false
    }

    const result = await translateService.translateJobs([testJob])
    
    console.log('✅ 翻译测试完成:', result)

    return res.json({
      success: true,
      message: `翻译服务正常 (使用${serviceType === 'mock' ? 'Mock' : '真实'}翻译)`,
      serviceType,
      testInput: testJob,
      testOutput: result[0],
      serviceInfo: {
        moduleLoaded: true,
        functionExists: true,
        availableFunctions: Object.keys(translateService),
        isMock: serviceType === 'mock'
      }
    })
  } catch (error) {
    console.error('❌ 翻译测试失败:', error)
    return res.status(500).json({
      success: false,
      error: '翻译测试失败',
      message: error.message,
      stack: error.stack,
      name: error.name
    })
  }
}

