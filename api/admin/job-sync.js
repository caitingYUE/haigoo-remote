import { listWorkflow } from '../../lib/services/job-sync/list-workflow.js'
import { manualWorkflow } from '../../lib/services/job-sync/manual-workflow.js'
import userHelper from '../../server-utils/user-helper.js'
import { extractToken, verifyToken } from '../../server-utils/auth-helpers.js'
import { SUPER_ADMIN_EMAILS } from '../../server-utils/admin-config.js'
import { db } from '../../lib/services/job-sync/store.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  try {
    const token = extractToken(req),
      payload = token ? verifyToken(token) : null
    const user = payload?.userId
      ? await userHelper.getUserById(payload.userId)
      : null
    if (
      !user ||
      !(
        user.roles?.admin ||
        user.roles?.super_admin ||
        SUPER_ADMIN_EMAILS.includes(String(user.email || '').toLowerCase())
      )
    )
      return res
        .status(403)
        .json({ success: false, error: '仅管理员可使用更新检查' })
    const actor = String(user.email || user.id || payload.userId),
      companyId = String(req.query.companyId || req.body?.companyId || '')
    if (req.query.workflow === 'listing') {
      if (req.method === 'GET') return res.json(await listWorkflow.get(req.query))
      if (req.method === 'POST') return res.json(await listWorkflow.post(req.body || {}, actor))
      return res.status(405).json({success:false,error:'不支持此请求方法'})
    }
    if (req.query.workflow === 'manual') {
      if (req.method === 'GET') return res.json(await manualWorkflow.get(req.query))
      if (req.method === 'POST') return res.status(410).json({success:false,error:'详细采集与预检已停用，请使用更新检查；岗位请在企业岗位列表中人工管理'})
      return res.status(405).json({ success: false, error: '不支持此请求方法' })
    }
    if (req.method === 'POST') return res.status(410).json({success:false,error:'旧岗位同步操作已停用，请使用可信企业页面的更新检查'})
    if (req.method === 'GET') {
      const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 30)),
        offset = Math.max(0, Number(req.query.offset) || 0),
        queue = ['changes', 'baseline', 'eligibility', 'manual'].includes(
          req.query.queue
        )
          ? req.query.queue
          : ''
      const [
        sources,
        candidates,
        runs,
        sourceJobs,
        jobs,
        outbox,
        metrics,
        companyOptions,
        urlChecks
      ] = await Promise.all([
        db(
          `SELECT s.*,jsonb_agg(jsonb_build_object('companyId',m.company_id,'rule',m.rule)) AS companies,
          (SELECT COUNT(*) FROM job_sync_candidates c JOIN job_sync_source_jobs sj ON sj.id=c.source_job_id WHERE sj.source_id=s.id AND c.status='pending') AS pending_count
          FROM job_sync_sources s JOIN job_sync_source_companies m ON m.source_id=s.id WHERE ($1='' OR s.id IN(SELECT source_id FROM job_sync_source_companies WHERE company_id=$1)) GROUP BY s.id ORDER BY s.last_error NULLS LAST,s.created_at`,
          [companyId]
        ),
        db(
          `SELECT c.*,sj.payload AS source_payload,j.sync_revision AS current_revision FROM job_sync_candidates c LEFT JOIN job_sync_source_jobs sj ON sj.id=c.source_job_id LEFT JOIN jobs j ON j.job_id=c.job_id
          WHERE c.status=$2 AND ($5='' OR c.queue=$5) AND ($1='' OR c.company_id=$1 OR (c.company_id IS NULL AND sj.source_id IN(SELECT source_id FROM job_sync_source_companies WHERE company_id=$1)))
          ORDER BY CASE WHEN c.kind='close' THEN 0 WHEN c.kind='update' THEN 1 ELSE 2 END,c.created_at DESC LIMIT $3 OFFSET $4`,
          [
            companyId,
            ['pending', 'approved', 'rejected', 'superseded'].includes(
              req.query.status
            )
              ? req.query.status
              : 'pending',
            limit,
            offset,
            queue
          ]
        ),
        db(
          `SELECT r.* FROM job_sync_runs r WHERE ($1='' OR source_id IN(SELECT source_id FROM job_sync_source_companies WHERE company_id=$1)) ORDER BY created_at DESC LIMIT 30`,
          [companyId]
        ),
        companyId
          ? db(
              "SELECT sj.id,sj.source_id,sj.external_id,sj.job_id,sj.version,sj.payload->>'title' AS title,sj.payload->>'url' AS url FROM job_sync_source_jobs sj WHERE source_id IN(SELECT source_id FROM job_sync_source_companies WHERE company_id=$1) ORDER BY sj.job_id NULLS FIRST,sj.last_seen_at DESC LIMIT 500",
              [companyId]
            )
          : [],
        companyId
          ? db(
              'SELECT job_id,title,url,status,is_approved,sync_revision FROM jobs WHERE company_id=$1 ORDER BY title',
              [companyId]
            )
          : [],
        db(
          "SELECT * FROM job_sync_outbox WHERE status<>'done' AND ($1='' OR company_id=$1) ORDER BY id LIMIT 30",
          [companyId]
        ),
        db(`SELECT (SELECT COUNT(*) FROM job_sync_sources WHERE enabled) AS enabled_sources,
          (SELECT COUNT(*) FROM job_sync_sources WHERE enabled AND last_complete_at>NOW()-INTERVAL '24 hours') AS fresh_sources,
          (SELECT COUNT(*) FROM job_sync_candidates WHERE status='pending') AS pending,
          (SELECT ROUND(AVG(EXTRACT(EPOCH FROM reviewed_at-created_at))/3600,1) FROM job_sync_candidates WHERE reviewed_at>NOW()-INTERVAL '7 days') AS average_review_wait_hours`),
        db(
          "SELECT company_id,name FROM trusted_companies WHERE status='active' ORDER BY name"
        ),
        db(
          "SELECT ck.*,j.title FROM job_sync_url_checks ck JOIN jobs j ON j.job_id=ck.job_id WHERE ($1='' OR j.company_id=$1) ORDER BY checked_at DESC LIMIT 30",
          [companyId]
        )
      ])
      return res.json({
        success: true,
        sources,
        candidates,
        runs,
        sourceJobs,
        jobs,
        outbox,
        companyOptions,
        urlChecks,
        metrics: metrics[0],
        paused: process.env.JOB_SYNC_ENABLED !== 'true',
        offset,
        hasMore: candidates.length === limit
      })
    }
    return res.status(405).json({ success: false, error: '不支持此请求方法' })
  } catch (error) {
    const conflict = /CONFLICT|STALE|duplicate key/.test(error.message)
    const migration = /does not exist/.test(error.message)
    return res.status(conflict ? 409 : migration ? 503 : 400).json({
      success: false,
      error: migration
        ? (req.query.workflow === 'listing' ? '更新检查尚未初始化，请联系管理员执行迁移 094' : '旧检查记录尚未初始化')
        : conflict
          ? '数据或证据已变化，请刷新后重新比较'
          : error.message
    })
  }
}
