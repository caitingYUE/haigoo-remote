import crypto from 'crypto'
import fs from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import http from 'http'
import os from 'os'
import path from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import cloudbase from '@cloudbase/node-sdk'
import { isLeaseActive, stableJson, staleCleanupDecision, syncDecision } from './sync-policy.mjs'
import {
  buildCompanyHiringSignals,
  buildHiringCompanyPage,
  mapCompanyJobDetail,
  mapCompanyJobSummary
} from './company-directory.mjs'

const port = Number(process.env.PORT || 8080)
const apiOrigin = String(process.env.HAIGOO_API_ORIGIN || '').replace(/\/+$/, '')
const jobsApiOrigin = String(process.env.HAIGOO_JOBS_API_ORIGIN || apiOrigin).replace(/\/+$/, '')
const appId = String(process.env.WECHAT_MINI_APP_ID || '')
const appSecret = String(process.env.WECHAT_MINI_APP_SECRET || '')
const gatewaySecret = String(process.env.MINI_GATEWAY_SHARED_SECRET || '')
const jobsGatewaySecret = String(process.env.MINI_JOBS_GATEWAY_SHARED_SECRET || gatewaySecret)
const sessionSecret = String(process.env.MINI_SESSION_SECRET || '')
const syncSecret = String(process.env.MINI_SYNC_SECRET || '')
const vercelAutomationBypassSecret = String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '')
const virtualPaymentOfferId = String(process.env.WECHAT_VIRTUAL_PAYMENT_OFFER_ID || '').trim()
const virtualPaymentAppKey = String(process.env.WECHAT_VIRTUAL_PAYMENT_APP_KEY || '').trim()
const virtualPaymentEnv = Number(process.env.WECHAT_VIRTUAL_PAYMENT_ENV || 0) === 1 ? 1 : 0
const jobsCollection = 'mini_jobs'
const jobListCollection = 'mini_job_list'
const syncCollection = 'mini_sync_state'
const SYNC_PAGE_SIZE = 100
const LIST_INDEX_FETCH_LIMIT = 1000
const LIST_INDEX_MAX_RECORDS = 20000
const MAX_REQUEST_BODY_BYTES = 3 * 1024 * 1024
const legacyJobCacheEnabled = String(process.env.MINI_ENABLE_LEGACY_JOB_CACHE || '').trim().toLowerCase() === 'true'
const GATEWAY_REQUEST_TIMEOUT_MS = Math.max(12000, Math.min(60000, Number(process.env.MINI_GATEWAY_REQUEST_TIMEOUT_MS || 25000)))
const SYNC_MAX_PAGES_PER_RUN = Math.max(1, Math.min(10, Number(process.env.MINI_SYNC_PAGES_PER_RUN || 3)))
const WRITE_CONCURRENCY = Math.max(1, Math.min(20, Number(process.env.MINI_SYNC_WRITE_CONCURRENCY || 4)))
const LOGO_CONCURRENCY = Math.max(1, Math.min(6, Number(process.env.MINI_LOGO_CONCURRENCY || 1)))
const MAX_LOGO_BYTES = Math.max(64 * 1024, Math.min(8 * 1024 * 1024, Number(process.env.MINI_LOGO_MAX_BYTES || 2 * 1024 * 1024)))
const contentAssetCollection = 'mini_asset_index'
const contentAssetDocument = 'content-images'
const contentAssetMemory = new Map()
const contentAssetFailureUntil = new Map()
const contentAssetPending = new Map()
let contentAssetIndexLoaded = false
let contentAssetIndexPromise = null
let contentAssetPersistPromise = Promise.resolve()
let contentAssetInfrastructureBackoffUntil = 0
const CACHE_REFRESH_MS = Math.max(5 * 60 * 1000, Number(process.env.MINI_CACHE_REFRESH_MS || 60 * 60 * 1000))
const FULL_SYNC_INTERVAL_MS = Math.max(6 * 60 * 60 * 1000, Number(process.env.MINI_FULL_SYNC_INTERVAL_MS || 24 * 60 * 60 * 1000))
const SYNC_TIMER_MS = Math.max(15 * 60 * 1000, Number(process.env.MINI_SYNC_INTERVAL_MS || 60 * 60 * 1000))
const SYNC_LEASE_MS = Math.max(5 * 60 * 1000, Number(process.env.MINI_SYNC_LEASE_MS || 15 * 60 * 1000))
const LOGO_RETRY_MS = Math.max(60 * 60 * 1000, Number(process.env.MINI_LOGO_RETRY_MS || 24 * 60 * 60 * 1000))
const LIST_MEMORY_CACHE_MS = Math.max(30 * 1000, Number(process.env.MINI_LIST_MEMORY_CACHE_MS || 5 * 60 * 1000))
const SYNC_STATE_MEMORY_CACHE_MS = Math.max(10 * 1000, Number(process.env.MINI_SYNC_STATE_MEMORY_CACHE_MS || 60 * 1000))
const STALE_CLEANUP_MAX_RATIO = Math.max(0, Math.min(1, Number(process.env.MINI_STALE_CLEANUP_MAX_RATIO || 0.2)))
const CACHE_MODEL_VERSION = '2026-08-18-trusted-companies-only-v1'
// The trusted-company filter intentionally invalidates the old RSS-inclusive
// snapshot. Keep the normal 20% guard for routine syncs, but allow this named
// migration to remove a larger, still bounded stale set in one pass.
const CACHE_MODEL_MIGRATION_MAX_RATIO = 0.75
const syncInstanceId = `${os.hostname()}:${process.pid}:${crypto.randomUUID()}`

if (!apiOrigin || !jobsApiOrigin || !appId || !appSecret || !gatewaySecret || !jobsGatewaySecret || !sessionSecret) {
  throw new Error('Missing required Cloud Hosting environment variables')
}

const cloudApp = cloudbase.init({ env: process.env.TCB_ENV })
const db = cloudApp.database()

function signGatewayRequest(method, action, timestamp, body, secret = gatewaySecret) {
  const bodyHash = crypto.createHash('sha256').update(stableJson(body || {})).digest('hex')
  return crypto.createHmac('sha256', secret)
    .update(`${method.toUpperCase()}:${action}:${timestamp}:${bodyHash}`)
    .digest('hex')
}

async function gatewayRequest(action, { method = 'GET', body = {}, query = {}, timeoutMs = GATEWAY_REQUEST_TIMEOUT_MS } = {}) {
  const useFormalJobsSource = action === 'sync' && jobsApiOrigin !== apiOrigin
  const requestOrigin = useFormalJobsSource ? jobsApiOrigin : apiOrigin
  const requestSecret = useFormalJobsSource ? jobsGatewaySecret : gatewaySecret
  const timestamp = String(Date.now())
  const params = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')) })
  const signedQuery = Object.fromEntries([...params.entries()].filter(([key]) => key !== 'action'))
  const signaturePayload = method === 'GET' ? signedQuery : body
  const response = await fetch(`${requestOrigin}/api/mini?${params}`, {
    method,
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      Accept: 'application/json',
      ...(!useFormalJobsSource && vercelAutomationBypassSecret
        ? { 'x-vercel-protection-bypass': vercelAutomationBypassSecret }
        : {}),
      ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
      'X-Haigoo-Mini-Timestamp': timestamp,
      'X-Haigoo-Mini-Signature': signGatewayRequest(method, action, timestamp, signaturePayload, requestSecret)
    },
    ...(method !== 'GET' ? { body: JSON.stringify(body) } : {})
  })
  const payload = await response.json().catch(() => ({ success: false, error: '上游服务返回无效数据' }))
  if (!response.ok) {
    const error = new Error(payload.error || '上游服务暂不可用')
    error.statusCode = response.status
    error.payload = payload
    throw error
  }
  return payload
}

function canonicalCompanyJobs(result, companyId) {
  return (Array.isArray(result?.jobs) ? result.jobs : [])
    .map((job) => mapCompanyJobSummary(job, companyId))
    .filter(Boolean)
    .slice(0, 100)
}

async function readAccessibleCompanyCatalog(openid) {
  const first = await gatewayRequest('companies', { query: { openid, page: '1', pageSize: '50' } })
  if (first.access?.scope !== 'member_all' || !first.hasMore) return first
  const pages = Math.ceil(Math.max(0, Number(first.total || 0)) / 50)
  const rest = await Promise.all(Array.from({ length: Math.max(0, pages - 1) }, (_, index) => (
    gatewayRequest('companies', { query: { openid, page: String(index + 2), pageSize: '50' } })
  )))
  return { ...first, companies: [first, ...rest].flatMap((item) => item.companies || []) }
}

async function readCurrentJobRecords() {
  try {
    const cached = (await readAllListDocuments()).map(unwrapDocument).filter(Boolean)
    if (cached.length > 0) return cached
  } catch (error) {
    console.warn('[mini-cloudrun] current hiring cache unavailable, using upstream', error?.message || error)
  }
  const first = await gatewayRequest('sync', { query: { page: '1', limit: '100', sortBy: 'recent' } })
  const totalPages = Math.max(1, Math.ceil(Math.max(0, Number(first.total || 0)) / 100))
  if (totalPages > Math.ceil(LIST_INDEX_MAX_RECORDS / 100)) {
    throw new Error(`Current hiring index exceeds safety cap: ${LIST_INDEX_MAX_RECORDS}`)
  }
  const rest = await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => (
    gatewayRequest('sync', { query: { page: String(index + 2), limit: '100', sortBy: 'recent' } })
  )))
  return [first, ...rest].flatMap((result) => Array.isArray(result.jobs) ? result.jobs : [])
}

async function readCurrentHiringCompanies({ openid, search, industry, page, pageSize }) {
  const catalog = await readAccessibleCompanyCatalog(openid)
  if (catalog.access?.scope === 'match_required') return catalog
  const records = await readCurrentJobRecords()
  const current = buildHiringCompanyPage({
    companies: catalog.companies,
    signals: buildCompanyHiringSignals(records),
    search,
    industry,
    page,
    pageSize
  })
  return {
    ...catalog,
    ...current,
    access: {
      ...catalog.access,
      previewLimit: catalog.access?.scope === 'free_fixed' ? current.total : null
    }
  }
}

function sessionToken(payload) {
  const encoded = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 })).toString('base64url')
  const signature = crypto.createHmac('sha256', sessionSecret).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

function verifySessionToken(value) {
  const [encoded, received] = String(value || '').split('.')
  if (!encoded || !received) return null
  const expected = crypto.createHmac('sha256', sessionSecret).update(encoded).digest('base64url')
  if (received.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))) return null
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    return payload?.openid && Number(payload.exp) > Date.now() ? payload : null
  } catch {
    return null
  }
}

function getSession(req) {
  return verifySessionToken(String(req.headers.authorization || '').replace(/^Bearer\s+/i, ''))
}

function requestClientKey(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const source = forwarded || String(req.socket?.remoteAddress || '').trim() || 'unknown'
  return crypto.createHash('sha256').update(source).digest('hex')
}

function jobDocumentId(jobId) {
  return crypto.createHash('sha256').update(String(jobId)).digest('hex')
}

function appOriginUrl(value) {
  const source = String(value || '').trim()
  if (!source) return ''
  if (/^https?:\/\//i.test(source)) return source
  return `${jobsApiOrigin}${source.startsWith('/') ? '' : '/'}${source}`
}

function contentOriginUrl(value) {
  const source = String(value || '').trim()
  if (!source) return ''
  if (/^https?:\/\//i.test(source)) return source
  return `${apiOrigin}${source.startsWith('/') ? '' : '/'}${source}`
}

function byteLimitTransform(maxBytes) {
  let received = 0
  return new Transform({
    transform(chunk, _encoding, callback) {
      received += chunk.length
      if (received > maxBytes) {
        callback(new Error(`Logo exceeds ${maxBytes} byte limit`))
        return
      }
      callback(null, chunk)
    }
  })
}

async function cacheLogo(jobId, source, existing = null) {
  if (!source || (existing?.logoSource === source && existing?.logoFileId)) return existing?.logoFileId || ''
  try {
    const response = await fetch(source, { signal: AbortSignal.timeout(8000) })
    const contentType = response.headers.get('content-type') || ''
    const contentLength = Number(response.headers.get('content-length') || 0)
    if (!response.ok || !contentType.startsWith('image/') || !response.body) {
      console.warn('[mini-cloudrun] logo cache skipped', jobId, response.status, contentType || 'missing-content-type')
      return existing?.logoFileId || ''
    }
    if (Number.isFinite(contentLength) && contentLength > MAX_LOGO_BYTES) {
      console.warn('[mini-cloudrun] logo cache skipped', jobId, `content-length ${contentLength} exceeds ${MAX_LOGO_BYTES}`)
      return existing?.logoFileId || ''
    }
    const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : contentType.includes('svg') ? 'svg' : 'jpg'
    const cloudPath = `mini-job-logos/${jobDocumentId(jobId)}-${crypto.createHash('sha1').update(source).digest('hex').slice(0, 12)}.${extension}`
    // The CloudBase Node SDK only accepts Buffer or fs.ReadStream (not a generic
    // Transform stream). Spool the bounded response to /tmp, then pass the
    // supported fs.ReadStream and clean it up immediately. This keeps arbitrary
    // third-party images out of the Node heap.
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'haigoo-logo-'))
    const tempPath = path.join(tempDir, `logo.${extension}`)
    try {
      await pipeline(
        Readable.fromWeb(response.body),
        byteLimitTransform(MAX_LOGO_BYTES),
        fs.createWriteStream(tempPath)
      )
      const uploaded = await cloudApp.uploadFile({ cloudPath, fileContent: fs.createReadStream(tempPath) })
      return uploaded.fileID || existing?.logoFileId || ''
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  } catch (error) {
    console.warn('[mini-cloudrun] logo cache failed', jobId, error?.message || error)
    return existing?.logoFileId || ''
  }
}

async function loadContentAssetIndex() {
  if (contentAssetIndexLoaded) return
  if (Date.now() < contentAssetInfrastructureBackoffUntil) return
  if (contentAssetIndexPromise) return contentAssetIndexPromise
  contentAssetIndexPromise = (async () => {
    let loaded = false
    try {
      const result = await db.collection(contentAssetCollection).doc(contentAssetDocument).get()
      const document = documentFromResult(result) || {}
      for (const [key, value] of Object.entries(document.assets || {})) {
        const fileId = typeof value === 'string' ? value : value?.fileId
        if (String(fileId || '').startsWith('cloud://')) contentAssetMemory.set(key, String(fileId))
      }
      loaded = true
    } catch (error) {
      console.warn('[mini-cloudrun] content asset index unavailable', error?.message || error)
      contentAssetInfrastructureBackoffUntil = Date.now() + 5 * 60 * 1000
    } finally {
      contentAssetIndexLoaded = loaded
      contentAssetIndexPromise = null
    }
  })()
  return contentAssetIndexPromise
}

function persistContentAssetIndex() {
  contentAssetPersistPromise = contentAssetPersistPromise.catch(() => {}).then(async () => {
    await db.runTransaction(async (transaction) => {
      const reference = transaction.collection(contentAssetCollection).doc(contentAssetDocument)
      const result = await reference.get()
      const current = documentFromResult(result) || {}
      const assets = { ...(current.assets || {}) }
      for (const [key, fileId] of contentAssetMemory.entries()) assets[key] = fileId
      await reference.set({ assets, updatedAt: new Date().toISOString() })
    })
  }).catch((error) => {
    console.warn('[mini-cloudrun] content asset index persist failed', error?.message || error)
  })
  return contentAssetPersistPromise
}

async function cacheContentImage({ ownerType, ownerId, sourcePath, folder }) {
  if (!sourcePath || !ownerId) return { fileId: '', created: false }
  const sourceHash = crypto.createHash('sha1').update(sourcePath).digest('hex').slice(0, 16)
  const cacheKey = `${ownerType}-${crypto.createHash('sha256').update(String(ownerId)).digest('hex').slice(0, 24)}-${sourceHash}`
  if (contentAssetMemory.has(cacheKey)) return { fileId: contentAssetMemory.get(cacheKey), created: false }
  if (contentAssetPending.has(cacheKey)) return contentAssetPending.get(cacheKey)
  if (Date.now() < Number(contentAssetFailureUntil.get(cacheKey) || 0)) {
    return { fileId: '', created: false }
  }
  const pending = (async () => {
    const source = contentOriginUrl(sourcePath)
    const tempDir = await mkdtemp(path.join(os.tmpdir(), `haigoo-${ownerType}-`))
    const tempPath = path.join(tempDir, 'asset')
    try {
      const response = await fetch(source, {
        signal: AbortSignal.timeout(10000),
        headers: vercelAutomationBypassSecret ? { 'x-vercel-protection-bypass': vercelAutomationBypassSecret } : {}
      })
      const contentType = response.headers.get('content-type') || ''
      if (!response.ok || !contentType.startsWith('image/') || !response.body) {
        contentAssetFailureUntil.set(cacheKey, Date.now() + 30 * 60 * 1000)
        return { fileId: '', created: false }
      }
      await pipeline(Readable.fromWeb(response.body), byteLimitTransform(MAX_LOGO_BYTES), fs.createWriteStream(tempPath))
      const extension = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : contentType.includes('svg') ? 'svg' : 'jpg'
      const uploaded = await cloudApp.uploadFile({
        cloudPath: `${folder}/${cacheKey}.${extension}`,
        fileContent: fs.createReadStream(tempPath)
      })
      if (uploaded.fileID) contentAssetMemory.set(cacheKey, uploaded.fileID)
      return { fileId: uploaded.fileID || '', created: Boolean(uploaded.fileID) }
    } catch (error) {
      console.warn('[mini-cloudrun] content image cache failed', ownerType, ownerId, error?.message || error)
      contentAssetFailureUntil.set(cacheKey, Date.now() + 30 * 60 * 1000)
      return { fileId: '', created: false }
    } finally {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  })()
  contentAssetPending.set(cacheKey, pending)
  try {
    return await pending
  } finally {
    contentAssetPending.delete(cacheKey)
  }
}

async function attachNoteCovers(notes) {
  await loadContentAssetIndex()
  let created = false
  const hydrated = await mapWithConcurrency(Array.isArray(notes) ? notes : [], 4, async (note) => {
    const { _coverSourcePath, ...publicNote } = note || {}
    if (publicNote.coverFileId) return publicNote
    const cached = await cacheContentImage({ ownerType: 'note', ownerId: note?.id, sourcePath: _coverSourcePath, folder: 'mini-note-covers' })
    created ||= cached.created
    return { ...publicNote, coverFileId: cached.fileId }
  })
  if (created) await persistContentAssetIndex()
  return hydrated
}

async function attachCompanyLogos(companies) {
  await loadContentAssetIndex()
  let created = false
  const hydrated = await mapWithConcurrency(Array.isArray(companies) ? companies : [], 3, async (company) => {
    const { _logoSourcePath, ...publicCompany } = company || {}
    if (publicCompany.logoFileId) return publicCompany
    const cached = await cacheContentImage({ ownerType: 'company', ownerId: company?.id, sourcePath: _logoSourcePath, folder: 'mini-company-logos' })
    created ||= cached.created
    return { ...publicCompany, logoFileId: cached.fileId }
  })
  if (created) await persistContentAssetIndex()
  return hydrated
}

function publicJob(job, logoFileId = '') {
  const {
    url,
    sourceUrl,
    hiringEmail,
    isFeatured,
    ...safeJob
  } = job
  delete safeJob.canRefer
  delete safeJob.effectiveReferralContactCount
  delete safeJob.hasReferral
  const isHotApplication = Boolean(job.isHotApplication || Number(job.applicationCount || 0) >= 10)
  return {
    ...safeJob,
    isFeatured: isHotApplication,
    isHotApplication,
    editorialFeatured: Boolean(isFeatured),
    // Never hand a Vercel or third-party image URL to the Mini Program.  When
    // a cache upload fails the UI intentionally falls back to its local icon.
    cachedLogoUrl: logoFileId || '',
    cachedCompanyLogoUrl: logoFileId || '',
    hasWebsiteApply: Boolean(url || sourceUrl),
    hasEmailApply: Boolean(hiringEmail)
  }
}

function compactTranslations(value) {
  if (!value || typeof value !== 'object') return undefined
  const { title, company, location, type } = value
  const compact = { title, company, location, type }
  return Object.values(compact).some(Boolean) ? compact : undefined
}

// `mini_jobs` intentionally contains the complete job description. It must
// never be used as a list query, because a few hundred rich documents exceed
// CloudBase's single-query response limit. This separate collection contains
// only the fields the job cards need.
function compactJobPayload(payload = {}) {
  const summary = { ...payload }
  const translations = summary.translations
  delete summary.description
  delete summary.originalDescription
  delete summary.requirements
  delete summary.responsibilities
  delete summary.benefits
  delete summary.translations
  const compact = { ...summary }
  const localized = compactTranslations(translations)
  if (localized) compact.translations = localized
  else delete compact.translations
  return compact
}

function jobListDocument({
  id,
  _id,
  jobId,
  status,
  featured,
  defaultRank,
  payload,
  lastSeenSyncId,
  updatedAt,
  sourceHash,
  logoSource,
  logoFileId,
  logoLastAttemptAt
}) {
  const compactPayload = compactJobPayload(payload)
  return {
    _id: id || _id,
    jobId,
    status: status || 'active',
    featured: Boolean(featured),
    defaultRank: defaultRank != null && Number.isFinite(Number(defaultRank)) ? Number(defaultRank) : null,
    publishedAt: compactPayload.publishedAt || '',
    category: compactPayload.category || '',
    lastSeenSyncId: lastSeenSyncId || '',
    updatedAt: updatedAt || '',
    sourceHash: sourceHash || '',
    logoSource: logoSource || '',
    logoFileId: logoFileId || '',
    logoLastAttemptAt: Number(logoLastAttemptAt || 0),
    payload: compactPayload
  }
}

function unwrapDocument(record) {
  let value = record
  while (value?.data && typeof value.data === 'object' && !Array.isArray(value.data)) {
    if (value.data === value) break
    value = value.data
  }
  return value
}

function documentFromResult(result) {
  const value = Array.isArray(result?.data) ? result.data[0] : result?.data
  return unwrapDocument(value)
}

function withoutDocumentId(record) {
  const data = { ...(record || {}) }
  delete data._id
  return data
}

let syncStateCache = null

async function getSyncState({ bypassCache = false } = {}) {
  if (
    !bypassCache &&
    syncStateCache &&
    Date.now() - syncStateCache.loadedAt < SYNC_STATE_MEMORY_CACHE_MS
  ) {
    return syncStateCache.state
  }
  const result = await db.collection(syncCollection).doc('jobs').get()
  let state = documentFromResult(result) || { _id: 'jobs', cursor: '', lastFullSyncAt: 0 }
  if (typeof state?.data === 'string') {
    try {
      const parsed = JSON.parse(state.data)
      if (parsed && typeof parsed === 'object') state = parsed
    } catch {
      // Keep the default/cold-cache path when a manually edited value is not
      // valid JSON. The next successful sync rewrites the state document.
    }
  }
  // Read existing nested records written by the first deployment. New writes
  // below are flat documents, but this keeps the migration non-disruptive.
  state = unwrapDocument(state)
  syncStateCache = { state, loadedAt: Date.now() }
  return state
}

async function setSyncState(value) {
  await db.collection(syncCollection).doc('jobs').set(withoutDocumentId({ _id: 'jobs', ...value }))
  syncStateCache = { state: { _id: 'jobs', ...value }, loadedAt: Date.now() }
}

function sourceStateChanged(state = {}) {
  return (
    String(state.jobsSourceOrigin || '') !== jobsApiOrigin ||
    String(state.cacheModelVersion || '') !== CACHE_MODEL_VERSION
  )
}

async function acquireSyncLease({ force = false } = {}) {
  let outcome = { acquired: false, reason: 'unknown', full: false, restartFull: false }
  await db.runTransaction(async (transaction) => {
    const reference = transaction.collection(syncCollection).doc('jobs')
    const result = await reference.get()
    const state = documentFromResult(result) || { _id: 'jobs', cursor: '', lastFullSyncAt: 0 }
    const now = Date.now()
    const decision = syncDecision({
      state,
      now,
      force,
      sourceChanged: sourceStateChanged(state),
      cacheRefreshMs: CACHE_REFRESH_MS,
      fullSyncIntervalMs: FULL_SYNC_INTERVAL_MS
    })
    if (!decision.due) {
      outcome = { acquired: false, reason: 'fresh', full: false, restartFull: false }
      return
    }
    if (isLeaseActive(state, now)) {
      outcome = { acquired: false, reason: 'leased', full: decision.full, restartFull: false }
      return
    }
    await reference.set(withoutDocumentId({
      ...state,
      syncLeaseOwner: syncInstanceId,
      syncLeaseStartedAt: now,
      syncLeaseExpiresAt: now + SYNC_LEASE_MS
    }))
    outcome = {
      acquired: true,
      reason: 'acquired',
      full: decision.full,
      restartFull: Boolean(force || sourceStateChanged(state) || (decision.full && !state.fullSyncInProgress))
    }
  })
  syncStateCache = null
  return outcome
}

async function releaseSyncLease() {
  await db.runTransaction(async (transaction) => {
    const reference = transaction.collection(syncCollection).doc('jobs')
    const result = await reference.get()
    const state = documentFromResult(result)
    if (!state || state.syncLeaseOwner !== syncInstanceId) return
    await reference.set(withoutDocumentId({
      ...state,
      syncLeaseOwner: '',
      syncLeaseStartedAt: 0,
      syncLeaseExpiresAt: 0
    }))
  }).catch((error) => {
    console.warn('[mini-cloudrun] sync lease release failed', error?.message || error)
  }).finally(() => {
    syncStateCache = null
  })
}

async function renewSyncLease() {
  await db.runTransaction(async (transaction) => {
    const reference = transaction.collection(syncCollection).doc('jobs')
    const result = await reference.get()
    const state = documentFromResult(result)
    if (!state || state.syncLeaseOwner !== syncInstanceId) {
      throw new Error('Synchronization lease ownership was lost')
    }
    await reference.set(withoutDocumentId({
      ...state,
      syncLeaseExpiresAt: Date.now() + SYNC_LEASE_MS
    }))
  })
}

async function runWithConcurrency(items, concurrency, worker) {
  let nextIndex = 0
  const failures = []
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const item = items[nextIndex]
      nextIndex += 1
      try {
        await worker(item)
      } catch (error) {
        failures.push({ item, error })
      }
    }
  })
  await Promise.all(workers)
  if (failures.length > 0) {
    const error = new Error(String(failures.length) + ' background cache writes failed')
    error.failures = failures
    throw error
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const values = Array.isArray(items) ? items : []
  const results = new Array(values.length)
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(values[index], index)
    }
  })
  await Promise.all(workers)
  return results
}

function jobSourceHash(job) {
  return crypto.createHash('sha256').update(stableJson(job || {})).digest('hex')
}

async function storeJob(job, { syncRunId = '', defaultRank = null, existingIndex = null } = {}) {
  const id = jobDocumentId(job.id)
  const existing = existingIndex
  const logoSource = appOriginUrl(job.cachedCompanyLogoUrl || job.cachedLogoUrl || job.companyLogo || job.logo)
  const sourceHash = jobSourceHash(job)
  // Keep a valid CloudBase file ID when the source has not changed. Previously
  // every job upsert erased it, which caused each periodic sync to download the
  // same logo again and briefly made clients fall back to the local placeholder.
  const cachedLogoFileId = existing?.logoFileId || existing?.payload?.cachedLogoUrl || existing?.payload?.cachedCompanyLogoUrl || ''
  const logoFileId = !existing?.logoSource || existing.logoSource === logoSource ? cachedLogoFileId : ''
  const logoLastAttemptAt = existing?.logoSource === logoSource ? Number(existing?.logoLastAttemptAt || 0) : 0
  const payload = publicJob(job, logoFileId)
  const data = {
    _id: id,
    jobId: job.id,
    status: job.status || 'active',
    featured: Boolean(payload.isHotApplication),
    defaultRank: defaultRank != null && Number.isFinite(Number(defaultRank)) ? Number(defaultRank) : existing?.defaultRank ?? null,
    updatedAt: job.updatedAt || existing?.updatedAt || '',
    sourceHash,
    logoSource,
    logoFileId,
    ...(logoLastAttemptAt > 0 ? { logoLastAttemptAt } : {}),
    lastSeenSyncId: syncRunId || existing?.lastSeenSyncId || '',
    payload
  }
  // A full reconciliation still updates lastSeenSyncId for stale cleanup.
  // Incremental runs can trust the compact list index hash and avoid one detail
  // read plus two writes for every unchanged upstream record.
  const changed = Boolean(syncRunId || !existing || existing.sourceHash !== sourceHash)
  if (changed) {
    await db.collection(jobsCollection).doc(id).set(withoutDocumentId(data))
    await db.collection(jobListCollection).doc(id).set(withoutDocumentId(jobListDocument(data)))
    invalidateListDocumentCache()
  }
  const logoDue = Boolean(
    logoSource &&
    !logoFileId &&
    Date.now() - Number(logoLastAttemptAt || 0) >= LOGO_RETRY_MS
  )
  return {
    changed,
    logoTask: logoDue ? { jobId: job.id, logoSource } : null
  }
}

async function cacheJobLogo(task) {
  const id = jobDocumentId(task.jobId)
  const currentResult = await db.collection(jobsCollection).doc(id).get().catch(() => ({ data: [] }))
  const current = documentFromResult(currentResult)
  // A later job update can replace the source while this task is waiting in the
  // queue. In that case leave the newer record alone; its own task will handle it.
  if (!current || current.logoSource !== task.logoSource) return
  const logoFileId = await cacheLogo(task.jobId, task.logoSource, current)
  const attemptedAt = Date.now()
  if (!logoFileId) {
    const attempted = {
      ...current,
      logoLastAttemptAt: attemptedAt
    }
    await Promise.all([
      db.collection(jobsCollection).doc(id).set(withoutDocumentId(attempted)),
      db.collection(jobListCollection).doc(id).set(withoutDocumentId(jobListDocument(attempted)))
    ])
    invalidateListDocumentCache()
    return
  }
  if (logoFileId === current.logoFileId) return
  await db.collection(jobsCollection).doc(id).set(withoutDocumentId({
    ...current,
    logoFileId,
    logoLastAttemptAt: attemptedAt,
    payload: {
      ...(current.payload || {}),
      cachedLogoUrl: logoFileId,
      cachedCompanyLogoUrl: logoFileId
    }
  }))
  await db.collection(jobListCollection).doc(id).set(withoutDocumentId(jobListDocument({
    id,
    jobId: current.jobId,
    status: current.status,
    featured: current.featured,
    defaultRank: current.defaultRank,
    lastSeenSyncId: current.lastSeenSyncId,
    payload: {
      ...(current.payload || {}),
      cachedLogoUrl: logoFileId,
      cachedCompanyLogoUrl: logoFileId
    }
  })))
  invalidateListDocumentCache()
}

function buildSyncQuery(state = {}) {
  return {
    page: state.page || 1,
    limit: SYNC_PAGE_SIZE,
    ...(state.cursor ? { cursor: state.cursor } : {})
  }
}

let logoQueue = new Map()
let logoWorkerPromise = null

function scheduleLogoCache(tasks) {
  for (const task of tasks) {
    const jobId = String(task?.jobId || '').trim()
    const logoSource = String(task?.logoSource || '').trim()
    if (jobId && logoSource) logoQueue.set(jobId, { jobId, logoSource })
  }
  if (logoWorkerPromise) return
  logoWorkerPromise = (async () => {
    while (logoQueue.size > 0) {
      const batch = [...logoQueue.values()].slice(0, SYNC_PAGE_SIZE)
      batch.forEach((task) => logoQueue.delete(task.jobId))
      await runWithConcurrency(batch, LOGO_CONCURRENCY, cacheJobLogo)
    }
  })()
    .catch((error) => console.warn('[mini-cloudrun] deferred logo cache failed', error?.message || error))
    .finally(() => {
      logoWorkerPromise = null
      if (logoQueue.size > 0) scheduleLogoCache([])
    })
}

async function writeBatch(jobs, { syncRunId = '', defaultRankStart = null } = {}) {
  if (jobs.length === 0) return { changed: 0, unchanged: 0, logoQueued: 0 }
  const existingIndexes = new Map(
    (await readAllListDocuments())
      .map(unwrapDocument)
      .filter((record) => record?._id)
      .map((record) => [String(record._id), record])
  )
  const results = []
  await runWithConcurrency(jobs.map((job, index) => ({ job, index })), WRITE_CONCURRENCY, async ({ job, index }) => {
    const result = await storeJob(job, {
      syncRunId,
      defaultRank: defaultRankStart != null && Number.isFinite(Number(defaultRankStart)) ? Number(defaultRankStart) + index : null,
      existingIndex: existingIndexes.get(jobDocumentId(job.id)) || null
    })
    results.push(result)
  })
  // Logo IO is intentionally detached from the cache write. A slow third-party
  // image must never delay the job list, the detail endpoint, or sync progress.
  const logoTasks = results.map((result) => result.logoTask).filter(Boolean)
  scheduleLogoCache(logoTasks)
  return {
    changed: results.filter((result) => result.changed).length,
    unchanged: results.filter((result) => !result.changed).length,
    logoQueued: logoTasks.length
  }
}

async function removeStaleCacheDocuments(syncRunId, { maxRemovalRatio = STALE_CLEANUP_MAX_RATIO } = {}) {
  if (!syncRunId) return { removed: 0 }
  const records = await readAllListDocuments({ bypassCache: true })
  const stale = records.filter((record) => String(record?.lastSeenSyncId || '') !== syncRunId)
  const cleanup = staleCleanupDecision({
    total: records.length,
    stale: stale.length,
    maxRemovalRatio
  })
  if (!cleanup.allowed) {
    console.error('[mini-cloudrun] stale cleanup blocked by safety threshold', cleanup)
    return { removed: 0, skipped: true, candidates: stale.length, removalRatio: cleanup.removalRatio }
  }
  const fileIds = []
  await runWithConcurrency(stale, WRITE_CONCURRENCY, async (record) => {
    const id = String(record?._id || '').trim()
    if (!id) return
    const detail = await db.collection(jobsCollection).doc(id).get().catch(() => ({ data: [] }))
    const job = unwrapDocument(detail.data?.[0])
    if (job?.logoFileId) fileIds.push(job.logoFileId)
    await Promise.all([
      db.collection(jobsCollection).doc(id).remove().catch(() => null),
      db.collection(jobListCollection).doc(id).remove().catch(() => null)
    ])
  })
  for (let index = 0; index < fileIds.length; index += 50) {
    await cloudApp.deleteFile({ fileList: fileIds.slice(index, index + 50) }).catch((error) => {
      console.warn('[mini-cloudrun] stale logo cleanup failed', error?.message || error)
    })
  }
  if (stale.length > 0) invalidateListDocumentCache()
  return { removed: stale.length, skipped: false, candidates: stale.length, removalRatio: cleanup.removalRatio }
}

let listDocumentCache = null

function invalidateListDocumentCache() {
  listDocumentCache = null
}

async function readAllListDocuments({ bypassCache = false } = {}) {
  if (
    !bypassCache &&
    listDocumentCache &&
    Date.now() - listDocumentCache.loadedAt < LIST_MEMORY_CACHE_MS
  ) {
    return listDocumentCache.records
  }
  const records = []
  let offset = 0
  while (offset < LIST_INDEX_MAX_RECORDS) {
    const result = await db.collection(jobListCollection)
      .skip(offset)
      .limit(LIST_INDEX_FETCH_LIMIT)
      .get()
    const batch = Array.isArray(result.data) ? result.data : []
    records.push(...batch)
    if (batch.length < LIST_INDEX_FETCH_LIMIT) break
    offset += batch.length
  }
  if (records.length >= LIST_INDEX_MAX_RECORDS) {
    throw new Error(`List cache exceeds safety cap: ${LIST_INDEX_MAX_RECORDS}`)
  }
  listDocumentCache = { records, loadedAt: Date.now() }
  return records
}

async function syncJobs({ force = false } = {}) {
  const state = await getSyncState({ bypassCache: true })
  const sourceChanged = sourceStateChanged(state)
  const cacheModelMigration =
    String(state.cacheModelVersion || '') !== CACHE_MODEL_VERSION ||
    state.cacheModelMigrationInProgress === true
  const restartFullSync = force || sourceChanged
  const fullSyncDue = syncDecision({
    state,
    force,
    sourceChanged,
    cacheRefreshMs: CACHE_REFRESH_MS,
    fullSyncIntervalMs: FULL_SYNC_INTERVAL_MS
  }).full
  const run = fullSyncDue
    ? {
        mode: 'full',
        page: restartFullSync ? 1 : Math.max(1, Number(state.fullSyncPage) || 1),
        cursor: '',
        newestCursor: restartFullSync ? '' : String(state.fullSyncNewestCursor || ''),
        syncRunId: restartFullSync ? crypto.randomUUID() : String(state.fullSyncRunId || crypto.randomUUID())
      }
    : {
        mode: 'incremental',
        page: Math.max(1, Number(state.incrementalPage) || 1),
        cursor: String(state.cursor || ''),
        newestCursor: String(state.incrementalNewestCursor || state.cursor || '')
      }

  let hasMore = true
  let pagesProcessed = 0
  let jobsProcessed = 0
  let jobsWritten = 0
  let jobsUnchanged = 0
  let logosQueued = 0
  while (hasMore && pagesProcessed < SYNC_MAX_PAGES_PER_RUN) {
    const pageBeingProcessed = run.page
    const batch = await gatewayRequest('sync', { query: buildSyncQuery(run) })
    const jobs = Array.isArray(batch.jobs) ? batch.jobs : []
    jobsProcessed += jobs.length
    const writes = await writeBatch(jobs, {
      syncRunId: run.mode === 'full' ? run.syncRunId : '',
      defaultRankStart: run.mode === 'full' ? (pageBeingProcessed - 1) * SYNC_PAGE_SIZE : null
    })
    jobsWritten += writes.changed
    jobsUnchanged += writes.unchanged
    logosQueued += writes.logoQueued
    if (batch.nextCursor && batch.nextCursor > run.newestCursor) run.newestCursor = batch.nextCursor
    hasMore = Boolean(batch.hasMore)
    run.page += 1
    pagesProcessed += 1
  }

  const completed = !hasMore
  const nextState = {
    ...state,
    jobsSourceOrigin: jobsApiOrigin,
    cacheModelVersion: CACHE_MODEL_VERSION,
    cacheModelMigrationInProgress: run.mode === 'full' && !completed ? cacheModelMigration : false,
    cacheReady: completed && run.mode === 'full' ? true : Boolean(state.cacheReady),
    fullSyncInProgress: run.mode === 'full' && !completed,
    lastSyncAt: Date.now(),
    ...(completed && run.mode === 'full'
      ? {
          staleCleanupSkippedAt: 0,
          staleCleanupCandidates: 0,
          staleCleanupRemovalRatio: 0
        }
      : {}),
    ...(run.mode === 'full'
      ? {
          fullSyncPage: completed ? 1 : run.page,
          fullSyncNewestCursor: completed ? '' : run.newestCursor,
          fullSyncRunId: completed ? '' : run.syncRunId,
          cursor: completed ? run.newestCursor : String(state.cursor || ''),
          lastFullSyncAt: completed ? Date.now() : Number(state.lastFullSyncAt || 0)
        }
      : {
          incrementalPage: completed ? 1 : run.page,
          incrementalNewestCursor: completed ? '' : run.newestCursor,
          cursor: completed ? run.newestCursor : String(state.cursor || '')
        })
  }
  await setSyncState(nextState)
  const cleanup = completed && run.mode === 'full'
    ? await removeStaleCacheDocuments(run.syncRunId, {
        maxRemovalRatio: cacheModelMigration ? CACHE_MODEL_MIGRATION_MAX_RATIO : STALE_CLEANUP_MAX_RATIO
      })
    : { removed: 0, skipped: false, candidates: 0, removalRatio: 0 }
  if (cleanup.skipped) {
    await setSyncState({
      ...nextState,
      staleCleanupSkippedAt: Date.now(),
      staleCleanupCandidates: cleanup.candidates,
      staleCleanupRemovalRatio: cleanup.removalRatio
    })
  }
  return {
    completed,
    mode: run.mode,
    pagesProcessed,
    jobsProcessed,
    jobsWritten,
    jobsUnchanged,
    logosQueued,
    staleRemoved: cleanup.removed,
    staleCleanupSkipped: Boolean(cleanup.skipped),
    staleCleanupCandidates: Number(cleanup.candidates || 0)
  }
}

async function syncJobsToCompletion({ force = false } = {}) {
  let nextForce = force
  let batchesProcessed = 0
  let pagesProcessed = 0
  let jobsProcessed = 0
  let jobsWritten = 0
  let jobsUnchanged = 0
  let logosQueued = 0
  let staleRemoved = 0
  let staleCleanupSkipped = false
  let staleCleanupCandidates = 0
  let latest = null
  const maxBatches = Math.ceil(LIST_INDEX_MAX_RECORDS / SYNC_PAGE_SIZE / SYNC_MAX_PAGES_PER_RUN) + 2
  do {
    latest = await syncJobs({ force: nextForce })
    nextForce = false
    batchesProcessed += 1
    pagesProcessed += Number(latest.pagesProcessed || 0)
    jobsProcessed += Number(latest.jobsProcessed || 0)
    jobsWritten += Number(latest.jobsWritten || 0)
    jobsUnchanged += Number(latest.jobsUnchanged || 0)
    logosQueued += Number(latest.logosQueued || 0)
    staleRemoved += Number(latest.staleRemoved || 0)
    staleCleanupSkipped ||= Boolean(latest.staleCleanupSkipped)
    staleCleanupCandidates += Number(latest.staleCleanupCandidates || 0)
    if (!latest.completed) {
      await renewSyncLease()
      await new Promise((resolve) => setImmediate(resolve))
    }
  } while (!latest.completed && batchesProcessed < maxBatches)
  if (!latest?.completed) throw new Error(`Job sync did not finish after ${maxBatches} batches`)
  return {
    ...latest,
    batchesProcessed,
    pagesProcessed,
    jobsProcessed,
    jobsWritten,
    jobsUnchanged,
    logosQueued,
    staleRemoved,
    staleCleanupSkipped,
    staleCleanupCandidates,
    jobsSourceOrigin: jobsApiOrigin
  }
}

let syncPromise = null
function scheduleSync({ force = false } = {}) {
  if (!legacyJobCacheEnabled) return Promise.resolve({ skipped: true, reason: 'legacy_job_cache_disabled' })
  if (syncPromise) return syncPromise
  syncPromise = runSyncWithLease({ force })
    .then((result) => {
      if (result.skipped) console.log('[mini-cloudrun] sync skipped', result)
      else console.log('[mini-cloudrun] sync completed', result)
      return result
    })
    .catch((error) => console.error('[mini-cloudrun] background sync failed', {
      message: error?.message || String(error),
      failures: Array.isArray(error?.failures)
        ? error.failures.slice(0, 3).map(({ item, error: failure }) => ({
            jobId: item?.id,
            code: failure?.code || failure?.errCode,
            message: failure?.message || String(failure)
          }))
        : undefined
    }))
    .finally(() => { syncPromise = null })
  return syncPromise
}

async function runSyncWithLease({ force = false } = {}) {
  if (!legacyJobCacheEnabled) return { skipped: true, reason: 'legacy_job_cache_disabled' }
  const lease = await acquireSyncLease({ force })
  if (!lease.acquired) {
    return { skipped: true, reason: lease.reason, mode: lease.full ? 'full' : 'incremental' }
  }
  try {
    return await syncJobsToCompletion({ force: lease.restartFull })
  } finally {
    await releaseSyncLease()
  }
}

function buildJobsResponse(items, query) {
  const search = String(query.search || '').trim().toLowerCase()
  const category = String(query.category || '').trim()
  const featured = String(query.featured || '') === 'true'
  const sortBy = String(query.sortBy || 'default').trim()
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20))
  const categoryTerms = category.split(',').map((value) => value.trim().toLowerCase()).filter(Boolean)
  const matchesCategory = (item) => {
    if (categoryTerms.length === 0) return true
    const payload = item.payload || {}
    const haystack = [payload.category, payload.title, payload.type, payload.jobType, ...(payload.tags || [])]
      .join(' ')
      .toLowerCase()
    if (categoryTerms.length === 1 && categoryTerms[0] === 'freelance') {
      return /(freelance|freelancer|自由职业|part[- ]?time|兼职|contractor|contract|合同工|合同制)/i.test(haystack)
    }
    return categoryTerms.some((term) => haystack.includes(term))
  }
  const searchScore = (item) => {
    if (!search) return 0
    const payload = item.payload || {}
    const title = String(payload.title || '').toLowerCase()
    const company = String(payload.company || '').toLowerCase()
    const categoryText = String(payload.category || '').toLowerCase()
    const tags = (payload.tags || []).join(' ').toLowerCase()
    return (company === search ? 1200 : 0) +
      (title === search ? 1000 : 0) +
      (categoryText === search ? 850 : 0) +
      (company.includes(search) ? 700 : 0) +
      (title.includes(search) ? 620 : 0) +
      (categoryText.includes(search) ? 500 : 0) +
      (tags.includes(search) ? 280 : 0)
  }
  const compareStableId = (a, b) => String(b.payload?.id || b.jobId || '')
    .localeCompare(String(a.payload?.id || a.jobId || ''))
  const compareDefault = (a, b) => {
    const searchDifference = searchScore(b) - searchScore(a)
    if (searchDifference) return searchDifference
    const rankA = a.defaultRank != null && Number.isFinite(Number(a.defaultRank)) ? Number(a.defaultRank) : Number.MAX_SAFE_INTEGER
    const rankB = b.defaultRank != null && Number.isFinite(Number(b.defaultRank)) ? Number(b.defaultRank) : Number.MAX_SAFE_INTEGER
    if (rankA !== rankB) return rankA - rankB
    const featuredDifference = Number(Boolean(b.payload?.editorialFeatured)) - Number(Boolean(a.payload?.editorialFeatured))
    if (featuredDifference) return featuredDifference
    const publishedDifference = String(b.payload?.publishedAt || '').localeCompare(String(a.payload?.publishedAt || ''))
    if (publishedDifference) return publishedDifference
    const memberDifference = Number(Boolean(b.payload?.memberOnly)) - Number(Boolean(a.payload?.memberOnly))
    if (memberDifference) return memberDifference
    const trustedDifference = Number(Boolean(b.payload?.isTrusted)) - Number(Boolean(a.payload?.isTrusted))
    if (trustedDifference) return trustedDifference
    return compareStableId(a, b)
  }
  const compareRecent = (a, b) => (
    String(b.payload?.publishedAt || '').localeCompare(String(a.payload?.publishedAt || ''))
    || compareStableId(a, b)
  )
  const all = items
    .filter((item) => item.status !== 'closed' && item.status !== 'expired')
    .filter((item) => !featured || item.featured)
    .filter(matchesCategory)
    .filter((item) => !search || [item.payload?.title, item.payload?.company, ...(item.payload?.tags || [])].join(' ').toLowerCase().includes(search))
    .sort(sortBy === 'recent' ? compareRecent : compareDefault)
  const categoryCounts = new Map()
  for (const item of all) {
    const value = String(item.payload?.category || '').trim()
    if (value) categoryCounts.set(value, Number(categoryCounts.get(value) || 0) + 1)
  }
  const categories = [...categoryCounts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'))
    .slice(0, 6)
  return { jobs: all.slice((page - 1) * limit, page * limit).map((item) => item.payload), total: all.length, page, pageSize: limit, totalPages: Math.max(1, Math.ceil(all.length / limit)), categories }
}

async function fetchUpstreamJobs(query) {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20))
  const batch = await gatewayRequest('sync', {
    query: {
      page,
      limit,
      ...(query.search ? { search: query.search } : {}),
      ...(query.category ? { category: query.category } : {}),
      ...(query.featured ? { featured: query.featured } : {}),
      ...(query.sortBy ? { sortBy: query.sortBy } : {})
    }
  })
  const jobs = (Array.isArray(batch.jobs) ? batch.jobs : []).map((job) => publicJob(job))
  const total = Math.max(0, Number(batch.total || jobs.length))
  return {
    jobs,
    total,
    page,
    pageSize: limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    categories: [],
    source: 'upstream-cold-cache'
  }
}

async function fetchUpstreamJob(jobId) {
  const batch = await gatewayRequest('sync', { query: { id: jobId, page: 1, limit: 1 } })
  const job = Array.isArray(batch.jobs) ? batch.jobs[0] : null
  return job ? publicJob(job) : null
}

async function fetchUpstreamJobSnapshot(jobId) {
  const batch = await gatewayRequest('sync', { query: { id: jobId, page: 1, limit: 1 } })
  const job = Array.isArray(batch.jobs) ? batch.jobs[0] : null
  if (!job || String(job.id || job.jobId || '') !== String(jobId || '')) return null
  return {
    id: String(job.id || job.jobId || ''),
    title: String(job.title || '').slice(0, 255),
    company: String(job.company || '').slice(0, 255),
    memberOnly: Boolean(job.memberOnly),
    url: String(job.url || '').slice(0, 2048),
    sourceUrl: String(job.sourceUrl || '').slice(0, 2048),
    hiringEmail: String(job.hiringEmail || '').slice(0, 320),
    emailType: String(job.emailType || '').slice(0, 50)
  }
}

async function getSubscriptionOptions(limit = 120) {
  const documents = await readAllListDocuments().catch(() => [])
  const counts = new Map()
  for (const record of documents.map(unwrapDocument)) {
    if (!record?.payload || ['inactive', 'closed', 'expired'].includes(String(record.status || '').toLowerCase())) continue
    const category = String(record.payload.category || '').trim()
    if (!category || ['其他', 'other', 'unspecified'].includes(category.toLowerCase())) continue
    counts.set(category, Number(counts.get(category) || 0) + 1)
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, label: value, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'zh-CN'))
    .slice(0, Math.max(1, Math.min(200, Number(limit) || 120)))
}

async function listJobs(query) {
  // Mini Program 1.0 keeps the legacy cache disabled. Do not serve any
  // documents left by an older RSS-inclusive deployment; the upstream sync
  // endpoint now enforces the trusted-company boundary.
  if (!legacyJobCacheEnabled) return fetchUpstreamJobs(query)
  if (query.search) {
    const state = await getSyncState().catch((error) => {
      console.warn('[mini-cloudrun] sync state unavailable during search', error?.message || error)
      return null
    })
    if (state && Date.now() - Number(state.lastSyncAt || 0) >= CACHE_REFRESH_MS) void scheduleSync()
    return fetchUpstreamJobs(query)
  }
  let listUnavailable = false
  const [state, result] = await Promise.all([
    getSyncState().catch((error) => {
      console.warn('[mini-cloudrun] sync state unavailable while serving cache', error?.message || error)
      return null
    }),
    readAllListDocuments().catch((error) => {
      console.warn('[mini-cloudrun] list cache unavailable, falling back upstream', error?.message || error)
      listUnavailable = true
      return []
    })
  ])
  const cached = result.map(unwrapDocument).filter((item) => item?.payload)
  if (listUnavailable || cached.length === 0 || (state && !state.cacheReady)) {
    // The first visitor gets a prompt upstream response. Full cache hydration is
    // deliberately best-effort work after the HTTP response is released.
    const response = await fetchUpstreamJobs(query)
    // An empty index alongside an old full cache means this is the first
    // deployment with the lightweight list collection. Rebuild it once, while
    // still answering the current request from Vercel immediately.
    if (!listUnavailable && state) {
      void scheduleSync({ force: Boolean(state.cacheReady && cached.length === 0) })
    }
    return response
  }
  if (state && Date.now() - Number(state.lastSyncAt || 0) >= CACHE_REFRESH_MS) void scheduleSync()
  return buildJobsResponse(cached, query)
}

async function enforceBrowseAllowance(session, jobs) {
  if (!session?.openid) {
    const error = new Error('请先完成微信登录后浏览岗位')
    error.statusCode = 401
    error.payload = { code: 'MINI_SESSION_REQUIRED', error: error.message }
    throw error
  }
  const jobIds = (Array.isArray(jobs) ? jobs : []).map((job) => String(job?.id || '')).filter(Boolean)
  if (jobIds.length === 0) return { jobs: [], browse: null }
  const browse = await gatewayRequest('browse', {
    method: 'POST',
    body: { openid: session.openid, jobIds }
  })
  const allowed = new Set(Array.isArray(browse.allowedJobIds) ? browse.allowedJobIds : [])
  return { jobs: jobs.filter((job) => allowed.has(String(job?.id || ''))), browse }
}

async function getBrowseStatus(session) {
  if (!session?.openid || !session?.userId) return null
  return gatewayRequest('browse', {
    method: 'POST',
    body: { openid: session.openid, consume: false, mode: 'status' }
  })
}

async function canVisitorOpenJob(jobId) {
  const preview = await listJobs({ page: 1, limit: 20, sortBy: 'default' })
  return preview.jobs.some((job) => String(job?.id || '') === String(jobId || ''))
}

async function getCachedJobs(jobIds, limit = 100) {
  const records = await Promise.all((Array.isArray(jobIds) ? jobIds : []).slice(0, limit).map(async (jobId) => {
    const result = await db.collection(jobsCollection).doc(jobDocumentId(jobId)).get().catch(() => ({ data: [] }))
    const cached = unwrapDocument(result.data?.[0])?.payload || null
    if (cached) return cached
    const upstream = await fetchUpstreamJob(jobId).catch(() => null)
    return upstream ? publicJob(upstream) : null
  }))
  return records.filter(Boolean)
}

async function exchangeCode(code) {
  if (!code || code.length > 256) {
    const error = new Error('无效的微信登录凭证')
    error.statusCode = 400
    error.payload = { code: 'INVALID_WECHAT_CODE', error: error.message }
    throw error
  }
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.search = new URLSearchParams({ appid: appId, secret: appSecret, js_code: code, grant_type: 'authorization_code' }).toString()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || !payload.openid) {
      const error = new Error('微信登录凭证无效或已过期')
      error.statusCode = 401
      error.payload = { code: 'WECHAT_LOGIN_FAILED', error: error.message }
      throw error
    }
    return {
      openid: String(payload.openid || ''),
      sessionKey: String(payload.session_key || '')
    }
  } catch (error) {
    if (error?.statusCode) throw error
    const unavailable = new Error('微信登录服务暂时不可用，请稍后重试')
    unavailable.statusCode = 503
    unavailable.payload = { code: 'WECHAT_SERVICE_UNAVAILABLE', error: unavailable.message }
    throw unavailable
  }
}

function virtualPaymentConfig() {
  if (
    !/^[A-Za-z0-9._:-]{1,128}$/.test(virtualPaymentOfferId) ||
    virtualPaymentAppKey.length < 16
  ) {
    const error = new Error('微信虚拟支付尚未完成配置')
    error.statusCode = 503
    error.payload = { code: 'VIRTUAL_PAYMENT_NOT_CONFIGURED', error: error.message }
    throw error
  }
  return {
    offerId: virtualPaymentOfferId,
    appKey: virtualPaymentAppKey,
    env: virtualPaymentEnv
  }
}

function virtualPaymentSignature(key, value) {
  return crypto.createHmac('sha256', key).update(value).digest('hex')
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    let receivedBytes = 0
    let settled = false
    req.on('data', (chunk) => {
      if (settled) return
      receivedBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk))
      if (receivedBytes > MAX_REQUEST_BODY_BYTES) {
        settled = true
        const error = new Error('请求内容过大')
        error.statusCode = 413
        error.payload = { code: 'REQUEST_TOO_LARGE', error: error.message }
        reject(error)
        return
      }
      body += chunk
    })
    req.on('end', () => {
      if (settled) return
      try {
        settled = true
        resolve(body ? JSON.parse(body) : {})
      } catch {
        settled = true
        const error = new Error('请求内容不是有效的 JSON')
        error.statusCode = 400
        error.payload = { code: 'INVALID_JSON', error: error.message }
        reject(error)
      }
    })
    req.on('error', (error) => {
      if (settled) return
      settled = true
      reject(error)
    })
  })
}

async function materializeCareerResumeFile(fileId, userId) {
  const normalizedFileId = String(fileId || '').trim()
  const owner = String(userId || '').replace(/[^A-Za-z0-9_-]/g, '_')
  if (
    !/^cloud:\/\/[A-Za-z0-9_.@/-]+$/.test(normalizedFileId) ||
    !owner ||
    !normalizedFileId.includes(`/mini-career-resumes/${owner}/`)
  ) {
    const error = new Error('简历文件无效，请重新选择')
    error.statusCode = 400
    error.payload = { success: false, code: 'INVALID_RESUME_FILE', error: error.message }
    throw error
  }
  const downloaded = await cloudApp.downloadFile({ fileID: normalizedFileId })
  const buffer = Buffer.isBuffer(downloaded?.fileContent)
    ? downloaded.fileContent
    : Buffer.from(downloaded?.fileContent || '')
  if (!buffer.length) throw new Error('简历文件为空，请重新选择')
  return { buffer, fileId: normalizedFileId }
}

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true })
    if (req.method === 'GET' && url.pathname === '/health/upstream') {
      const startedAt = Date.now()
      const result = await gatewayRequest('career_watch_options', { timeoutMs: 5000 })
      if (!Array.isArray(result?.filterOptions?.roles)) {
        const error = new Error('小程序上游接口返回无效')
        error.statusCode = 503
        throw error
      }
      return send(res, 200, {
        ok: true,
        upstream: true,
        latencyMs: Date.now() - startedAt
      })
    }
    if (req.method === 'POST' && url.pathname === '/internal/sync') {
      if (!syncSecret || req.headers['x-mini-sync-secret'] !== syncSecret) return send(res, 401, { error: 'Unauthorized' })
      const result = await runSyncWithLease({ force: url.searchParams.get('full') === 'true' })
      return send(res, 200, { success: true, ...result })
    }
    if (req.method === 'GET' && url.pathname === '/mini/home') {
      const session = getSession(req)
      const result = await gatewayRequest('content_home', {
        query: { openid: session?.openid || '' }
      })
      const [companies, notes] = await Promise.all([
        attachCompanyLogos(result.companies),
        attachNoteCovers(result.notes)
      ])
      return send(res, 200, { ...result, companies, notes })
    }
    if (req.method === 'GET' && url.pathname === '/mini/companies') {
      const session = getSession(req)
      const result = await readCurrentHiringCompanies({
        openid: session?.openid || '',
        search: url.searchParams.get('search') || '',
        industry: url.searchParams.get('industry') || '',
        page: url.searchParams.get('page') || '1',
        pageSize: url.searchParams.get('pageSize') || '20'
      })
      return send(res, 200, { ...result, companies: await attachCompanyLogos(result.companies) })
    }
    if (req.method === 'GET' && /^\/mini\/companies\/[^/]+$/.test(url.pathname)) {
      const session = getSession(req)
      const id = decodeURIComponent(url.pathname.split('/').pop())
      const result = await gatewayRequest('company', {
        query: { openid: session?.openid || '', id }
      })
      let jobs = []
      try {
        const formalJobs = await gatewayRequest('sync', {
          query: { search: String(result.company?.name || '').trim(), page: '1', limit: '100', sortBy: 'recent' }
        })
        jobs = canonicalCompanyJobs(formalJobs, id)
      } catch (error) {
        console.warn('[mini-cloudrun] formal company jobs unavailable', { companyId: id, message: error?.message || String(error) })
      }
      result.company = {
        ...result.company,
        jobs,
        openJobCount: jobs.length,
        hasPublicOpportunity: jobs.length > 0,
        publicOpportunityUpdatedAt: jobs[0]?.updatedAt || null
      }
      const [company] = await attachCompanyLogos(result.company ? [result.company] : [])
      return send(res, 200, { ...result, company: company || result.company })
    }
    if (req.method === 'GET' && /^\/mini\/companies\/[^/]+\/jobs\/[^/]+$/.test(url.pathname)) {
      const session = getSession(req)
      const parts = url.pathname.split('/')
      const companyId = decodeURIComponent(parts[3])
      const jobId = decodeURIComponent(parts[5])
      const companyResult = await gatewayRequest('company', {
        query: { openid: session?.openid || '', id: companyId }
      })
      const formalJobs = await gatewayRequest('sync', {
        query: { id: jobId, page: '1', limit: '1', sortBy: 'recent' }
      })
      const job = mapCompanyJobDetail(formalJobs.jobs?.[0], companyId)
      if (!job) return send(res, 404, { error: '岗位不存在或已下线' })
      return send(res, 200, {
        success: true,
        company: { id: companyId, name: String(companyResult.company?.name || job.company || '') },
        job
      })
    }
    if (req.method === 'GET' && url.pathname === '/mini/growth/notes') {
      const session = getSession(req)
      const result = await gatewayRequest('growth_notes', {
        query: {
          openid: session?.openid || '',
          pageSize: url.searchParams.get('pageSize') || '50'
        }
      })
      return send(res, 200, { ...result, notes: await attachNoteCovers(result.notes) })
    }
    if (req.method === 'GET' && /^\/mini\/growth\/notes\/[^/]+$/.test(url.pathname)) {
      const session = getSession(req)
      const id = decodeURIComponent(url.pathname.split('/').pop())
      const result = await gatewayRequest('growth_note', {
        query: { openid: session?.openid || '', id }
      })
      const [note] = await attachNoteCovers(result.note ? [result.note] : [])
      return send(res, 200, { ...result, note: note || result.note })
    }
    if (req.method === 'GET' && url.pathname === '/mini/membership/plans') {
      const session = getSession(req)
      const result = await gatewayRequest('membership_plans', {
        query: { openid: session?.openid || '' }
      })
      return send(res, 200, {
        ...result,
        paymentAvailable: Boolean(result.paymentAvailable && virtualPaymentOfferId && virtualPaymentAppKey)
      })
    }
    if (req.method === 'GET' && url.pathname === '/mini/member-services') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'LOGIN_REQUIRED', error: '请先登录并连接 Haigoo 账号' })
      const result = await gatewayRequest('member_services', { query: { openid: session.openid } })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && /^\/mini\/member-services\/[^/]+\/claim$/.test(url.pathname)) {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'LOGIN_REQUIRED', error: '请先登录并连接 Haigoo 账号' })
      const entitlementKey = decodeURIComponent(url.pathname.split('/')[3])
      const result = await gatewayRequest('member_services', {
        method: 'POST',
        body: { openid: session.openid, entitlementKey }
      })
      return send(res, 200, result)
    }
    if (req.method === 'GET' && url.pathname === '/mini/consultations/me') {
      const session = getSession(req)
      if (!session?.userId) {
        return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      }
      const result = await gatewayRequest('consultations', {
        query: { openid: session.openid }
      })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/consultations') {
      const session = getSession(req)
      if (!session?.userId) {
        return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      }
      const body = await readBody(req)
      const result = await gatewayRequest('consultations', {
        method: 'POST',
        body: {
          openid: session.openid,
          topic: body.topic,
          wechatId: body.wechatId,
          question: body.question,
          sourcePage: body.sourcePage,
          sourceContentId: body.sourceContentId,
          sourceCompanyId: body.sourceCompanyId,
          idempotencyKey: body.idempotencyKey,
          privacyVersion: body.privacyVersion,
          acceptedAt: body.acceptedAt,
          clientKey: requestClientKey(req)
        }
      })
      return send(res, 201, result)
    }
    if (req.method === 'GET' && url.pathname === '/mini/match') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const result = await gatewayRequest('career_state', { query: { openid: session.openid } })
      return send(res, 200, result)
    }
    if (req.method === 'GET' && url.pathname === '/mini/match/feed') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const result = await gatewayRequest('match_feed', { query: { openid: session.openid } })
      const recommendations = await attachCompanyLogos((result.recommendations || []).map((item) => ({ ...item, id: item.companyId })))
      return send(res, 200, { ...result, recommendations })
    }
    if (req.method === 'GET' && url.pathname === '/mini/career-watch') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'LOGIN_REQUIRED', error: '请先登录并连接 Haigoo 账号' })
      const result = await gatewayRequest('career_watch_state', { query: { openid: session.openid } })
      return send(res, 200, result)
    }
    if (req.method === 'GET' && url.pathname === '/mini/career-watch/options') {
      const result = await gatewayRequest('career_watch_options')
      return send(res, 200, result)
    }
    if (req.method === 'PUT' && url.pathname === '/mini/career-watch') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'LOGIN_REQUIRED', error: '请先登录并连接 Haigoo 账号' })
      const body = await readBody(req)
      const result = await gatewayRequest('career_watch_save', { method: 'PUT', body: { openid: session.openid, ...body } })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/career-watch/import') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'LOGIN_REQUIRED', error: '请先登录并连接 Haigoo 账号' })
      const body = await readBody(req)
      const result = await gatewayRequest('career_watch_import', { method: 'POST', body: { openid: session.openid, ...body } })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/career-watch/notifications') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'LOGIN_REQUIRED', error: '请先登录并连接 Haigoo 账号' })
      const body = await readBody(req)
      const result = await gatewayRequest('career_watch_notifications', {
        method: 'POST',
        body: { openid: session.openid, enabled: body.enabled, templateStatus: body.templateStatus }
      })
      return send(res, 200, result)
    }
    if (req.method === 'GET' && url.pathname === '/mini/match/follows') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const result = await gatewayRequest('match_follows', { query: { openid: session.openid } })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/match/follows') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const body = await readBody(req)
      const result = await gatewayRequest('match_follows', { method: 'POST', body: { openid: session.openid, ...body } })
      return send(res, 200, result)
    }
    if (req.method === 'DELETE' && /^\/mini\/match\/follows\/[^/]+$/.test(url.pathname)) {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const companyId = decodeURIComponent(url.pathname.split('/').pop())
      const result = await gatewayRequest('match_follows', { method: 'DELETE', query: { openid: session.openid, companyId } })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && /^\/mini\/match\/follows\/[^/]+\/notifications$/.test(url.pathname)) {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const companyId = decodeURIComponent(url.pathname.split('/')[4])
      const body = await readBody(req)
      const result = await gatewayRequest('match_notifications', { method: 'POST', body: { openid: session.openid, companyId, ...body } })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/match/feedback') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const body = await readBody(req)
      const result = await gatewayRequest('match_feedback', { method: 'POST', body: { openid: session.openid, ...body } })
      return send(res, 200, result)
    }
    if (req.method === 'GET' && url.pathname === '/mini/match/updates') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const result = await gatewayRequest('match_updates', { query: { openid: session.openid } })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/match/updates/read') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const body = await readBody(req)
      const result = await gatewayRequest('match_updates', { method: 'POST', body: { openid: session.openid, ...body } })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/match/apply-ticket') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const body = await readBody(req)
      const result = await gatewayRequest('match_apply_ticket', { method: 'POST', body: { openid: session.openid, ...body } })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/match/resume/parse') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const body = await readBody(req)
      let materialized = null
      try {
        if (body.fileId) materialized = await materializeCareerResumeFile(body.fileId, session.userId)
        const result = await gatewayRequest('career_resume_parse', {
          method: 'POST',
          timeoutMs: 60000,
          body: {
            openid: session.openid,
            filename: body.filename,
            fileBase64: materialized?.buffer?.toString('base64') || body.fileBase64
          }
        })
        return send(res, 200, result)
      } finally {
        if (materialized?.fileId) await cloudApp.deleteFile({ fileList: [materialized.fileId] }).catch(() => undefined)
      }
    }
    if (req.method === 'POST' && url.pathname === '/mini/match/resume/sync') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const body = await readBody(req)
      let materialized = null
      try {
        if (body.fileId) materialized = await materializeCareerResumeFile(body.fileId, session.userId)
        const result = await gatewayRequest('career_resume_sync', {
          method: 'POST',
          timeoutMs: 60000,
          body: {
            openid: session.openid,
            filename: body.filename,
            fileBase64: materialized?.buffer?.toString('base64') || body.fileBase64
          }
        })
        return send(res, 200, result)
      } finally {
        if (materialized?.fileId) await cloudApp.deleteFile({ fileList: [materialized.fileId] }).catch(() => undefined)
      }
    }
    if (req.method === 'PUT' && url.pathname === '/mini/match/profile') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const body = await readBody(req)
      const result = await gatewayRequest('career_profile', {
        method: 'PUT',
        body: { openid: session.openid, ...body }
      })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/match/analyze') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const body = await readBody(req)
      const result = await gatewayRequest('career_analyze', {
        method: 'POST',
        timeoutMs: 120000,
        body: { openid: session.openid, ...body }
      })
      return send(res, 200, result)
    }
    if (req.method === 'DELETE' && url.pathname === '/mini/match/data') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const body = await readBody(req)
      const result = await gatewayRequest('career_delete', { method: 'DELETE', body: { openid: session.openid, ...body } })
      return send(res, 200, result)
    }
    if (req.method === 'GET' && url.pathname === '/mini/jobs') {
      const session = getSession(req)
      const query = Object.fromEntries(url.searchParams)
      const isVisitor = !session?.userId
      const isHomePreview = isVisitor && query.surface === 'home'
      const result = await listJobs(isVisitor
        ? isHomePreview
          ? { page: 1, limit: 6, ...(query.featured === 'true' ? { featured: 'true' } : {}), sortBy: 'default' }
          : { page: 1, limit: 20, sortBy: 'default' }
        : query)
      const browse = isVisitor ? null : await getBrowseStatus(session)
      return send(res, 200, {
        ...result,
        ...(isVisitor ? {
          total: result.jobs.length,
          page: 1,
          pageSize: result.jobs.length,
          totalPages: 1,
          categories: []
        } : {}),
        browse: browse ? {
          viewedCount: browse.viewedCount,
          remaining: browse.remaining,
          limited: browse.limited
        } : undefined
      })
    }
    if (req.method === 'GET' && /^\/mini\/jobs\/[^/]+$/.test(url.pathname)) {
      const jobId = decodeURIComponent(url.pathname.split('/').pop())
      const result = legacyJobCacheEnabled
        ? await db.collection(jobsCollection).doc(jobDocumentId(jobId)).get().catch(() => ({ data: [] }))
        : { data: [] }
      const job = unwrapDocument(result.data?.[0])?.payload
      if (job) {
        const session = getSession(req)
        if (!session?.userId) {
          if (!await canVisitorOpenJob(jobId)) {
            return send(res, 401, {
              code: 'ACCOUNT_BIND_REQUIRED',
              error: '登录后可继续查看更多岗位'
            })
          }
          return send(res, 200, { job, access: { visitorPreview: true } })
        }
        const { jobs, browse } = await enforceBrowseAllowance(session, [job])
        if (jobs.length === 0) {
          return send(res, 403, {
            code: 'MINI_BROWSE_LIMIT_REACHED',
            error: '免费版本可享有100次查看额度，完整功能可前往网站或了解 Club 权益。',
            browse: { viewedCount: browse?.viewedCount || 100, remaining: browse?.remaining || 0 }
          })
        }
        const state = await getSyncState().catch((error) => {
          console.warn('[mini-cloudrun] sync state unavailable while serving job detail', error?.message || error)
          return null
        })
        if (state && Date.now() - Number(state.lastSyncAt || 0) >= CACHE_REFRESH_MS) void scheduleSync()
        return send(res, 200, { job: jobs[0], browse })
      }
      const upstreamJob = await fetchUpstreamJob(jobId)
      void scheduleSync()
      if (!upstreamJob) return send(res, 404, { error: '岗位不存在或已下线' })
      const session = getSession(req)
      if (!session?.userId) {
        if (!await canVisitorOpenJob(jobId)) {
          return send(res, 401, {
            code: 'ACCOUNT_BIND_REQUIRED',
            error: '登录后可继续查看更多岗位'
          })
        }
        return send(res, 200, { job: upstreamJob, source: 'upstream-cold-cache', access: { visitorPreview: true } })
      }
      const { jobs, browse } = await enforceBrowseAllowance(session, [upstreamJob])
      if (jobs.length === 0) {
        return send(res, 403, {
          code: 'MINI_BROWSE_LIMIT_REACHED',
          error: '免费版本可享有100次查看额度，完整功能可前往网站或了解 Club 权益。',
          browse: { viewedCount: browse?.viewedCount || 100, remaining: browse?.remaining || 0 }
        })
      }
      return send(res, 200, { job: jobs[0], source: 'upstream-cold-cache', browse })
    }
    if (req.method === 'GET' && url.pathname === '/mini/browse-status') {
      const session = getSession(req)
      if (!session?.userId) return send(res, 200, { authenticated: false, browse: null })
      const browse = await getBrowseStatus(session)
      return send(res, 200, { authenticated: true, browse })
    }
    if (req.method === 'POST' && url.pathname === '/mini/auth/session') {
      const body = await readBody(req)
      const { openid } = await exchangeCode(String(body.code || ''))
      const session = await gatewayRequest('session', { method: 'POST', body: { openid } })
      return send(res, 200, { ...session, token: sessionToken({ openid, userId: session.user?.userId || null }) })
    }
    if (req.method === 'POST' && url.pathname === '/mini/account/bind') {
      const session = getSession(req)
      if (!session) return send(res, 401, { error: '微信登录已失效，请重新登录' })
      const body = await readBody(req)
      const bound = await gatewayRequest('bind', {
        method: 'POST',
        body: {
          openid: session.openid,
          email: body.email,
          password: body.password,
          clientKey: requestClientKey(req)
        }
      })
      return send(res, 200, { ...bound, token: sessionToken({ openid: session.openid, userId: bound.user?.userId || null }) })
    }
    if (req.method === 'POST' && url.pathname === '/mini/account/register') {
      const session = getSession(req)
      if (!session) return send(res, 401, { error: '微信登录已失效，请重新登录' })
      const body = await readBody(req)
      const registrationBody = {
        openid: session.openid,
        email: body.email,
        password: body.password,
        agreementVersion: body.agreementVersion,
        privacyVersion: body.privacyVersion,
        acceptedAt: body.acceptedAt,
        clientKey: requestClientKey(req)
      }
      if (String(body.username || '').trim()) registrationBody.username = String(body.username).trim()
      const registered = await gatewayRequest('register', {
        method: 'POST',
        body: registrationBody
      })
      return send(res, 201, { ...registered, token: sessionToken({ openid: session.openid, userId: registered.user?.userId || null }) })
    }
    if (req.method === 'POST' && url.pathname === '/mini/account/request-password-reset') {
      const session = getSession(req)
      if (!session) return send(res, 401, { error: '微信登录已失效，请重新登录' })
      const body = await readBody(req)
      const result = await gatewayRequest('request_password_reset', {
        method: 'POST',
        body: {
          openid: session.openid,
          email: body.email,
          clientKey: requestClientKey(req)
        }
      })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/account/unbind') {
      const session = getSession(req)
      if (!session) return send(res, 401, { error: '微信登录已失效，请重新登录' })
      const body = await readBody(req)
      const result = await gatewayRequest('unbind_wechat', {
        method: 'POST',
        body: {
          openid: session.openid,
          password: body.password,
          clientKey: requestClientKey(req)
        }
      })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/account/delete') {
      const session = getSession(req)
      if (!session) return send(res, 401, { error: '微信登录已失效，请重新登录' })
      const body = await readBody(req)
      const result = await gatewayRequest('delete_account', {
        method: 'POST',
        body: {
          openid: session.openid,
          password: body.password,
          clientKey: requestClientKey(req)
        }
      })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/feedback') {
      const session = getSession(req)
      if (!session) return send(res, 401, { error: '微信登录已失效，请重新登录' })
      const body = await readBody(req)
      const result = await gatewayRequest('feedback', {
        method: 'POST',
        body: { openid: session.openid, content: body.content }
      })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/events') {
      const session = getSession(req)
      if (!session) return send(res, 401, { error: '微信登录已失效，请重新登录' })
      const body = await readBody(req)
      const result = await gatewayRequest('events', {
        method: 'POST',
        body: {
          openid: session.openid,
          events: Array.isArray(body.events) ? body.events.slice(0, 20) : [],
          releaseVersion: body.releaseVersion
        }
      })
      return send(res, 202, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/payments/orders') {
      const session = getSession(req)
      if (!session?.userId) {
        return send(res, 401, {
          code: 'ACCOUNT_BIND_REQUIRED',
          error: '请先登录并绑定 Haigoo 网站账号'
        })
      }
      const body = await readBody(req)
      const login = await exchangeCode(String(body.code || ''))
      if (!login.sessionKey || login.openid !== session.openid) {
        return send(res, 401, {
          code: 'WECHAT_PAYMENT_IDENTITY_MISMATCH',
          error: '微信支付身份已失效，请重新操作'
        })
      }
      const config = virtualPaymentConfig()
      const created = await gatewayRequest('virtual_payment_create', {
        method: 'POST',
        body: {
          openid: session.openid,
          planId: String(body.planId || ''),
          idempotencyKey: String(body.idempotencyKey || ''),
          agreementVersion: String(body.agreementVersion || ''),
          privacyVersion: String(body.privacyVersion || ''),
          acceptedAt: body.acceptedAt,
          virtualEnv: config.env,
          clientKey: requestClientKey(req)
        }
      })
      const order = created.order || {}
      if (
        !/^[A-Za-z0-9_*-]{6,32}$/.test(String(order.paymentId || '')) ||
        !String(order.productId || '') ||
        !Number.isSafeInteger(Number(order.amountCents)) ||
        Number(order.amountCents) <= 0
      ) {
        const error = new Error('微信虚拟支付订单返回无效')
        error.statusCode = 503
        error.payload = { code: 'VIRTUAL_PAYMENT_ORDER_INVALID', error: error.message }
        throw error
      }
      const signData = JSON.stringify({
        offerId: config.offerId,
        buyQuantity: 1,
        env: config.env,
        currencyType: 'CNY',
        productId: String(order.productId),
        goodsPrice: Number(order.amountCents),
        outTradeNo: String(order.paymentId),
        attach: String(order.attach || '')
      })
      return send(res, 201, {
        success: true,
        order: {
          paymentId: String(order.paymentId),
          planId: String(order.planId || ''),
          amountCents: Number(order.amountCents),
          currency: 'CNY',
          status: String(order.status || 'pending')
        },
        payment: {
          mode: 'short_series_goods',
          signData,
          paySig: virtualPaymentSignature(config.appKey, `requestVirtualPayment&${signData}`),
          signature: virtualPaymentSignature(login.sessionKey, signData)
        }
      })
    }
    if (req.method === 'GET' && url.pathname === '/mini/payments/orders') {
      const session = getSession(req)
      if (!session?.userId) {
        return send(res, 401, {
          code: 'ACCOUNT_BIND_REQUIRED',
          error: '请先登录并绑定 Haigoo 网站账号'
        })
      }
      const result = await gatewayRequest('virtual_payment_list', {
        query: {
          openid: session.openid,
          page: Math.max(1, Number(url.searchParams.get('page')) || 1),
          pageSize: Math.min(50, Math.max(1, Number(url.searchParams.get('pageSize')) || 20))
        }
      })
      return send(res, 200, result)
    }
    if (req.method === 'GET' && /^\/mini\/payments\/orders\/[^/]+$/.test(url.pathname)) {
      const session = getSession(req)
      if (!session?.userId) {
        return send(res, 401, {
          code: 'ACCOUNT_BIND_REQUIRED',
          error: '请先登录并绑定 Haigoo 网站账号'
        })
      }
      const paymentId = decodeURIComponent(url.pathname.split('/').pop())
      const result = await gatewayRequest('virtual_payment_status', {
        query: { openid: session.openid, paymentId }
      })
      return send(res, 200, result)
    }
    if (req.method === 'PUT' && /^\/mini\/payments\/orders\/[^/]+$/.test(url.pathname)) {
      const session = getSession(req)
      if (!session?.userId) {
        return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      }
      const paymentId = decodeURIComponent(url.pathname.split('/').pop())
      const body = await readBody(req)
      const result = await gatewayRequest('virtual_payment_update', {
        method: 'PUT',
        body: { openid: session.openid, paymentId, status: body.status }
      })
      return send(res, 200, result)
    }
    if (req.method === 'GET' && url.pathname === '/mini/subscriptions') {
      const session = getSession(req)
      if (!session) return send(res, 401, { error: '微信登录已失效，请重新登录' })
      const [data, options] = await Promise.all([
        gatewayRequest('subscriptions', { query: { openid: session.openid } }),
        getSubscriptionOptions()
      ])
      const jobs = await getCachedJobs(data.jobIds || [], 5)
      return send(res, 200, {
        subscriptions: data.subscriptions || [],
        jobs,
        options,
        limits: {
          recommended: 5,
          maximum: 8
        }
      })
    }
    if (req.method === 'POST' && url.pathname === '/mini/subscriptions') {
      const session = getSession(req)
      if (!session) return send(res, 401, { error: '微信登录已失效，请重新登录' })
      const body = await readBody(req)
      const subscriptionBody = {
        openid: session.openid,
        topics: Array.isArray(body.topics) ? body.topics : [],
        idempotencyKey: body.idempotencyKey
      }
      if (Array.isArray(body.customTopics) && body.customTopics.length > 0) {
        subscriptionBody.customTopics = body.customTopics
      }
      const subscription = await gatewayRequest('subscriptions', {
        method: 'POST',
        body: subscriptionBody
      })
      return send(res, 200, subscription)
    }
    if (req.method === 'GET' && url.pathname === '/mini/favorites') {
      const session = getSession(req)
      if (!session) return send(res, 401, { error: '微信登录已失效，请重新登录' })
      const data = await gatewayRequest('favorites', { query: { openid: session.openid } })
      const favorites = Array.isArray(data.favorites) ? data.favorites : []
      const jobIds = favorites.map((item) => String(item.jobId || '')).filter(Boolean)
      return send(res, 200, {
        favorites,
        favoriteJobIds: jobIds,
        jobs: await getCachedJobs(jobIds)
      })
    }
    if (req.method === 'POST' && url.pathname === '/mini/favorites') {
      const session = getSession(req)
      if (!session) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const body = await readBody(req)
      const jobId = String(body.jobId || '').trim()
      const [job] = body.favorite === false ? [] : await getCachedJobs([jobId], 1)
      const result = await gatewayRequest('favorites', {
        method: 'POST',
        body: {
          openid: session.openid,
          jobId,
          jobSnapshot: job ? { id: job.id, title: job.title, company: job.company } : undefined,
          favorite: body.favorite !== false,
          idempotencyKey: body.idempotencyKey
        }
      })
      return send(res, 200, result)
    }
    if (req.method === 'GET' && url.pathname === '/mini/applications') {
      const session = getSession(req)
      if (!session) return send(res, 401, { error: '微信登录已失效，请重新登录' })
      const data = await gatewayRequest('applications', { query: { openid: session.openid } })
      const applications = Array.isArray(data.applications) ? data.applications : []
      const jobIds = [...new Set(applications.map((item) => String(item.jobId || '')).filter(Boolean))]
      return send(res, 200, {
        applications,
        jobs: await getCachedJobs(jobIds)
      })
    }
    if (req.method === 'GET' && url.pathname === '/mini/application-usage') {
      const session = getSession(req)
      if (!session?.userId) {
        return send(res, 401, {
          code: 'ACCOUNT_BIND_REQUIRED',
          error: '请先登录并绑定 Haigoo 网站账号'
        })
      }
      const usage = await gatewayRequest('application_usage', {
        query: { openid: session.openid }
      })
      return send(res, 200, usage)
    }
    if (req.method === 'POST' && /^\/mini\/jobs\/[^/]+\/application$/.test(url.pathname)) {
      const session = getSession(req)
      if (!session) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const body = await readBody(req)
      const jobId = decodeURIComponent(url.pathname.split('/')[3])
      const jobSnapshot = await fetchUpstreamJobSnapshot(jobId)
      if (!jobSnapshot) return send(res, 404, { error: '岗位不存在或已下线' })
      const application = await gatewayRequest('application', {
        method: 'POST',
        body: {
          openid: session.openid,
          jobId,
          jobSnapshot,
          type: body.type,
          idempotencyKey: body.idempotencyKey
        }
      })
      return send(res, 200, application)
    }
    if (req.method === 'POST' && /^\/mini\/jobs\/[^/]+\/application-status$/.test(url.pathname)) {
      const session = getSession(req)
      if (!session) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const body = await readBody(req)
      const jobId = decodeURIComponent(url.pathname.split('/')[3])
      const result = await gatewayRequest('application_status', {
        method: 'POST',
        body: {
          openid: session.openid,
          jobId,
          type: body.type,
          status: body.status,
          idempotencyKey: body.idempotencyKey
        }
      })
      return send(res, 200, result)
    }
    return send(res, 404, { error: 'Not found' })
  } catch (error) {
    console.error('[mini-cloudrun] request failed', error)
    return send(res, Number(error.statusCode) || 500, error.payload || { error: error.message || '服务暂时不可用' })
  }
}

const server = http.createServer(route)
server.listen(port, () => {
  console.log(`[mini-cloudrun] listening on ${port}`)
  if (legacyJobCacheEnabled) void scheduleSync()
  else console.log('[mini-cloudrun] legacy job cache disabled for Mini Program 1.0')
})

if (legacyJobCacheEnabled) {
  const syncTimer = setInterval(() => { void scheduleSync() }, SYNC_TIMER_MS)
  syncTimer.unref()
}
