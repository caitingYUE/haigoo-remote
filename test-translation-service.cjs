const assert = require('node:assert/strict')

process.env.PREFERRED_TRANSLATION_PROVIDER = 'google'
process.env.TRANSLATION_AI_REQUEST_TIMEOUT_MS = '30000'
process.env.TRANSLATION_REQUEST_TIMEOUT_MS = '8000'
process.env.VITE_ALIBABA_BAILIAN_API_KEY = 'test-key'
delete process.env.ALIBABA_BAILIAN_API_KEY
delete process.env.VITE_DEEPSEEK_API_KEY
delete process.env.DEEPSEEK_API_KEY

const service = require('./lib/services/translation-service.cjs')
service.configure({ aiEnabled: true })

const timeoutDurations = []
const originalAbortSignalTimeout = AbortSignal.timeout
AbortSignal.timeout = (milliseconds) => {
  timeoutDurations.push(milliseconds)
  return originalAbortSignalTimeout(milliseconds)
}

const failedResponse = () => new Response('{}', { status: 503 })

async function run() {
  const providerLogs = []
  const originalLog = console.log
  const originalWarn = console.warn
  console.log = (...args) => providerLogs.push(args.join(' '))
  console.warn = (...args) => providerLogs.push(args.join(' '))

  try {
    global.fetch = async (url, options) => {
      assert.ok(options.signal, 'all translation providers must have a request timeout signal')
      if (!String(url).includes('dashscope.aliyuncs.com')) return failedResponse()

      return new Response(JSON.stringify({
        choices: [{ message: { content: '财务运营专员，负责本地实体的财务管理与合规工作。' } }],
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    const translated = await service.translateJob({
      id: 'bailian-compatible-response',
      title: 'Financial Operations Specialist',
      description: 'Manage finance operations and compliance for a local entity.',
      requirements: [],
      benefits: []
    }, true)

    assert.equal(translated.isTranslated, true)
    assert.match(translated.translations.description, /[\u4e00-\u9fa5]/)
    assert.equal(translated.translationError, undefined)

    global.fetch = async (_url, options) => {
      assert.ok(options.signal, 'fallback providers must have a request timeout signal')
      return failedResponse()
    }

    const failed = await service.translateJob({
      id: 'all-providers-failed',
      title: 'Unique untranslated role',
      description: 'Unique source description that no provider translated.',
      requirements: [],
      benefits: []
    }, true)

    assert.equal(failed.isTranslated, false)
    assert.equal(failed.translations, null)
    assert.equal(failed.translationError, 'Zero Chinese Characters')

    assert(providerLogs.some(line => line.includes('[translation-provider]') && line.includes('"provider":"Google Translate"') && line.includes('"status":"failed"')))
    assert(providerLogs.some(line => line.includes('[translation-provider]') && line.includes('"provider":"Bailian"') && line.includes('"status":"success"')))
    assert(providerLogs.some(line => line.includes('"event":"exhausted"') && line.includes('"jobId":"all-providers-failed"')))
    assert.equal(providerLogs.some(line => line.includes('Manage finance operations')), false)

    service.configure({ aiEnabled: true, aiFirst: true })
    const aiChunkLengths = []
    global.fetch = async (url, options) => {
      assert.ok(options.signal, 'AI requests must have a timeout signal')
      if (String(url).includes('dashscope.aliyuncs.com')) {
        const body = JSON.parse(options.body)
        aiChunkLengths.push(body.messages?.[1]?.content?.length || 0)
        return new Response(JSON.stringify({
          choices: [{ message: { content: '这是中文翻译结果。' } }],
          usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return failedResponse()
    }

    const longDescription = 'This is a detailed responsibility statement for the role. '.repeat(170)
    const longDescriptionJob = await service.translateJob({
      id: 'bailian-long-description',
      title: 'Long Description Role',
      description: longDescription,
      requirements: [],
      benefits: []
    }, true)

    assert.equal(longDescriptionJob.isTranslated, true)
    assert.ok(aiChunkLengths.length > 2, 'long AI input should be split into multiple requests')
    assert.ok(aiChunkLengths.every(length => length <= 4000), 'AI chunks must respect the provider limit')
    assert.ok(timeoutDurations.includes(30000), 'AI requests should use the longer timeout')

    service.configure({ aiEnabled: false, aiFirst: false })
    const memoryUrls = []
    global.fetch = async (url, options) => {
      assert.ok(options.signal, 'fallback providers must have a request timeout signal')
      if (String(url).includes('api.mymemory.translated.net')) {
        memoryUrls.push(String(url))
        return new Response(JSON.stringify({
          responseStatus: 200,
          responseData: { translatedText: '中文翻译结果。', match: 100 }
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      return failedResponse()
    }

    const memoryFallback = await service.translateJob({
      id: 'mymemory-auto-source',
      title: 'Fallback Role',
      description: 'Fallback description for MyMemory.',
      requirements: [],
      benefits: []
    }, true)

    assert.equal(memoryFallback.isTranslated, true)
    assert.ok(memoryUrls.length > 0, 'MyMemory fallback should be attempted')
    assert.ok(memoryUrls.every(url => url.includes('langpair=en|zh') && !url.includes('langpair=auto|zh')))
  } finally {
    console.log = originalLog
    console.warn = originalWarn
    AbortSignal.timeout = originalAbortSignalTimeout
  }

  console.log('translation service regression checks passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
