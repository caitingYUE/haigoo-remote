# Mini Program 1.0.32 Production Recovery Design

## Goal

Restore stable production behavior for Mini Program media, page navigation, Match caching, company directory completeness/sorting/NEW badges, admin Mini Program account attribution, and trusted-company job editing without allowing preview synchronization to damage company master data.

## Confirmed Causes

- Company and note assets are converted to temporary URLs in CloudRun. Failed or slow conversion clears the stable `cloud://` value, leaving the client no usable fallback.
- Companies, company detail, and Match explicitly clear retained state and force session/data requests in `useDidShow`, so every tab switch and back navigation displays a reload.
- Preview catalog synchronization can fall back from the public company snapshot to the legacy job feed. That feed may omit company metadata, while the importer overwrites all trusted-company fields with empty values.
- The current admin user query no longer joins `mini_wechat_identities`, so the UI cannot show whether a website account is bound to the Mini Program.
- A single admin job write synchronously reconciles company history and rebuilds the hiring profile before responding. Translation uses unauthenticated public providers without a bounded request timeout. Both paths can exceed a serverless request window.

## Design

1. Keep stable CloudBase file IDs in API responses and let the existing Mini Program asset resolver batch temporary-URL resolution. Preserve any existing HTTPS URL as a fast path.
2. Retain page data across `useDidShow`. Refresh authenticated session state with a coalesced TTL check in the background; only invalidate content when the authoritative account scope actually changes. Explicit pull-to-refresh remains forceful.
3. Require the allowlisted `company_catalog_snapshot` action for cross-environment catalog imports. Do not use a job-only response as a company-master fallback. Preserve complete public metadata and first-seen timestamps so latest ordering and NEW badges have one canonical source.
4. Restore the account-source join and UI badge/filter using `mini_wechat_identities`.
5. Keep the database write and required in-transaction directory history update atomic, but run derived hiring-profile rebuild as best-effort post-write work. Bound translation provider calls and retain per-job failure details instead of treating a partial batch as a total success.

## Safety Constraints

- Production and preview imports remain isolated; catalog import is preview-only.
- No private contacts, users, payment data, or credentials enter the public catalog snapshot.
- Empty or incomplete catalogs fail closed. They cannot deactivate a large projection or overwrite company master data.
- Refund and membership expiry still change the content cache scope after an authoritative session refresh.
- No production data repair is performed until a read-only comparison identifies the exact affected environment and recoverable source.

## Verification

- Contract tests for stable asset IDs, retained navigation, catalog fail-closed behavior, account-source mapping, and fast job-write response boundaries.
- Type-check and production Mini Program build.
- Signed CloudRun smoke checks for company totals, latest/relevance ordering, NEW timestamps, company jobs, notes, and runtime environment identity.
- Website production build plus authenticated admin/API smoke checks where available.
- Upload a new Mini Program version only after all release checks pass.
