import snapshot from '../data/company-top100-current.json' with { type: 'json' }
import edition from '../data/company-top100-edition.json' with { type: 'json' }
import { deriveMembershipCapabilities } from '../shared/membership.js'
import { resolveCachedLogoUrlFromRow } from './company-image-asset-service.js'

const keys = ['mainland', 'remote', 'payment', 'timezone', 'basics', 'business']
const safeUrl = value => {
    try { const url = new URL(String(value || '')); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null }
    catch { return null }
}

const validDate = value => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const date = new Date(`${value}T00:00:00Z`)
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function validateCompanyTop100(data) {
    if (typeof data?.version !== 'string' || !data.version || !validDate(data.researchedAt) || !Array.isArray(data.companies) || data.companies.length !== 100) throw new Error('Invalid ranking version')
    if (!data.weights || keys.some(key => !Number.isFinite(data.weights[key]) || data.weights[key] < 0) || keys.reduce((sum, key) => sum + data.weights[key], 0) !== 100) throw new Error('Invalid ranking weights')
    const ids = new Set()
    for (const [i, row] of data.companies.entries()) {
        if (typeof row.companyId !== 'string' || !row.companyId || ids.has(row.companyId) || row.rank !== i + 1 || !['A', 'B'].includes(row.tier)) throw new Error('Invalid ranking identity or evidence')
        ids.add(row.companyId)
        if (['name','industry','geoNote','remoteNote','contractNote','timezoneNote','pending'].some(key => typeof row[key] !== 'string') || !row.name.trim() || !validDate(row.reviewedAt)
            || !['fully_remote','remote_first','selected_roles','field_work'].includes(row.remoteClass)
            || !['employee_unconfirmed','contractor','project','unknown'].includes(row.contractClass)
            || ['roles','notes','sources'].some(key => !Array.isArray(row[key]) || row[key].some(value => typeof value !== 'string'))
            || (row.applicationNote !== undefined && typeof row.applicationNote !== 'string') || !row.components || !row.unknown || !row.basics) throw new Error('Invalid ranking fields')
        const total = keys.reduce((sum, key) => sum + (row.components[key] ?? 0), 0)
        if (!Number.isFinite(row.score) || Math.abs(total - row.score) > 0.001 || row.score < 0 || row.score > 100 || !row.sources.length || row.sources.some(url => !safeUrl(url))) throw new Error('Invalid ranking score or source')
        if (i && data.companies[i - 1].score < row.score) throw new Error('Ranking must be descending')
        for (const key of keys) if (row.components[key] !== null && (!Number.isFinite(row.components[key]) || row.components[key] < 0 || row.components[key] > data.weights[key])) throw new Error('Invalid component score')
    }
    return data
}

export function getCompanyTop100Edition(data) {
    if (!validDate(data.researchedAt) || typeof data.version !== 'string' || !data.version) throw new Error('Invalid ranking edition')
    const year = Number(data.researchedAt.slice(0,4)), quarter = Math.ceil(Number(data.researchedAt.slice(5,7)) / 3)
    const nextReviewAt = new Date(Date.UTC(year, quarter * 3, 10)).toISOString().slice(0,10)
    return { version: data.version, researchedAt: data.researchedAt, quarter: `${year} Q${quarter}`, nextReviewAt }
}
export function validateCompanyTop100Edition(edition, data) {
    const expected = getCompanyTop100Edition(data), fields = Object.keys(expected)
    if (!edition || typeof edition !== 'object' || Array.isArray(edition) || Object.keys(edition).length !== fields.length || fields.some(key => !Object.hasOwn(edition,key) || edition[key] !== expected[key])) throw new Error('Public edition must contain only matching release metadata')
    return edition
}
export const companyTop100Snapshot = validateCompanyTop100(snapshot)
validateCompanyTop100Edition(edition,companyTop100Snapshot)

export async function getCompanyTop100LiveData(entries, query) {
    const ids = entries.map(row => row.companyId)
    // This matches the website's ID-filtered list policy for full members:
    // active, approved, and not manually crawl-deleted. Counts are not mainland eligibility.
    const [companies, jobs] = await Promise.allSettled([
        query('SELECT * FROM trusted_companies WHERE company_id = ANY($1::text[])', [ids]),
        query(`SELECT company_id, COUNT(*)::int AS count FROM jobs
            WHERE company_id = ANY($1::text[]) AND status = 'active' AND is_approved = true
              AND (to_jsonb(jobs)->>'crawl_deleted_at') IS NULL GROUP BY company_id`, [ids])
    ])
    const companyMap = companies.status === 'fulfilled' && Array.isArray(companies.value) ? new Map(companies.value.map(row => [row.company_id, row])) : null
    const countMap = jobs.status === 'fulfilled' && Array.isArray(jobs.value) ? new Map(jobs.value.map(row => [row.company_id, Number(row.count)])) : null
    return entries.map(entry => {
        const live = companyMap?.get(entry.companyId)
        const availability = !companyMap ? 'unknown' : live?.status === 'active' ? 'available' : 'unavailable'
        return {
            ...entry,
            name: live?.name || entry.name,
            availability,
            logo: safeUrl(live?.logo),
            cachedLogoUrl: live ? resolveCachedLogoUrlFromRow(live) : null,
            website: safeUrl(live?.website || entry.website),
            careersPage: safeUrl(live?.careers_page || entry.careersPage),
            jobCount: availability === 'unavailable' ? null : countMap ? (countMap.has(entry.companyId) ? (Number.isInteger(countMap.get(entry.companyId)) && countMap.get(entry.companyId) >= 0 ? countMap.get(entry.companyId) : null) : 0) : null,
            liveUpdatedAt: live?.updated_at || null
        }
    })
}

// Entitlements must come from the current database row. Do not use the generic
// user helper's local fallback or its membership-finalization writes here.
export async function getCompanyTop100AccessUser(userId, query) {
    const rows = await query(`SELECT user_id, email, status, roles, member_status, member_type,
        member_expire_at, member_cycle_start_at, to_jsonb(users)->>'membership_level' AS membership_level
        FROM users WHERE user_id = $1 LIMIT 1`, [userId])
    if (!Array.isArray(rows)) throw new Error('Access verification unavailable')
    if (!rows.length) return null
    let roles = rows[0].roles
    if (typeof roles === 'string') { try { roles = JSON.parse(roles) } catch { roles = {} } }
    if (!roles || typeof roles !== 'object' || Array.isArray(roles)) roles = {}
    return { ...rows[0], roles: { ...roles, admin: roles.admin === true } }
}

export function createCompanyTop100Handler({ extractToken, verifyToken, getUser, isAdmin, enrich, data = companyTop100Snapshot }) {
    return async (req, res) => {
        res.setHeader('Cache-Control', 'private, no-store')
        res.setHeader('Vary', 'Authorization')
        res.setHeader('X-Robots-Tag', 'noindex')
        if (req.method !== 'GET') {
            res.setHeader('Allow', 'GET')
            return res.status(405).json({ success: false, code: 'METHOD_NOT_ALLOWED' })
        }
        let payload
        try {
            const token = extractToken(req)
            payload = token ? verifyToken(token) : null
        } catch { payload = null }
        if (!payload?.userId) return res.status(401).json({ success: false, code: 'LOGIN_REQUIRED' })
        let user
        try { user = await getUser(payload.userId) }
        catch { return res.status(503).json({ success: false, code: 'ACCESS_VERIFICATION_UNAVAILABLE' }) }
        if (!user) return res.status(401).json({ success: false, code: 'LOGIN_REQUIRED' })
        if ((user.status && user.status !== 'active') || (!isAdmin(user) && !deriveMembershipCapabilities(user).canAccessTrustedCompaniesPage)) {
            return res.status(403).json({ success: false, code: 'FULL_MEMBERSHIP_REQUIRED' })
        }
        const id = req.query?.companyId
        if (id !== undefined && (typeof id !== 'string' || !id.trim() || id.length > 160)) return res.status(400).json({ success: false, code: 'INVALID_COMPANY_ID' })
        const entries = id ? data.companies.filter(row => row.companyId === id) : data.companies
        if (!entries.length) return res.status(404).json({ success: false, code: 'RANKING_COMPANY_NOT_FOUND' })
        try {
            const companies = await enrich(entries)
            return res.status(200).json({ success: true, version: data.version, researchedAt: data.researchedAt, weights: data.weights, total: data.companies.length, companies })
        } catch { return res.status(503).json({ success: false, code: 'RANKING_UNAVAILABLE' }) }
    }
}
