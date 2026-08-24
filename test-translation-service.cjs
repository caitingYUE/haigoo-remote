const assert = require('node:assert/strict')

process.env.PREFERRED_TRANSLATION_PROVIDER = 'google'
process.env.VITE_ALIBABA_BAILIAN_API_KEY = 'test-key'
delete process.env.ALIBABA_BAILIAN_API_KEY
delete process.env.VITE_DEEPSEEK_API_KEY
delete process.env.DEEPSEEK_API_KEY

const service = require('./lib/services/translation-service.cjs')
service.configure({ aiEnabled: true })

const failedResponse = () => new Response('{}', { status: 503 })

async function run() {
  global.fetch = async (url) => {
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

  global.fetch = async () => failedResponse()

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

  console.log('translation service regression checks passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
