import crypto from 'crypto'
import fs from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import http from 'http'
import os from 'os'
import path from 'path'
import { Readable, Transform } from 'stream'
import { pipeline } from 'stream/promises'
import cloudbase from '@cloudbase/node-sdk'

const port = Number(process.env.PORT || 8080)
const apiOrigin = String(process.env.HAIGOO_API_ORIGIN || '').replace(/\/+$/, '')
const appId = String(process.env.WECHAT_MINI_APP_ID || '')
const appSecret = String(process.env.WECHAT_MINI_APP_SECRET || '')
const gatewaySecret = String(process.env.MINI_GATEWAY_SHARED_SECRET || '')
const sessionSecret = String(process.env.MINI_SESSION_SECRET || '')
const syncSecret = String(process.env.MINI_SYNC_SECRET || '')
const jobsCollection = 'mini_jobs'
const jobListCollection = 'mini_job_list'
const syncCollection = 'mini_sync_state'
const SYNC_PAGE_SIZE = 100
const LIST_INDEX_FETCH_LIMIT = 1000
const SYNC_MAX_PAGES_PER_RUN = Math.max(1, Math.min(10, Number(process.env.MINI_SYNC_PAGES_PER_RUN || 3)))
const WRITE_CONCURRENCY = Math.max(1, Math.min(20, Number(process.env.MINI_SYNC_WRITE_CONCURRENCY || 8)))
const LOGO_CONCURRENCY = Math.max(1, Math.min(6, Number(process.env.MINI_LOGO_CONCURRENCY || 2)))
const MAX_LOGO_BYTES = Math.max(64 * 1024, Math.min(8 * 1024 * 1024, Number(process.env.MINI_LOGO_MAX_BYTES || 2 * 1024 * 1024)))
const CACHE_REFRESH_MS = 5 * 60 * 1000

if (!apiOrigin || !appId || !appSecret || !gatewaySecret || !sessionSecret) {
  throw new Error('Missing required Cloud Hosting environment variables')
}

const cloudApp = cloudbase.init({ env: process.env.TCB_ENV })
const db = cloudApp.database()

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

function signGatewayRequest(method, action, timestamp, body) {
  const bodyHash = crypto.createHash('sha256').update(stableJson(body || {})).digest('hex')
  return crypto.createHmac('sha256', gatewaySecret)
    .update(`${method.toUpperCase()}:${action}:${timestamp}:${bodyHash}`)
    .digest('hex')
}

async function gatewayRequest(action, { method = 'GET', body = {}, query = {} } = {}) {
  const timestamp = String(Date.now())
  const params = new URLSearchParams({ action, ...Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== null && value !== '')) })
  const signedQuery = Object.fromEntries([...params.entries()].filter(([key]) => key !== 'action'))
  const signaturePayload = method === 'GET' ? signedQuery : body
  const response = await fetch(`${apiOrigin}/api/mini?${params}`, {
    method,
    signal: AbortSignal.timeout(12000),
    headers: {
      Accept: 'application/json',
      ...(method !== 'GET' ? { 'Content-Type': 'application/json' } : {}),
      'X-Haigoo-Mini-Timestamp': timestamp,
      'X-Haigoo-Mini-Signature': signGatewayRequest(method, action, timestamp, signaturePayload)
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

function publicJob(job, logoFileId = '') {
  const { url, sourceUrl, hiringEmail, ...safeJob } = job
  return {
    ...safeJob,
    // Never hand a Vercel or third-party image URL to the Mini Program.  When
    // a cache upload fails the UI intentionally falls back to its local icon.
    cachedLogoUrl: logoFileId || '',
    cachedCompanyLogoUrl: logoFileId || '',
    hasWebsiteApply: Boolean(url || sourceUrl),
    hasEmailApply: Boolean(hiringEmail),
    hasReferral: Boolean(safeJob.canRefer || Number(safeJob.effectiveReferralContactCount || 0) > 0)
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
  const {
    description,
    originalDescription,
    requirements,
    responsibilities,
    benefits,
    translations,
    ...summary
  } = payload
  const compact = { ...summary }
  const localized = compactTranslations(translations)
  if (localized) compact.translations = localized
  else delete compact.translations
  return compact
}

function jobListDocument({ id, _id, jobId, status, featured, payload, lastSeenSyncId }) {
  const compactPayload = compactJobPayload(payload)
  return {
    _id: id || _id,
    jobId,
    status: status || 'active',
    featured: Boolean(featured),
    publishedAt: compactPayload.publishedAt || '',
    category: compactPayload.category || '',
    lastSeenSyncId: lastSeenSyncId || '',
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

function withoutDocumentId(record) {
  const { _id, ...data } = record || {}
  return data
}

async function getSyncState() {
  const result = await db.collection(syncCollection).doc('jobs').get().catch(() => ({ data: [] }))
  let state = result.data?.[0] || { _id: 'jobs', cursor: '', lastFullSyncAt: 0 }
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
  return unwrapDocument(state)
}

async function setSyncState(value) {
  await db.collection(syncCollection).doc('jobs').set(withoutDocumentId({ _id: 'jobs', ...value }))
}

async function runWithConcurrency(items, concurrency, worker) {
  const queue = [...items]
  const failures = []
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
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

async function storeJob(job, { syncRunId = '' } = {}) {
  const id = jobDocumentId(job.id)
  const existingResult = await db.collection(jobsCollection).doc(id).get().catch(() => ({ data: [] }))
  const existing = unwrapDocument(existingResult.data?.[0])
  const logoSource = appOriginUrl(job.cachedCompanyLogoUrl || job.cachedLogoUrl || job.companyLogo || job.logo)
  // Keep a valid CloudBase file ID when the source has not changed. Previously
  // every job upsert erased it, which caused each periodic sync to download the
  // same logo again and briefly made clients fall back to the local placeholder.
  const logoFileId = existing?.logoSource === logoSource ? existing.logoFileId || '' : ''
  const data = {
    _id: id,
    jobId: job.id,
    status: job.status || 'active',
    featured: Boolean(job.isFeatured),
    updatedAt: job.updatedAt || new Date().toISOString(),
    logoSource,
    logoFileId,
    lastSeenSyncId: syncRunId || existing?.lastSeenSyncId || '',
    payload: publicJob(job, logoFileId)
  }
  await db.collection(jobsCollection).doc(id).set(withoutDocumentId(data))
  await db.collection(jobListCollection).doc(id).set(withoutDocumentId(jobListDocument(data)))
}

async function cacheJobLogo(task) {
  const id = jobDocumentId(task.jobId)
  const currentResult = await db.collection(jobsCollection).doc(id).get().catch(() => ({ data: [] }))
  const current = unwrapDocument(currentResult.data?.[0])
  // A later job update can replace the source while this task is waiting in the
  // queue. In that case leave the newer record alone; its own task will handle it.
  if (!current || current.logoSource !== task.logoSource) return
  const logoFileId = await cacheLogo(task.jobId, task.logoSource, current)
  if (!logoFileId || logoFileId === current.logoFileId) return
  await db.collection(jobsCollection).doc(id).set(withoutDocumentId({
    ...current,
    logoFileId,
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
    lastSeenSyncId: current.lastSeenSyncId,
    payload: {
      ...(current.payload || {}),
      cachedLogoUrl: logoFileId,
      cachedCompanyLogoUrl: logoFileId
    }
  })))
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

function scheduleLogoCache(jobs) {
  for (const job of jobs) {
    const jobId = String(job?.id || '').trim()
    const logoSource = appOriginUrl(job?.cachedCompanyLogoUrl || job?.cachedLogoUrl || job?.companyLogo || job?.logo)
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

async function writeBatch(jobs, { syncRunId = '' } = {}) {
  await runWithConcurrency(jobs, WRITE_CONCURRENCY, (job) => storeJob(job, { syncRunId }))
  // Logo IO is intentionally detached from the cache write. A slow third-party
  // image must never delay the job list, the detail endpoint, or sync progress.
  scheduleLogoCache(jobs)
}

async function removeStaleCacheDocuments(syncRunId) {
  if (!syncRunId) return { removed: 0 }
  const result = await db.collection(jobListCollection).limit(LIST_INDEX_FETCH_LIMIT).get().catch(() => ({ data: [] }))
  const records = Array.isArray(result.data) ? result.data : []
  const stale = records.filter((record) => String(record?.lastSeenSyncId || '') !== syncRunId)
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
  return { removed: stale.length }
}

async function syncJobs({ force = false } = {}) {
  const state = await getSyncState()
  const fullSyncDue = force || Boolean(state.fullSyncInProgress) || !state.cacheReady || !state.cursor || Date.now() - Number(state.lastFullSyncAt || 0) > 60 * 60 * 1000
  const run = fullSyncDue
    ? {
        mode: 'full',
        page: force ? 1 : Math.max(1, Number(state.fullSyncPage) || 1),
        cursor: '',
        newestCursor: force ? '' : String(state.fullSyncNewestCursor || ''),
        syncRunId: force ? crypto.randomUUID() : String(state.fullSyncRunId || crypto.randomUUID())
      }
    : {
        mode: 'incremental',
        page: Math.max(1, Number(state.incrementalPage) || 1),
        cursor: String(state.cursor || ''),
        newestCursor: String(state.incrementalNewestCursor || state.cursor || '')
      }

  let hasMore = true
  let pagesProcessed = 0
  while (hasMore && pagesProcessed < SYNC_MAX_PAGES_PER_RUN) {
    const batch = await gatewayRequest('sync', { query: buildSyncQuery(run) })
    const jobs = Array.isArray(batch.jobs) ? batch.jobs : []
    await writeBatch(jobs, { syncRunId: run.mode === 'full' ? run.syncRunId : '' })
    if (batch.nextCursor && batch.nextCursor > run.newestCursor) run.newestCursor = batch.nextCursor
    hasMore = Boolean(batch.hasMore)
    run.page += 1
    pagesProcessed += 1
  }

  const completed = !hasMore
  const nextState = {
    ...state,
    cacheReady: completed && run.mode === 'full' ? true : Boolean(state.cacheReady),
    fullSyncInProgress: run.mode === 'full' && !completed,
    lastSyncAt: Date.now(),
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
    ? await removeStaleCacheDocuments(run.syncRunId)
    : { removed: 0 }
  return { completed, mode: run.mode, pagesProcessed, staleRemoved: cleanup.removed }
}

let syncPromise = null
function scheduleSync({ force = false } = {}) {
  if (syncPromise) return syncPromise
  syncPromise = syncJobs({ force })
    .then((result) => {
      if (!result.completed) {
        // Yield between bounded batches so a cold cache never holds the Mini
        // Program request open, while still allowing hydration to finish.
        setTimeout(() => { void scheduleSync() }, 0)
      }
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
    const categoryText = String(payload.category || '').toLowerCase()
    const haystack = [payload.category, payload.title, payload.type, payload.jobType, ...(payload.tags || [])]
      .join(' ')
      .toLowerCase()
    if (categoryTerms.length === 1 && categoryTerms[0] === 'freelance') {
      return /(freelance|freelancer|自由职业|part[- ]?time|兼职|contractor|contract|合同工|合同制)/i.test(haystack)
    }
    return categoryTerms.some((term) => categoryText.includes(term))
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
  const compareDefault = (a, b) => {
    const searchDifference = searchScore(b) - searchScore(a)
    if (searchDifference) return searchDifference
    const featuredDifference = Number(Boolean(b.featured)) - Number(Boolean(a.featured))
    if (featuredDifference) return featuredDifference
    const publishedDifference = String(b.payload?.publishedAt || '').localeCompare(String(a.payload?.publishedAt || ''))
    if (publishedDifference) return publishedDifference
    const memberDifference = Number(Boolean(b.payload?.memberOnly)) - Number(Boolean(a.payload?.memberOnly))
    if (memberDifference) return memberDifference
    const referralDifference = Number(Boolean(b.payload?.canRefer)) - Number(Boolean(a.payload?.canRefer))
    if (referralDifference) return referralDifference
    return Number(Boolean(b.payload?.isTrusted)) - Number(Boolean(a.payload?.isTrusted))
  }
  const all = items
    .filter((item) => item.status !== 'closed' && item.status !== 'expired')
    .filter((item) => !featured || item.featured)
    .filter(matchesCategory)
    .filter((item) => !search || [item.payload?.title, item.payload?.company, ...(item.payload?.tags || [])].join(' ').toLowerCase().includes(search))
    .sort(sortBy === 'recent'
      ? (a, b) => String(b.payload?.publishedAt || '').localeCompare(String(a.payload?.publishedAt || ''))
      : compareDefault)
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
  const jobs = (Array.isArray(batch.jobs) ? batch.jobs : []).map((job) => ({
    status: job.status || 'active',
    featured: Boolean(job.isFeatured),
    payload: publicJob(job)
  }))
  const response = buildJobsResponse(jobs, query)
  return { ...response, total: Number(batch.total || response.total), source: 'upstream-cold-cache' }
}

async function fetchUpstreamJob(jobId) {
  const batch = await gatewayRequest('sync', { query: { id: jobId, page: 1, limit: 1 } })
  const job = Array.isArray(batch.jobs) ? batch.jobs[0] : null
  return job ? publicJob(job) : null
}

async function listJobs(query) {
  const [state, result] = await Promise.all([
    getSyncState(),
    db.collection(jobListCollection).limit(LIST_INDEX_FETCH_LIMIT).get().catch(() => ({ data: [] }))
  ])
  const cached = (result.data || []).map(unwrapDocument).filter((item) => item?.payload)
  if (!state.cacheReady || cached.length === 0) {
    // The first visitor gets a prompt upstream response. Full cache hydration is
    // deliberately best-effort work after the HTTP response is released.
    const response = await fetchUpstreamJobs(query)
    // An empty index alongside an old full cache means this is the first
    // deployment with the lightweight list collection. Rebuild it once, while
    // still answering the current request from Vercel immediately.
    void scheduleSync({ force: Boolean(state.cacheReady && cached.length === 0) })
    return response
  }
  if (Date.now() - Number(state.lastSyncAt || 0) >= CACHE_REFRESH_MS) void scheduleSync()
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
  const url = new URL('https://api.weixin.qq.com/sns/jscode2session')
  url.search = new URLSearchParams({ appid: appId, secret: appSecret, js_code: code, grant_type: 'authorization_code' }).toString()
  const response = await fetch(url)
  const payload = await response.json()
  if (!response.ok || !payload.openid) throw new Error(payload.errmsg || '微信登录失败')
  return payload.openid
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk; if (body.length > 1024 * 1024) reject(new Error('Request too large')) })
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}) } catch { reject(new Error('Invalid JSON body')) }
    })
    req.on('error', reject)
  })
}

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`)
  try {
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true })
    if (req.method === 'POST' && url.pathname === '/internal/sync') {
      if (!syncSecret || req.headers['x-mini-sync-secret'] !== syncSecret) return send(res, 401, { error: 'Unauthorized' })
      const result = await syncJobs({ force: url.searchParams.get('full') === 'true' })
      if (!result.completed) {
        // Manual full syncs are also resumable. This is important for logo
        // backfills: one protected trigger can repopulate existing records
        // without forcing an operator to repeatedly call the endpoint.
        setTimeout(() => { void scheduleSync() }, 0)
      }
      return send(res, 200, { success: true, ...result })
    }
    if (req.method === 'GET' && url.pathname === '/mini/jobs') {
      const session = getSession(req)
      const result = await listJobs(Object.fromEntries(url.searchParams))
      const { jobs, browse } = await enforceBrowseAllowance(session, result.jobs)
      return send(res, 200, {
        ...result,
        jobs,
        browse: browse ? {
          viewedCount: browse.viewedCount,
          remaining: browse.remaining,
          limited: browse.limited
        } : undefined
      })
    }
    if (req.method === 'GET' && /^\/mini\/jobs\/[^/]+$/.test(url.pathname)) {
      const jobId = decodeURIComponent(url.pathname.split('/').pop())
      const result = await db.collection(jobsCollection).doc(jobDocumentId(jobId)).get().catch(() => ({ data: [] }))
      const job = unwrapDocument(result.data?.[0])?.payload
      if (job) {
        const { jobs, browse } = await enforceBrowseAllowance(getSession(req), [job])
        if (jobs.length === 0) {
          return send(res, 403, {
            code: 'MINI_BROWSE_LIMIT_REACHED',
            error: '免费用户最多浏览 100 个岗位，开通会员后可继续查看全部岗位',
            browse: { viewedCount: browse?.viewedCount || 100, remaining: browse?.remaining || 0 }
          })
        }
        const state = await getSyncState()
        if (Date.now() - Number(state.lastSyncAt || 0) >= CACHE_REFRESH_MS) void scheduleSync()
        return send(res, 200, { job: jobs[0], browse })
      }
      const upstreamJob = await fetchUpstreamJob(jobId)
      void scheduleSync()
      if (!upstreamJob) return send(res, 404, { error: '岗位不存在或已下线' })
      const { jobs, browse } = await enforceBrowseAllowance(getSession(req), [upstreamJob])
      if (jobs.length === 0) {
        return send(res, 403, {
          code: 'MINI_BROWSE_LIMIT_REACHED',
          error: '免费用户最多浏览 100 个岗位，开通会员后可继续查看全部岗位',
          browse: { viewedCount: browse?.viewedCount || 100, remaining: browse?.remaining || 0 }
        })
      }
      return send(res, 200, { job: jobs[0], source: 'upstream-cold-cache', browse })
    }
    if (req.method === 'POST' && url.pathname === '/mini/auth/session') {
      const body = await readBody(req)
      const openid = await exchangeCode(String(body.code || ''))
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
        body: { openid: session.openid, password: body.password }
      })
      return send(res, 200, result)
    }
    if (req.method === 'POST' && url.pathname === '/mini/account/delete') {
      const session = getSession(req)
      if (!session) return send(res, 401, { error: '微信登录已失效，请重新登录' })
      const body = await readBody(req)
      const result = await gatewayRequest('delete_account', {
        method: 'POST',
        body: { openid: session.openid, password: body.password }
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
    if (req.method === 'GET' && url.pathname === '/mini/subscriptions') {
      const session = getSession(req)
      if (!session) return send(res, 401, { error: '微信登录已失效，请重新登录' })
      const data = await gatewayRequest('subscriptions', { query: { openid: session.openid } })
      return send(res, 200, {
        subscriptions: data.subscriptions || [],
        jobs: await getCachedJobs(data.jobIds || [], 18)
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
      const result = await gatewayRequest('favorites', {
        method: 'POST',
        body: {
          openid: session.openid,
          jobId: body.jobId,
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
    if (req.method === 'POST' && /^\/mini\/jobs\/[^/]+\/application$/.test(url.pathname)) {
      const session = getSession(req)
      if (!session) return send(res, 401, { code: 'ACCOUNT_BIND_REQUIRED', error: '请先登录并绑定 Haigoo 网站账号' })
      const body = await readBody(req)
      const jobId = decodeURIComponent(url.pathname.split('/')[3])
      const application = await gatewayRequest('application', {
        method: 'POST',
        body: {
          openid: session.openid,
          jobId,
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
        body: { openid: session.openid, jobId, type: body.type, status: body.status }
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
  void scheduleSync()
})

// The production service keeps one minimum instance during launch week. This
// timer makes the cache refresh hourly without exposing a public cron URL.
const syncTimer = setInterval(() => { void scheduleSync() }, 60 * 60 * 1000)
syncTimer.unref()
