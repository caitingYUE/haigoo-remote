import { z } from 'zod'
import neonHelper from '../../server-utils/dal/neon-helper.js'
import userHelper from '../../server-utils/user-helper.js'
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js'
import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js'
import {
  buildResumeDiagnosisFingerprint,
  candidateProfileSchema,
  CareerAgentError,
  getResumeDiagnosisModel,
  hashText,
  RESUME_DIAGNOSIS_PROMPT_VERSION,
  RESUME_DIAGNOSIS_WORKFLOW_VERSION,
  runResumeDiagnosis
} from '../../lib/services/member-crm-career-agent.js'

const CRM_MEMBER_TYPES = ['starter', 'half_year', 'annual', 'trial_week', 'quarter', 'quarter_pro', 'year']
const userIdSchema = z.string().trim().min(1).max(255)
const runSchema = z.object({
  userId: userIdSchema,
  workflowKey: z.literal('resume_diagnosis'),
  sourceResumeKind: z.enum(['crm', 'user']),
  sourceResumeId: z.string().trim().min(1).max(255),
  includeCrmContext: z.boolean().optional().default(true),
  consultantFocus: z.string().trim().max(1000).optional().default(''),
  force: z.boolean().optional().default(false)
})
const artifactSchema = z.object({
  userId: userIdSchema,
  artifactId: z.string().uuid(),
  action: z.enum(['approve', 'archive', 'update_notes', 'update_profile']),
  consultantNotes: z.string().max(10000).optional().default(''),
  candidateProfile: candidateProfileSchema.optional()
}).superRefine((value, context) => {
  if (value.action === 'update_profile' && !value.candidateProfile) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['candidateProfile'], message: '缺少候选人画像' })
  }
})

function isLocalDevRuntime() {
  return process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production'
}

function isSuperAdminUser(user) {
  const email = String(user?.email || '').trim().toLowerCase()
  return Boolean(user?.roles?.super_admin || SUPER_ADMIN_EMAILS.includes(email) || (isLocalDevRuntime() && email === 'test_admin@haigoo.com'))
}

async function requireSuperAdmin(req, res) {
  const token = extractToken(req)
  const payload = token ? verifyToken(token) : null
  const user = payload?.userId ? await userHelper.getUserById(payload.userId) : null
  if (!isSuperAdminUser(user)) {
    res.status(403).json({ success: false, error: '仅超级管理员可使用 CRM 顾问工具' })
    return null
  }
  return user
}

function parseJson(value, fallback = {}) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try { return JSON.parse(value) } catch { return fallback }
}

function mapRun(row) {
  return {
    id: row.id,
    userId: row.user_id,
    workflowKey: row.workflow_key,
    status: row.status,
    sourceResumeKind: row.source_resume_kind,
    sourceResumeId: row.source_resume_id,
    sourceResumeName: row.source_resume_name,
    provider: row.provider,
    model: row.model,
    tokenUsage: parseJson(row.token_usage),
    inputOptions: parseJson(row.input_options),
    errorCode: row.error_code || null,
    errorMessage: row.error_message || null,
    createdAt: row.created_at,
    completedAt: row.completed_at || null,
    cached: Boolean(row.cached)
  }
}

function mapArtifact(row) {
  if (!row?.artifact_id) return null
  return {
    id: row.artifact_id,
    runId: row.run_id || row.id,
    artifactType: row.artifact_type,
    version: Number(row.artifact_version || row.version || 1),
    status: row.artifact_status || row.status,
    content: parseJson(row.artifact_content || row.content),
    sourceRefs: parseJson(row.source_refs),
    consultantNotes: row.consultant_notes || '',
    approvedAt: row.approved_at || null,
    createdAt: row.artifact_created_at || row.created_at,
    approvedByName: row.approved_by_name || ''
  }
}

async function loadWorkspace(userId) {
  await neonHelper.query(`UPDATE member_crm_agent_runs SET status='failed', error_code='RUN_INTERRUPTED',
      error_message='任务执行中断，请重新运行', completed_at=NOW(), updated_at=NOW()
    WHERE user_id=$1 AND status='running' AND started_at < NOW() - INTERVAL '5 minutes'`, [userId])
  const memberRows = await neonHelper.query('SELECT user_id FROM users WHERE user_id=$1 AND member_type=ANY($2)', [userId, CRM_MEMBER_TYPES])
  if (!memberRows?.[0]) return null
  const rows = await neonHelper.query(`SELECT r.*,
      a.id AS artifact_id, a.artifact_type, a.version AS artifact_version,
      a.status AS artifact_status, a.content AS artifact_content, a.source_refs,
      a.consultant_notes, a.approved_at, a.created_at AS artifact_created_at,
      COALESCE(approver.username, approver.email, '') AS approved_by_name
    FROM member_crm_agent_runs r
    LEFT JOIN member_crm_agent_artifacts a ON a.run_id=r.id
    LEFT JOIN users approver ON approver.user_id=a.approved_by
    WHERE r.user_id=$1 ORDER BY r.created_at DESC LIMIT 30`, [userId])
  return {
    modelConfigured: Boolean(process.env.ALIBABA_BAILIAN_API_KEY || process.env.BAILIAN_API_KEY),
    provider: 'Qwen 内地端',
    model: getResumeDiagnosisModel(),
    runs: (rows || []).map((row) => ({ ...mapRun(row), artifact: mapArtifact(row) }))
  }
}

async function loadResume(input) {
  const query = input.sourceResumeKind === 'crm'
    ? `SELECT d.id::text AS id, d.file_name, d.content_text
       FROM member_crm_resume_documents d JOIN users u ON u.user_id=d.user_id
       WHERE d.id::text=$1 AND d.user_id=$2 AND u.member_type=ANY($3) LIMIT 1`
    : `SELECT r.resume_id::text AS id, r.file_name, r.content_text
       FROM resumes r JOIN users u ON u.user_id=r.user_id
       WHERE r.resume_id::text=$1 AND r.user_id=$2 AND u.member_type=ANY($3) LIMIT 1`
  const rows = await neonHelper.query(query, [input.sourceResumeId, input.userId, CRM_MEMBER_TYPES])
  return rows?.[0] || null
}

async function loadCrmContext(userId) {
  const rows = await neonHelper.query(`SELECT background_summary, detailed_background, primary_needs,
      pain_points, service_plan FROM member_crm_profiles WHERE user_id=$1`, [userId])
  const row = rows?.[0] || {}
  return [
    ['背景摘要', row.background_summary],
    ['详细背景', row.detailed_background],
    ['需求与目标', row.primary_needs],
    ['主要痛点', row.pain_points],
    ['服务方案', row.service_plan]
  ].filter(([, value]) => String(value || '').trim()).map(([label, value]) => `${label}：${value}`).join('\n')
}

async function findCachedRun(userId, fingerprint) {
  const rows = await neonHelper.query(`SELECT r.*,
      a.id AS artifact_id, a.artifact_type, a.version AS artifact_version,
      a.status AS artifact_status, a.content AS artifact_content, a.source_refs,
      a.consultant_notes, a.approved_at, a.created_at AS artifact_created_at,
      COALESCE(approver.username, approver.email, '') AS approved_by_name
    FROM member_crm_agent_runs r
    JOIN member_crm_agent_artifacts a ON a.run_id=r.id
    LEFT JOIN users approver ON approver.user_id=a.approved_by
    WHERE r.user_id=$1 AND r.input_fingerprint=$2 AND r.status='completed' AND a.status<>'archived'
    ORDER BY r.created_at DESC LIMIT 1`, [userId, fingerprint])
  const row = rows?.[0]
  return row ? { ...mapRun({ ...row, cached: true }), artifact: mapArtifact(row) } : null
}

async function createRun(input, resume, crmContext, adminId) {
  const sourceHash = hashText(resume.content_text || '')
  const fingerprint = buildResumeDiagnosisFingerprint({
    resumeText: resume.content_text || '',
    crmContext,
    model: getResumeDiagnosisModel()
  })
  if (!input.force) {
    const cached = await findCachedRun(input.userId, fingerprint)
    if (cached) return cached
  }

  const inputOptions = { includeCrmContext: input.includeCrmContext, consultantFocus: input.consultantFocus }
  const inserted = await neonHelper.query(`INSERT INTO member_crm_agent_runs
      (user_id, workflow_key, status, source_resume_kind, source_resume_id, source_resume_name,
       source_resume_hash, input_fingerprint, input_options, skill_versions, provider, model, created_by)
    VALUES ($1,$2,'running',$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,'alibaba_bailian_cn',$10,$11)
    ON CONFLICT (user_id,input_fingerprint) WHERE status='running' DO NOTHING
    RETURNING *`, [input.userId, input.workflowKey, input.sourceResumeKind, resume.id, resume.file_name || '',
    sourceHash, fingerprint, JSON.stringify(inputOptions),
    JSON.stringify({ workflow: RESUME_DIAGNOSIS_WORKFLOW_VERSION, prompt: RESUME_DIAGNOSIS_PROMPT_VERSION }),
    getResumeDiagnosisModel(), adminId])
  if (!inserted?.[0]) {
    const existing = await neonHelper.query(`SELECT * FROM member_crm_agent_runs
      WHERE user_id=$1 AND input_fingerprint=$2 AND status='running' ORDER BY created_at DESC LIMIT 1`, [input.userId, fingerprint])
    if (existing?.[0]) return { ...mapRun(existing[0]), artifact: null, deduplicated: true }
    throw new CareerAgentError('RUN_CONFLICT', '相同任务正在处理中，请稍后刷新')
  }
  const run = inserted[0]

  try {
    const result = await runResumeDiagnosis({ resumeText: resume.content_text || '', crmContext })
    const sourceRefs = {
      resumeKind: input.sourceResumeKind,
      resumeId: resume.id,
      resumeName: resume.file_name || '',
      resumeHash: sourceHash,
      skillVersions: result.skillVersions,
      sourceStats: result.sourceStats,
      inputOptions
    }
    const saved = await neonHelper.query(`WITH next_version AS (
        SELECT COALESCE(MAX(version),0)+1 AS value FROM member_crm_agent_artifacts
        WHERE user_id=$1 AND artifact_type='resume_diagnosis'
      ), artifact_saved AS (
        INSERT INTO member_crm_agent_artifacts
          (run_id,user_id,artifact_type,version,status,content,source_refs,created_by)
        SELECT $2,$1,'resume_diagnosis',next_version.value,'draft',$3::jsonb,$4::jsonb,$5 FROM next_version
        RETURNING *
      ), run_saved AS (
        UPDATE member_crm_agent_runs SET status='completed', provider=$6, model=$7,
          token_usage=$8::jsonb, skill_versions=$9::jsonb, completed_at=NOW(), updated_at=NOW()
        WHERE id=$2 AND user_id=$1 RETURNING *
      ), audit_saved AS (
        INSERT INTO member_crm_audit_log
          (target_user_id,admin_user_id,action,entity_type,entity_id,metadata)
        SELECT $1,$5,'agent_run_completed','career_agent',run_saved.id,
          jsonb_build_object('workflow','resume_diagnosis','artifactId',artifact_saved.id,
            'sourceResumeKind',$10,'sourceResumeId',$11,'provider',$6,'model',$7)
        FROM run_saved CROSS JOIN artifact_saved
      )
      SELECT run_saved.*, artifact_saved.id AS artifact_id, artifact_saved.artifact_type,
        artifact_saved.version AS artifact_version, artifact_saved.status AS artifact_status,
        artifact_saved.content AS artifact_content, artifact_saved.source_refs,
        artifact_saved.consultant_notes, artifact_saved.approved_at,
        artifact_saved.created_at AS artifact_created_at
      FROM run_saved CROSS JOIN artifact_saved`, [input.userId, run.id, JSON.stringify(result.artifact),
      JSON.stringify(sourceRefs), adminId, result.provider, result.model, JSON.stringify(result.usage || {}),
      JSON.stringify(result.skillVersions), input.sourceResumeKind, resume.id])
    const row = saved[0]
    return { ...mapRun(row), artifact: mapArtifact(row) }
  } catch (error) {
    const code = error instanceof CareerAgentError ? error.code : 'RUN_FAILED'
    const publicMessage = error instanceof CareerAgentError ? error.message : '顾问工具执行失败，请稍后重试'
    await neonHelper.query(`WITH run_saved AS (
        UPDATE member_crm_agent_runs SET status='failed', error_code=$3, error_message=$4,
          completed_at=NOW(), updated_at=NOW() WHERE id=$2 AND user_id=$1 RETURNING id
      ), audit_saved AS (
        INSERT INTO member_crm_audit_log
          (target_user_id,admin_user_id,action,entity_type,entity_id,metadata)
        SELECT $1,$5,'agent_run_failed','career_agent',run_saved.id,
          jsonb_build_object('workflow','resume_diagnosis','errorCode',$3) FROM run_saved
      ) SELECT id FROM run_saved`, [input.userId, run.id, code, publicMessage.slice(0, 500), adminId])
    throw new CareerAgentError(code, publicMessage)
  }
}

async function updateArtifact(input, adminId) {
  const rows = input.action === 'update_profile'
    ? await neonHelper.query(`WITH saved AS (
        UPDATE member_crm_agent_artifacts
        SET content=jsonb_set(content,'{candidateProfile}',$1::jsonb,false), updated_at=NOW()
        WHERE id=$2 AND user_id=$3 AND status='draft' RETURNING *
      ), audit_saved AS (
        INSERT INTO member_crm_audit_log
          (target_user_id,admin_user_id,action,entity_type,entity_id,changed_fields)
        SELECT $3,$4,'agent_artifact_profile_updated','career_artifact',saved.id,
          '["candidateProfile"]'::jsonb FROM saved
      ) SELECT saved.*, saved.id AS artifact_id, saved.version AS artifact_version,
        saved.status AS artifact_status, saved.content AS artifact_content,
        saved.created_at AS artifact_created_at FROM saved`, [JSON.stringify(input.candidateProfile), input.artifactId, input.userId, adminId])
    : input.action === 'update_notes'
    ? await neonHelper.query(`WITH saved AS (
        UPDATE member_crm_agent_artifacts SET consultant_notes=$1, updated_at=NOW()
        WHERE id=$2 AND user_id=$3 AND status<>'archived' RETURNING *
      ), audit_saved AS (
        INSERT INTO member_crm_audit_log
          (target_user_id,admin_user_id,action,entity_type,entity_id,changed_fields)
        SELECT $3,$4,'agent_artifact_notes_updated','career_artifact',saved.id,'["consultantNotes"]'::jsonb FROM saved
      ) SELECT saved.*, saved.id AS artifact_id, saved.version AS artifact_version,
        saved.status AS artifact_status, saved.content AS artifact_content,
        saved.created_at AS artifact_created_at FROM saved`, [input.consultantNotes, input.artifactId, input.userId, adminId])
    : await neonHelper.query(`WITH saved AS (
        UPDATE member_crm_agent_artifacts SET status=$1, consultant_notes=$6,
          approved_by=CASE WHEN $1='approved' THEN $4 ELSE approved_by END,
          approved_at=CASE WHEN $1='approved' THEN COALESCE(approved_at,NOW()) ELSE approved_at END,
          updated_at=NOW()
        WHERE id=$2 AND user_id=$3
          AND (($1='approved' AND status='draft') OR ($1='archived' AND status<>'archived'))
        RETURNING *
      ), audit_saved AS (
        INSERT INTO member_crm_audit_log
          (target_user_id,admin_user_id,action,entity_type,entity_id,changed_fields)
        SELECT $3,$4,$5,'career_artifact',saved.id,'["status","consultantNotes"]'::jsonb FROM saved
      ) SELECT saved.*, saved.id AS artifact_id, saved.version AS artifact_version,
        saved.status AS artifact_status, saved.content AS artifact_content,
        saved.created_at AS artifact_created_at FROM saved`, [input.action === 'approve' ? 'approved' : 'archived',
      input.artifactId, input.userId, adminId, input.action === 'approve' ? 'agent_artifact_approved' : 'agent_artifact_archived',
      input.consultantNotes])
  return rows?.[0] ? mapArtifact(rows[0]) : null
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (!neonHelper.isConfigured) return res.status(503).json({ success: false, error: 'Database not configured' })
  const admin = await requireSuperAdmin(req, res)
  if (!admin) return
  const adminId = admin.user_id || admin.userId
  const resource = String(req.query.resource || 'workspace')
  try {
    if (req.method === 'GET' && resource === 'workspace') {
      const userId = userIdSchema.parse(req.query.userId)
      const workspace = await loadWorkspace(userId)
      if (!workspace) return res.status(404).json({ success: false, error: '会员不存在或不在 CRM 范围内' })
      return res.status(200).json({ success: true, data: workspace })
    }
    if (req.method === 'POST' && resource === 'runs') {
      const input = runSchema.parse(req.body || {})
      const resume = await loadResume(input)
      if (!resume) return res.status(404).json({ success: false, error: '所选简历不存在或不属于该会员' })
      const contextParts = []
      if (input.consultantFocus) contextParts.push(`本次分析重点：${input.consultantFocus}`)
      if (input.includeCrmContext) {
        const crmContext = await loadCrmContext(input.userId)
        if (crmContext) contextParts.push(crmContext)
      }
      const result = await createRun(input, resume, contextParts.join('\n'), adminId)
      return res.status(result.cached || result.deduplicated ? 200 : 201).json({ success: true, data: result })
    }
    if (req.method === 'PATCH' && resource === 'artifacts') {
      const input = artifactSchema.parse(req.body || {})
      const artifact = await updateArtifact(input, adminId)
      if (!artifact) return res.status(404).json({ success: false, error: '顾问成果不存在' })
      return res.status(200).json({ success: true, data: artifact })
    }
    return res.status(405).json({ success: false, error: 'Method not allowed' })
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, error: error.issues[0]?.message || '数据格式错误' })
    if (error instanceof CareerAgentError) {
      const status = ['MODEL_NOT_CONFIGURED', 'MODEL_ENDPOINT_INVALID'].includes(error.code) ? 503
        : error.code === 'RUN_CONFLICT' ? 409 : error.code.startsWith('RESUME_') ? 400 : 502
      return res.status(status).json({ success: false, error: error.message, code: error.code })
    }
    console.error('[member-crm-agent] API error:', error)
    return res.status(500).json({ success: false, error: 'CRM 顾问工具暂时不可用，请稍后重试' })
  }
}
