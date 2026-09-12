# Mini Retained Loading Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the Mini Program's primary pages visually stable during sorting, navigation, repeat entry, and background refresh while preserving account and membership isolation.

**Architecture:** Extend the existing `use-retained-resource` hook into a bounded, session-scoped in-memory stale-while-revalidate cache. Migrate the affected pages to render retained data during refresh, add an anchored company-sort menu and compact update indicator, and keep Match card structure mounted throughout swiper transitions.

**Tech Stack:** Taro 4, React 18, TypeScript, SCSS, WeChat Mini Program APIs, existing Node.js source-contract tests.

**Spec:** `docs/superpowers/specs/2026-09-10-mini-retained-loading-experience-design.md`

## Global Constraints

- Preserve the current 1.0.30 behavior, routes, backend contracts, membership prices, access rules, Match ordering, and three-day NEW calculation.
- Do not add a state-management or UI dependency.
- Cache only in process memory and scope every entry with `miniContentScope()`.
- Clear visible data immediately when session or membership scope changes.
- Preserve visible content during same-scope refresh; show a full loading state only when no content is available.
- Preserve all pre-existing dirty-worktree edits. Do not commit implementation files while they contain changes not created by this plan.
- Do not deploy, upload a WeChat experience build, or modify production data.

---

### Task 1: Make retained resources survive page recreation

**Files:**
- Modify: `miniprogram/src/hooks/use-retained-resource.ts`
- Create: `test-mini-retained-loading.js`

**Interfaces:**
- Consumes: `miniContentScope(): string`, existing `ApiRequestError`, React state setters.
- Produces: `useRetainedResource<T>(initialKey?: string)` returning `{ data, setData, loading, refreshing, error, load }`.
- Produces: module-scoped entries keyed by `${miniContentScope()}\n${resourceKey}` with `{ data, loadedAt }` and a bounded entry count.

- [ ] **Step 1: Add a failing retained-resource contract test**

Create a Node source/behavior test that verifies the module owns a bounded cache, accepts an initial key, preserves visible data across same-scope key changes, and clears visible data on scope change. Include source assertions for the public API:

```js
const source = read('miniprogram/src/hooks/use-retained-resource.ts')
assert.match(source, /new Map</)
assert.match(source, /useRetainedResource<T>\(initialKey = ''\)/)
assert.match(source, /miniContentScope\(\)/)
assert.match(source, /CACHE_LIMIT/)
assert.doesNotMatch(source, /setStorageSync/)
```

Extend the existing lightweight React harness pattern from `test-mini-review-races.js` so a first hook instance loads `companies:latest`, a second instance synchronously starts from that value, and a same-scope `companies:relevance` request leaves the latest data visible until resolution.

- [ ] **Step 2: Run the new test and verify the baseline failure**

Run:

```bash
node test-mini-retained-loading.js
```

Expected: FAIL because `useRetainedResource` has only hook-instance memory and no `initialKey` argument.

- [ ] **Step 3: Add the bounded in-memory cache**

Implement a module map and helpers inside the hook file:

```ts
const CACHE_LIMIT = 40
const CACHE_TTL_MS = 60_000
type RetainedEntry = { data: unknown; loadedAt: number }
const retainedResources = new Map<string, RetainedEntry>()

function scopedResourceKey(scope: string, key: string) {
  return `${scope}\n${key}`
}
```

When reading or writing an entry, move it to the end of the map. When the map exceeds `CACHE_LIMIT`, delete the oldest key. Do not persist this map.

- [ ] **Step 4: Initialize from cache and preserve same-scope content**

Change the hook signature to:

```ts
export default function useRetainedResource<T>(initialKey = '')
```

Use lazy state initialization to read the current-scope cache for `initialKey`. In `load(key, fetcher, force)`, apply these rules:

```text
scope changed       -> invalidate the current sequence and replace visible data with only the new-scope cached entry
same scope, cached  -> show that entry immediately
same scope, no cache -> retain the currently visible data while the new key loads
no visible data     -> loading=true
visible data exists -> refreshing=true and loading=false
```

Wrap the returned `setData` so list pagination updates both React state and the currently active cache entry.

- [ ] **Step 5: Preserve error and race behavior**

Keep latest-sequence wins semantics. On `401`, `403`, or scope mismatch, delete the active entry and clear visible data. On an ordinary failure with visible data, keep it and show the existing toast; without visible data, expose the error string.

- [ ] **Step 6: Run the focused tests and inspect the diff**

Run:

```bash
node test-mini-retained-loading.js
node test-mini-review-races.js
npm --prefix miniprogram run type-check
git diff --check -- miniprogram/src/hooks/use-retained-resource.ts test-mini-retained-loading.js
```

Expected: all pass. Review only the two task files; do not commit pre-existing changes.

---

### Task 2: Replace the company sort toggle with a stable dropdown

**Files:**
- Modify: `miniprogram/src/pages/companies/index.tsx`
- Modify: `miniprogram/src/pages/companies/index.scss`
- Modify: `miniprogram/src/utils/company-role-summary.ts`
- Modify: `test-mini-review-races.js`
- Modify: `test-mini-company-detail-polish.js`
- Modify: `test-mini-retained-loading.js`

**Interfaces:**
- Consumes: `useRetainedResource<CompaniesResponse>(initialKey)`, existing `fetchCompanies`, `CompanyDirectorySort`.
- Produces: sort button state `sortOpen: boolean` and selection handler `selectSort(nextSort: CompanyDirectorySort): Promise<void>`.
- Produces: accessible options `按最新` and `按相关度` and a compact `正在更新企业` list status.

- [ ] **Step 1: Update the failing sort interaction test**

Replace the old single-toggle assertions in `test-mini-review-races.js` with this behavior:

```js
const trigger = find(companies.render(), node => node.props?.className === 'companies-sort-toggle')
assert.equal(trigger.props['aria-expanded'], false)
trigger.props.onClick()
assert.equal(requests.length, requestCountBeforeOpen, 'opening the menu does not request data')
const relevance = find(companies.render(), node => node.props?.['data-sort'] === 'relevance')
relevance.props.onClick()
await tick()
assert.equal(requests.at(-1).params.sortBy, 'relevance')
assert.equal(companies.slots[0].companies[0].name, 'initial', 'old list remains during refresh')
```

Add source assertions that both options expose `aria-selected`, the trigger exposes `aria-expanded`, and the refresh status contains `正在更新企业`.

- [ ] **Step 2: Update the direction-copy test and verify failure**

Change expected summaries in `test-mini-company-detail-polish.js` from `岗位可关注` to `方向可关注`, including single- and two-direction cases.

Run:

```bash
node test-mini-review-races.js
node test-mini-company-detail-polish.js
```

Expected: FAIL on the old toggle behavior and old suffix.

- [ ] **Step 3: Initialize the directory from its default retained key**

Define a stable key helper near the page component:

```ts
const companyResourceKey = (search: string, industry: string, sortBy: CompanyDirectorySort) =>
  JSON.stringify([search.trim(), industry, sortBy])
```

Initialize with:

```ts
useRetainedResource<CompaniesResponse>(companyResourceKey('', '', 'latest'))
```

Use the helper for every call to `loadResource`. Keep the existing request-sequence, pagination fan-out, follow-state revision, and retry query behavior.

- [ ] **Step 4: Implement the anchored dropdown**

Add `sortOpen` state. The trigger displays `按最新` or `按相关度`, toggles only the menu, and uses `aria-haspopup='listbox'` plus `aria-expanded`. Render an absolute menu under the trigger:

```tsx
<View className='companies-sort-menu' aria-role='listbox' aria-label='企业排序方式'>
  {sortOptions.map((option) => <View
    className={option.value === sortBy ? 'is-selected' : ''}
    data-sort={option.value}
    aria-role='option'
    aria-selected={option.value === sortBy}
    onClick={() => void selectSort(option.value)}
  >
    <Text>{option.label}</Text>
    {option.value === sortBy ? <MiniIcon name='check' size='20rpx' /> : null}
  </View>)}
</View>
```

Add a page-level click target behind the menu to close it without changing the selection. Selecting the current option closes only; selecting another option closes, updates the trigger, and requests page 1.

- [ ] **Step 5: Keep the list mounted and expose a compact refresh status**

Render the initial skeleton only for `loading && !data`. When `refreshing && data && !loadingMore`, insert a fixed-height status immediately before `.company-list`:

```tsx
<View className='companies-refreshing' aria-live='polite' aria-busy>
  <View className='companies-refreshing__spinner' />
  <Text>正在更新企业</Text>
</View>
```

Do not hide `.company-list` while `refreshing` is true. Existing failures with retained data remain toast-only.

- [ ] **Step 6: Apply NEW order, green styling, and copy**

Render rating before NEW in `.company-card__title-row`. Change `.company-card__new` to a success green with sufficient contrast on white, such as `#168653`. Update the utility suffix exactly:

```ts
const suffix = visible.length > 1 ? '等方向可关注' : '方向可关注'
```

Do not change the `companyUpdateDeadline` condition or empty-category fallback.

- [ ] **Step 7: Style and verify the company interaction**

Use existing surfaces and borders. Keep the trigger at least `88rpx` high, menu options at least `88rpx`, and prevent horizontal overflow on 320px-class devices. Disable spinner animation under `prefers-reduced-motion`.

Run:

```bash
node test-mini-review-races.js
node test-mini-company-detail-polish.js
node test-mini-company-directory-v2.js
node test-mini-retained-loading.js
npm --prefix miniprogram run type-check
git diff --check -- miniprogram/src/pages/companies/index.tsx miniprogram/src/pages/companies/index.scss miniprogram/src/utils/company-role-summary.ts test-mini-review-races.js test-mini-company-detail-polish.js test-mini-retained-loading.js
```

Expected: menu opening makes no request, selecting relevance retains the old list until success, and all copy/visual contracts pass.

---

### Task 3: Migrate details, notes, and membership to retained refresh

**Files:**
- Modify: `miniprogram/src/pages/company-detail/index.tsx`
- Modify: `miniprogram/src/pages/company-detail/index.scss`
- Modify: `miniprogram/src/pages/job-detail/index.tsx`
- Modify: `miniprogram/src/pages/job-detail/index.scss`
- Modify: `miniprogram/src/pages/growth/index.tsx`
- Modify: `miniprogram/src/pages/note-detail/index.tsx`
- Modify: `miniprogram/src/pages/note-detail/index.scss`
- Modify: `miniprogram/src/pages/membership/index.tsx`
- Modify: `miniprogram/src/pages/membership/index.scss`
- Modify: `test-mini-retained-loading.js`
- Modify: `test-mini-review-races.js`
- Modify: `test-mini-membership-refresh.js`

**Interfaces:**
- Consumes: the Task 1 hook and existing content-service fetchers.
- Produces: retained keys `company-detail:<id>:<search>`, `job-detail:<companyId>:<jobId>:<search>`, `growth-notes`, `growth-note:<id>`, and `membership-plans`.
- Produces: first-load structural skeletons and non-blocking background refresh states.

- [ ] **Step 1: Add failing continuity assertions**

Extend `test-mini-retained-loading.js` and `test-mini-review-races.js` to assert:

```js
assert.doesNotMatch(companyDetailSource, /setCompany\(null\)/)
assert.doesNotMatch(companyDetailSource, /正在加载企业资料/)
assert.doesNotMatch(jobDetailSource, /正在加载岗位信息/)
assert.doesNotMatch(noteDetailSource, /正在打开笔记/)
assert.match(companyDetailSource, /useRetainedResource/)
assert.match(jobDetailSource, /useRetainedResource/)
assert.match(noteDetailSource, /useRetainedResource/)
assert.match(membershipSource, /useRetainedResource/)
```

In the detail race harness, load a member result, trigger `useDidShow` again in the same scope, and assert the previous company remains visible until the second response resolves. Keep the existing account-switch assertion that clears member contacts.

- [ ] **Step 2: Run focused tests and verify failure**

Run:

```bash
node test-mini-retained-loading.js
node test-mini-review-races.js
node test-mini-membership-refresh.js
```

Expected: FAIL because the details and membership page have not adopted retained resources.

- [ ] **Step 3: Migrate company detail**

Store only the authoritative detail response in the retained resource:

```ts
type CompanyDetailResource = Awaited<ReturnType<typeof fetchCompanyDetail>>
const resourceKey = `company-detail:${id}:${accessSearch}`
const { data, loading, refreshing, error, load: loadResource } =
  useRetainedResource<CompanyDetailResource>(resourceKey)
const company = data?.company || null
const access = data?.access || null
```

On every `useDidShow`, call `loadResource(resourceKey, () => fetchCompanyDetail(id, true, accessSearch), true)` and refresh follows/Match notification metadata in parallel. Remove the unconditional clearing at the start of `load`. Use `ContentSkeleton` only when `loading && !company`; keep current content during `refreshing`.

- [ ] **Step 4: Migrate job detail without coupling favorite state**

Use a retained resource for `fetchCompanyJob` and keep favorite state separate:

```ts
type JobDetailResource = Awaited<ReturnType<typeof fetchCompanyJob>>
const resourceKey = `job-detail:${companyId}:${jobId}:${accessSearch}`
const { data, loading, error, load: loadResource } =
  useRetainedResource<JobDetailResource>(resourceKey)
```

Refresh the job with `force=true` on `useDidShow`. Fetch favorite IDs independently; favorite failure must set only `favorite=null`. Initialize language from the newly loaded job only when the job ID or available translation changes. Replace the loading text with a stable hero/facts skeleton.

- [ ] **Step 5: Keep the note list visible during refresh**

Initialize `GrowthPage` with `useRetainedResource<GrowthNote[]>('growth-notes')` and use that same key in `loadResource`. Change the meta line to show the current note count whenever notes exist and append a compact `正在更新` state while `refreshing` without replacing the count. Render `ContentSkeleton` only when `loading && notes.length === 0`.

- [ ] **Step 6: Migrate note detail as one retained resource**

Use one fetcher that returns the main response and related notes:

```ts
type NoteDetailResource = {
  result: Awaited<ReturnType<typeof fetchGrowthNote>>
  related: GrowthNote[]
}
```

The resource key is `growth-note:${id}`. `fetchGrowthNotes()` may fail to `[]` without failing the main note. Render the article from retained data and use an article-shaped skeleton only when no note is available.

- [ ] **Step 7: Migrate membership after session refresh**

Define:

```ts
type MembershipPlansResource = Awaited<ReturnType<typeof fetchMembershipPlans>>
```

Use `useRetainedResource<MembershipPlansResource>('membership-plans')`. In the `useDidShow` loader, first await `refreshWechatSession()` when authenticated, then call `loadResource('membership-plans', fetchMembershipPlans, true)` so the hook observes the refreshed scope. Derive `plans`, `membership`, and `paymentAvailable` from retained data rather than clearing three separate states. Keep `selectedPlanId` if still valid. After payment, call the same forced loader.

- [ ] **Step 8: Add bounded skeleton and refresh styles**

Use existing page colors, borders, and card geometry. Skeletons must reserve the hero and primary content height; background refresh status must not cover bottom actions. Do not add a shared component unless at least three pages use identical markup.

- [ ] **Step 9: Run page tests and inspect all scoped diffs**

Run:

```bash
node test-mini-retained-loading.js
node test-mini-review-races.js
node test-mini-membership-refresh.js
node test-mini-note-cover-urls.js
node test-mini-experience-feedback.js
npm --prefix miniprogram run type-check
git diff --check -- miniprogram/src/pages/company-detail/index.tsx miniprogram/src/pages/company-detail/index.scss miniprogram/src/pages/job-detail/index.tsx miniprogram/src/pages/job-detail/index.scss miniprogram/src/pages/growth/index.tsx miniprogram/src/pages/note-detail/index.tsx miniprogram/src/pages/note-detail/index.scss miniprogram/src/pages/membership/index.tsx miniprogram/src/pages/membership/index.scss
```

Expected: all pass, same-scope returns retain content, and account changes still clear restricted data.

---

### Task 4: Keep Match card structure mounted during swipes

**Files:**
- Modify: `miniprogram/src/pages/index/career-watch-page.tsx`
- Modify: `miniprogram/src/components/match-company-card/index.tsx`
- Modify: `miniprogram/src/components/match-company-card/index.scss`
- Modify: `test-mini-match-immersive-v2.js`
- Modify: `test-mini-retained-loading.js`

**Interfaces:**
- Consumes: existing valid `CareerWatchResponse` Storage snapshot and `MatchCompanyDeck` active state.
- Produces: synchronous valid-snapshot initialization and stable card Logo/footer markup for active and inactive cards.

- [ ] **Step 1: Add failing Match stability contracts**

Assert the card no longer conditionally mounts the follow action on `active`, the logo is eagerly available within the bounded five-card deck, and inactive cards expose a class that disables interaction:

```js
assert.doesNotMatch(card, /\{active \? <CompanyFollowAction/)
assert.match(card, /match-company-card__footer--inactive/)
assert.match(card, /lazyLoad=\{false\}/)
assert.match(watch, /isCareerWatchCacheValid/)
```

Add a source/behavior assertion that a valid stored snapshot initializes `watch` and `step='feed'` without rendering `watch-loading` first.

- [ ] **Step 2: Run the Match tests and verify failure**

Run:

```bash
node test-mini-match-immersive-v2.js
node test-mini-retained-loading.js
```

Expected: FAIL because footer controls are active-only and initial state starts at `loading`.

- [ ] **Step 3: Initialize Match from a valid scoped snapshot**

Read the current user's stored response once before state initialization, normalize it, and accept it only when `isCareerWatchCacheValid` and membership entitlement matches the current session. Initialize `watch` and `step` from that value; keep the existing network refresh on `useDidShow`.

Use one helper shared by both initial state and `load`:

```ts
function readValidCachedWatch(): CareerWatchResponse | null
```

It must return `null` for guests, expired snapshots, malformed data, or a membership mismatch.

- [ ] **Step 4: Keep card media and footer geometry present**

Render `CompanyFollowAction` for every card and derive the wrapper class from `active`. Keep reminders mounted for followed companies regardless of active status. For inactive cards, apply `pointer-events: none`, preserve opacity and height, and rely on the existing Swiper item's `aria-hidden` for accessibility isolation. Do not invoke follow or reminder callbacks from inactive cards.

Set the maximum five company logos to `lazyLoad={false}` so adjacent card media is decoded before the swipe transition. Retain the existing initial fallback and image error behavior.

- [ ] **Step 5: Run Match and type checks**

Run:

```bash
node test-mini-match-immersive-v2.js
node test-mini-match-follow-loop.js
node test-mini-retained-loading.js
npm --prefix miniprogram run type-check
git diff --check -- miniprogram/src/pages/index/career-watch-page.tsx miniprogram/src/components/match-company-card/index.tsx miniprogram/src/components/match-company-card/index.scss test-mini-match-immersive-v2.js test-mini-retained-loading.js
```

Expected: existing valid snapshots render immediately, card content remains stable during swipe, and active-card behavior is unchanged.

---

### Task 5: Run release-level verification and produce a scoped handoff

**Files:**
- Modify only files proven necessary by Tasks 1-4.
- Verify: `miniprogram/dist-experience/`
- Verify: `miniprogram/.wechat-experience/`

**Interfaces:**
- Consumes: all page and hook changes from Tasks 1-4.
- Produces: a passing local test/build report and a source tree ready for a later explicit experience upload.

- [ ] **Step 1: Run all focused regressions**

Run:

```bash
node test-mini-retained-loading.js
node test-mini-review-races.js
node test-mini-company-directory-v2.js
node test-mini-company-detail-polish.js
node test-mini-note-cover-urls.js
node test-mini-membership-refresh.js
node test-mini-match-follow-loop.js
node test-mini-match-immersive-v2.js
node test-mini-experience-feedback.js
```

Expected: every command exits 0.

- [ ] **Step 2: Run broad Mini Program checks**

Run:

```bash
npm --prefix miniprogram run type-check
node test-mini-release-readiness.js
node test-mini-design-readiness.js
npm --prefix miniprogram run build:weapp:experience
```

Expected: type checking, release/design contracts, and the 1.0.30 experience build pass without upload.

- [ ] **Step 3: Run the experience bundle checker**

Run:

```bash
npm --prefix miniprogram run check:weapp:experience
```

Expected: the checker exits 0, the bundle points only to the development CloudBase environment, and the release version is `1.0.30`.

- [ ] **Step 4: Review the final diff without absorbing unrelated changes**

Run:

```bash
git diff --check
git status --short
git diff -- miniprogram/src/hooks/use-retained-resource.ts miniprogram/src/pages/companies/index.tsx miniprogram/src/pages/companies/index.scss miniprogram/src/pages/company-detail/index.tsx miniprogram/src/pages/company-detail/index.scss miniprogram/src/pages/job-detail/index.tsx miniprogram/src/pages/job-detail/index.scss miniprogram/src/pages/growth/index.tsx miniprogram/src/pages/note-detail/index.tsx miniprogram/src/pages/note-detail/index.scss miniprogram/src/pages/membership/index.tsx miniprogram/src/pages/membership/index.scss miniprogram/src/pages/index/career-watch-page.tsx miniprogram/src/components/match-company-card/index.tsx miniprogram/src/components/match-company-card/index.scss miniprogram/src/utils/company-role-summary.ts test-mini-retained-loading.js test-mini-review-races.js test-mini-company-detail-polish.js test-mini-match-immersive-v2.js
```

Expected: no whitespace errors, no backend/deployment edits from this plan, and no accidental reversal of pre-existing work.

- [ ] **Step 5: Report the handoff**

Report changed files, exact tests/builds run, any baseline failures, and the location of the generated experience project. Do not upload or deploy. Because the implementation files were dirty before this plan, leave committing them to a separately reviewed user-approved step.

---

## Execution Order and Review Gates

1. Task 1 must pass before any page adopts the retained-resource API.
2. Task 2 must prove menu-open versus menu-select behavior and list retention before detail migration.
3. Task 3 must preserve the existing account-switch contact isolation test.
4. Task 4 must keep inactive controls non-interactive while preserving card geometry.
5. Task 5 must pass the 1.0.30 experience build without upload or deployment.
