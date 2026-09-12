# Company Acquisition Implementation Plan

**Goal:** Free named-company discovery and applications, five concurrent free subscriptions with historical over-limit subscriptions retained, and factual 72-hour NEW badges.

**Architecture:** Keep the existing gateway, CloudRun and Taro pages. Search public company names on the server; enforce subscription additions in a real Neon transaction and preserve all active follows in notification delivery. No production deployment or schema writes are part of this implementation.

**Tech Stack:** JavaScript, existing natural distance library, Neon HTTP transaction API, React/Taro.

**Spec:** User-approved design in this task, including expiry clarification: 20 historical subscriptions continue; additions require fewer than five active subscriptions.

## Constraints

- All business content comes from existing backend data; fixtures are test-only.
- Keep Match geometry, algorithms, native gestures, contact and note entitlements.
- Explicit company detail links are public; full directory browsing remains member-only.
- No automatic cancellation on expiry. Re-following an inactive company counts as a new subscription.
- Do not use the non-atomic neonHelper.transaction wrapper for quota enforcement.

## Task 1: Named Search and Direct Access

Files: lib/services/mini-company-search-service.js, lib/api-handlers/mini-gateway.js, miniprogram/src/services/content-service.ts, miniprogram/src/pages/companies/index.tsx.

- [x] Test normalization, exact-name priority, 30% typo bounds, short names, translations and ambiguous results.
- [x] Cache only public company IDs and original/translated names for five minutes with shared in-flight reads; use natural DamerauLevenshteinDistance.
- [x] Resolve free search to company IDs before directory queries; omit job-title fuzzy search for free users. Return search outcome without exposing the full index.
- [x] Permit direct access to active company details; preserve existing visibility of followed historical companies and private contact checks.
- [x] Keep selected search results independent of old industry filters; display named-search and no-result states accurately.

## Task 2: Concurrent Subscription Quota

Files: lib/services/mini-company-match-service.js, miniprogram/src/components/company-follow-action/index.tsx.

- [x] Test 0/4/5/20 active counts, duplicates, removal, reactivation, members, errors and notification audience.
- [x] Execute SELECT user_id FROM users WHERE user_id = $1 FOR UPDATE followed by conditional INSERT/UPSERT inside sql.transaction with ReadCommitted isolation. The second statement observes the committed count after waiting for the account lock.
- [x] Return COMPANY_FOLLOW_LIMIT_REACHED only when a new free subscription exceeds five; preserve existing active rows and always allow cancellation.
- [x] Remove fixed-Match-only restrictions from explicitly followed-company event fanout and delivery; retain membership restrictions for direction-based recommendations and all WeChat authorization checks.
- [x] On limit error show membership and subscription-management actions, without mutating local state or prompting WeChat authorization.

## Task 3: NEW and Verification

Files: lib/api-handlers/mini-gateway.js, miniprogram/src/types/index.ts, miniprogram/src/pages/companies/index.tsx, miniprogram/src/pages/companies/index.scss, test-mini-company-acquisition.js.

- [x] Derive newJobsUntil from valid source publication timestamps for open public jobs. Missing/future dates and routine crawling do not imply NEW.
- [x] Render a compact inline NEW badge; expire using server time plus elapsed device time without extra network requests.
- [x] Run acquisition behavioral tests, existing mini regressions, TypeScript and local/experience builds.
- [x] Review changed authorization and SQL paths; no schema changes are necessary. Local PostgreSQL SQL execution and development Neon read-only EXPLAIN passed. Deployment and device verification details are recorded in artifacts/mini-company-acquisition-2026-09-06/review.md.
