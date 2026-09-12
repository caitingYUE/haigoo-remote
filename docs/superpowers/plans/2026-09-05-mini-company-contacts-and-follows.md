# Haigoo Mini Program Company Contacts and Follows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make email-only jobs actionable, expose privacy-safe company-contact previews, show authoritative personalized role labels, unify company details, and add a dedicated followed-companies management page.

**Architecture:** Extend the existing Mini Gateway and CloudRun contracts instead of adding parallel company APIs. Keep sensitive contact redaction and follow-state transitions server-side; keep user-direction highlighting in the Mini Program by combining authoritative `openRoleCategories` with the already loaded Career Watch profile and filter metadata. All company entry points continue to use the canonical company-detail route.

**Tech Stack:** Node.js ES modules, Neon/PostgreSQL, CloudRun HTTP gateway, Taro 4.2.1, React 18, TypeScript 5.4, SCSS, WeChat Mini Program APIs, existing Node contract tests.

**Spec:** `docs/superpowers/specs/2026-09-05-mini-company-contacts-and-follows-design.md`

## Global Constraints

- Preserve real company, job, contact, rating, category, follow, and subscription data; never add fixtures to production UI.
- Public application email is not a member contact and must remain available to non-members.
- Non-member responses must never contain original contact names, email addresses, LinkedIn URLs, hashes of those values, or reversible identifiers.
- Membership and company-detail access are decided by the server, not by cached Mini Program session flags.
- `cancel reminder` keeps the follow active; `unfollow` disables reminders and removes the follow in one atomic server operation.
- Re-following a company must not restore historical WeChat reminder permission.
- `company_job_history.category` is the visible role-label authority; `role_families` is used only to determine relevance to the user.
- Match ranking, scoring, snapshot order, recommendation logic, position cache, and reduced-motion behavior must not change.
- The custom bottom TabBar remains exactly `企业 / Match / 笔记`; the new followed-companies screen is a Profile child route.
- Keep current palette and design system. Touch targets are at least `88rpx`; verify `390 x 844` at DPR 3 and a 320px narrow viewport.
- The worktree is already dirty. Read overlapping files before editing, preserve unrelated changes, and never use `git reset --hard` or destructive checkout commands.
- Implement backend-compatible additive fields first, then frontend consumers, then visual and release verification.

---

## File Map

### Shared and backend

- Create `lib/shared/mini-company-presentation.js`: pure contact masking and authoritative open-role category normalization.
- Create `lib/shared/mini-company-presentation.d.ts`: TypeScript declarations for the shared helpers.
- Modify `lib/api-handlers/mini-gateway.js`: company list categories, privacy-safe contact response, followed-company access authorization.
- Modify `lib/services/mini-company-match-service.js`: enriched follow summaries and atomic follow/reminder transitions.
- Modify `cloudrun/index.mjs`: hydrate logos on follow summaries without changing the public follow keys.
- Verify `cloudrun/company-directory.mjs`: retain the existing URL/email-only application mapping.

### Mini Program

- Modify `miniprogram/src/types/index.ts`: contact preview and open-role category fields.
- Modify `miniprogram/src/services/content-service.ts`: expose company access metadata without deleting safe previews.
- Modify `miniprogram/src/services/career-match-service.ts`: typed followed-company summaries.
- Create `miniprogram/src/utils/company-role-summary.ts`: renderable category segments and profile matching.
- Modify `miniprogram/src/pages/job-detail/index.tsx` and `index.scss`: public application method states.
- Modify `miniprogram/src/pages/company-detail/index.tsx` and `index.scss`: canonical contact states and separated reminder behavior.
- Modify `miniprogram/src/pages/companies/index.tsx` and `index.scss`: remove per-company detail fetching and highlight only matched categories.
- Create `miniprogram/src/pages/followed-companies/index.tsx`, `index.scss`, and `index.config.ts`: followed-company management.
- Modify `miniprogram/src/pages/profile/index.tsx`: navigate to the new management page.
- Modify `miniprogram/src/app.config.ts`: register the child route without touching `tabBar.list`.

### Tests

- Create `test-mini-company-contacts-and-follows.js`: pure contracts, privacy assertions, source-level integration contracts.
- Modify `test-mini-company-directory.js`: email-only application regression coverage and category contract.
- Modify `test-mini-content-contract.js`: mapped company fields.
- Modify `test-mini-release-readiness.js`: new route and removal of stale email prohibition.
- Modify `test-mini-design-readiness.js`: followed page and partial category highlight structure.
- Modify `test-mini-match-follow-loop.js`: separated company-detail reminder semantics.
- Modify `package.json`: register `test:mini-company-contacts`.

---

### Task 1: Add Privacy and Role-Normalization Contracts

**Files:**

- Create: `lib/shared/mini-company-presentation.js`
- Create: `lib/shared/mini-company-presentation.d.ts`
- Create: `test-mini-company-contacts-and-follows.js`
- Modify: `package.json`

**Interfaces:**

- Produces: `maskCompanyContactName(name: unknown): string`
- Produces: `buildCompanyContactPreview(contact: object): { id: string; maskedName: string; title: string }`
- Produces: `normalizeOpenRoleCategories(values: unknown, limit?: number): string[]`
- Consumes: `JOB_CATEGORY_OPTIONS` from `lib/shared/job-categories.js`

- [ ] **Step 1: Write the failing pure-contract test**

Create `test-mini-company-contacts-and-follows.js` with these executable assertions:

```js
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildCompanyContactPreview,
  maskCompanyContactName,
  normalizeOpenRoleCategories
} from './lib/shared/mini-company-presentation.js'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')

assert.equal(maskCompanyContactName('张三'), '张*')
assert.equal(maskCompanyContactName('欧阳娜娜'), '欧***')
assert.equal(maskCompanyContactName('Jane Smith'), 'J*** S***')
assert.equal(maskCompanyContactName('Q'), 'Q')
assert.equal(maskCompanyContactName(''), '联系人')

const preview = buildCompanyContactPreview({
  id: 'contact-1', name: 'Jane Smith', title: 'VP People',
  email: 'jane@example.com', linkedin: 'https://linkedin.example/jane'
})
assert.deepEqual(preview, { id: 'contact-1', maskedName: 'J*** S***', title: 'VP People' })
assert.doesNotMatch(JSON.stringify(preview), /jane@example|linkedin|Jane Smith/)

assert.deepEqual(
  normalizeOpenRoleCategories(['软件开发', '前端开发', '后端开发', '前端开发', '其他']),
  ['前端开发', '后端开发']
)
assert.deepEqual(
  normalizeOpenRoleCategories(['设计', 'UI/UX设计', '产品经理']),
  ['UI/UX设计', '产品经理']
)
assert.deepEqual(normalizeOpenRoleCategories(['unknown', '', null]), [])

const gateway = read('./lib/api-handlers/mini-gateway.js')
const matchService = read('./lib/services/mini-company-match-service.js')
const companiesPage = read('./miniprogram/src/pages/companies/index.tsx')
const companyDetail = read('./miniprogram/src/pages/company-detail/index.tsx')
const jobDetail = read('./miniprogram/src/pages/job-detail/index.tsx')
const profile = read('./miniprogram/src/pages/profile/index.tsx')
const appConfig = read('./miniprogram/src/app.config.ts')

assert.match(gateway, /contactPreviews/)
assert.match(gateway, /mini_company_follows/)
assert.match(matchService, /openRoleCategories/)
assert.match(matchService, /wechat_enabled\s*=\s*FALSE|wechat_enabled = CASE/)
assert.match(jobDetail, /publicApplicationEmail/)
assert.match(companyDetail, /WechatReminderAction/)
assert.doesNotMatch(companyDetail, /await unfollowCompany\(company\.id\)/)
assert.match(companiesPage, /openRoleCategories/)
assert.doesNotMatch(companiesPage, /fetchCompany\(company\.id/)
assert.match(profile, /pages\/followed-companies\/index/)
assert.match(appConfig, /pages\/followed-companies\/index/)

console.log('mini company contacts and follows checks passed')
```

- [ ] **Step 2: Register and run the failing test**

Add to root `package.json`:

```json
"test:mini-company-contacts": "node test-mini-company-contacts-and-follows.js"
```

Run:

```bash
npm run test:mini-company-contacts
```

Expected: FAIL because `lib/shared/mini-company-presentation.js` does not exist.

- [ ] **Step 3: Implement the shared pure helpers**

Create `lib/shared/mini-company-presentation.js`:

```js
import { JOB_CATEGORY_OPTIONS } from './job-categories.js'

const ALLOWED_CATEGORIES = new Set(JOB_CATEGORY_OPTIONS)
const GENERIC_BY_SPECIFIC = new Map([
  ['软件开发', new Set(['前端开发', '后端开发', '全栈开发', '移动开发', '数据开发', '服务器开发', '平台工程师', '数据库工程师'])],
  ['设计', new Set(['产品设计', 'UI/UX设计', '视觉设计', '平面设计', '创意设计', '营销设计'])]
])

function cleanText(value, limit = 160) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit)
}

export function maskCompanyContactName(value) {
  const name = cleanText(value, 100)
  if (!name) return '联系人'
  if (/^[\u3400-\u9fff]+$/u.test(name)) return name.length === 1 ? name : `${name[0]}${'*'.repeat(name.length - 1)}`
  return name.split(/\s+/).filter(Boolean).map((part) => part.length === 1 ? part : `${part[0]}***`).join(' ')
}

export function buildCompanyContactPreview(contact = {}) {
  return {
    id: cleanText(contact.id, 120) || 'contact',
    maskedName: maskCompanyContactName(contact.name),
    title: cleanText(contact.title, 160)
  }
}

export function normalizeOpenRoleCategories(values, limit = 6) {
  const unique = [...new Set((Array.isArray(values) ? values : [])
    .map((value) => cleanText(value, 120))
    .filter((value) => value && value !== '其他' && ALLOWED_CATEGORIES.has(value)))]
  const specific = new Set(unique)
  const filtered = unique.filter((value) => {
    const replacements = GENERIC_BY_SPECIFIC.get(value)
    return !replacements || ![...replacements].some((item) => specific.has(item))
  })
  return filtered.slice(0, Math.max(0, Math.min(12, Number(limit) || 0)))
}
```

Create matching declarations in `lib/shared/mini-company-presentation.d.ts`:

```ts
export interface CompanyContactPreview {
  id: string
  maskedName: string
  title: string
}

export function maskCompanyContactName(value: unknown): string
export function buildCompanyContactPreview(contact?: Record<string, unknown>): CompanyContactPreview
export function normalizeOpenRoleCategories(values: unknown, limit?: number): string[]
```

- [ ] **Step 4: Run the focused test**

```bash
npm run test:mini-company-contacts
```

Expected: helper assertions PASS; source integration assertions still FAIL on fields and pages not yet implemented.

- [ ] **Step 5: Commit the helper contract**

```bash
git add package.json test-mini-company-contacts-and-follows.js lib/shared/mini-company-presentation.js lib/shared/mini-company-presentation.d.ts
git commit -m "test(mini): define company contact privacy contracts"
```

---

### Task 2: Extend Company Directory and Detail Backend Contracts

**Files:**

- Modify: `lib/api-handlers/mini-gateway.js`
- Modify: `miniprogram/src/types/index.ts`
- Modify: `miniprogram/src/services/content-service.ts`
- Modify: `test-mini-content-contract.js`
- Modify: `test-mini-release-readiness.js`

**Interfaces:**

- Consumes: `buildCompanyContactPreview()` and `normalizeOpenRoleCategories()` from Task 1.
- Produces: `MiniCompany.openRoleCategories?: string[]`
- Produces: `MiniCompany.contactPreviews?: CompanyContactPreview[]`
- Produces: `fetchCompanyDetail(...): Promise<{ company: MiniCompany; access: CompanyAccess }>` while keeping `fetchCompany()` as a compatibility wrapper if needed.

- [ ] **Step 1: Add failing mapper and privacy assertions**

In `test-mini-content-contract.js`, extend the `mapMiniCompany` fixture:

```js
const categorizedCompany = mapMiniCompany({
  company_id: 'company-role', name: 'Role Co',
  open_role_categories: ['软件开发', '前端开发', '产品经理']
})
assert.deepEqual(categorizedCompany.openRoleCategories, ['前端开发', '产品经理'])
```

In `test-mini-release-readiness.js`, add source contracts:

```js
assert.match(gateway, /contactPreviews/)
assert.match(gateway, /buildCompanyContactPreview/)
assert.match(gateway, /open_role_categories/)
assert.match(gateway, /mini_company_follows/)
assert.match(contentService, /contactPreview/)
assert.doesNotMatch(contentService, /delete company\.contactPreviews/)
```

Run:

```bash
npm run test:mini-content
npm run test:mini-release
```

Expected: FAIL on the missing fields and access contract.

- [ ] **Step 2: Add authoritative role categories to company queries**

Import the Task 1 helpers in `lib/api-handlers/mini-gateway.js`:

```js
import {
  buildCompanyContactPreview,
  normalizeOpenRoleCategories
} from '../shared/mini-company-presentation.js'
```

Extend the existing `hiringJoin` lateral query in `readMiniCompanies()` with a stable category array:

```sql
ARRAY(
  SELECT category_rollup.category
    FROM (
      SELECT BTRIM(open_job.category) AS category,
             COUNT(*)::int AS job_count,
             MAX(open_job.last_seen_at) AS latest_seen
        FROM company_job_history open_job
       WHERE open_job.company_id = tc.company_id
         AND open_job.closed_at IS NULL
         AND open_job.is_public_opportunity IS TRUE
         AND NULLIF(BTRIM(open_job.category), '') IS NOT NULL
       GROUP BY BTRIM(open_job.category)
       ORDER BY latest_seen DESC NULLS LAST, job_count DESC, category ASC
       LIMIT 12
    ) category_rollup
) AS open_role_categories
```

Select `hiring.open_role_categories` in the company-list query and add to `mapMiniCompany()`:

```js
openRoleCategories: normalizeOpenRoleCategories(safeJsonArray(row.open_role_categories), 6)
```

Do not remove `publicJobTitles` in this task; older clients still consume it.

- [ ] **Step 3: Add followed-company access to company detail**

In `handleMiniCompany()`, extend the non-member `freeAccess` SQL with this fourth branch:

```sql
OR ($2::text <> '' AND EXISTS (
  SELECT 1
    FROM mini_company_follows follows
   WHERE follows.user_id::text = $2::text
     AND follows.company_id = $1
     AND follows.status = 'active'
))
```

Keep the existing free-directory, fixed-Match, and exact-search branches unchanged.

- [ ] **Step 4: Build contact previews without leaking public application email**

Before mapping `referral_contacts`, read current public job rows for this company through the existing formal jobs reader:

```js
const publicJobs = await readJobsFromNeon({
  companyId,
  trustedCompaniesOnly: true,
  canAccessMemberOnly: false,
  sortBy: 'recent'
}, { page: 1, limit: 100 }).catch(() => [])

const publicApplicationEmails = new Set((publicJobs || [])
  .filter((job) => !job.memberOnly && !job.url && !job.sourceUrl)
  .map((job) => normalizeEmail(job.hiringEmail))
  .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))
```

Normalize contacts, then filter public application email before count, previews, and member contacts:

```js
const contacts = rawContacts.map((item, index) => ({
  id: String(item?.id || `contact-${index + 1}`),
  name: String(item?.name || '').trim(),
  title: String(item?.title || '').trim(),
  email: String(item?.hiringEmail || item?.email || '').trim(),
  linkedin: safeExternalUrl(item?.linkedin)
})).filter((item) => (item.email || item.linkedin)
  && !publicApplicationEmails.has(normalizeEmail(item.email)))

const contactPreviews = contacts.map(buildCompanyContactPreview)
```

Return additive fields:

```js
const company = {
  ...mapMiniCompany(row),
  contactCount: contacts.length,
  contactPreviews,
  ...(viewer.capabilities.canAccessCompanyContacts && contacts.length ? { contacts } : {})
}

const access = {
  scope: viewer.hasCompanyDirectoryAccess ? 'member_all' : 'free_fixed',
  fullDirectory: viewer.hasCompanyDirectoryAccess,
  contacts: viewer.capabilities.canAccessCompanyContacts && contacts.length > 0,
  contactPreview: contactPreviews.length > 0
}
```

Before committing, add a request-level unit seam that calls the contact response builder with a non-member viewer and asserts the serialized payload does not contain the fixture's original name/email/LinkedIn. Export only the pure builder for testing; do not export raw database helpers.

- [ ] **Step 5: Extend Mini Program types and preserve access metadata**

Add to `miniprogram/src/types/index.ts`:

```ts
export interface CompanyContactPreview {
  id: string
  maskedName: string
  title: string
}

export interface CompanyAccess {
  scope: 'free_fixed' | 'member_all'
  fullDirectory: boolean
  contacts: boolean
  contactPreview: boolean
}
```

Extend `MiniCompany`:

```ts
openRoleCategories?: string[]
contactPreviews?: CompanyContactPreview[]
```

Change `content-service.ts` to return both company and access:

```ts
export async function fetchCompanyDetail(id: string, _force = false, accessSearch = '') {
  const searchQuery = accessSearch.trim() ? `?search=${encodeURIComponent(accessSearch.trim())}` : ''
  const response = await requestJson<{ success: true; company: MiniCompany; access: CompanyAccess }>(
    `/mini/companies/${encodeURIComponent(id)}${searchQuery}`,
    { authenticated: true }
  )
  if (!['free_fixed', 'member_all'].includes(response?.access?.scope)) {
    throw new Error('企业访问权限尚未确认，请稍后重试')
  }
  const [company] = await hydrateCompanies([response.company])
  return {
    company,
    access: {
      ...response.access,
      contactPreview: Boolean(response.access.contactPreview)
    }
  }
}

export async function fetchCompany(id: string, force = false, accessSearch = '') {
  return (await fetchCompanyDetail(id, force, accessSearch)).company
}
```

Do not delete `contacts` or `contactPreviews` in the client. The server is the authorization boundary.

- [ ] **Step 6: Run backend contract tests**

```bash
npm run test:mini-content
npm run test:mini-release
npm run test:mini-company-contacts
```

Expected: content and backend privacy assertions PASS; page integration assertions may still fail until later tasks.

- [ ] **Step 7: Commit the additive company contract**

```bash
git add lib/api-handlers/mini-gateway.js miniprogram/src/types/index.ts miniprogram/src/services/content-service.ts test-mini-content-contract.js test-mini-release-readiness.js test-mini-company-contacts-and-follows.js
git commit -m "feat(mini): expose safe company contact previews"
```

---

### Task 3: Make Follow and Reminder State Atomic and Enrich Follow Summaries

**Files:**

- Modify: `lib/services/mini-company-match-service.js`
- Modify: `cloudrun/index.mjs`
- Modify: `miniprogram/src/services/career-match-service.ts`
- Modify: `miniprogram/src/services/company-follow-state.ts`
- Modify: `test-mini-company-contacts-and-follows.js`
- Modify: `test-mini-match-follow-loop.js`

**Interfaces:**

- Produces: `CompanyFollowSummary`
- Preserves: `followCompany(companyId)`, `unfollowCompany(companyId)`, `setMatchNotifications(companyId, enabled, templateStatus)`
- Produces events: `{ companyId, followed, reminderEnabled }`

- [ ] **Step 1: Add failing follow-state source contracts**

Append to `test-mini-company-contacts-and-follows.js`:

```js
const cloudrun = read('./cloudrun/index.mjs')
const careerClient = read('./miniprogram/src/services/career-match-service.ts')
const followState = read('./miniprogram/src/services/company-follow-state.ts')

assert.match(matchService, /open_role_categories/)
assert.match(matchService, /openJobCount/)
assert.match(matchService, /followedAt/)
assert.match(matchService, /status = 'inactive'[\s\S]*wechat_enabled = FALSE/)
assert.match(matchService, /wechat_template_status = 'not_requested'/)
assert.match(cloudrun, /attachFollowLogos/)
assert.match(careerClient, /CompanyFollowSummary/)
assert.match(followState, /reminderEnabled/)
```

Add to `test-mini-match-follow-loop.js`:

```js
assert.match(reminderAction, /followed:\s*true,\s*reminderEnabled:\s*nextEnabled/)
assert.doesNotMatch(reminderAction, /unfollowCompany/)
```

Run both tests and confirm they fail.

- [ ] **Step 2: Reset reminders only on a real follow transition**

Replace the follow upsert in `setCompanyFollow()` with one atomic statement:

```sql
INSERT INTO mini_company_follows (
  user_id, company_id, status, in_app_enabled,
  wechat_enabled, wechat_template_status, updated_at
) VALUES ($1, $2, $3, TRUE, FALSE, 'not_requested', NOW())
ON CONFLICT (user_id, company_id) DO UPDATE SET
  status = EXCLUDED.status,
  in_app_enabled = EXCLUDED.status = 'active',
  wechat_enabled = CASE
    WHEN EXCLUDED.status = 'inactive' OR mini_company_follows.status = 'inactive' THEN FALSE
    ELSE mini_company_follows.wechat_enabled
  END,
  wechat_template_status = CASE
    WHEN EXCLUDED.status = 'inactive' OR mini_company_follows.status = 'inactive' THEN 'not_requested'
    ELSE mini_company_follows.wechat_template_status
  END,
  updated_at = NOW()
```

This preserves reminders on an idempotent duplicate follow of an already active row, resets reminders when an inactive row is reactivated, and disables reminders on unfollow.

- [ ] **Step 3: Enrich `listCompanyFollows()` without filtering stopped-hiring companies**

Extend the query with company identity fields and a lateral open-job rollup:

```sql
SELECT follows.company_id, follows.status, follows.in_app_enabled,
       follows.wechat_enabled, follows.wechat_template_status,
       follows.created_at AS followed_at,
       companies.name, companies.industry, companies.cached_logo_url,
       COALESCE(hiring.open_job_count, 0) AS open_job_count,
       hiring.open_role_categories
  FROM mini_company_follows follows
  JOIN trusted_companies companies ON companies.company_id = follows.company_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS open_job_count,
           ARRAY(
             SELECT grouped.category
               FROM (
                 SELECT BTRIM(history.category) AS category,
                        COUNT(*)::int AS job_count,
                        MAX(history.last_seen_at) AS latest_seen
                   FROM company_job_history history
                  WHERE history.company_id = follows.company_id
                    AND history.closed_at IS NULL
                    AND history.is_public_opportunity IS TRUE
                    AND NULLIF(BTRIM(history.category), '') IS NOT NULL
                  GROUP BY BTRIM(history.category)
                  ORDER BY latest_seen DESC NULLS LAST, job_count DESC, category ASC
                  LIMIT 12
               ) grouped
           ) AS open_role_categories
      FROM company_job_history open_jobs
     WHERE open_jobs.company_id = follows.company_id
       AND open_jobs.closed_at IS NULL
       AND open_jobs.is_public_opportunity IS TRUE
  ) hiring ON TRUE
 WHERE follows.user_id = $1
   AND follows.status = 'active'
 ORDER BY follows.updated_at DESC
```

Map rows instead of returning snake-case database rows directly:

```js
return {
  success: true,
  follows: (rows || []).map((row) => ({
    company_id: String(row.company_id),
    name: String(row.name || ''),
    industry: String(row.industry || ''),
    logoFileId: /^cloud:\/\/[A-Za-z0-9_.@/-]+$/.test(String(row.cached_logo_url || '').trim())
      ? String(row.cached_logo_url).trim()
      : '',
    _logoSourcePath: `/api/company-assets?companyId=${encodeURIComponent(String(row.company_id))}&type=logo`,
    openJobCount: Number(row.open_job_count || 0),
    openRoleCategories: normalizeOpenRoleCategories(row.open_role_categories, 6),
    followedAt: row.followed_at || null,
    wechat_enabled: Boolean(row.wechat_enabled),
    wechat_template_status: String(row.wechat_template_status || 'not_requested')
  }))
}
```

The follow service must not return `companies.logo` or any third-party URL. It may return only a validated `cloud://` ID or the canonical first-party `_logoSourcePath`; `attachCompanyLogos()` strips `_logoSourcePath` before the client response. Do not remove stopped-hiring companies from the result.

- [ ] **Step 4: Hydrate follow logos in CloudRun**

Add a focused adapter in `cloudrun/index.mjs`:

```js
async function attachFollowLogos(follows) {
  const hydrated = await attachCompanyLogos((Array.isArray(follows) ? follows : []).map((follow) => ({
    ...follow,
    id: follow.company_id
  })))
  return hydrated.map(({ id, ...follow }) => follow)
}
```

Use it in `GET /mini/match/follows`:

```js
const result = await gatewayRequest('match_follows', { query: { openid: session.openid } })
return send(res, 200, { ...result, follows: await attachFollowLogos(result.follows) })
```

- [ ] **Step 5: Type the follow response and event semantics**

In `career-match-service.ts` define:

```ts
export interface CompanyFollowSummary {
  company_id: string
  name: string
  industry: string
  logoFileId?: string
  openJobCount: number
  openRoleCategories: string[]
  followedAt: string | null
  wechat_enabled: boolean
  wechat_template_status: string
}
```

Change `fetchCompanyFollows()` to return `CompanyFollowSummary[]`. Keep `company-follow-state.ts` event fields unchanged, but document through code naming that `followed` and `reminderEnabled` are independent.

- [ ] **Step 6: Run follow tests**

```bash
npm run test:mini-company-contacts
npm run test:mini-match-follow-loop
npm run test:mini-company-match
```

Expected: PASS for helper and follow-state contracts; remaining page assertions may still fail.

- [ ] **Step 7: Commit follow-state changes**

```bash
git add lib/services/mini-company-match-service.js cloudrun/index.mjs miniprogram/src/services/career-match-service.ts miniprogram/src/services/company-follow-state.ts test-mini-company-contacts-and-follows.js test-mini-match-follow-loop.js
git commit -m "feat(mini): separate company follows from reminders"
```

---

### Task 4: Render Public Email Application and Canonical Contact States

**Files:**

- Modify: `miniprogram/src/pages/job-detail/index.tsx`
- Modify: `miniprogram/src/pages/job-detail/index.scss`
- Modify: `miniprogram/src/pages/company-detail/index.tsx`
- Modify: `miniprogram/src/pages/company-detail/index.scss`
- Modify: `test-mini-company-directory.js`
- Modify: `test-mini-release-readiness.js`
- Modify: `test-mini-match-follow-loop.js`

**Interfaces:**

- Consumes: `fetchCompanyDetail()` from Task 2.
- Consumes: `CompanyAccess`, `contactPreviews`, and `contacts`.
- Consumes: existing `CompanyFollowAction` and `WechatReminderAction`.
- Preserves: canonical route `/pages/company-detail/index?id=<companyId>`.

- [ ] **Step 1: Update failing job-detail expectations**

In `test-mini-release-readiness.js`, replace the stale prohibition:

```js
assert.doesNotMatch(jobDetail, /复制公开申请邮箱|公开申请邮箱/)
```

with:

```js
assert.match(jobDetail, /publicApplicationEmail/)
assert.match(jobDetail, /复制申请邮箱/)
assert.match(jobDetail, /暂未收录公开申请方式/)
```

Extend `test-mini-company-directory.js`:

```js
const noApplyMethod = mapCompanyJobDetail({
  id: 'j3', companyId: 'c1', title: 'Analyst', company: 'Alpha', hiringEmail: 'invalid'
}, 'c1')
assert.equal(noApplyMethod.officialApplyUrl, '')
assert.equal(noApplyMethod.publicApplicationEmail, '')
```

Run and confirm the release test fails on the current page.

- [ ] **Step 2: Model and render the job application method**

Replace `copyValue(value)` with a message-aware helper:

```ts
async function copyValue(value: string, successTitle: string) {
  try {
    await setClipboardData({ data: value })
    showToast({ title: successTitle, icon: 'success' })
  } catch {
    showToast({ title: '复制失败，请稍后重试', icon: 'none' })
  }
}
```

After loading `job`, derive:

```ts
const applicationMethod = job.officialApplyUrl
  ? { kind: 'url' as const, label: '官网申请', value: job.officialApplyUrl, action: '复制申请链接' }
  : job.publicApplicationEmail
    ? { kind: 'email' as const, label: '公开申请邮箱', value: job.publicApplicationEmail, action: '复制申请邮箱' }
    : null
```

Render an in-flow application section before the fixed action bar. The fixed bar uses `applicationMethod` and calls:

```ts
void copyValue(
  applicationMethod.value,
  applicationMethod.kind === 'email' ? '申请邮箱已复制' : '申请链接已复制'
)
```

When absent, show `暂未收录公开申请方式` and a disabled action. Give the email value selectable visual treatment and allow wrapping at 320px.

- [ ] **Step 3: Add failing company-detail contact-state contracts**

Add to `test-mini-company-contacts-and-follows.js`:

```js
assert.match(companyDetail, /fetchCompanyDetail/)
assert.match(companyDetail, /contactPreviews/)
assert.match(companyDetail, /maskedName/)
assert.match(companyDetail, /查看会员权益/)
assert.match(companyDetail, /WechatReminderAction/)
assert.doesNotMatch(companyDetail, /await unfollowCompany\(company\.id\)/)
```

Run and confirm failure.

- [ ] **Step 4: Consume the canonical company response**

In `company-detail/index.tsx`, store access with company data:

```ts
const [access, setAccess] = useState<CompanyAccess | null>(null)
```

Load with:

```ts
const [companyResult, follows, watch] = await Promise.all([
  fetchCompanyDetail(id, true, accessSearch),
  authenticated ? fetchCompanyFollows().catch(() => emptyFollows) : Promise.resolve(emptyFollows),
  authenticated ? fetchCareerWatch().catch(() => null) : Promise.resolve(null)
])
setCompany(companyResult.company)
setAccess(companyResult.access)
```

No branch may read Match card fields or synthesize identity data.

- [ ] **Step 5: Render four explicit contact states**

Use these branches in order:

```tsx
const fullContacts = company.contacts || []
const previews = company.contactPreviews || []
const contactCount = Number(company.contactCount || 0)

const contactSection = access?.contacts && fullContacts.length
  ? <FullCompanyContacts contacts={fullContacts} />
  : previews.length
    ? <LockedCompanyContacts previews={previews} onUnlock={() => navigateTo({ url: '/pages/membership/index' })} />
    : contactCount > 0
      ? <LegacyLockedCompanyContacts onUnlock={() => navigateTo({ url: '/pages/membership/index' })} />
      : <Text className='company-detail__empty-copy'>暂未收录企业联系人</Text>
```

Keep these renderers inside the page unless extraction clearly reduces duplication. Full contacts show complete values and independent copy controls. Locked previews show only `maskedName` and `title`; no hidden DOM node may contain full contact data.

- [ ] **Step 6: Separate the company-detail reminder flow**

Remove the current branch where closing `subscribed` calls both `setMatchNotifications()` and `unfollowCompany()`.

Use this display rule:

- Not followed: footer primary action `订阅更新`; handler calls `followCompany(company.id)`, sets `followed=true`, then invokes the same WeChat authorization flow. If authorization is rejected or unavailable, leave `followed=true` and `subscribed=false`.
- Followed and reminder off: render `WechatReminderAction` with `enabled={false}`.
- Followed and reminder on: render `WechatReminderAction` with `enabled={true}`; closing it keeps `followed=true`.
- Website/careers copy remains a separate action.
- Do not expose an ambiguous `取消订阅` label that performs unfollow.

Emit `company-follow-state` only after server success.

- [ ] **Step 7: Polish the two detail pages within current design tokens**

In the SCSS files:

- Keep existing company-detail header, tabs, metrics, and card language from the Companies baseline.
- Give locked and full contact rows the same vertical hierarchy and at least `88rpx` touch areas.
- Use `overflow-wrap: anywhere` for public application email.
- Keep fixed action bars above `env(safe-area-inset-bottom)`.
- At 320px, stack label/value content before reducing body text size.
- Do not add gradients, heavy shadow stacks, or a second company-detail visual variant.

- [ ] **Step 8: Run page contracts and type-check**

```bash
npm run test:mini-company-contacts
npm run test:mini-release
npm run test:mini-match-follow-loop
node test-mini-company-directory.js
npm --prefix miniprogram run type-check
```

Expected: PASS.

- [ ] **Step 9: Commit detail-page behavior**

```bash
git add miniprogram/src/pages/job-detail miniprogram/src/pages/company-detail test-mini-company-directory.js test-mini-release-readiness.js test-mini-match-follow-loop.js test-mini-company-contacts-and-follows.js
git commit -m "feat(mini): show email applications and contact previews"
```

---

### Task 5: Replace Guessed Company Role Copy with Personalized Structured Segments

**Files:**

- Create: `miniprogram/src/utils/company-role-summary.ts`
- Modify: `miniprogram/src/pages/companies/index.tsx`
- Modify: `miniprogram/src/pages/companies/index.scss`
- Modify: `test-mini-design-readiness.js`
- Modify: `test-mini-company-contacts-and-follows.js`

**Interfaces:**

- Consumes: `MiniCompany.openRoleCategories` from Task 2.
- Consumes: `CareerWatchResponse.profile` and `CareerWatchResponse.filterOptions.roleGroups`.
- Produces: `buildCompanyRoleSummary(categories, profile, filterOptions): CompanyRoleSummary`.

- [ ] **Step 1: Add failing helper and page assertions**

Append source contracts:

```js
const roleSummary = read('./miniprogram/src/utils/company-role-summary.ts')
assert.match(roleSummary, /buildCompanyRoleSummary/)
assert.match(roleSummary, /customRoleTerms/)
assert.match(roleSummary, /roleGroups/)
assert.match(companiesPage, /company-card__role--matched/)
assert.doesNotMatch(companiesPage, /roleLabelsFromTitles/)
assert.doesNotMatch(companiesPage, /loadCompanyDirections/)
```

In `test-mini-design-readiness.js`, require the matched span and forbid the old all-orange class rule:

```js
assert.match(companiesPage, /company-card__role--matched/)
assert.doesNotMatch(read('miniprogram/src/pages/companies/index.scss'), /company-card__roles\.has-directions\s*\{[^}]*color:\s*#f0/s)
```

Run both tests and confirm failure.

- [ ] **Step 2: Implement the pure frontend summary helper**

Create `company-role-summary.ts`:

```ts
import type { CareerWatchResponse, WatchProfile, WatchFilterOptions } from '../services/career-match-service'

export interface CompanyRoleSegment {
  label: string
  matched: boolean
}

export interface CompanyRoleSummary {
  ariaLabel: string
  segments: CompanyRoleSegment[]
  suffix: string
}

export function buildCompanyRoleSummary(
  categories: string[] = [],
  profile: WatchProfile | null,
  filterOptions: WatchFilterOptions | CareerWatchResponse['filterOptions']
): CompanyRoleSummary {
  const visible = [...new Set(categories.map((item) => String(item || '').trim()).filter(Boolean))].slice(0, 2)
  if (!visible.length) return { ariaLabel: '查看当前开放岗位', segments: [], suffix: '查看当前开放岗位' }

  const optionMap = new Map((filterOptions.roleGroups || []).flatMap((group) => group.options)
    .map((option) => [option.value, option]))
  const exact = new Set((profile?.customRoleTerms || [])
    .map((item) => item.trim())
    .filter((item) => optionMap.has(item)))
  const families = new Set(profile?.roleFamilies || [])
  const segments = visible.map((label) => {
    const option = optionMap.get(label)
    const matched = exact.has(label) || (!exact.size && Boolean(option?.families.some((family) => families.has(family))))
    return { label, matched }
  })
  return {
    ariaLabel: `${visible.join('、')}${categories.length > visible.length ? '等' : ''}可申请`,
    segments,
    suffix: `${categories.length > visible.length ? '等' : ''}可申请`
  }
}
```

If the existing `WatchFilterOptions` type is not exported, export it from `career-match-service.ts` rather than duplicating its structure.

- [ ] **Step 3: Remove per-company detail requests from Companies**

Delete these from `companies/index.tsx`:

- `fetchCompany` import.
- `MiniCompanyJob` import.
- `roleLabelsFromTitles` import.
- `detailJobs`, `directionRequests`, `loadCompanyDirections`, and every call to it.
- `companyOpenRoleSummary()` based on job titles.

Store the loaded watch response:

```ts
const [watchState, setWatchState] = useState<CareerWatchResponse | null>(null)
```

Set it inside the existing `Promise.all()` load and derive each card's role summary:

```ts
const roleSummary = buildCompanyRoleSummary(
  company.openRoleCategories || [],
  watchState?.profile || null,
  watchState?.filterOptions || { roles: [], roleGroups: [], teamSizes: [], ratings: [], companyAges: [], industries: [] }
)
```

- [ ] **Step 4: Render partial emphasis**

Replace the one-string role text with:

```tsx
<View className='company-card__roles' aria-label={roleSummary.ariaLabel}>
  {roleSummary.segments.length ? <>
    {roleSummary.segments.map((segment, index) => <Text key={segment.label}>
      {index ? '、' : ''}
      <Text className={segment.matched ? 'company-card__role--matched' : ''}>{segment.label}</Text>
    </Text>)}
    <Text>{roleSummary.suffix}</Text>
  </> : <Text>{roleSummary.suffix}</Text>}
</View>
```

Style defaults to deep gray and only the matched class to brand orange:

```scss
.company-card__roles { color: #667085; }
.company-card__role--matched { color: var(--color-brand-text); font-weight: 600; }
```

Do not use color on punctuation or `等可申请`.

- [ ] **Step 5: Run Companies tests and type-check**

```bash
npm run test:mini-company-contacts
npm run test:mini-design
npm run test:mini-release
npm --prefix miniprogram run type-check
```

Expected: PASS; inspect logs to confirm Companies no longer issues detail requests solely for labels.

- [ ] **Step 6: Commit role-summary behavior**

```bash
git add miniprogram/src/utils/company-role-summary.ts miniprogram/src/pages/companies test-mini-design-readiness.js test-mini-company-contacts-and-follows.js
git commit -m "feat(mini): personalize company role highlights"
```

---

### Task 6: Add the Followed Companies Management Page

**Files:**

- Create: `miniprogram/src/pages/followed-companies/index.tsx`
- Create: `miniprogram/src/pages/followed-companies/index.scss`
- Create: `miniprogram/src/pages/followed-companies/index.config.ts`
- Modify: `miniprogram/src/pages/profile/index.tsx`
- Modify: `miniprogram/src/app.config.ts`
- Modify: `test-mini-design-readiness.js`
- Modify: `test-mini-company-contacts-and-follows.js`

**Interfaces:**

- Consumes: `fetchCompanyFollows(): Promise<{ follows: CompanyFollowSummary[] }>`.
- Consumes: `fetchCareerWatch()` for WeChat template availability and ID.
- Consumes: `CompanyFollowAction`, `WechatReminderAction`, `onCompanyFollowChange()`.
- Produces route: `/pages/followed-companies/index`.

- [ ] **Step 1: Add failing route and screen contracts**

Append to `test-mini-design-readiness.js`:

```js
const followedCompanies = read('miniprogram/src/pages/followed-companies/index.tsx')
const followedStyles = read('miniprogram/src/pages/followed-companies/index.scss')
assert.match(appConfig, /pages\/followed-companies\/index/)
assert.match(profile, /navigateTo\(\{ url: '\/pages\/followed-companies\/index' \}\)/)
assert.match(followedCompanies, /fetchCompanyFollows/)
assert.match(followedCompanies, /WechatReminderAction/)
assert.match(followedCompanies, /CompanyFollowAction/)
assert.match(followedCompanies, /暂无开放岗位/)
assert.match(followedStyles, /safe-area-inset-bottom/)
```

Run and confirm failure.

- [ ] **Step 2: Register the child page**

Add to `app.config.ts` after company detail:

```ts
'pages/followed-companies/index',
```

Create `index.config.ts`:

```ts
export default definePageConfig({
  navigationBarTitleText: '关注企业',
  enablePullDownRefresh: true,
  backgroundColor: '#f6f7fa'
})
```

Do not alter `tabBar.list`.

- [ ] **Step 3: Build the page loading model**

Use `useDidShow` and pull-to-refresh to load follows and Career Watch in parallel:

```ts
const [companies, setCompanies] = useState<CompanyFollowSummary[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState('')
const [reminderConfig, setReminderConfig] = useState({ available: false, templateId: '' })

const load = useCallback(async ({ preserve = false } = {}) => {
  if (!preserve) setLoading(true)
  setError('')
  try {
    const [follows, watch] = await Promise.all([
      fetchCompanyFollows(),
      fetchCareerWatch().catch(() => null)
    ])
    setCompanies(follows.follows)
    setReminderConfig({
      available: Boolean(watch?.entitlements.wechatSubscriptionAvailable),
      templateId: String(watch?.entitlements.wechatTemplateId || '')
    })
  } catch (loadError) {
    setError(loadError instanceof Error ? loadError.message : '关注企业加载失败')
  } finally {
    setLoading(false)
  }
}, [])
```

On refresh failure with existing data, preserve the list and show an inline retry message.

- [ ] **Step 4: Render compact management rows**

Each row must include:

- Real logo with company-initial fallback.
- Company name and industry.
- `openRoleCategories.slice(0, 2)` joined as an honest summary, or `暂无开放岗位`.
- Text state `已关注`.
- `WechatReminderAction` using the row's `wechat_enabled`.
- `CompanyFollowAction` with `followed={true}` and an `onChanged(false)` callback that removes the row.
- A main body click that navigates only to `/pages/company-detail/index?id=...`.

Update reminder state locally only after `WechatReminderAction` succeeds:

```ts
onChanged={(enabled) => setCompanies((current) => current.map((item) =>
  item.company_id === company.company_id ? { ...item, wechat_enabled: enabled } : item
))}
```

Stop propagation on both action components; retain their existing confirmation and error recovery.

- [ ] **Step 5: Add loading, error, and empty states**

- Loading: use the existing `ContentSkeleton` or a compact list skeleton.
- First-load error: title `关注企业暂时无法加载`, show server message and `重新加载`.
- Empty: `关注企业后，可在这里集中管理岗位更新`, action `浏览企业`, call `switchTab({ url: '/pages/companies/index' })`.
- No jobs: keep the company visible with `暂无开放岗位`.

- [ ] **Step 6: Style for WeChat mobile constraints**

Use a flat page surface and restrained rows:

```scss
.followed-companies-page {
  min-height: 100vh;
  padding-top: 24px;
  padding-bottom: calc(32px + env(safe-area-inset-bottom));
  background: var(--color-page);
}

.followed-company {
  padding: 28px 0;
  border-bottom: 1PX solid var(--color-border);
}

.followed-company__actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 20px;
}
```

At 320px, keep the two actions at least `88rpx` high and allow their labels to wrap; if labels collide, switch the action grid to one column rather than shrinking text.

- [ ] **Step 7: Update the Profile entry**

Replace:

```ts
Taro.switchTab({ url: '/pages/companies/index' })
```

on the “关注企业” fact with:

```ts
navigateTo({ url: '/pages/followed-companies/index' })
```

Keep “未读岗位更新” behavior unchanged.

- [ ] **Step 8: Run route and UI contracts**

```bash
npm run test:mini-company-contacts
npm run test:mini-design
npm run test:mini-match-follow-loop
npm --prefix miniprogram run type-check
```

Expected: PASS.

- [ ] **Step 9: Commit the followed-companies page**

```bash
git add miniprogram/src/pages/followed-companies miniprogram/src/pages/profile/index.tsx miniprogram/src/app.config.ts test-mini-design-readiness.js test-mini-company-contacts-and-follows.js
git commit -m "feat(mini): add followed company management"
```

---

### Task 7: Integration Review, Visual QA, and Release Gates

**Files:**

- Modify only if verification finds scoped defects: files from Tasks 1-6.
- Modify: `design-qa.md` with actual screenshots and findings from this pass.
- Verify: `docs/superpowers/specs/2026-09-05-mini-company-contacts-and-follows-design.md` remains unchanged unless implementation exposes a real contradiction.

**Interfaces:**

- Consumes all prior tasks.
- Produces a verified local and experience-compatible Mini Program build.

- [ ] **Step 1: Run the focused backend and contract suite**

```bash
npm run test:mini-company-contacts
node test-mini-company-directory.js
npm run test:mini-content
npm run test:mini-company-match
npm run test:mini-match-follow-loop
npm run test:mini-release
npm run test:mini-design
```

Expected: all PASS. Do not change new behavior merely to satisfy stale assertions; update an assertion only when it contradicts the approved spec.

- [ ] **Step 2: Run TypeScript and the local WeChat build**

```bash
npm --prefix miniprogram run type-check
npm --prefix miniprogram run build:weapp
```

Expected: exit code 0 and a complete `miniprogram/dist-local` build.

- [ ] **Step 3: Verify privacy at the response boundary**

Using the local gateway test harness or a development Mini Gateway account, capture JSON for the same company as:

1. Anonymous or unbound viewer.
2. Bound non-member.
3. Active member.
4. Expired member.

Assert:

- Non-member JSON contains `contactPreviews` with only `id`, `maskedName`, and `title`.
- Non-member JSON does not contain original contact name, email, LinkedIn, or hashes of those values.
- Member JSON contains complete `contacts` only when `access.contacts === true`.
- A public email-only job exposes `publicApplicationEmail` regardless of member status.
- The same public email does not also appear in `contacts` or contribute to `contactCount`.

Do not store real sensitive response bodies in committed artifacts; record only pass/fail and redacted field names in `design-qa.md`.

- [ ] **Step 4: Verify the state machine with real API calls**

For one test company, execute and observe:

1. Follow with reminders off.
2. Enable WeChat reminder.
3. Disable reminder and confirm the company remains in `GET /mini/match/follows`.
4. Unfollow and confirm the company disappears and the row has reminders disabled server-side.
5. Re-follow and confirm `wechat_enabled === false` and `wechat_template_status === 'not_requested'`.
6. Use a followed company with zero open jobs and confirm company detail access still succeeds.

Restore only the test account's intended final state; do not modify production user data.

- [ ] **Step 5: Capture WeChat Developer Tools screenshots**

Use the default iPhone 12/13 Pro simulator (`390 x 844`, DPR 3) and capture:

- Job detail with public email-only application.
- Company detail as a non-member with masked contacts.
- Company detail as a member with full contacts.
- Companies list with a mixed matched/unmatched role summary.
- Followed companies with reminders off.
- Followed companies with reminders on.
- Followed company with no open jobs.

Repeat the critical layouts at 320px width:

- Public email wraps without horizontal scrolling.
- Contact name/title and unlock action do not collide.
- Companies role punctuation and suffix remain gray while only matching categories are orange.
- Followed-company actions remain at least `88rpx` and stack instead of shrinking when needed.

- [ ] **Step 6: Perform one bounded visual defect pass**

Review screenshots together and fix in one batch:

- Misaligned company identity between Match and Companies entry paths.
- Contact cards that expose hidden text, clip titles, or make locked state ambiguous.
- All-orange role sentences.
- Fixed footer overlap with content or home indicator.
- Action labels below touch-size requirements.
- Empty states that imply a company was deleted when it merely has zero jobs.

Capture one confirmation set after fixes and stop polishing.

- [ ] **Step 7: Build the experience bundle and run asset checks**

```bash
npm --prefix miniprogram run build:weapp:experience
npm --prefix miniprogram run check:weapp:experience
```

Expected: PASS. Do not upload or deploy unless the user separately authorizes release actions.

- [ ] **Step 8: Run repository hygiene checks**

```bash
git diff --check
git status --short
```

Inspect the status carefully. Commit only files changed for this feature; preserve all pre-existing unrelated changes.

- [ ] **Step 9: Update QA evidence and commit**

Add a concise section to `design-qa.md` listing viewport, account state, screenshot paths, privacy checks, state-machine results, tests, and any residual limitations.

```bash
git add design-qa.md
git commit -m "docs(mini): record company contact flow verification"
```

---

## Final Acceptance Checklist

- [ ] Email-only jobs display and copy the public application email.
- [ ] Link-only jobs retain the current official-link action.
- [ ] Jobs with neither method show a stable disabled state.
- [ ] Non-members see only masked contact name and title.
- [ ] Members see complete contact details only when the server grants access.
- [ ] Public application email is not duplicated as a paid contact.
- [ ] Companies cards use authoritative fine-grained categories.
- [ ] Only user-relevant categories are orange; sentence grammar remains gray.
- [ ] Match, Companies, and Followed Companies open the same company-detail implementation.
- [ ] Closing reminders keeps the follow active.
- [ ] Unfollowing disables reminders and removes the company.
- [ ] Re-following does not restore reminders.
- [ ] Followed stopped-hiring companies remain manageable.
- [ ] The new page is not added to the bottom TabBar.
- [ ] `390 x 844` and 320px screenshots pass visual review.
- [ ] Focused tests, Mini Program type-check, local build, experience build, asset check, and `git diff --check` pass.
