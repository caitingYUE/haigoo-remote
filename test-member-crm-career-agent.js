import assert from 'node:assert/strict'

process.env.ALIBABA_BAILIAN_API_KEY = 'test-key'

const {
  buildResumeDiagnosisFingerprint,
  isAllowedQwenCnEndpoint,
  redactResumeForModel,
  resumeDiagnosisArtifactSchema,
  runResumeDiagnosis
} = await import('./lib/services/member-crm-career-agent.js')

assert.equal(isAllowedQwenCnEndpoint('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'), true)
assert.equal(isAllowedQwenCnEndpoint('https://cn-beijing.dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'), true)
assert.equal(isAllowedQwenCnEndpoint('http://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'), false)
assert.equal(isAllowedQwenCnEndpoint('https://dashscope.aliyuncs.com.example.com/chat/completions'), false)

const redacted = redactResumeForModel(`姓名：Test User
邮箱：test@example.com
电话：+86 138 1234 5678
LinkedIn: https://linkedin.com/in/test
产品经理，负责跨境 SaaS 产品路线图和用户研究。`)

assert.equal(redacted.includes('test@example.com'), false)
assert.equal(redacted.includes('138 1234 5678'), false)
assert.equal(redacted.includes('linkedin.com'), false)
assert.equal(redacted.includes('跨境 SaaS 产品路线图'), true)
assert.equal(redactResumeForModel('工作经历：2018-2022').includes('2018-2022'), true)

const first = buildResumeDiagnosisFingerprint({ resumeText: 'resume', crmContext: 'context', model: 'qwen-plus' })
const second = buildResumeDiagnosisFingerprint({ resumeText: 'resume', crmContext: 'context', model: 'qwen-plus' })
const changed = buildResumeDiagnosisFingerprint({ resumeText: 'resume', crmContext: 'changed', model: 'qwen-plus' })
assert.equal(first, second)
assert.notEqual(first, changed)

const parsed = resumeDiagnosisArtifactSchema.parse({
  schemaVersion: 'member-crm-resume-diagnosis-v1',
  summary: { headline: '产品与增长复合型候选人', positioning: '具备产品规划与用户研究经验。', consultantBrief: '优先补充量化成果。' },
  evidenceLedger: [{ id: 'E1', category: 'responsibility', statement: '负责产品路线图', sourceExcerpt: '负责跨境 SaaS 产品路线图', grade: 'A' }],
  strengths: [{ title: '产品规划', explanation: '有直接职责证据。', confidence: 'high', evidenceIds: ['E1'] }],
  findings: [{ category: 'content', severity: 'high', title: '成果不足', detail: '缺少结果描述。', recommendation: '补充范围和结果。', evidenceIds: ['E1'] }],
  candidateProfile: {
    headline: '产品经理', seniority: 'mid', primaryFunctions: ['产品管理'], transferableSkills: ['用户研究'],
    domainAssets: ['SaaS'], workStyleStrengths: [], languages: [], tools: [], targetRolesNow: ['产品经理'],
    targetRolesBridge: [], targetRolesLater: [], evidenceGaps: ['量化结果'], unverifiedClaims: []
  },
  careerPaths: { now: [], bridge: [], later: [] },
  clarificationQuestions: [],
  quality: { verifiedEvidenceCount: 1, rejectedEvidenceCount: 0, warnings: [] },
  localProfile: {}
})
assert.equal(parsed.evidenceLedger.length, 1)

const modelPayload = {
  schemaVersion: 'member-crm-resume-diagnosis-v1',
  summary: { headline: '跨境产品候选人', positioning: '具备产品规划和用户研究经验。', consultantBrief: '优先核实业务成果。' },
  evidenceLedger: [{ id: 'E1', category: 'responsibility', statement: '负责产品路线图', sourceExcerpt: '负责跨境 SaaS 产品路线图和用户研究', grade: 'A' }],
  strengths: [{ title: '产品规划', explanation: '职责中有明确依据。', confidence: 'high', evidenceIds: ['E1'] }],
  findings: [{ category: 'content', severity: 'high', title: '成果表达不足', detail: '缺少结果信息。', recommendation: '在访谈中补充结果。', evidenceIds: ['E1'] }],
  candidateProfile: {
    headline: '跨境 SaaS 产品经理', seniority: 'mid', primaryFunctions: ['产品管理'], transferableSkills: ['用户研究'],
    domainAssets: ['SaaS'], workStyleStrengths: [], languages: [], tools: [], targetRolesNow: ['产品经理'],
    targetRolesBridge: [], targetRolesLater: [], evidenceGaps: ['业务结果'], unverifiedClaims: []
  },
  careerPaths: { now: [], bridge: [], later: [] },
  clarificationQuestions: [{ question: '路线图最终带来了什么结果？', reason: '结果会影响成果表述。', priority: 'high' }]
}
const originalFetch = globalThis.fetch
globalThis.fetch = async () => new Response(JSON.stringify({
  model: 'qwen-plus',
  choices: [{ message: { content: JSON.stringify(modelPayload) } }],
  usage: { prompt_tokens: 100, completion_tokens: 80 }
}), { status: 200, headers: { 'Content-Type': 'application/json' } })
const diagnosis = await runResumeDiagnosis({
  resumeText: '产品经理，负责跨境 SaaS 产品路线图和用户研究。参与需求分析、方案评审和版本交付，并与设计、研发团队持续协作。曾负责整理客户反馈、制定季度优先级、推进上线复盘，并持续协调跨职能团队完成产品交付。',
  crmContext: '目标是申请远程产品岗位。'
})
globalThis.fetch = originalFetch
assert.equal(diagnosis.artifact.evidenceLedger[0].id, 'E1')
assert.equal(diagnosis.artifact.quality.verifiedEvidenceCount, 1)
assert.equal(diagnosis.usage.prompt_tokens, 100)

console.log('Member CRM career agent contract tests passed')
