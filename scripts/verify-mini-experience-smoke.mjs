import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import dotenv from 'dotenv'
import { MINI_SMOKE_DIRECTION, MINI_SMOKE_FIXTURES } from './mini-smoke-fixtures.mjs'

const envFile = process.argv.find((argument) => argument.startsWith('--env-file='))?.slice('--env-file='.length) || ''
const originArgument = process.argv.find((argument) => argument.startsWith('--origin='))?.slice('--origin='.length) || ''
const useLocalHandler = process.argv.includes('--local-handler')
const useVercelCurl = process.argv.includes('--vercel-curl')
if (!envFile || (!originArgument && !useLocalHandler)) {
  throw new Error('Usage: node scripts/verify-mini-experience-smoke.mjs --env-file=/path/to/preview.env (--origin=https://preview.example|--local-handler)')
}

const environment = dotenv.parse(fs.readFileSync(path.resolve(envFile)))
if (environment.VERCEL_ENV !== 'preview') throw new Error('Experience smoke tests require Preview environment configuration')
const origin = useLocalHandler ? 'local-handler' : originArgument.replace(/\/+$/, '')
const gatewaySecret = String(environment.MINI_GATEWAY_SHARED_SECRET || '')
const bypassSecret = String(environment.VERCEL_AUTOMATION_BYPASS_SECRET || '')
if (!gatewaySecret) throw new Error('Preview gateway signature configuration is unavailable')
let localHandler = null
if (useLocalHandler) {
  Object.assign(process.env, environment)
  localHandler = (await import('../lib/api-handlers/mini-gateway.js')).default
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

async function gatewayRequest(action, { method = 'GET', query = {}, body = {} } = {}) {
  const requestId = `release-smoke-${crypto.randomUUID()}`
  const requestQuery = { ...query, requestId }
  const payload = method === 'GET' ? requestQuery : body
  const timestamp = String(Date.now())
  const signature = crypto.createHmac('sha256', gatewaySecret)
    .update(`${method}:${action}:${timestamp}:${crypto.createHash('sha256').update(stableJson(payload)).digest('hex')}`)
    .digest('hex')
  const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Haigoo-Mini-Timestamp': timestamp,
      'X-Haigoo-Mini-Signature': signature,
      'X-Haigoo-Request-Id': requestId,
      ...(bypassSecret && !useVercelCurl ? { 'x-vercel-protection-bypass': bypassSecret } : {})
  }
  let status
  let result
  let responseRequestId
  if (localHandler) {
    const responseHeaders = new Map()
    const response = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this },
      setHeader(key, value) { responseHeaders.set(String(key).toLowerCase(), String(value)); return this },
      json(value) { this.payload = value; return this },
      end(value) { this.payload = value; return this }
    }
    await localHandler({
      method,
      query: { action, ...requestQuery },
      body: method === 'GET' ? {} : body,
      headers: Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
    }, response)
    status = response.statusCode
    result = response.payload
    responseRequestId = responseHeaders.get('x-haigoo-request-id')
  } else {
    const url = `/api/mini?${new URLSearchParams({ action, ...requestQuery })}`
    if (useVercelCurl) {
      const output = execFileSync('npx', [
        'vercel', 'curl', url,
        '--deployment', origin,
        '--yes', '--',
        '--silent', '--show-error', '--write-out', '\n%{http_code}',
        '--request', method,
        ...Object.entries(headers).flatMap(([key, value]) => ['--header', `${key}: ${value}`]),
        ...(method === 'GET' ? [] : ['--data', JSON.stringify(body)])
      ], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
      const lines = output.trimEnd().split('\n')
      status = Number(lines.pop())
      result = JSON.parse(lines.join('\n') || 'null')
      responseRequestId = null
    } else {
      const response = await fetch(`${origin}${url}`, {
        method,
        signal: AbortSignal.timeout(30000),
        headers,
        ...(method === 'GET' ? {} : { body: JSON.stringify(body) })
      })
      status = response.status
      result = await response.json().catch(() => null)
      responseRequestId = response.headers.get('x-haigoo-request-id')
    }
  }
  if (responseRequestId !== requestId && result?.requestId !== requestId) {
    throw new Error(`${action} did not preserve its anonymous request ID (header=${responseRequestId || 'missing'}, body=${result?.requestId || 'missing'})`)
  }
  if (status < 200 || status >= 300 || !result?.success) {
    throw new Error(`${action} failed with HTTP ${status}: ${String(result?.code || result?.error || 'invalid response')}`)
  }
  return result
}

function companyIds(result) {
  return (result.companies || []).map((company) => String(company.companyId || company.id || ''))
}

function recommendationIds(result) {
  return (result.recommendations || []).map((company) => String(company.companyId || ''))
}

function sameValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

async function state(fixture) {
  return gatewayRequest('career_watch_state', { query: { openid: fixture.openid } })
}

async function companies(fixture, pageSize = 50, page = 1) {
  return gatewayRequest('companies', { query: { openid: fixture.openid, page: String(page), pageSize: String(pageSize) } })
}

async function completeMemberDirectory(fixture) {
  const first = await companies(fixture)
  const rows = [...(first.companies || [])]
  let page = 2
  while (rows.length < Number(first.total || 0)) {
    const next = await companies(fixture, first.pageSize || 50, page)
    if (!next.companies?.length) throw new Error('Member company pagination ended before the reported total')
    rows.push(...next.companies)
    page += 1
  }
  return { ...first, companies: rows }
}

async function saveDirection(fixture) {
  return gatewayRequest('career_watch_save', {
    method: 'PUT',
    body: { openid: fixture.openid, ...MINI_SMOKE_DIRECTION }
  })
}

const unusedState = await state(MINI_SMOKE_FIXTURES.unused)
const unusedCompanies = await companies(MINI_SMOKE_FIXTURES.unused)
if (unusedState.matchState !== 'unused' || unusedState.recommendations?.length !== 0) {
  throw new Error('Unused free fixture did not remain unused')
}
if (unusedCompanies.access?.scope !== 'match_required' || unusedCompanies.total !== 0) {
  throw new Error('Unused free fixture received company access')
}

let fixedState = await state(MINI_SMOKE_FIXTURES.fixed)
if (fixedState.matchState === 'unused') fixedState = await saveDirection(MINI_SMOKE_FIXTURES.fixed)
const fixedCompanies = await companies(MINI_SMOKE_FIXTURES.fixed)
const repeatedFixedState = await state(MINI_SMOKE_FIXTURES.fixed)
const fixedIds = recommendationIds(fixedState).slice(0, 5)
if (fixedState.matchState !== 'fixed_free' || fixedIds.length !== 5 || fixedCompanies.access?.scope !== 'free_fixed' || fixedCompanies.total !== 5) {
  throw new Error('Free fixture did not receive exactly five fixed companies')
}
if (!sameValues(fixedIds, companyIds(fixedCompanies)) || !sameValues(fixedIds, recommendationIds(repeatedFixedState).slice(0, 5))) {
  throw new Error('Free fixture company IDs changed between Match and company directory reads')
}

let memberState = await state(MINI_SMOKE_FIXTURES.member)
if (!memberState.profile || memberState.recommendations?.length === 0) memberState = await saveDirection(MINI_SMOKE_FIXTURES.member)
const memberCompanies = await completeMemberDirectory(MINI_SMOKE_FIXTURES.member)
const memberRows = memberCompanies.companies || []
const memberSorted = memberRows.every((company, index) => index === 0
  || new Date(memberRows[index - 1].publicOpportunityUpdatedAt || 0).getTime() >= new Date(company.publicOpportunityUpdatedAt || 0).getTime())
if (memberState.matchState !== 'member_dynamic' || memberState.recommendations?.length === 0) {
  throw new Error('Member fixture did not receive a dynamic Match result')
}
if (memberCompanies.access?.scope !== 'member_all' || memberCompanies.total !== memberRows.length || memberRows.length === 0) {
  throw new Error('Member fixture company directory is incomplete')
}
if (!memberSorted || memberRows.some((company) => !company.hasPublicOpportunity || Number(company.openJobCount || 0) < 1)) {
  throw new Error('Member company directory is not using the current public-opportunity order')
}

for (const companyId of fixedIds) {
  const detail = await gatewayRequest('company', { query: { openid: MINI_SMOKE_FIXTURES.fixed.openid, id: companyId } })
  if (String(detail.company?.companyId || detail.company?.id || '') !== companyId) throw new Error('A fixed Match company could not be opened')
}

console.log(JSON.stringify({
  environment: 'preview',
  origin,
  unused: { matchState: unusedState.matchState, companyScope: unusedCompanies.access.scope },
  fixed: { matchState: fixedState.matchState, recommendations: fixedIds.length, total: fixedCompanies.total, stable: true },
  member: { matchState: memberState.matchState, recommendations: memberState.recommendations.length, hiringCompanies: memberCompanies.total, sorted: memberSorted },
  requestTracing: true
}, null, 2))
