# Mini Program 1.0.32 Production Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Execute this plan task-by-task with a test gate after every task.

**Goal:** Repair the 1.0.32 production regressions and produce a verified release candidate without further company-data damage.

**Architecture:** Stable CloudBase IDs and retained page resources are the client-facing baseline. Formal company metadata flows through one allowlisted snapshot contract; preview imports fail closed when that contract is unavailable. Admin writes return after the canonical database update while derived projections and third-party translation are isolated from the save success path.

**Tech Stack:** Taro 4 / React / TypeScript, Node.js ESM/CJS, Neon PostgreSQL, Vercel functions, Google Cloud Run, WeChat Mini Program.

**Spec:** `docs/superpowers/specs/2026-09-11-mini-1032-production-recovery-design.md`

## Global Constraints

- Preserve all unrelated working-tree changes.
- Do not import production data into production or preview data into production.
- Do not deploy until focused tests, type checks, and production builds pass.
- Do not repair data without a read-only source/target comparison.

---

### Task 1: Stable Media and Retained Navigation

**Files:**
- Modify: `cloudrun/index.mjs`
- Modify: `miniprogram/src/services/mini-auth-service.ts`
- Modify: `miniprogram/src/pages/companies/index.tsx`
- Modify: `miniprogram/src/pages/company-detail/index.tsx`
- Modify: `miniprogram/src/pages/index/career-watch-page.tsx`
- Test: `test-mini-note-cover-urls.js`
- Test: `test-mini-retained-loading.js`

**Interfaces:**
- Produces: `refreshWechatSessionIfStale(maxAgeMs?: number): Promise<SessionResponse | null>`.
- Preserves: `coverFileId` and `logoFileId` stable CloudBase values.

- [x] Add failing contracts proving API responses retain allowed stable file IDs and page `useDidShow` handlers do not clear retained data.
- [x] Implement coalesced TTL session refresh and non-destructive page lifecycle handlers.
- [x] Remove synchronous server-side public-image signing from list/detail responses.
- [x] Run media, retained loading, membership consistency, and Match loop tests.

### Task 2: Catalog Integrity, Completeness, Sorting, and NEW

**Files:**
- Modify: `cloudrun/company-directory.mjs`
- Modify: `lib/services/mini-company-catalog-sync-service.js`
- Modify: `cloudrun/index.mjs`
- Test: `test-mini-company-catalog-sync.js`
- Test: `test-mini-company-directory-v2.js`

**Interfaces:**
- Consumes: signed `company_catalog_snapshot` from Formal.
- Produces: complete public company metadata plus job `firstSeenAt` and deterministic latest/relevance ordering.

- [x] Add a failing contract that rejects legacy job-feed fallback for catalog import.
- [x] Make snapshot absence a hard failure and prevent incomplete imports.
- [x] Retain first-seen/public-opportunity timestamps through CloudRun metadata mapping.
- [x] Verify latest and relevance produce independently ordered fixtures and NEW expiry derives from a three-day window.

### Task 3: Admin Mini Program Account Source

**Files:**
- Modify: `server-utils/user-helper.js`
- Modify: `lib/api-handlers/users.js`
- Modify: `src/types/auth-types.ts`
- Modify: `src/pages/UserManagementPage.tsx`
- Test: `test-admin-user-source.js`

**Interfaces:**
- Produces: `accountSource`, `hasMiniAccount`, `miniAccountCount`, `miniCreatedAt`, and `miniLinkedAt` on admin user rows.

- [x] Restore the `mini_wechat_identities` summary join, source filter, and source statistics.
- [x] Restore desktop/mobile source badges and CSV source columns.
- [x] Run admin contract tests and TypeScript checks.

### Task 4: Reliable Job Save and Translation

**Files:**
- Modify: `lib/api-handlers/processed-jobs.js`
- Modify: `lib/services/translation-service.cjs`
- Modify: `src/components/AdminCompanyJobsModal.tsx`
- Test: `test-translation-service.cjs`
- Test: `test-admin-job-reliability.js`

**Interfaces:**
- Canonical job save returns only after the job and required history record commit.
- Derived profile rebuild is best effort and cannot turn a successful save into an HTTP failure.
- Translation returns explicit translated and failed counts.

- [x] Add bounded provider requests and preserve per-job failures.
- [x] Remove derived profile rebuild from the blocking save latency path.
- [x] Make the admin UI distinguish partial translation success and await list refreshes consistently.
- [x] Run translation, job API, build, and type-check gates.

### Task 5: Environment Audit, Recovery, and Deployment

**Files:**
- Modify when required: `scripts/deploy-mini-cloudrun.mjs`
- Modify: `miniprogram/package.json`
- Modify: release runbook/checklist only for verified operational changes.

**Interfaces:**
- Produces: a new CloudRun revision and WeChat experience upload whose version exceeds `1.0.32`.

- [x] Compare production/preview runtime fingerprints and company aggregate field coverage without exposing credentials.
- [x] Determine whether either database needs repair; the 2026-09-12 read-only audit found isolated targets and no critical production corruption, so no data repair was applied.
- [x] Run focused tests, root and Mini Program type-checks, and production builds.
- [x] Run signed production runtime smoke checks.
- [x] Deploy the website backend containing the required snapshot/source fixes.
- [x] Deploy production CloudRun and rerun smokes.
- [x] Increment the Mini Program patch version, build, and check the production package.
- [x] Upload the `1.0.33` production version after the production runtime passes; submission for WeChat review remains a manual release step.
