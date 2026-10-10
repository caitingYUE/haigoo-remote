# Top100 follow-up hardening

User requested code/requirements review, fixes and product/design/taste interaction improvements. This stays inside the approved Top100 feature and release authorization. Preserve routes, ranking/scores, formal-member policy and incumbent Haigoo visual system; no database writes or new dependencies.

## Findings and intended fixes

- Harden null/invalid live query responses and snapshot/response validation; avoid fake zero counts or rendering exceptions.
- Share protected request lifecycle between ranking and per-company research. Distinguish401 login expiry from403 membership; background revalidate without collapsing list; clear immediately on owner/permission loss or failed verification.
- Complete single-company research on detail, exact safe return, contextual feedback and membership return. No ranking payload for public users.
- Reset profile jobs/modal on user or company changes; ignore stale list/load-more results.
- Protect AuthContext refresh against old-token responses; keep transient failures distinct from logout.
- Close header disclosures on outside focus/click and route changes. Improve mobile form readability and accessible research targets.

## Verification

- [x] Current-run five-step product audit screenshots and findings recorded.
- [x] Meaningful server null/NaN/date/enum/weight/failed-user tests and frontend malformed-response/return-path tests.
- [x] Controlled local fixtures for delayed/401/403/503/malformed ranking, jobs pagination/error, auth changes. Real browser flow, keyboard, mobile/English, retry/return/feedback checks.
- [x] Build, relevant membership/job regressions, scoped detector once, fresh finish review, local surface documentation update.
- [x] Reverify actual current production baseline; normal per-file source manifest/hash verification; publish authorized task changes with rollback retained and verify live public/API gates.
