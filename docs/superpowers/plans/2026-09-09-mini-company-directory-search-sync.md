# Mini Company Directory Search and Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Mini Program company directory consume only currently approved public jobs, mirror formal public content safely into Preview, support company/job-name search with the required access rules, and expose stable latest/relevance sorting plus truthful 72-hour NEW badges.

**Architecture:** Keep the existing Vercel Gateway, CloudBase development container, Neon tables and Taro page. A signed formal catalog snapshot is validated and atomically projected into Preview; the directory then builds one cached public company snapshot from a strict current-job join and applies access-aware search and user-aware sorting before pagination. No production deployment or new search service is required.

**Tech Stack:** JavaScript, TypeScript, React/Taro, Neon PostgreSQL, CloudBase Node SDK, existing `natural` Damerau-Levenshtein implementation, Node `assert` tests.

**Spec:** `docs/superpowers/specs/2026-09-09-mini-company-directory-search-sync-design.md`

## Global Constraints

- Only companies with at least one current `active`, `is_approved IS TRUE`, non-member-only job and a public application method may appear.
- `jobs.is_approved` is the canonical review flag; a missing flag is never treated as approved.
- Preview's existing 1080 legacy `is_approved=true` jobs are not a valid backfill source.
- A history row without a strict current `jobs` match cannot enter search, counts, facets, sorting or NEW calculations.
- `first_seen_at` is immutable after insert; `source_published_at` and `last_seen_at` do not reset NEW.
- Formal-to-Preview import may write only public company fields, approved public job projections and their histories.
- Do not write users, memberships, orders, payments, follows, contacts or notifications during catalog synchronization.
- Do not deploy Vercel Production or CloudBase production.
- Reuse existing dependencies and tables; do not add a search engine or speculative scoring subsystem.

---

### Task 1: Harden review eligibility and first-seen semantics

**Files:**
- Create: `server-utils/dal/migrations/088_harden_job_approval_default.sql`
- Modify: `src/components/AdminCompanyJobsModal.tsx:190-220`
- Modify: `lib/services/mini-company-match-service.js:201-238,282-301`
- Modify: `lib/api-handlers/processed-jobs.js:3154-3475,4527-4562`
- Test: `test-mini-company-directory-v2.js`

**Interfaces:**
- Produces: `isEligibleDirectoryJob(job): boolean` in `mini-company-match-service.js`.
- Produces: `archiveJobSnapshot(job, { closed?: boolean, firstSeenAt?: string }): Promise<object | null>` with immutable `first_seen_at`.
- Produces: every admin write reconciles its final approval state into `company_job_history` through the shared functions.
- Consumes: existing `archiveJobSnapshot`, `rebuildCompanyHiringProfile`, `recordCompanyUpdateEvent`, and `writeJobsToNeon` flows.

- [ ] **Step 1: Write the failing eligibility and source-contract tests**

Add `test-mini-company-directory-v2.js` with real module assertions and source checks:

```js
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isEligibleDirectoryJob } from './lib/services/mini-company-match-service.js'

const approved = {
  id: 'job-1', companyId: 'company-1', title: 'Product Manager',
  status: 'active', isApproved: true, memberOnly: false,
  url: 'https://example.com/jobs/1'
}
assert.equal(isEligibleDirectoryJob(approved), true)
assert.equal(isEligibleDirectoryJob({ ...approved, isApproved: undefined }), false)
assert.equal(isEligibleDirectoryJob({ ...approved, isApproved: false }), false)
assert.equal(isEligibleDirectoryJob({ ...approved, memberOnly: true }), false)
assert.equal(isEligibleDirectoryJob({ ...approved, status: 'inactive' }), false)
assert.equal(isEligibleDirectoryJob({ ...approved, url: '', hiringEmail: 'jobs@example.com' }), true)
assert.equal(isEligibleDirectoryJob({ ...approved, url: '', hiringEmail: '' }), false)

const migration = fs.readFileSync('server-utils/dal/migrations/088_harden_job_approval_default.sql', 'utf8')
assert.match(migration, /ALTER COLUMN is_approved SET DEFAULT FALSE/i)
assert.match(fs.readFileSync('src/components/AdminCompanyJobsModal.tsx', 'utf8'), /isApproved:\s*false/)
```

- [ ] **Step 2: Run the test and verify the new contract is absent**

Run: `node test-mini-company-directory-v2.js`

Expected: FAIL because `isEligibleDirectoryJob` and migration 088 do not exist, and the company modal still defaults new jobs to approved.

- [ ] **Step 3: Add the approval-default migration and safe UI default**

Create the idempotent migration:

```sql
ALTER TABLE jobs
  ALTER COLUMN is_approved SET DEFAULT FALSE;
```

Change the new-company-job template to:

```ts
isApproved: false,
status: 'active',
```

Do not update existing rows in this migration.

- [ ] **Step 4: Implement one strict eligibility helper**

Add and reuse:

```js
export function isEligibleDirectoryJob(job = {}) {
  const status = String(job.status || '').toLowerCase()
  const approved = (job.isApproved ?? job.is_approved) === true
  const memberOnly = Boolean(job.memberOnly ?? job.member_only)
  const url = String(job.url || job.sourceUrl || '').trim()
  const email = String(job.hiringEmail || job.hiring_email || '').trim()
  const hasApplication = /^https?:\/\/\S+$/i.test(url) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  return status === 'active' && approved && !memberOnly && hasApplication
}
```

Use it in `archiveJobSnapshot` and `recordCompanyUpdateEvent`. Remove the existing `?? true` event fallback. On insert, use `firstSeenAt || NOW()` for `first_seen_at`; on conflict, never update `first_seen_at`. An ineligible current job must close or mark its existing history non-public instead of generating an update event.

- [ ] **Step 5: Reconcile admin job writes at the shared boundary**

After `writeJobsToNeon` succeeds, reconcile each saved job through `archiveJobSnapshot`, passing `closed: !isEligibleDirectoryJob(job)`, then rebuild each distinct trusted company profile once. Ensure omitted `isApproved` stays false in admin POST normalization:

```js
isApproved: j.isApproved === true,
```

Keep the existing crawler's explicit reconciliation idempotent; duplicate calls must update the same history row rather than create a second row.

- [ ] **Step 6: Run focused and existing history tests**

Run:

```bash
node test-mini-company-directory-v2.js
node test-mini-company-acquisition.js
node test-mini-company-match.js
```

Expected: all pass; tests prove missing review state is private, email-only approved jobs are eligible, and first-seen is not replaced by a source publication date.

- [ ] **Step 7: Commit the review hardening**

```bash
git add server-utils/dal/migrations/088_harden_job_approval_default.sql src/components/AdminCompanyJobsModal.tsx lib/services/mini-company-match-service.js lib/api-handlers/processed-jobs.js test-mini-company-directory-v2.js
git commit -m "fix(mini): enforce approved company jobs"
```

---

### Task 2: Build one strict directory snapshot with access-aware search and sorting

**Files:**
- Modify: `lib/services/mini-company-search-service.js`
- Modify: `lib/api-handlers/mini-gateway.js:791-1110,1146-1158`
- Modify: `test-mini-company-directory-v2.js`
- Modify: `test-mini-company-acquisition.js`

**Interfaces:**
- Consumes: `normalizeCompanyName(value)` and existing `natural` distance dependency.
- Produces: `rankDirectoryCompanies(companies, { search, mode, sortBy, roleFamilies }): { companies, outcome }`.
- Produces: `GET action=companies&sortBy=latest|relevance` response containing `sortBy` and `latestPublicJobAt`/existing mapped time fields.
- Produces: one 45-second cached public snapshot; personalized ordering is performed after cloning that snapshot.

- [ ] **Step 1: Add failing pure search/ranking tests**

Use fixtures with original and translated company/job names:

```js
import { rankDirectoryCompanies } from './lib/services/mini-company-search-service.js'

const directory = [
  { id: 'a', name: 'Linear', translatedNames: ['线性'], publicJobTitles: ['Product Manager', '产品经理'], roleFamilies: ['product'], latestPublicJobAt: '2026-09-09T01:00:00Z' },
  { id: 'b', name: 'Figma', translatedNames: ['菲格玛'], publicJobTitles: ['Product Designer', '产品设计师'], roleFamilies: ['design'], latestPublicJobAt: '2026-09-09T02:00:00Z' }
]
assert.deepEqual(rankDirectoryCompanies(directory, { search: 'Prodcut Manager', mode: 'exact', sortBy: 'latest', roleFamilies: [] }).companies.map(x => x.id), ['a'])
assert.equal(rankDirectoryCompanies(directory, { search: 'Product', mode: 'exact', sortBy: 'latest', roleFamilies: [] }).outcome, 'too_broad')
assert.deepEqual(rankDirectoryCompanies(directory, { search: '产品', mode: 'fuzzy', sortBy: 'relevance', roleFamilies: ['product'] }).companies.map(x => x.id), ['a', 'b'])
assert.deepEqual(rankDirectoryCompanies(directory, { search: '%_', mode: 'fuzzy', sortBy: 'latest', roleFamilies: [] }).companies, [])
assert.deepEqual(rankDirectoryCompanies(directory, { search: '', mode: 'fuzzy', sortBy: 'relevance', roleFamilies: ['product'] }).companies.map(x => x.id), ['a', 'b'])
```

Also assert free exact matches return at most five companies and 2–3 character candidates require exact equality.

- [ ] **Step 2: Run the tests and verify failure**

Run: `node test-mini-company-directory-v2.js`

Expected: FAIL because `rankDirectoryCompanies` is not exported and the current free candidate index has no job titles.

- [ ] **Step 3: Implement pure candidate scoring**

Refactor `mini-company-search-service.js` to score normalized company names and job titles. Use a structured score, not SQL wildcards:

```js
// Lower tuple values are better.
// company exact, job exact, company edit/prefix, job edit/prefix,
// company contains, job contains, no match.
const rank = { companyExact: 0, jobExact: 1, companyNear: 2, jobNear: 3, companyContains: 4, jobContains: 5 }
```

For `mode: 'exact'`, only whole-candidate exact or Damerau matches inside the 30% edit budget qualify. For `mode: 'fuzzy'`, whole, prefix, literal substring and 30% Damerau matches qualify. Treat `%`, `_` and `\` as ordinary characters because matching occurs against normalized JavaScript strings.

- [ ] **Step 4: Replace the lateral/fallback directory query with one strict public snapshot query**

In `mini-gateway.js`, load all eligible companies through a CTE that strictly joins `trusted_companies`, `company_job_history`, and current `jobs`. The CTE must apply every eligibility predicate once, aggregate all searchable original/translated titles, aggregate role families/categories, and calculate:

```sql
MAX(CASE WHEN h.first_seen_at <= NOW() THEN h.first_seen_at END) AS latest_public_job_at
```

Delete every `job_record.job_id IS NULL OR (...)` compatibility branch from company search, counts, facets and detail counts. Cache only the public snapshot, not a user's page.

- [ ] **Step 5: Apply access, profile and pagination after the snapshot clone**

Validate `sortBy` to `latest` or `relevance`, defaulting to `latest`. For relevance, load `getCareerWatchProfile(viewer.user?.userId)` only for a bound user and pass its `roleFamilies`; on failure use `[]`. Rank before slicing pages. Preserve the current free directory limit of 12 and free search maximum of five results.

Use stable final keys:

```js
latestPublicJobAt DESC, name ASC, id ASC
```

and for relevance place direction overlap ahead of latest, or text score ahead of direction when a query exists.

- [ ] **Step 6: Run contract, authorization and regression tests**

Run:

```bash
node test-mini-company-directory-v2.js
node test-mini-company-acquisition.js
node test-mini-company-directory.js
node test-mini-company-contacts-and-follows.js
```

Expected: all pass; source assertions prove no orphan-history fallback remains and pages are sliced after global ranking.

- [ ] **Step 7: Commit the directory engine**

```bash
git add lib/services/mini-company-search-service.js lib/api-handlers/mini-gateway.js test-mini-company-directory-v2.js test-mini-company-acquisition.js
git commit -m "feat(mini): rank approved company directory"
```

---

### Task 3: Add the signed formal catalog snapshot and atomic Preview import

**Files:**
- Create: `lib/services/mini-company-catalog-sync-service.js`
- Modify: `lib/api-handlers/mini-gateway.js:78-115,2525-2660`
- Create: `test-mini-company-catalog-sync.js`
- Modify: `package.json`

**Interfaces:**
- Produces: `readPublicCompanyCatalogPage({ page, pageSize }): Promise<CatalogPage>`.
- Produces: `validateCompanyCatalogSnapshot(payload): CatalogSnapshot`.
- Produces: `applyPreviewCompanyCatalogSnapshot(payload, { allowImport }): Promise<CatalogImportResult>`.
- Produces Gateway actions: `company_catalog_snapshot` (GET, read-only secret) and `company_catalog_import` (POST, Preview shared secret).
- Consumes: `neonHelper.getClient().transaction([...queries])` for a real Neon HTTP transaction; never use the simulated callback transaction helper for the import.

- [ ] **Step 1: Write failing snapshot validation and route-security tests**

Test the public payload allowlist, duplicate IDs, missing companies, unapproved jobs, count mismatches, production import rejection and HMAC secret scope. Representative assertion:

```js
assert.throws(() => validateCompanyCatalogSnapshot({
  version: 'v1', totalCompanies: 1, totalJobs: 1,
  companies: [{ id: 'c1', name: 'Safe Co' }],
  jobs: [{ id: 'j1', companyId: 'c1', status: 'active', isApproved: false }]
}), /approved public job/i)
```

Source checks must reject fields named `referralContacts`, `contacts`, `users`, `orders`, `payments` or `password` in the validated snapshot.

- [ ] **Step 2: Run the test and verify failure**

Run: `node test-mini-company-catalog-sync.js`

Expected: FAIL because the catalog service and actions do not exist.

- [ ] **Step 3: Implement the formal read-only page**

Query current `jobs` as the authority and only left join history to preserve an existing first-seen time. Required SQL predicates:

```sql
tc.status = 'active'
AND j.company_id = tc.company_id
AND j.status = 'active'
AND j.is_approved IS TRUE
AND COALESCE(j.member_only, FALSE) IS FALSE
AND (
  NULLIF(BTRIM(j.url), '') ~* '^https?://'
  OR NULLIF(BTRIM(tc.hiring_email), '') ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
)
```

Return a compact job projection; use `COALESCE(h.first_seen_at, j.created_at, j.updated_at)` as the source's stable first-seen value. Do not return private contacts or unapproved records.

- [ ] **Step 4: Implement validation and atomic Preview import**

Require `VERCEL_ENV === 'preview'` and `MINI_ALLOW_CATALOG_IMPORT === 'true'`. Validate caps before any query. Build a fixed transaction array containing:

1. allowlisted company upsert from JSON,
2. approved public job projection upsert from JSON,
3. history upsert with immutable `first_seen_at`,
4. closing histories absent from the complete snapshot,
5. deactivating stale `source='mini_catalog_projection'` jobs.

Use one real transaction:

```js
const sql = neonHelper.getClient()
const results = await sql.transaction(statements.map(({ text, params }) => sql.query(text, params)))
```

Reject empty snapshots when the previous projection is non-empty and reject removal ratios over the configured safety cap.

- [ ] **Step 5: Register the two signed actions**

Allow `MINI_GATEWAY_READONLY_SECRET` only for `sync` and `company_catalog_snapshot`. `company_catalog_import` must use the normal Preview shared secret and reject non-Preview environments even with a valid signature. Add both actions to the explicit allowlist and method dispatch.

- [ ] **Step 6: Add and run tests**

Add `"test:mini-company-catalog": "node test-mini-company-catalog-sync.js"` to `package.json`, then run:

```bash
npm run test:mini-company-catalog
node test-mini-content-contract.js
node test-mini-company-directory-v2.js
```

Expected: all pass; tests prove the import is one transaction and private/unreviewed data cannot enter its payload.

- [ ] **Step 7: Commit the catalog endpoints**

```bash
git add lib/services/mini-company-catalog-sync-service.js lib/api-handlers/mini-gateway.js test-mini-company-catalog-sync.js package.json
git commit -m "feat(mini): add preview company catalog projection"
```

---

### Task 4: Schedule and observe the development catalog synchronization

**Files:**
- Modify: `cloudrun/index.mjs:22-115,557-670,1110-1165,1535-1575,2380-2400`
- Modify: `scripts/deploy-mini-cloudrun.mjs:180-260`
- Create: `test-mini-company-catalog-cloudrun.js`
- Modify: `package.json`

**Interfaces:**
- Consumes Gateway actions `company_catalog_snapshot` and `company_catalog_import`.
- Produces: `syncCompanyCatalogToPreview({ force?: boolean }): Promise<CatalogSyncResult>`.
- Produces: `POST /internal/catalog-sync?full=true`, protected by `X-Mini-Sync-Secret`.
- Produces: CloudBase state document `mini_sync_state/catalog` with last success/failure counters.

- [ ] **Step 1: Write failing orchestration tests**

Extract or load the orchestration with fake Gateway calls and assert:

- all source pages are read before import,
- page version/count drift aborts without calling import,
- concurrent calls share one promise,
- startup and hourly timers are gated by `MINI_CATALOG_SYNC_ENABLED=true`,
- a failed run preserves `lastSuccessAt` and increments `consecutiveFailures`,
- the internal route rejects a missing or wrong sync secret.

- [ ] **Step 2: Run the test and verify failure**

Run: `node test-mini-company-catalog-cloudrun.js`

Expected: FAIL because the catalog sync route and scheduler do not exist.

- [ ] **Step 3: Teach Gateway requests to select source and destination explicitly**

Extend `gatewayRequest` with a constrained target option:

```js
gatewayRequest(action, { target = 'preview', ...options })
```

`target: 'formal'` must use only `jobsApiOrigin/jobsGatewaySecret`; `target: 'preview'` must use only `apiOrigin/gatewaySecret` and the existing Vercel automation bypass header. Do not infer the target from arbitrary user input.

- [ ] **Step 4: Implement full-read-then-import orchestration**

Read source pages with `target: 'formal'`, confirm every page has the same version and totals, enforce hard caps, concatenate and validate IDs, then send one compact import body with `target: 'preview'`. Store only status metadata in `mini_sync_state/catalog`.

- [ ] **Step 5: Add lease, manual route and timer**

Reuse the existing CloudBase transaction/lease pattern with document ID `catalog`, but keep it independent of `MINI_ENABLE_LEGACY_JOB_CACHE`. Run one non-blocking sync at container startup and an hourly interval only when `MINI_CATALOG_SYNC_ENABLED=true`. Expose the signed internal manual route.

- [ ] **Step 6: Update development deployment configuration**

Ensure development deployment sets:

```js
MINI_CATALOG_SYNC_ENABLED: 'true',
MINI_CATALOG_SYNC_INTERVAL_MS: '3600000',
MINI_CATALOG_SYNC_MAX_RECORDS: '5000',
MINI_ALLOW_CATALOG_IMPORT: 'true'
```

`MINI_ALLOW_CATALOG_IMPORT` belongs on Vercel Preview, not CloudBase production. Preserve existing secrets instead of regenerating them.

- [ ] **Step 7: Run and commit**

```bash
node test-mini-company-catalog-cloudrun.js
node test-mini-company-catalog-sync.js
node test-mini-company-cache.js
git add cloudrun/index.mjs scripts/deploy-mini-cloudrun.mjs test-mini-company-catalog-cloudrun.js package.json
git commit -m "feat(mini): automate preview company catalog sync"
```

Expected: all tests pass and legacy job-cache enablement has no effect on catalog synchronization.

---

### Task 5: Add latest/relevance controls to the Mini Program

**Files:**
- Modify: `miniprogram/src/services/content-service.ts:45-115`
- Modify: `miniprogram/src/pages/companies/index.tsx:25-230`
- Modify: `miniprogram/src/pages/companies/index.scss`
- Modify: `miniprogram/src/types/index.ts`
- Modify: `test-mini-review-races.js`
- Modify: `test-mini-company-directory-v2.js`

**Interfaces:**
- Consumes: `GET /mini/companies?sortBy=latest|relevance`.
- Produces: `fetchCompanies({ search, industry, sortBy, page, pageSize, force })`.
- Produces: compact accessible sort control with selected state and stable refresh behavior.

- [ ] **Step 1: Add failing service and page contract tests**

Assert `sortBy` is present in request construction, resource keys, refresh fan-out and load-more calls. Assert free copy supports job names and that both controls have selected state:

```js
assert.match(pageSource, /搜索企业或岗位名称/)
assert.match(pageSource, /最新/)
assert.match(pageSource, /相关度/)
assert.match(pageSource, /aria-checked/)
assert.match(pageSource, /sortBy/)
```

Extend the race test so switching sort during an older search request cannot overwrite the new result.

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
node test-mini-company-directory-v2.js
node test-mini-review-races.js
```

Expected: FAIL because the sort state and request parameter do not exist.

- [ ] **Step 3: Extend types and service parameters**

Add:

```ts
export type CompanyDirectorySort = 'latest' | 'relevance'
```

Include `sortBy` in `CompaniesResponse`, `fetchCompanies` parameters and the query string. Preserve the existing access contract and logo hydration.

- [ ] **Step 4: Implement sort state without breaking pagination**

Add `const [sortBy, setSortBy] = useState<CompanyDirectorySort>('latest')`. Include it in the retained-resource key, first-page requests, refresh fan-out, load-more and request race identity. On change, set the new state and call `load(true, appliedSearch, industry, nextSort)` so results restart at page 1.

- [ ] **Step 5: Add the compact accessible control and corrected copy**

Use two existing-styled `View` buttons with `aria-role='radio'`, `aria-checked`, pressed hover state and a shared group label. Update free helper/empty text to refer to a complete enterprise or job name and to distinguish `too_broad` from no approved public result. Do not add a new icon dependency.

- [ ] **Step 6: Style and test the control**

Add a small segmented control that fits with the current editorial search and topic scroller, has a visible selected state, 44px-equivalent touch targets and no horizontal overflow at the existing Mini Program width.

Run:

```bash
node test-mini-company-directory-v2.js
node test-mini-review-races.js
npm --prefix miniprogram run typecheck
npm --prefix miniprogram run build:weapp
```

Expected: all pass and the WeChat build completes.

- [ ] **Step 7: Commit the Mini Program interaction**

```bash
git add miniprogram/src/services/content-service.ts miniprogram/src/pages/companies/index.tsx miniprogram/src/pages/companies/index.scss miniprogram/src/types/index.ts test-mini-review-races.js test-mini-company-directory-v2.js
git commit -m "feat(mini): add company directory sorting"
```

---

### Task 6: Verify, deploy to Preview/development, and reconcile real content

**Files:**
- Create: `scripts/verify-mini-company-directory-v2.mjs`
- Modify: `scripts/verify-mini-experience-smoke.mjs`
- Modify: `docs/guides/MINIPROGRAM_RELEASE_RUNBOOK.md`
- Create: `artifacts/mini-company-directory-2026-09-09/` runtime evidence files

**Interfaces:**
- Consumes: Vercel Preview deployment, CloudBase development `haigoo-mini`, formal read-only catalog source, test accounts already available in the development environment.
- Produces: redacted JSON evidence for formal eligible counts, Preview projection counts, API ordering/search outcomes, NEW deadlines and sync health.

- [ ] **Step 1: Add a read-only/live verification script**

The script must:

- query formal catalog totals through the signed read-only action,
- query Preview projection totals with the strict join,
- call CloudBase `/mini/companies` as guest/free and an available member session,
- verify free exact company and job-title typo cases,
- verify member fuzzy company/job cases and literal `%_`,
- verify latest ordering across at least two pages when enough companies exist,
- verify relevance direction hits precede non-hits,
- verify `newJobsUntil === latestPublicJobAt + 72h`,
- record only IDs/counts/timestamps and redact emails, openids, tokens and secrets.

- [ ] **Step 2: Run the full local regression suite**

Run:

```bash
npm run test:mini-company-catalog
node test-mini-company-directory-v2.js
node test-mini-company-acquisition.js
node test-mini-company-directory.js
node test-mini-company-cache.js
node test-mini-company-contacts-and-follows.js
node test-mini-review-races.js
node test-mini-content-contract.js
npm --prefix miniprogram run typecheck
npm --prefix miniprogram run build:weapp
npm run build
```

Expected: every command exits 0.

- [ ] **Step 3: Review the exact deployment diff**

Run `git status --short`, `git diff --check`, and review only files committed by Tasks 1–5. Preserve all unrelated dirty-worktree changes. Build an isolated release snapshot if the shared worktree still contains unrelated modifications.

- [ ] **Step 4: Deploy Vercel Preview and apply Preview-only migration/configuration**

Deploy the isolated snapshot to Vercel Preview. Apply migration 088 only to Preview and set `MINI_ALLOW_CATALOG_IMPORT=true` only on the Preview project/environment. Confirm the stable Preview alias resolves to the new healthy deployment before continuing.

- [ ] **Step 5: Deploy CloudBase development and force one catalog sync**

Deploy `haigoo-mini` to environment `haigoo-dev-d2gctbzxma401b345`, verify `/health/upstream`, then call `POST /internal/catalog-sync?full=true` with the existing development sync secret. Do not deploy `haigoo-mini-prod`.

- [ ] **Step 6: Reconcile authoritative counts**

Run `scripts/verify-mini-company-directory-v2.mjs`. The expected invariant is:

```text
formal eligible jobs = Preview projected eligible jobs
formal eligible companies = Preview strict-directory companies
CloudBase member directory total = Preview strict-directory companies
```

The free default list remains at most 12 and free exact search may find eligible companies outside those 12. Investigate any difference before declaring completion; do not relax approval filters to make counts match.

- [ ] **Step 7: Run UI smoke checks and capture evidence**

Verify in the experience build:

- complete enterprise name and complete job name with a small typo both work for free access,
- member fuzzy search works,
- latest/relevance controls switch without stale-result flashes,
- a company with a genuinely new approved job shows NEW,
- an unapproved or orphan-history company never appears.

Save redacted output under `artifacts/mini-company-directory-2026-09-09/` and update the runbook with the manual sync and rollback checks.

- [ ] **Step 8: Commit verification assets**

```bash
git add scripts/verify-mini-company-directory-v2.mjs scripts/verify-mini-experience-smoke.mjs docs/guides/MINIPROGRAM_RELEASE_RUNBOOK.md artifacts/mini-company-directory-2026-09-09
git commit -m "test(mini): verify company directory release"
```

---

## Execution order and review gates

1. Task 1 must pass review before any data synchronization code is accepted.
2. Task 2 must prove strict current-job joins before Task 3 imports data.
3. Task 3 must pass payload/security review before CloudBase scheduling is enabled.
4. Task 4 must preserve the previous successful snapshot on every tested failure.
5. Task 5 may merge only after the backend accepts and returns `sortBy`.
6. Task 6 is complete only when formal, Preview and CloudBase counts reconcile without weakening review requirements.

The selected execution mode is subagent-driven: dispatch one fresh implementation agent per task, then run a separate requirements review and code-quality review before moving to the next task.
