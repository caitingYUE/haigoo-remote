import translationService from '../translation-service.cjs'
import { db } from './store.js'

export function normalizeDraft(facts) {
  const draft = { ...facts }
  const type = String(draft.job_type || '')
    .replace(/[\s_-]/g, '')
    .toLowerCase()
  const types = {
    fulltime: 'full-time',
    parttime: 'part-time',
    contract: 'contract',
    internship: 'internship',
    temporary: 'temporary'
  }
  if (types[type]) draft.job_type = types[type]
  return draft
}

// Candidate-only translation, with a claim and optimistic version check. Failed translations
// are visible and retried explicitly; the daily scanner never retranslates unchanged content.
export async function enrichCandidate(id) {
  const [c] = await db(
    `UPDATE job_sync_candidates SET enrichment_status='running',enrichment_started_at=NOW()
    WHERE id=$1 AND status='pending' AND kind<>'close' AND (enrichment_status IN ('pending','failed') OR (enrichment_status='running' AND enrichment_started_at<NOW()-INTERVAL '5 minutes')) RETURNING *`,
    [id]
  )
  if (!c) return { skipped: true }
  try {
    const facts = { ...c.before_payload, ...c.patch }
    const translated = await translationService.translateJob({
      id: c.id,
      title: facts.title,
      description: facts.description,
      requirements: Array.isArray(facts.requirements)
        ? facts.requirements.join('\n')
        : facts.requirements,
      benefits: Array.isArray(facts.benefits)
        ? facts.benefits.join('\n')
        : facts.benefits
    })
    if (!translated?.isTranslated || !translated.translations)
      throw new Error(
        translated?.translationError || '翻译暂不可用，请保留原文或人工填写译文'
      )
    const rows = await db(
      `UPDATE job_sync_candidates SET patch=jsonb_set(patch,'{translations}',$3::jsonb),version=version+1,enrichment_status='done',enrichment_error=NULL
      WHERE id=$1 AND version=$2 AND status='pending' RETURNING id`,
      [id, c.version, JSON.stringify(translated.translations)]
    )
    return { updated: rows.length > 0 }
  } catch (error) {
    await db(
      "UPDATE job_sync_candidates SET enrichment_status='failed',enrichment_error=$2 WHERE id=$1 AND status='pending'",
      [id, error.message]
    )
    return { error: error.message }
  }
}
export async function enrichNextCandidate() {
  if (process.env.JOB_SYNC_TRANSLATE_ENABLED !== 'true') return { paused: true }
  await db(
    "UPDATE job_sync_candidates SET enrichment_status='failed',enrichment_error='翻译超时，可手动重试' WHERE enrichment_status='running' AND enrichment_started_at<NOW()-INTERVAL '5 minutes'"
  )
  const [c] = await db(
    "SELECT id FROM job_sync_candidates WHERE status='pending' AND enrichment_status='pending' AND kind<>'close' AND (patch ? 'title' OR patch ? 'description') ORDER BY created_at LIMIT 1"
  )
  return c ? enrichCandidate(c.id) : { empty: true }
}
