# Mini Program Entitlement and Directory Fixes Implementation Plan

> **For agentic workers:** Execute this plan task-by-task with a test after each task.

**Goal:** Remove stale post-refund member access, make company/job responses fail closed when incomplete, and make directory sorting observable and deterministic.

**Architecture:** The server remains authoritative for membership and directory data. The Mini Program refreshes its signed session before protected-content loads, while CloudRun validates formal job completeness before returning company details. Directory ranking stays in the existing pure ranking service and receives a meaningful fallback relevance score.

**Tech Stack:** TypeScript/Taro Mini Program, Node.js ESM, PostgreSQL/Neon gateway queries, assert-based repository regression tests.

**Spec:** `docs/superpowers/specs/2026-09-11-mini-entitlement-directory-fixes.md`

## Global Constraints

- Do not add dependencies or change payment provider contracts.
- Preserve the existing free-directory limit and member access policy.
- Server membership state and provider-confirmed refund state remain authoritative.
- Keep company catalog data public-only and fail closed on incomplete source data.

### Task 1: Refresh Member-Sensitive Mini Program Screens

**Files:**
- Modify: `miniprogram/src/pages/profile/index.tsx`
- Modify: `miniprogram/src/pages/index/career-watch-page.tsx`
- Modify: `miniprogram/src/pages/companies/index.tsx`
- Modify: `miniprogram/src/pages/company-detail/index.tsx`
- Test: `test-mini-membership-refresh.js`

- [x] Add refresh-before-load behavior for authenticated screens.
- [x] Remove the profile fallback that renders cached membership as authoritative before dashboard refresh completes.
- [x] Add source assertions covering Match, directory, and detail refreshes.
- [x] Run the focused refresh test and Mini Program type-check.

### Task 2: Harden Company Job Completeness

**Files:**
- Modify: `cloudrun/index.mjs`
- Modify: `cloudrun/company-directory.mjs`
- Test: `test-mini-company-match.js`
- Test: `test-mini-company-catalog-sync.js`

- [x] Add a company-specific formal job fallback when metadata has no jobs for a company that advertises open jobs.
- [x] Reject incomplete metadata snapshots instead of returning a false empty job list.
- [x] Add regression assertions for the fallback and fail-closed behavior.
- [x] Run company directory and CloudRun source checks.

### Task 3: Make Relevance Sorting Meaningful

**Files:**
- Modify: `lib/services/mini-company-search-service.js`
- Test: `test-mini-company-directory-v2.js`

- [x] Add a deterministic fallback relevance score based on open opportunity breadth and freshness.
- [x] Preserve role-family overlap as the primary relevance signal when a profile exists.
- [x] Add fixtures proving relevance order differs from latest order.
- [x] Run the directory ranking test.

### Task 4: Build and Release Gates

**Files:**
- No source changes.

- [x] Run payment/refund, membership, company directory, and retained-loading tests.
- [x] Run Mini Program type-check, production build, and production package gate.
- [x] Run `git diff --check` and report deployment blockers separately from code results.
