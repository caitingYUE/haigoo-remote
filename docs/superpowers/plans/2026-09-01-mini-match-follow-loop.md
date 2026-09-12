# Haigoo Mini Match Follow Loop Implementation Plan

> 2026-09-01 visual supersession note: This plan documents the already-built follow loop and deck behavior. Do not reuse its warm dossier card styling or bottom action hierarchy for the next visual iteration. Execute the visual upgrade from `docs/superpowers/specs/2026-09-01-mini-match-immersive-v2-design.md` and a new implementation plan derived from that specification.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved three-tab Haigoo mini-program experience in which users can browse a reversible stacked Match deck, understand each recommendation, and explicitly follow companies without coupling follow state to WeChat reminder permission.

**Architecture:** Keep the existing Taro pages and API routes, add focused deck/card/follow components, and extend the Career Watch response with verifiable snapshot metadata. The server remains authoritative for active opportunities and follow state; the client may use a cached snapshot only before its server-supplied expiry and uses event-center notifications to refresh shared follow state across Match, Companies, Profile, and the top avatar badge.

**Tech Stack:** Taro 4.2.1, React 18, TypeScript 5.4, SCSS, WeChat Mini Program APIs, Node.js contract tests, PostgreSQL through the existing Neon data layer.

**Spec:** `docs/superpowers/specs/2026-09-01-mini-match-follow-loop-design.md`

## Global Constraints

- The bottom navigation order is exactly `企业 / Match / 笔记`; Profile remains a non-tab page opened from the avatar.
- The visible Match tab uses `miniprogram/assets/icons/match.svg` and `miniprogram/assets/icons/match-active.svg`.
- Horizontal swipe changes only the active card index; it never follows, unfollows, or requests WeChat permission.
- A release threshold is exactly 25% of the measured card width; otherwise the card returns to its origin.
- Follow success is authoritative before a separate optional WeChat reminder prompt; reminder rejection never rolls back the follow.
- A free fixed snapshot is publishable only with five currently valid companies and never uses fabricated or expired data.
- Match returns exactly five valid cards for a free fixed snapshot and up to five for a member dynamic snapshot; member access changes refresh cadence and directory access.
- Cached cards render only while `validUntil` is in the future.
- Primary touch targets are at least `88rpx`; all actions expose Chinese accessible names and state.
- Preserve the existing behavior and icon assets. Do not reuse the warm dossier styling; the active visual authority is the immersive V2 specification.
- Preserve every pre-existing workspace edit. Before any commit, inspect the staged diff and exclude unrelated hunks; do not stage an already-modified file unless the task-owned hunks can be isolated.

---

## File Map

### Create

- `miniprogram/src/utils/match-deck.ts` — pure index wrapping, release threshold, and snapshot storage-key helpers.
- `miniprogram/src/components/match-company-deck/index.tsx` — pointer/touch gesture ownership and three-layer card arrangement.
- `miniprogram/src/components/match-company-deck/index.scss` — stack depth, transitions, reduced-motion behavior, and skeleton shape.
- `miniprogram/src/components/match-company-card/index.tsx` — historical card presentation and semantic actions; restyle through the immersive V2 plan.
- `miniprogram/src/components/match-company-card/index.scss` — dossier header, warm body, information hierarchy, and responsive rules.
- `miniprogram/src/components/company-follow-action/index.tsx` — explicit follow/unfollow state machine.
- `miniprogram/src/components/company-follow-action/index.scss` — primary/followed/busy/error states.
- `miniprogram/src/components/wechat-reminder-action/index.tsx` — optional WeChat reminder authorization after follow success.
- `miniprogram/src/services/company-follow-state.ts` — typed cross-page follow-state event and cached Career Watch synchronization.
- `test-mini-match-follow-loop.js` — source-contract regression coverage for navigation, deck, copy, and follow/reminder separation.

### Modify

- `lib/services/career-watch-service.js` — live recommendation revalidation and snapshot metadata.
- `lib/api-handlers/mini-gateway.js` — preserve the expanded Career Watch response contract.
- `test-mini-career-watch.js` — backend contract and five-valid-company assertions.
- `scripts/verify-mini-experience-smoke.mjs` — preview checks for snapshot stability, validity, and follow/reminder independence.
- `miniprogram/src/services/career-match-service.ts` — normalize the expanded response and expose typed fields.
- `miniprogram/src/app.config.ts` — three-tab order and Profile removal.
- `miniprogram/src/custom-tab-bar/index.tsx` and `index.scss` — three visible items and dedicated Match SVG.
- `miniprogram/src/components/editorial-top-bar/index.tsx` and `index.scss` — Profile navigation and unread badge.
- `miniprogram/src/pages/index/career-watch-page.tsx` and `index.scss` — deck integration and new feed states.
- `miniprogram/src/pages/companies/index.tsx` and `index.scss` — explicit follow text and shared state.
- `miniprogram/src/pages/growth/index.tsx` and `index.scss` — shared top bar.
- `miniprogram/src/pages/profile/index.tsx` and `index.scss` — non-tab navigation semantics and “关注企业” terminology.
- Profile callers in `miniprogram/src/pages/{membership,payment-orders,account-settings,job-detail,company-detail}/index.tsx` — replace invalid `switchTab` calls.
- `docs/haigoo-mini-design-system.md` — replace the obsolete four-tab rule.
- `test-mini-release-readiness.js` and `package.json` — enforce and run the new product contract.

---

### Task 1: Make Career Watch Data Verifiable

**Files:**
- Modify: `lib/services/career-watch-service.js`
- Modify: `miniprogram/src/services/career-match-service.ts`
- Modify: `test-mini-career-watch.js`

**Interfaces:**
- Produces server response fields `snapshotId: string`, `validUntil: string`, `WatchFeedItem.verifiedAt: string`, `WatchFeedItem.openJobCount: number`, and `WatchFeedItem.employeeCount: string`.
- Produces `isCareerWatchCacheValid(response: CareerWatchResponse, now?: number): boolean` for the Match page cache gate.

- [ ] **Step 1: Write failing backend and client-contract assertions**

Add assertions to `test-mini-career-watch.js` that require the service to select active public opportunities, return the five-card fixed result, expose verification fields, revalidate cached fixed results, and require the client cache gate:

```js
assert.match(service, /snapshotId/)
assert.match(service, /validUntil/)
assert.match(service, /verifiedAt/)
assert.match(service, /openJobCount/)
assert.match(service, /applyLiveRecommendationState/)
assert.match(client, /export function isCareerWatchCacheValid/)
```

- [ ] **Step 2: Run the contract test and confirm failure**

Run: `npm run test:mini-career-watch`

Expected: FAIL because the new fields and cache validator are absent.

- [ ] **Step 3: Extend the recommendation and response contracts**

In `miniprogram/src/services/career-match-service.ts`, extend the existing interfaces exactly as follows:

```ts
export interface WatchFeedItem {
  // existing fields remain
  verifiedAt: string
  openJobCount: number
  employeeCount: string
}

export interface CareerWatchResponse {
  // existing fields remain
  snapshotId: string
  validUntil: string
}

export function isCareerWatchCacheValid(response: CareerWatchResponse, now = Date.now()) {
  const expiresAt = new Date(response.validUntil).getTime()
  return response.matchState !== 'unused' && Number.isFinite(expiresAt) && expiresAt > now
}
```

Normalize missing `snapshotId` to a stable `${profile?.version || 0}:${generatedAt}` fallback and missing `validUntil` to an already-expired value, so old cached responses are never treated as current.

- [ ] **Step 4: Revalidate live opportunity facts before returning a cached snapshot**

In `lib/services/career-watch-service.js`, replace the follow-only cache hydration with `applyLiveRecommendationState(userId, recommendations)`. Query active `company_job_history` rows for the recommendation company IDs, group by company, and return only companies with `closed_at IS NULL` and `is_public_opportunity IS TRUE`. Update the representative job, `verifiedAt`, `openJobCount`, `employeeCount`, follow state, and reminder state from current rows.

For `fixedFree`, if revalidation produces fewer than five companies, recompute five results with `computeCareerWatchFeed`, update both `recommendations` and `fixed_recommendations` when the fixed column is enabled, and assign a new `generated_at`. Never consume the free entitlement again. Member dynamic snapshots request up to five cards; membership affects the six-hour refresh cadence rather than requiring artificial filler results.

Return:

```js
{
  recommendations,
  followedUpdates,
  generatedAt,
  snapshotId: `${profile.version}:${new Date(generatedAt).toISOString()}`,
  validUntil: new Date(new Date(generatedAt).getTime() + (isMember ? 6 : 24) * 3600000).toISOString(),
  emptyReason,
  source
}
```

- [ ] **Step 5: Run focused tests and type checking**

Run: `npm run test:mini-career-watch && npm --prefix miniprogram run type-check`

Expected: both commands PASS.

- [ ] **Step 6: Create a review checkpoint**

Inspect: `git diff -- lib/services/career-watch-service.js miniprogram/src/services/career-match-service.ts test-mini-career-watch.js`

Expected: only response-contract, revalidation, cache-validity, and tests are changed.

---

### Task 2: Restore the Three-Tab Shell and Avatar Profile Entry

**Files:**
- Modify: `miniprogram/src/app.config.ts`
- Modify: `miniprogram/src/custom-tab-bar/index.tsx`
- Modify: `miniprogram/src/custom-tab-bar/index.scss`
- Modify: `miniprogram/src/components/editorial-top-bar/index.tsx`
- Modify: `miniprogram/src/components/editorial-top-bar/index.scss`
- Modify: `miniprogram/src/pages/growth/index.tsx`
- Modify: `miniprogram/src/pages/companies/index.tsx`
- Modify: Profile callers listed in the File Map

**Interfaces:**
- Produces `EditorialTopBarProps { authenticated: boolean; avatar?: string; unread?: number }`.
- The top bar opens `/pages/profile/index` with `navigateTo`.
- The custom tab list is exactly Companies, Match, Growth.

- [ ] **Step 1: Add failing shell assertions to `test-mini-match-follow-loop.js`**

```js
assert.deepEqual(tabLabels, ['企业', 'Match', '笔记'])
assert.doesNotMatch(appConfig, /pagePath:\s*'pages\/profile\/index'/)
assert.match(tabBar, /assets\/icons\/match-active\.svg/)
assert.match(topBar, /navigateTo\(\{ url: '\/pages\/profile\/index' \}\)/)
assert.match(topBar, /editorial-topbar__badge/)
```

- [ ] **Step 2: Run and confirm the shell test fails**

Run: `node test-mini-match-follow-loop.js`

Expected: FAIL on the four-tab configuration and `switchTab` Profile entry.

- [ ] **Step 3: Implement the three-tab declaration and visible tab bar**

Set both `app.config.ts` and `custom-tab-bar/index.tsx` to `企业 / Match / 笔记`. Keep valid PNG paths in the declarative `tabBar` config, but render the approved SVG assets in the custom tab bar for the visible Match icon:

```tsx
<Image
  className='custom-tabbar__match-icon'
  src={active ? '/assets/icons/match-active.svg' : '/assets/icons/match.svg'}
  mode='aspectFit'
/>
```

Use a three-column grid and give the centered Match item slightly greater visual prominence without lifting it outside the safe area.

- [ ] **Step 4: Turn the top bar into the Profile entry and unread indicator**

Change `EditorialTopBar` to call `navigateTo`, add a numeric `unread` prop, and render `9+` when the value is above nine. Add `aria-label` text that includes the unread count.

Mount the top bar on Match, Companies, and Growth using `getMiniUser()`, `hasAuthenticatedSession()`, and the existing cached Career Watch unread count. Remove duplicate fake navigation masks and avoid double status-bar padding.

- [ ] **Step 5: Replace Profile `switchTab` callers**

Use `navigateTo` for Profile entries. In child pages that are returning to an existing Profile page, use `navigateBack`; use `reLaunch({ url: '/pages/index/index' })` only when no previous page exists.

- [ ] **Step 6: Run shell checks**

Run: `node test-mini-match-follow-loop.js && npm --prefix miniprogram run type-check`

Expected: three-tab and Profile navigation assertions PASS; TypeScript PASS.

---

### Task 3: Separate Follow State from WeChat Reminder Permission

**Files:**
- Create: `miniprogram/src/services/company-follow-state.ts`
- Create: `miniprogram/src/components/company-follow-action/index.tsx`
- Create: `miniprogram/src/components/company-follow-action/index.scss`
- Create: `miniprogram/src/components/wechat-reminder-action/index.tsx`
- Modify: `miniprogram/src/pages/index/career-watch-page.tsx`
- Modify: `miniprogram/src/pages/companies/index.tsx`

**Interfaces:**
- Produces `CompanyFollowChange { companyId: string; followed: boolean; reminderEnabled: boolean }`.
- Produces `emitCompanyFollowChange(change)` and `onCompanyFollowChange(listener): () => void`.
- Produces `CompanyFollowActionProps { companyId; companyName; followed; busy?; onChanged }`.
- Produces `WechatReminderActionProps { companyId; available; templateId; enabled; onChanged }`.

- [ ] **Step 1: Add failing separation assertions**

Require `CompanyFollowAction` to call `followCompany` before rendering the reminder action, require explicit unfollow confirmation copy, and forbid the old rollback pattern:

```js
assert.match(followAction, /关注岗位动态/)
assert.match(followAction, /取消关注后，将不再在关注动态中展示这家企业的新岗位/)
assert.doesNotMatch(`${watchPage}\n${companies}`, /if \(addedFollow\) await unfollowCompany/)
assert.match(reminderAction, /setMatchNotifications/)
```

- [ ] **Step 2: Run and confirm failure**

Run: `node test-mini-match-follow-loop.js`

Expected: FAIL because follow and subscription are still coupled.

- [ ] **Step 3: Implement shared state propagation**

Use the event name `haigoo:company-follow-change`. When a follow changes, update the cached `haigoo-career-watch:<userId>` recommendations before emitting the event so Match, Companies, Profile, and the avatar badge agree after page transitions.

- [ ] **Step 4: Implement explicit follow and unfollow actions**

`CompanyFollowAction` calls `followCompany` for an unfollowed company. After server success it immediately emits `{ followed: true, reminderEnabled: false }`, shows “已关注”, and then exposes the optional reminder control. Clicking “已关注” shows the approved confirmation modal and calls `unfollowCompany` only after confirmation.

Do not call `setMatchNotifications` inside the follow transaction. Do not roll back follow after a reminder rejection or exception.

- [ ] **Step 5: Implement optional reminder authorization**

`WechatReminderAction` calls `Taro.requestSubscribeMessage` only from a direct user tap. On accept, call `setMatchNotifications(companyId, true, 'accepted')`. On reject, record `{ followed: true, reminderEnabled: false }` and show “已关注，可稍后开启微信提醒”. On unavailable configuration, leave follow state untouched.

- [ ] **Step 6: Run focused checks**

Run: `node test-mini-match-follow-loop.js && npm --prefix miniprogram run type-check`

Expected: separation and confirmation assertions PASS; TypeScript PASS.

---

### Task 4: Build the Reversible Stacked Deck

**Files:**
- Create: `miniprogram/src/utils/match-deck.ts`
- Create: `miniprogram/src/components/match-company-deck/index.tsx`
- Create: `miniprogram/src/components/match-company-deck/index.scss`
- Create: `miniprogram/src/components/match-company-card/index.tsx`
- Create: `miniprogram/src/components/match-company-card/index.scss`

**Interfaces:**
- Produces `wrapDeckIndex(index: number, length: number): number`.
- Produces `resolveDeckRelease(offsetX: number, cardWidth: number): -1 | 0 | 1`.
- Produces `matchDeckStorageKey(userId: string, snapshotId: string): string`.
- Produces `MatchCompanyDeckProps { items: WatchFeedItem[]; snapshotId: string; activeIndex: number; onActiveIndexChange(index, direction): void; renderCard(item, active): ReactNode }`.

- [ ] **Step 1: Add failing utility and source-contract checks**

The source contract must require the exact threshold expression, wrapping behavior, touch cancellation on card actions, stack layers, and reduced motion:

```js
assert.match(deckUtil, /Math\.abs\(offsetX\) < cardWidth \* 0\.25/)
assert.match(deckUtil, /\(index % length \+ length\) % length/)
assert.match(deck, /catchMove/)
assert.match(deckStyles, /prefers-reduced-motion:\s*reduce/)
assert.match(deckStyles, /match-deck__card--depth-2/)
```

- [ ] **Step 2: Run and confirm failure**

Run: `node test-mini-match-follow-loop.js`

Expected: FAIL because deck files do not exist.

- [ ] **Step 3: Implement pure deck calculations**

```ts
export function resolveDeckRelease(offsetX: number, cardWidth: number): -1 | 0 | 1 {
  if (!Number.isFinite(cardWidth) || cardWidth <= 0 || Math.abs(offsetX) < cardWidth * 0.25) return 0
  return offsetX < 0 ? 1 : -1
}

export function wrapDeckIndex(index: number, length: number) {
  return length > 0 ? (index % length + length) % length : 0
}
```

- [ ] **Step 4: Implement gesture ownership and stack animation**

Track touch start, horizontal offset, measured card width, and whether the gesture has become horizontal. Do not call `preventDefault` until horizontal movement is greater than vertical movement and above a small movement tolerance. Render only the active card and the next two depth layers. After release, animate out, wrap the index, reset offset, and call `onActiveIndexChange` with `left` or `right`.

Buttons in the rendered card call `stopPropagation`; their touch start marks the gesture as action-owned so the deck does not switch.

- [ ] **Step 5: Implement the historical card behavior** (visual styling superseded by immersive V2)

Render a dark header with the real logo/name/industry, a warm body with two or three reason chips, a representative job, open-job count, verification date, and a recommendation line based on the first server reason. Place “关注岗位动态” as the only filled primary action and “查看企业” as a text action. Do not render `score`.

- [ ] **Step 6: Verify deck source and types**

Run: `node test-mini-match-follow-loop.js && npm --prefix miniprogram run type-check`

Expected: deck threshold, wrapping, card content, and reduced-motion assertions PASS; TypeScript PASS.

---

### Task 5: Integrate the Deck and Complete Match States

**Files:**
- Modify: `miniprogram/src/pages/index/career-watch-page.tsx`
- Modify: `miniprogram/src/pages/index/index.scss`
- Modify: `miniprogram/src/services/analytics-service.ts`

**Interfaces:**
- Consumes `MatchCompanyDeck`, `MatchCompanyCard`, follow/reminder actions, `isCareerWatchCacheValid`, and `snapshotId`.
- Produces analytics event names `mini_match_deck_view`, `mini_match_card_view`, `mini_match_card_swipe`, `mini_company_open`, `mini_company_follow_*`, and `mini_wechat_reminder_*`.

- [ ] **Step 1: Add failing Match integration assertions**

Require the title “为你匹配的企业”, the deck component, snapshot-index persistence, cache expiry gate, stack skeleton, empty-reason copy, and the approved analytics events. Forbid “今日匹配”, visible score, and “仅更新一组”.

- [ ] **Step 2: Run and confirm failure**

Run: `node test-mini-match-follow-loop.js`

Expected: FAIL on the legacy list feed and copy.

- [ ] **Step 3: Replace the feed list with the deck**

Initialize the active index from `matchDeckStorageKey(userId, watch.snapshotId)`, clamp it through `wrapDeckIndex`, and save after every completed switch. Fire card-view analytics once per snapshot/index pair. Keep direction editing available as a quiet secondary action for eligible members.

- [ ] **Step 4: Correct cache and error behavior**

Call `applyResponse(cached)` only when `isCareerWatchCacheValid(cached)` is true. If the network fails with valid cache, keep cards and show the cached-warning copy. If cache is expired, render the full retry state. Map `strict_filters` to a specific “放宽企业条件” action and other empty results to “调整求职方向”.

- [ ] **Step 5: Add a deck-shaped loading state and responsive layout**

The skeleton uses the same card height and three-layer offsets. Ensure the deck and primary action fit at 320 CSS px width without clipping and reserve bottom-tab safe area. In reduced-motion mode, remove rotation and spring-like transitions.

- [ ] **Step 6: Run Match checks**

Run: `node test-mini-match-follow-loop.js && npm run test:mini-career-watch && npm --prefix miniprogram run type-check`

Expected: all commands PASS.

---

### Task 6: Synchronize Companies, Profile, Copy, and Design Documentation

**Files:**
- Modify: `miniprogram/src/pages/companies/index.tsx`
- Modify: `miniprogram/src/pages/companies/index.scss`
- Modify: `miniprogram/src/pages/profile/index.tsx`
- Modify: `miniprogram/src/pages/profile/index.scss`
- Modify: `docs/haigoo-mini-design-system.md`
- Modify: `test-mini-release-readiness.js`

**Interfaces:**
- Consumes `CompanyFollowAction` and `onCompanyFollowChange`.
- Produces consistent user-facing terminology: “关注 / 已关注 / 关注企业 / 岗位动态”.

- [ ] **Step 1: Add failing directory and Profile assertions**

Require visible follow text in company rows, forbid plus-only controls, require Profile to say “关注企业”, and require the design system to state the three-tab order.

- [ ] **Step 2: Run and confirm failure**

Run: `node test-mini-match-follow-loop.js && npm run test:mini-release`

Expected: FAIL on legacy subscription copy and four-tab documentation.

- [ ] **Step 3: Reuse explicit follow actions in Companies**

Replace the 88rpx plus-only control with a text button showing “关注” or “已关注”. Subscribe to `haigoo:company-follow-change` while the page is mounted. Keep search/filter behavior and company-detail navigation unchanged.

- [ ] **Step 4: Update Profile terminology and navigation**

Display “关注企业” instead of “订阅企业”. Keep unread岗位 updates as a separate fact. Profile remains in the page list but does not emit a tab-change event and does not expect a tab-bar instance.

- [ ] **Step 5: Update the design system and release contract**

Replace the old four-tab rule with `企业 / Match / 笔记`, document the avatar Profile entry, follow/reminder separation, 25% deck threshold, and cached snapshot validity rule. Update release assertions so they enforce the new copy and icon assets instead of legacy strings.

- [ ] **Step 6: Run product-contract checks**

Run: `node test-mini-match-follow-loop.js && npm run test:mini-release && npm --prefix miniprogram run type-check`

Expected: all commands PASS.

---

### Task 7: Preview Smoke, Production Gates, and Visual QA

**Files:**
- Modify: `scripts/verify-mini-experience-smoke.mjs`
- Modify: `package.json`
- Modify only if a gate reveals a direct defect: files changed in Tasks 1–6

**Interfaces:**
- Produces `npm run test:mini-match-follow-loop`.
- Extends preview smoke to assert five valid fixed recommendations, stable `snapshotId`, future `validUntil`, populated `verifiedAt`, and follow persistence after reminder rejection.

- [ ] **Step 1: Register the focused test and extend preview smoke**

Add `"test:mini-match-follow-loop": "node test-mini-match-follow-loop.js"` to root scripts. In the preview smoke, assert every fixed card has a non-empty company ID, job ID, reasons, `verifiedAt`, and `openJobCount >= 1`; the repeated read must preserve IDs and `snapshotId` while valid.

Use the existing preview fixture or a dedicated disposable fixture to follow one company, record reminder rejection/unavailable, read state again, and assert `isFollowed === true` and `isSubscribed !== true`.

- [ ] **Step 2: Run all focused local checks**

Run:

```bash
npm run test:mini-match-follow-loop
npm run test:mini-career-watch
npm run test:mini-release
npm --prefix miniprogram run type-check
```

Expected: all commands PASS.

- [ ] **Step 3: Build and inspect the experience artifact**

Run: `npm --prefix miniprogram run build:weapp:experience && npm --prefix miniprogram run check:weapp:experience`

Expected: build and asset gate PASS with no secret-bearing or local-only configuration.

- [ ] **Step 4: Build and inspect the production artifact**

Run: `npm --prefix miniprogram run build:weapp:prod && npm --prefix miniprogram run check:weapp:prod`

Expected: build and production gate PASS; main package and static assets remain under configured limits.

- [ ] **Step 5: Compare visual output with the approved sources**

In WeChat DevTools, capture Match at small, iPhone 12/13, and large viewports. For new visual work, compare each Match screenshot at the same viewport against `artifacts/miniprogram-match-v2-reference/match-v2-reference.png`. Check stack depth, logo crop, card padding, title weights, button fit, safe area, and reduced motion; correct visible differences and repeat the comparison.

- [ ] **Step 6: Complete manual launch gates**

Run the WeChat DevTools sensitive-information/privacy scan and test on a real device: follow success, unfollow confirmation, reminder accept, reminder reject, notification arrival, avatar Profile entry, three-tab switching, and cached/offline recovery. Record the membership pricing/service-mix decision as an unresolved launch blocker until the product owner explicitly resolves it.

- [ ] **Step 7: Final diff review**

Run: `git status --short && git diff --check`

Expected: no whitespace errors; every changed file maps to this plan or is a preserved pre-existing workspace change clearly excluded from the delivery summary.
