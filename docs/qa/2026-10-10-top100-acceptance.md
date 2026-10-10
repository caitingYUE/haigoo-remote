# Top100 acceptance — 2026-10-10

User approved development and production release against the written design. Work is isolated on codex/member-company-top100, based on the verified production source commit 009c255b. Primary user checkout was not reset or included in this release.

## Verified

- `node test-company-top100.js`:100 unique IDs, descending summed scores, safe sources;49 A/51 B and77 unknown contracts; current database user permissions, real JWT expiry/invalid signature, all member types, disabled/refunded/future memberships; denied responses do not enrich or return a ranking; exact company selection and degraded live queries.
- `node test-job-access-policy.js`:existing job access and cron/retired endpoint policies passed.
- `npm run build`:TypeScript and Vite production bundle passed. The protected research snapshot is imported only by server code, not public dist assets.
- Real HTTP localhost fixture integration:member/starter/admin200 with100 entries;trial/free/expired403;guest/bad token401. Private,no-store headers verified. Ephemeral fixture identities are local only; no production test accounts created.
- Real browser:guest teaser has no names/scores/logos; full member100 rows; B51 retains original ranks; Contractor21; keyword/combined filters; empty-result reset; expand six factors and official sources; exact company profile and15 Supabase jobs; job detail with official application button; return preserves filters/expansion; mobile dropdown directory thenTop100; logout clears rows; trial sees trial/full-member explanation.
- Zero-job Scalerrs profile has0 matching roles and official careers fallback, no claim that the employer has no vacancies everywhere.
- Desktop1440x1000/mobile390x844/tablet768x1024 captured. Initial mobile wordmark overlap and ambiguous profile overview fixed. No horizontal overflow at390.
- One scoped Impeccable detector invocation:[] findings. Fresh reviewer requested76 manually written application-limit summaries be shown by default and metadata moved below title. Both were applied as one batch; score/rank/full evidence preserved. Final verdict separately recorded.
- Production database read-only enrichment:exactly2 SELECT queries,100/100 active company records,0 unavailable/unknown counts,294 active approved site roles. Counts do not mean mainland eligibility. No user/resume data queried and no database writes.

## Evidence limits retained in product

49 employers have specific mainland remote evidence;51 need mainland confirmation.77 contract modes remain unconfirmed, and the single employee-category row does not establish a mainland direct hiring/EoR entity. Existing ratings/size/most founding dates were not comprehensively reverified. Scores prioritize research and do not guarantee application eligibility or employment.

## Release

Normal per-file Vercel upload, no archive. Source baseline707 files:missing0; changed existing9 task-owned files; new9 runtime source files. Source upload excludes env/research/workbooks/docs/screenshots/local fixtures/tests/dist. Production candidate created with `--prod --skip-domain`; inspect candidate before promote. Previous deployment for rollback:haigoo-remote-i0hfsjefm-caitlinyct.vercel.app.

Authenticated browser acceptance uses isolated fixtures. No existing member was impersonated on production. Live public/API negative tests and real read-only database enrichment complement that validation; any unperformed production member login must not be reported as verified.
