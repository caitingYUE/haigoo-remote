# Member Company Top 100 Implementation Plan

> Execution: inline in this chat, after the user approved the written design and production release. Use the existing shared primitives; finish review/documentation follows the applied Impeccable skill. No delegation of implementation is needed.

**Goal:** Publish the researched Top100 inside the website's remote-company navigation, restricted to active full members, with reliable company-to-job application navigation.

**Architecture:** A versioned server-only research snapshot feeds a protected endpoint, enriched in a batch with current company records and job counts. A dedicated React page renders the ranked directory, filters and evidence. Existing ID-based company detail and application flows are reused.

**Tech Stack:** Existing React/TypeScript/React Router, semantic CSS tokens, Lucide, Node24, Neon and Vercel; no new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-10-member-company-top100-design.md` (user approved).

## Global Constraints

- Route `/trusted-companies/top-100`; dropdown items `远程企业`, then `Top 100`.
- Entry visible to all; content only active full members and verified admins. Trial members excluded.
- Exact researched100, original ranks, default weights30/15/15/15/15/10, no invented current mainland job counts.
- Unknown contracts remain unknown; source/date and evidence limits visible.
- Server checks current user state before data; private/no-store; no public snapshot or persistent client data cache.
- Research ranking stays versioned; current jobs are separate. Links usecompany_id, return preserves filters/position.
- Isolated managed worktree and clean approved source; no unrelated dirty edits or research/private files in deployment.

## Task 1: Protected data and live enrichment

- [ ] Create `lib/data/company-top100-2026-10-10.json` containing only website research fields.
- [ ] Create `lib/services/company-top100-service.js` for validation, current company/job enrichment and public-safe shaping; use bounded ID queries and existing visible-active job policy.
- [ ] Add an early `action=top100` branch in `lib/api-handlers/trusted-companies.js`, before existing public caches and preview fallbacks.
- [ ] Add `test-company-top100.js` covering all100 IDs/sums/order, missing info, eligibility, invalid users, trial/expiry and database/enrichment failures. Keep interfaces injectable for meaningful tests.
- [ ] Verify user access before any snapshot response, and no list/rank/score on401/403.

## Task 2: Member ranking UI and navigation

- [ ] Create `src/types/company-top100.ts`, `src/services/company-top100-service.ts` and `src/pages/CompanyTop100Page.tsx`.
- [ ] Create scoped `src/styles/company-top100.css`, imported with the page; reuse Logo, Language, Auth and tracking helpers.
- [ ] Create `src/components/RemoteCompaniesNav.tsx`; integrate into Header desktop/mobile with keyboard/outside-click/route-close behavior.
- [ ] Add App route and accurate Layout title; add directory discovery link.
- [ ] Show genuine research classes and totals, search/combined filters over100, preserve original ranks, evidence expansion and six components; only public teaser for unauthorized viewers.
- [ ] Clear data on user changes, permission loss and failed revalidation; keep no protected localStorage snapshot.

## Task 3: Detail/application continuity

- [ ] Update CompanyProfilePage to use existing companyId job filter, total/page controls and the existing application modal.
- [ ] Add official careers fallback, precise zero/error wording, internal returnTo and hash navigation to jobs.
- [ ] Carry origin/ranking version through tracking and optional member-only research context, without exposing private data in public metadata.
- [ ] Test exact-company query and back navigation; preserve public company/job behavior.

## Task 4: Verification and release

- [ ] Run meaningful API/data/member tests, type-check and production build; verify server snapshot is absent from public dist assets.
- [ ] Start isolated local/preview fixtures, test guest/free/trial/full/admin and invalid/expired token outcomes.
- [ ] Batched real-browser screenshots at1440desktop/768tablet/390mobile; check dropdown, filters, score/evidence, company entry, zero jobs, back restoration and overflow.
- [ ] Fix issues once as a batch, confirm once; run scoped Impeccable detector, finish review and documentation.
- [ ] Compare production baseline deployment metadata; build/publish only reviewed task changes; keep previous production URL for rollback.
- [ ] Verify live route/API and navigation after release, report live URL and remaining evidence uncertainty.
