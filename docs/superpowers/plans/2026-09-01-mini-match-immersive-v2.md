# Haigoo Mini Program Match Immersive V2.1 Implementation Plan

> Execution authority: implement against `PRODUCT.md`, `docs/haigoo-platform-positioning.md`, `docs/haigoo-mini-design-system.md`, and `docs/superpowers/specs/2026-09-01-mini-match-immersive-v2-design.md`. The V2.1 visual baseline is `artifacts/miniprogram-match-v2-reference/match-v2-1-reference.html` and its PNG snapshot.

**Goal:** Turn the existing working Match follow loop into the Mini Program's premium primary experience, while unifying the company directory and fixing bottom navigation visibility and safe-area behavior.

**Architecture:** Preserve the current Taro pages, real Career Watch response, reversible deck, company follow service, reminder separation, cache validity, and analytics transport. Reshape only the presentation model and page composition needed for V2. Add small pure helpers for copy normalization and card view data instead of adding a UI framework or replacing the matching engine.

**Tech Stack:** Taro 4.2.1, React 18, TypeScript 5.4, SCSS, WeChat Mini Program APIs, existing Node contract tests.

## Global Constraints

- The Mini Program is Match-first. Do not convert it into a mobile website, job portal, editorial home feed, or generic enterprise directory.
- Primary navigation remains exactly `企业 / Match / 笔记`; Profile stays behind the top avatar.
- Match remains centered and visually larger by about 35–40%. Do not use the current 84px detached floating treatment or reduce it to peer size.
- Preserve the current 25% horizontal release threshold, looping index, cached active index, and reduced-motion handling.
- Swipe changes the active recommendation only. It never follows, unfollows, subscribes, dismisses, or applies.
- Follow and WeChat reminder remain separate actions and separate services.
- Use verified production fields only. Do not invent ratings, remote policy, hiring counts, salaries, or match claims.
- A numeric match score is allowed only with server-provided `scoreBreakdown` and `scoreConfidence`; the client never calculates a second score.
- Public rating requires a supported `ratingSource`; headquarters requires a real address; role summaries require active job titles or normalized role families.
- Do not add a component library, animation dependency, gradient, glass effect, large floating orb, or decorative illustration.
- Do not reuse the old “warm dossier” layout, “为什么推荐给你” block, large `持续核验` badge, full-width follow button, or stacked follow/reminder/detail footer.

## Task 1: Lock V2 Design Contracts in Tests

**Files:**

- Modify: `test-mini-design-readiness.js`
- Modify: `test-mini-match-follow-loop.js`
- Create: `test-mini-match-immersive-v2.js`
- Modify: `package.json`

### Step 1: Add a failing V2 contract test

Create `test-mini-match-immersive-v2.js` with static assertions that enforce the intended structure without overfitting individual CSS declarations:

```js
import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const card = read('./miniprogram/src/components/match-company-card/index.tsx')
const cardStyles = read('./miniprogram/src/components/match-company-card/index.scss')
const presentation = read('./miniprogram/src/utils/match-card-presentation.ts')
const watch = read('./miniprogram/src/pages/index/career-watch-page.tsx')
const companies = read('./miniprogram/src/pages/companies/index.scss')
const tab = read('./miniprogram/src/custom-tab-bar/index.scss')
const careerWatch = read('./lib/services/career-watch-service.js')
const careerTypes = read('./miniprogram/src/services/career-match-service.ts')

assert.match(watch, /更懂你的远程企业/)
assert.match(watch, /当前方向/)
assert.doesNotMatch(card, /为什么推荐给你|持续核验/)
assert.doesNotMatch(card, /WechatReminderAction/)
assert.match(`${card}\n${presentation}`, /slice\(0, 2\)/)
assert.match(card, /compact/)
assert.match(`${careerWatch}\n${careerTypes}`, /scoreBreakdown/)
assert.match(`${careerWatch}\n${careerTypes}`, /scoreConfidence/)
assert.match(`${careerWatch}\n${careerTypes}`, /openRoleLabels/)
assert.match(card, /score|匹配度/)
assert.doesNotMatch(cardStyles, /min-height:\s*(9|10)\d\dpx/)
assert.doesNotMatch(cardStyles, /company-follow-action[^}]*min-height:\s*104px/s)
assert.match(companies, /company-list[^}]*gap:\s*(?:20|24)rpx/s)
assert.match(companies, /company-card[^}]*border-radius:\s*24rpx/s)
assert.doesNotMatch(tab, /84px|margin-top:\s*-24px/)
assert.match(tab, /safe-area-inset-bottom/)

console.log('mini Match immersive V2 checks passed')
```

Adjust selectors if the implementation uses renamed V2 classes, but keep the behavioral intent of every assertion.

### Step 2: Register the test

Add this script to root `package.json`:

```json
"test:mini-match-v2": "node test-mini-match-immersive-v2.js"
```

### Step 3: Update legacy assertions

- In `test-mini-match-follow-loop.js`, preserve assertions for three tabs, Match SVG, 25% threshold, wraparound, follow/reminder separation, cache validity, and reduced motion.
- Replace the legacy assertion that forbids `company.score`; V2.1 displays a server-provided explainable reference score.
- Replace visual assertions that require `REMOTEMATCH`, `为你匹配`, or legacy copy with V2.1 copy and structure.
- In `test-mini-design-readiness.js`, keep the no-purple, no-gradient, safe-area, real-data, and primary-page top-bar rules.
- Change any assertion that requires large repeated company cards to the V2.1 light-card rule: 24rpx radius, 20–24rpx gap, specific role summary, and no thick border plus heavy shadow combination.

### Step 4: Run the test to confirm it fails

```bash
npm run test:mini-match-v2
```

Expected: failure on the current large card footer, old copy, opaque score contract, 84px Match icon, and low-information company cards.

## Task 2: Normalize Shared Mini Program Tokens and Bottom Navigation

**Files:**

- Modify: `miniprogram/src/app.scss`
- Modify: `miniprogram/src/custom-tab-bar/index.scss`
- Verify: `miniprogram/src/custom-tab-bar/index.tsx`

### Step 1: Normalize semantic tokens

Keep existing variable names where already shared, but align values and add missing component tokens:

```scss
page,
.page-shell {
  --color-page: #f4f6f8;
  --color-surface: #ffffff;
  --color-ink: #141820;
  --color-secondary: #465264;
  --color-muted: #748094;
  --color-border: #e2e6eb;
  --color-border-strong: #cdd3dc;
  --color-brand: #e96832;
  --color-brand-strong: #c94f22;
  --color-brand-soft: #fff1ea;
  --radius-chip: 8px;
  --radius-control: 10px;
  --radius-card: 12px;
  --radius-match: 16px;
  --shadow-match: 0 18px 44px rgba(20, 24, 32, .12), 0 2px 8px rgba(20, 24, 32, .05);
}
```

Do not globally change every historical page radius in this task. Apply the new component tokens to Match, Companies, and custom Tab first.

### Step 2: Rebuild the Tab surface

- Keep the fixed white surface and full `env(safe-area-inset-bottom)` coverage.
- Target a visible content height around 98–104rpx plus the device safe area.
- Keep all three items inside the same bar; no item may sit above and outside it.
- Set ordinary icons to approximately 44–52rpx and Match to approximately 64–72rpx, producing a visible ratio around 1.35–1.45.
- Remove `width: 84px`, `height: 84px`, and `margin-top: -24px`.
- Give Match a slightly stronger label weight and orange active state; do not increase its label more than one text step above peers.
- Add a subtle upward shadow only to separate the bar from scrolling content.

### Step 3: Verify content clearance

For Match, Companies, and Notes, confirm the page bottom padding is at least:

```scss
padding-bottom: calc(var(--tabbar-content-height) + env(safe-area-inset-bottom) + 24px);
```

If CSS variables are inconvenient in the compiled Taro target, use one consistent literal value in all three pages and document it in `app.scss`.

### Step 4: Run contract tests

```bash
npm run test:mini-design
npm run test:mini-match-follow-loop
npm run test:mini-match-v2
```

## Task 3: Extend the Explainable Match Data Contract

**Files:**

- Modify: `lib/services/career-watch-service.js`
- Modify: `miniprogram/src/services/career-match-service.ts`
- Create: `miniprogram/src/utils/match-card-presentation.ts`
- Create: `miniprogram/src/utils/match-card-presentation.test.ts` only if the current toolchain already runs TS unit tests; otherwise extend `test-mini-match-immersive-v2.js`
- Modify: `miniprogram/src/components/match-company-card/index.tsx`

### Step 1: Replace the opaque display score with an explainable score

Preserve the core role-matching and ranking engine. Replace the current Career Watch display formula based on an unexplained fixed base with three named dimensions:

```text
Career direction fit        0–50
Active company preferences  0–30
Opportunity validity        0–20
```

Recommended calculation:

- Direction: exact custom-role evidence `50`; matching role family with active public role `42`; historical-only evidence is not sufficient for the main deck.
- Preferences: divide 30 evenly across the user's active preference keys. `matched` earns the share, `not_matched` earns zero, and `missing` earns zero while reducing confidence.
- Opportunity: valid public application opportunity `12`; freshness adds `8` within 7 days, `5` within 30 days, otherwise `2` while the opportunity remains verified open.
- `scoreConfidence` is the comparable weight divided by 100. Direction and opportunity contribute known coverage; missing active preference facts reduce coverage.
- Display a numeric score only when `scoreConfidence >= 0.75`. Otherwise preserve ranking but render a qualitative fit band.

Return the same calculation used for ordering:

```ts
score: number
scoreBreakdown: {
  direction: { score: number; max: 50; label: string }
  preferences: { score: number; max: 30; label: string }
  opportunity: { score: number; max: 20; label: string }
}
scoreConfidence: number
```

Do not describe this score as accuracy, success probability, hiring probability, or company quality.

### Step 2: Return shared company facts

Extend the Career Watch query and response with:

```ts
headquarters?: string
rating: number | null
ratingSource?: string
openRoleLabels: string[]
```

- Select `tc.address`, `tc.company_rating`, and `tc.rating_source` in the existing trusted-company query.
- Normalize headquarters to a concise city/country label without turning remote-work policy into headquarters.
- Return a rating only when the value is finite and the source is in the supported source allowlist already used by Career Watch preferences.
- Build `openRoleLabels` from active grouped jobs, using localized titles or existing role-family labels, deduplicated and capped at two.

### Step 3: Introduce pure presentation helpers

Add a pure helper that receives `WatchFeedItem` and returns display-safe strings:

```ts
export interface MatchCardPresentation {
  meta: string
  headquarters: string
  ratingLabel: string
  showNumericScore: boolean
  scoreLabel: string
  signal: string
  judgment: string
  reasons: string[]
  jobTitle: string
  roleSummary: string
  verifiedLabel: string
}

export function buildMatchCardPresentation(company: WatchFeedItem): MatchCardPresentation {
  const reasons = company.reasons
    .map(normalizeMatchReason)
    .filter(Boolean)
    .slice(0, 2)

  return {
    meta: [company.industry, company.employeeCount].filter(Boolean).join(' · '),
    headquarters: company.headquarters ? `总部 · ${company.headquarters}` : '',
    ratingLabel: typeof company.rating === 'number' && Number.isFinite(company.rating) && company.ratingSource
      ? `★ ${company.rating.toFixed(1)}`
      : '',
    showNumericScore: company.scoreConfidence >= 0.75,
    scoreLabel: company.scoreConfidence >= 0.75 ? String(company.score) : fitBandLabel(company.fitBand),
    signal: reasons[0] || '这家企业与你当前关注的方向存在交集',
    judgment: reasons[1] || '可以结合开放岗位与团队信息继续判断。',
    reasons,
    jobTitle: company.jobTitle || '查看企业当前开放岗位',
    roleSummary: formatOpenRoleLabels(company.openRoleLabels),
    verifiedLabel: formatVerifiedLabel(company.verifiedAt || company.updatedAt)
  }
}
```

Do not generate new claims on the client. The fallback copy must remain neutral and must not imply a verified attribute that is absent from the response.

### Step 4: Normalize AI-like prefixes

`normalizeMatchReason` should remove only known boilerplate such as `推荐关注：`, `为什么推荐：`, duplicated punctuation, and excessive whitespace. Do not rewrite substantive data or concatenate unrelated reasons.

### Step 5: Test the contract and mapper

Cover:

- Three or more server reasons become exactly two visible reasons.
- Empty reasons produce neutral fallback copy.
- Missing industry and employee count do not produce dangling separators.
- Missing job count uses the official-site fallback.
- Missing rating or rating source renders no star row.
- Missing headquarters renders no placeholder.
- Two or more active roles become `产品、前端可申请`; one role becomes `产品岗位可申请`.
- Confidence below `0.75` hides the exact score.
- The three score dimensions sum to the returned score and their maxima sum to 100.
- Dates remain calendar dates and never become invented “刚刚更新” copy.

## Task 4: Rebuild the Match Company Card

**Files:**

- Modify: `miniprogram/src/components/match-company-card/index.tsx`
- Replace: `miniprogram/src/components/match-company-card/index.scss`
- Modify: `miniprogram/src/components/company-follow-action/index.scss`

### Step 1: Change card hierarchy

Render this order:

1. Asymmetric identity row: 96–108rpx logo and company name on the left, reference match score on the right.
2. Compact facts row: industry, headquarters and sourced rating; missing facts collapse without placeholders.
3. One strong personalized fit statement.
4. At most two restrained evidence chips tied to active user settings.
5. One representative job row, with specific direction labels such as `产品、前端可申请`.
6. Compact footer: verified date on the left, `关注` and `查看企业` on the right.

The whole active card opens the company detail except when the user starts a horizontal swipe or taps an explicit nested action. Preserve event propagation guards on follow and job actions.

### Step 2: Remove the legacy bottom action stack

- Remove `WechatReminderAction` from the Match card.
- Do not remove the component or reminder service. Reminder settings remain available in company detail and the followed-company flow.
- Remove the full-width follow action and large bottom white space.
- Move `CompanyFollowAction` into the compact footer with `compact` presentation.
- Change compact copy to `关注` / `已关注` on narrow card surfaces while keeping the existing explicit unfollow confirmation.

### Step 3: Set stable dimensions

- Card radius: 32rpx / 16px equivalent.
- Horizontal padding: 32–36rpx.
- Logo: 104–112rpx; radius 20–24rpx.
- Match score ring: 88–100rpx; one numeric value and one short label only.
- Company name: 34–40rpx, maximum one line with ellipsis.
- Personalized signal: 30–34rpx, maximum two lines.
- Judgment: 25–28rpx, maximum three lines.
- Evidence rows: minimum 64–70rpx; no more than two.
- Job row: minimum 92–104rpx.
- Footer: 80–88rpx.
- Total card height should remain stable across data variations and fit above the Tab at 320px, 375px, 390px, and 430px logical widths.

Use line clamping or fixed min/max blocks so content variations do not resize the deck during swipe.

### Step 4: Style restraint

- White surface with either a quiet 1px neutral border or one medium shadow, not both.
- Back cards use lower opacity, 1–2 degree opposing rotations and little or no shadow so the deck feels physical without looking playful.
- Use orange for the score ring, evidence chips and active controls; keep the majority of the card white, ink and neutral gray.
- No black badge beside the company name.
- No filled orange full-width CTA.
- No gradient, blur, glow, glass, texture, or dark header block.

### Step 5: Verify nested actions

- Tapping follow must not open the company or move the deck.
- Tapping the score ring opens the score-breakdown bottom sheet and does not open the company.
- Tapping the job row opens the job detail when `jobId` exists.
- Tapping the card or footer opens company detail.
- Swiping across nested content still changes the active card when the gesture began outside a button.

## Task 5: Make the Match Page Immersive

**Files:**

- Modify: `miniprogram/src/pages/index/career-watch-page.tsx`
- Modify: `miniprogram/src/pages/index/index.scss`
- Modify only if required: `miniprogram/src/components/match-company-deck/index.scss`

### Step 1: Replace the feed header

Use:

- Title: `更懂你的远程企业`
- Counter: `{active + 1} / {total}`
- Compact direction strip: `当前方向` + summarized direction + `调整`

Remove the large dated header and the current `为你匹配` framing. Keep exact verification dates inside each card, where they support trust without dominating the page.

### Step 2: Tighten the viewport composition

- Keep the top bar white and stable.
- Reduce page side padding to approximately 32–36rpx for the Match feed.
- Reserve the central viewport for the deck; do not wrap it in another card.
- Show 2 back-card edges with 8–18rpx vertical offsets and subtle scale.
- Keep pagination dots below the deck. Remove the sentence `左右滑动，反复比较` after the first-use period; do not make persistent instructional copy part of the main layout.

### Step 3: Refine deck motion

- Preserve the 25% release threshold and 190–280ms transition window.
- Cap visible card rotation near 3 degrees.
- Use a decelerating transform curve; no bounce, spring overshoot, glow, particle, sound, or haptic loop.
- Keep vertical scroll available until horizontal intent exceeds the existing gesture gate.
- For `prefers-reduced-motion: reduce`, remove rotation and shorten the transition.

### Step 4: Preserve all product states

Restyle, but do not remove:

- first-time direction setup;
- resume import;
- loading skeleton;
- cached-data warning;
- empty state caused by strict filters;
- generic empty state;
- fatal load error;
- free fixed snapshot and member dynamic snapshot boundaries.

The onboarding can retain its current hero image, but it must lead clearly to the Match identity and not resemble a website landing page.

### Step 5: Add or update analytics

Preserve existing event names. Add properties where useful:

```ts
trackMiniEvent('mini_match_card_view', {
  snapshot_id: watch.snapshotId,
  entity_id: company.companyId,
  card_index: index,
  presentation_version: 'immersive_v2'
})
```

Apply `presentation_version` to deck view, card view, swipe, company open, job open, and follow click where the existing analytics API accepts extra properties.

Add `mini_match_score_open` with `entity_id`, `card_index`, `score_band`, `score_confidence_band`, and `presentation_version`. Do not send the user's raw personal settings in analytics.

## Task 6: Unify the Company Directory

**Files:**

- Modify: `miniprogram/src/pages/companies/index.tsx`
- Replace relevant sections: `miniprogram/src/pages/companies/index.scss`
- Modify if needed: `miniprogram/src/components/editorial-row/index.scss`
- Modify if needed: `miniprogram/src/components/company-follow-action/index.scss`

### Step 1: Keep the current information architecture

Preserve:

- page title and open-application subtitle;
- exact result count;
- search;
- horizontal industry filters;
- real company data;
- follow state synchronization;
- load more;
- free/member access boundary;
- match-required state.

### Step 2: Rebuild the list as light, consistent company cards

- Keep individual cards so each company remains a clear tap target, but remove the current thick, blunt dossier styling.
- Card gap: 20–24rpx; radius: 24rpx / 12px equivalent.
- Each card uses either a 1px neutral border or a very light shadow, never both.
- Card height target: 224–264rpx depending on content, with stable alignment.
- Logo target: 96–112rpx, 20rpx radius.
- Copy order: name; industry + employee count; headquarters + sourced rating; specific open-role summary.
- Open-role summary prefers `产品、前端可申请`; use `产品岗位可申请` for one known direction and the official-site fallback only when no role labels are available.
- Open-role summary uses success/active text color but not a filled badge.
- Compact follow control is 88rpx minimum touch height and visually secondary to the row.
- Missing headquarters or rating collapses cleanly; never render `待补充`, `暂无评分`, or invented stars.

### Step 3: Refine tools

- Search height: 96rpx, radius 20rpx, 1px neutral border.
- Filter chip radius: 16rpx or 8px; active chip uses ink background.
- Keep horizontal scrolling and avoid clipping the last visible chip.
- Do not add a sticky filter mask, blur, or gradient edge.

### Step 4: Handle long names and localization

- Names such as `BaymardInstitute` must not collide with the follow control.
- Use a minmax grid or flex item with `min-width: 0` and ellipsis on normal screens.
- At narrow widths, allow the name to wrap to two lines while preserving row and button alignment.
- Chinese and English metadata use the same baseline and spacing rhythm.

## Task 7: Cross-page Consistency and UX Copy Pass

**Files:**

- Modify only shared surfaces needed by Match/Companies: `miniprogram/src/components/editorial-top-bar/*`, `miniprogram/src/components/editorial-search/*`, `miniprogram/src/components/topic-scroller/*`, `miniprogram/src/components/company-follow-action/*`
- Verify: `miniprogram/src/pages/company-detail/*`
- Verify: `miniprogram/src/pages/growth/*`

### Step 1: Apply the same primitives

Check that Match, Companies, company detail, and Notes share:

- top bar height and border;
- page background;
- ink/secondary/muted text colors;
- 10px control radius and 12px standard surface radius;
- icon stroke weight;
- 44px logical minimum touch target;
- consistent follow state colors.

Do not redesign unrelated membership, account, or consultation pages in this task unless a shared token causes a direct regression.

### Step 2: Remove low-value copy

Replace or remove:

- `为什么推荐给你` as a visible heading;
- `持续核验` as a large badge;
- persistent gesture instructions after onboarding;
- repeated `岗位动态 / 微信提醒 / 查看详情` action labels inside one card;
- AI-like explanation paragraphs that repeat the evidence rows.
- generic `多个岗位开放申请中` whenever one or more concrete role directions are available.

Keep copy concise, concrete, and based on available data.

### Step 3: Verify user control

- The user can adjust direction from the Match header.
- Follow is reversible and confirms unfollow.
- Reminder permission failure never rolls back follow.
- The score ring opens an explanation sheet; it never changes follow, ranking, or card position.
- Card swipe does not mutate business state.
- Back navigation returns to the prior primary surface without forcing Match.

## Task 8: Verification and Visual QA

**Files:**

- Update after implementation: `docs/haigoo-mini-design-system.md` only if actual accepted tokens differ
- Keep reference: `artifacts/miniprogram-match-v2-reference/match-v2-1-reference.png`

### Step 1: Run automated checks

```bash
npm run test:mini-match-v2
npm run test:mini-match-follow-loop
npm run test:mini-design
npm run test:mini-company-match
npm run test:mini-career-watch
npm run test:mini-release
npm run type-check
npm --prefix miniprogram run type-check
npm --prefix miniprogram run build:weapp
```

### Step 2: WeChat viewport matrix

Capture and compare at the same viewport against the reference:

| Viewport | Match feed | Company list | Required checks |
|---|---|---|---|
| 320px logical width | yes | yes | long names, card fit, no text/button collision |
| 375px | yes | yes | primary reference composition |
| 390px | yes | yes | iPhone 12/13-class safe area |
| 430px | yes | yes | no excessive whitespace or stretched card |

For each viewport inspect:

- top bar and native capsule clearance;
- card stack framing;
- card content truncation;
- follow and job touch targets;
- score ring readability and score-breakdown sheet hierarchy;
- Tab surface and safe-area fill;
- last scrolling content not hidden behind Tab;
- company row alignment;
- rating source, headquarters omission and specific open-role summaries;
- loading, empty, error, followed, and reminder states;
- reduced-motion behavior.

### Step 3: Interaction matrix

Verify on WeChat DevTools and at least one real device:

1. Short horizontal drag snaps back without changing index.
2. Drag beyond 25% changes one card and loops at both ends.
3. Vertical scrolling is not captured as a swipe.
4. Follow changes state without moving or opening the card.
5. Unfollow confirmation works and shared state updates Companies/Profile.
6. Job row opens the intended job.
7. Card body/footer opens company detail.
8. Reminder opt-in remains available after follow in the appropriate secondary surface.
9. Tab labels and icons remain visible above every safe area.
10. Score ring opens the correct breakdown, closes predictably, and does not trigger card navigation.
11. Low-confidence matches use a qualitative band and do not expose a fake precise number.

### Step 4: Release gate

Do not ship until:

- all automated checks pass;
- no legacy warm-dossier layout or copy remains in the active Match card;
- no 84px floating Match icon remains;
- no company list item uses the old thick border, oversized radius, or generic open-role copy;
- no prototype or invented company data appears;
- every numeric score has a visible breakdown and confidence gate;
- every visible rating has a source, missing headquarters is omitted, and role directions come from active openings;
- screenshots are reviewed side by side with the V2.1 reference at matching dimensions;
- product, platform, design-system, spec, plan, and implementation use the same Match-first positioning.

## Definition of Done

- The first viewport unmistakably presents Match as the Mini Program's primary identity.
- The user can understand why a company is shown in under five seconds without reading a generated paragraph.
- The user can inspect how the reference match score was calculated and understands that it is not a hiring probability.
- A Match card feels desirable enough to inspect while remaining credible and calm.
- The company list is faster to scan and visually belongs to the same product.
- The custom Tab is fully visible, safe-area-correct, and does not obscure content.
- Website and Mini Program positioning are no longer conflated in active documentation or UI copy.
