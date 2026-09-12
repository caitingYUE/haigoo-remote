# Design QA

final result: passed

## 2026-09-05 Match page — iPhone 12/13 Pro visual calibration

### Visual truth and reviewed state

- Source visual truth: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-fece220b-f5ba-40b5-bf65-7a747a7dfd93.png` (578 x 1210 px).
- Implementation screenshot: `/private/tmp/match-final-visual-578x1210.png` (578 x 1210 px), cropped from WeChat DevTools running the iPhone 12/13 Pro profile at 390 x 844 CSS px, DPR 3.
- Combined comparison: `/private/tmp/match-final-comparison.png` (1156 x 1210 px).
- State: authenticated free user, real Slasify recommendation at index 5 / 5, real Product Manager opportunity, unfollowed state.
- Density normalization: source and implementation were compared on equal 578 px-wide canvases. The source omits the iOS status-bar/notch region; app-owned content was aligned from the Haigoo navigation and section dividers rather than raw top-edge coordinates.

### Comparison result

- Fonts and typography: the page title, company name, score, recommendation, evidence rows, role card, and CTA now follow the source hierarchy. `91%` renders without truncation; the score column also has capacity for `100%`.
- Spacing and layout: the title, count, direction/settings row, update/member row, card, pagination, and TabBar form the same reading sequence. The active card uses a source-equivalent narrow proportion, complete one-screen presentation, balanced exterior space, and visible adjacent-card edges.
- Colors and tokens: existing Haigoo orange and neutral surfaces were retained as requested. The card uses a white surface, restrained shadow, subtle dividers, and a light role module without gradients or added decoration.
- Image and icon fidelity: the real company logo remains `aspectFit`; the existing icon library supplies settings, location, and navigation icons. No visual asset was fabricated.
- Copy and content: company, industry, location, score, description, evidence, role, and follow state remain API-driven. The real Slasify description occupies two lines and its missing rating row stays hidden, so the card is slightly taller internally than the fully populated Kraken mock.
- Interaction preservation: the previous, active, and next cards remain mounted. Their horizontal positions now use one card width plus a 12 px gap, so adjacent cards follow the finger continuously. Card tap still opens company detail; job and follow controls stop propagation and retain their existing actions.

### Comparison history

- Pass 1 established the three-row header, full-height card composition, large score treatment, narrow card width, exposed neighbors, and continuous deck geometry. The score was clipped and the card was visibly too tall.
- Pass 2 widened the score column, bounded the card height, and tightened the header. The score rendered fully, but Logo/name scale and the rpx height conversion still exceeded the source.
- Pass 3 set the Logo to 80 rpx, company name to 42 rpx, and card maximum height to 912 rpx. The final equal-width comparison has no actionable P0/P1/P2 mismatch after accounting for the source's omitted system status region and different real-data content.

### Verification

- `cd miniprogram && npm run type-check` passed.
- `cd miniprogram && npm run build:weapp` passed with the existing three CSS ordering warnings.
- `npm run test:mini-career` passed.
- `npm run test:mini-career-watch` passed.
- Impeccable layout detection returned no findings.
- `git diff --check` passed.
- Two legacy source-assertion tests remain stale: `test:mini-match-follow-loop` inspects an unused older release-threshold utility, while `test:mini-match-v2` requires `REMOTEMATCH` and the previously removed `为什么推荐给你` block. The implementation was not regressed to satisfy those obsolete assertions.

Final result: passed

## 2026-09-03 Company directory content — compact three-line cards

### Visual truth and reviewed state

- Source visual truth: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-63d92fdc-b2d5-42a8-8eb0-dc5cba61310f.png`.
- Implementation screenshot: `/private/tmp/haigoo-companies-content-final.png`.
- Target viewport: WeChat DevTools iPhone 12/13 Pro, 390 x 844 CSS px, DPR 3.
- The source and implementation were inspected together in one comparison input. Existing Haigoo navigation and TabBar were intentionally excluded from source matching and left unchanged.

### Comparison result

- Search measures 358 x 45 CSS px, equivalent to the requested 32 rpx page margins and approximately 88 rpx height. Filter chips measure 33 CSS px high and remain horizontally scrollable.
- Cards measure 358 x 81 CSS px, equivalent to approximately 162 rpx high, with 16 rpx vertical gaps, 24 rpx radius, fine border, and no heavy shadow. The final viewport shows five complete cards plus the top of a sixth.
- Card hierarchy is fixed to three rows: name plus real rating, industry plus company size, then headquarters plus application directions. Long values are single-line ellipsized before the 45 x 45 CSS px (90 rpx) follow hit area.
- The directory response's real public-title field is used when present. Where that deployed response omits titles, the page reads the existing authorized company-detail endpoint and deduplicates its real translated/original titles through the shared role classifier. Empty detail results display `暂无可申请岗位`; no company-specific direction copy is hardcoded.
- Real Buffer titles resolve to `设计、市场等可申请` in the captured state. Existing follow state, search/filter behavior, card navigation, routes, APIs, top navigation, and TabBar behavior remain unchanged.

### Verification

- `cd miniprogram && npm run type-check` passed.
- `cd miniprogram && npm run build:weapp` passed with the existing three CSS ordering warnings.
- `git diff --check` passed for the Companies page files.

## 2026-09-03 Company directory — search, filters, and list refinement

### Visual truth and reviewed state

- Source visual truth: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-4ad57156-d8a1-4954-9980-dd6cd8eb9ffb.png` (636 x 1274, including its reference device frame).
- Implementation screenshot: `/private/tmp/haigoo-companies-final.png` (610 x 1318 simulator capture).
- Target viewport: WeChat DevTools iPhone 12/13 Pro, 390 x 844 CSS px, DPR 3.
- State: real free directory with 12 available companies, default industry filter, real follow states, and the existing Haigoo navigation and TabBar.
- Density normalization: comparison aligned the app-owned content by viewport width. The reference-only phone frame and the intentionally retained product navigation were excluded from geometric comparison.

### Findings

- No actionable P0/P1/P2 findings remain after the final combined comparison.
- Fonts and typography: title treatment remains the approved product version; search copy, filter labels, company names, metadata, facts, and role counts reproduce the reference hierarchy without unintended wrapping.
- Spacing and layout: the 350 x 45 CSS px search field, 33 CSS px filter chips, 350 x 99 CSS px company cards, 47 CSS px logos, and 37 CSS px follow controls form the same compact rhythm as the source. The native TabBar remains unobstructed.
- Colors and tokens: white cards, pale-gray page/search surfaces, fine neutral borders, dark active filter, and restrained orange action accents match the source direction without gradients or heavy shadows.
- Image and icon fidelity: real API logos remain `aspectFit`; missing logos retain the existing initial fallback. The existing MiniIcon plus/check glyphs replace the former labeled follow button without changing follow behavior.
- Copy and content: title/subtitle, company order, industries, employee counts, addresses, Glassdoor ratings, role counts, pagination, and follow state remain API-driven. The count now follows the required `免费版X家` / `会员版X家` format.

### Comparison history

- Pass 1 established the search, filter, card, and compact follow-control treatment. The count still contained extra spaces, and the 78 CSS px cards were materially denser than the source.
- Pass 2 removed the count spacing and increased cards to 99 CSS px while keeping their logo and control sizes stable. The final source/implementation comparison shows aligned card proportions and list rhythm.

### Interaction and runtime verification

- Existing search submit, horizontal category selection, company-detail navigation, pagination, membership boundary, follow/unfollow state, and TabBar handlers remain wired to their original real-data flows.
- WeChat DevTools current-page inspection confirmed `/pages/companies/index`; the console error filter returned no matches.
- `cd miniprogram && npm run type-check` passed.
- `cd miniprogram && npm run build:weapp` passed with the existing three CSS ordering warnings.

### Focused-region decision

The final full-view capture keeps the search field, filter states, company metadata, follow controls, borders, and truncation readable. Runtime element-size checks provided the focused geometry evidence, so a separate raster crop was unnecessary.

## 2026-09-03 Company detail — visual-reference rebuild

### Visual truth and reviewed state

- Source visual truth: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-08bc1aaa-9f1b-42ba-aff3-2a82ab1707d3.png` (650 x 1246), `codex-clipboard-a98be365-4df5-4835-8721-7d6da5c8070b.png` (670 x 1266), and `codex-clipboard-c0050503-eb9a-4df9-a606-0041b2885446.png` (646 x 1264).
- Implementation evidence: `/private/tmp/haigoo-company-detail-final.jpg` (592 x 1280 simulator capture) and clean DevTools window crop `/private/tmp/haigoo-company-detail-final.png` (272 x 598).
- Target viewport: WeChat DevTools iPhone 12/13 Pro, 390 x 844 CSS px, DPR 3.
- State: authenticated company directory, real Buffer company response, overview selected; jobs and culture states were also activated and inspected.
- Density normalization: the references include device frames while the implementation evidence is the app viewport. Comparison aligned the app-owned summary, tab bar, content cards, and fixed action bar by normalized screen width.

### Findings

- No actionable P0/P1/P2 findings remain after the final combined comparison.
- Typography: company identity, metric values, tab labels, card headings, job titles, metadata, and fixed actions follow the reference hierarchy without unintended wrapping.
- Spacing and layout: the identity area, four equal metric cards, three-tab navigation, card widths, content rhythm, and safe-area footer reproduce the reference composition. The page scrolls naturally when the real content is longer.
- Colors and tokens: the restrained white/light-gray surfaces, fine borders, orange active state, neutral copy, and black website action match the selected visual direction without gradients or heavy shadows.
- Image and icon fidelity: the real API logo is retained with `aspectFit`; existing NutUI-backed MiniIcon glyphs are reused for metrics, location, jobs, and gated content.
- Copy and content: all company, rating, employee, founding, address, job, contact, culture, and entitlement content remains API-driven. Buffer has no rating or contact record in the reviewed response, so the UI truthfully shows an empty rating marker and omits the reference-only gated contact card instead of inventing data.

### Comparison history

- Pass 1 established the summary, metrics, tabs, focused content panels, job list, culture facts, and fixed actions. The employee value repeated the unit from the source string and truncated inside its metric card.
- Pass 2 removed only the redundant trailing employee unit for presentation. The final screenshot shows `51–200` centered without truncation while preserving the source value everywhere else.

### Interaction and runtime verification

- Overview, jobs, and culture tabs were activated in WeChat DevTools. The jobs state rendered all three real jobs, and the culture state rendered the real company scale, founding year, location, and remote-work tags.
- Existing subscription, official-link copy, job navigation, membership upgrade, native back behavior, and access conditions remain wired to their original handlers.
- WeChat DevTools console error filter returned no matches.
- `cd miniprogram && npm run type-check` passed.
- `cd miniprogram && npm run build:weapp` passed with the existing three CSS ordering warnings.
- `git diff --check` passed for the company-detail page files.

## 2026-09-03 Membership plans — monthly and half-year natural-height refinement

### Visual truth and reviewed states

- Reference captures: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-87953d1a-65de-4b99-8a90-f76f79c8baf6.png` and `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-78ae59ef-d8c9-453d-96f1-7dca401bf74e.png`.
- Implementation captures: `/private/tmp/haigoo-membership-monthly-final.png` and `/private/tmp/haigoo-membership-halfyear-final.png`, cropped directly from the same WeChat DevTools simulator window.
- Target viewport: iPhone 12/13 Pro, 390 x 844 CSS px, DPR 3.
- Reviewed states: real monthly membership selected with dynamic renewal CTA; real half-year plan selected with dynamic purchase CTA.
- Overlay method: reference device frames were removed, then app-owned content was width-normalized and aligned at the hero title baseline and shared content frame. Monthly copy/count differences were excluded from geometry scoring because the reference shows a different selected plan.

### Findings

- No actionable P0/P1/P2 findings remain after the normalized overlays.
- The hero label is removed; the white hero, two-line light-weight heading, subtitle, tags, and light-gray plan zone follow the reference hierarchy.
- Hero, plan grid, benefit card, and fixed CTA share the normalized reference content frame; the principal left/right boundaries and baselines are within the requested 4 CSS px tolerance.
- Plan cards are equal width and height. The selected card uses the brand-orange surface, while quarter and half-year badges read `省¥99` and `全部权益` without the former recommendation label.
- Monthly pricing is isolated at each card bottom. API prices and benefits remain intact; original-price anchors and monthly prices retain the existing approved calculations.
- Benefit rows use the requested 112rpx height, 40rpx horizontal padding, and 1rpx dividers. The three-item monthly card ends naturally, while the five-item half-year card grows naturally and remains scrollable above the fixed purchase bar.
- The purchase bar preserves dynamic open/renew wording, non-auto-renewal copy, and the iPhone bottom safe area.

### Verification

- WeChat DevTools accessibility output confirmed `续费月度会员 · ¥99` for the monthly state and `开通半年会员 · ¥699` for the half-year state.
- WeChat DevTools console error filter returned no matches.
- `cd miniprogram && npm run type-check` passed.
- `cd miniprogram && npm run build:weapp` passed with the existing three CSS ordering warnings.
- `git diff --check` passed for the membership page files.

## 2026-09-03 Membership plans — reference structure alignment

### Visual truth and state

- Source visual truth: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-816407d4-bf7e-420d-9d4b-dbad4b676430.png` (722 x 1254, including the reference device frame).
- Implementation screenshot: `/private/tmp/haigoo-membership-structure-final.jpg` (592 x 1280 optimized WeChat simulator capture).
- Target viewport: WeChat DevTools iPhone 12/13 Pro, 390 x 844 CSS px, DPR 3.
- State: signed-in user, real half-year plan selected, purchase available.
- Density normalization: comparison used app-owned content proportions because the source contains a device frame and the implementation is an optimized simulator-only capture.

### Findings

- No actionable P0/P1/P2 findings remain after the final combined comparison.
- Typography: price, crossed-out original price, monthly price, saving amount, plan label, benefit titles, and CTA follow the reference hierarchy without truncation.
- Spacing and layout: the three plan cards are equal height, the selected half-year plan uses the full brand-orange surface, all five real half-year benefits form a compact list, and the fixed purchase area has no intervening blank block.
- Colors and tokens: white default cards, black compact plan badges, orange selected card and CTA, and restrained neutral dividers match the selected reference direction.
- Image and icon fidelity: there are no app-specific raster assets in this surface; the existing MiniIcon check glyph is reused for benefit rows.
- Copy and content: prices and benefit titles are sourced from the existing plan response. Original-price anchors follow the approved reference values; monthly price and saving amounts are calculated from the active price. Only real quota-bearing half-year benefits receive the `赠品` label.

### Comparison history

- Pass 1 aligned cards, benefits, and purchase bar, but the API's `featured` flag did not render a recommendation badge in the simulator state.
- Pass 2 keyed the recommendation badge to the real quarter member type, restored the half-year `全部权益` badge, and confirmed both badges in the final screenshot. No P0/P1/P2 mismatch remains in the requested structure.

### Interaction and runtime verification

- Selecting the quarter plan updates the fixed purchase area to `开通季度会员 · ¥199` and `约 ¥66/月 · 到期不自动续费`; relaunch restores the half-year default state.
- The fixed purchase bar remains above the iPhone safe area and the page reserves its height below the benefit list.
- WeChat DevTools console error filter returned no matches.
- `cd miniprogram && npm run type-check` passed.
- `cd miniprogram && npm run build:weapp` passed with the existing three CSS ordering warnings.
- `git diff --check` passed for the membership page files.

### Focused-region decision

The full-view comparison keeps all plan pricing metadata, gift tags, benefit titles, and purchase copy legible, so a separate crop was not necessary for this structural pass.

## 2026-09-03 Membership plans — editorial composition rebuild

### Visual truth and state

- Scope: membership value, plan selection, benefit presentation, and fixed purchase bar only. Existing navigation, prices, entitlement arrays, availability rules, and payment flow were retained.
- Source visual truth: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-cee89262-8a47-43a9-bc34-3c4597bfae4f.png` (650 x 1252, including a reference phone frame).
- Implementation screenshot: `/private/tmp/haigoo-membership-final.jpg` (554 x 1200 optimized simulator capture).
- Target viewport: WeChat DevTools iPhone 12/13 Pro, 390 x 844 CSS px, DPR 3.
- State: authenticated user, quarterly plan selected, purchase available; fixed bar reads `季度会员 ¥199 · 3 个月 立即开通`.
- Density normalization: the reference includes an outer device frame while the implementation capture is the simulator screen. Comparison therefore aligned app-owned content proportions and section order instead of using raw pixel equality.

### Findings

- No actionable P0/P1/P2 findings remain.
- Typography: the two-line value statement, plan prices, benefit titles, descriptions, and purchase summary form a clear hierarchy with readable Chinese optical weights and no truncation in the reviewed state.
- Spacing and layout: three plans are equal height; the selected plan uses an orange border, small check marker, and restrained elevation. The benefit card expands into available vertical space, removing the previous lower-page void while leaving the fixed purchase bar unobstructed.
- Colors and tokens: the page uses white, warm gray, ink, and the existing orange action color. There is no gradient, illustrative filler, or excessive shadow.
- Image and icon fidelity: the page contains no source imagery to reproduce; existing library check icons are used consistently for selection and benefit rows.
- Copy and content: API-provided prices, durations, descriptions, and entitlement titles remain unchanged. Added benefit subtitles explain the existing entitlement text without changing availability or quota.

### Comparison history

- Pass 1 established the editorial hierarchy and corrected the selected-card treatment, but the three-item quarterly plan still left a visibly loose region above the fixed purchase bar.
- Pass 2 made the page and benefit section a flex composition so the benefit rows absorb only the available residual height. The final combined source-and-implementation comparison shows a continuous value → plans → benefits → purchase sequence without a dominant blank block.

### Interaction and runtime verification

- Selecting the quarterly card updates both the benefits and fixed purchase summary to `季度会员 ¥199 · 3 个月` while preserving the existing purchase action.
- The purchase bar remains above the home indicator and the page reserves bottom safe-area space, so the bar does not cover benefits or secondary actions.
- WeChat DevTools reported 0 application errors; only existing base-library deprecation/preload warnings remain.
- `cd miniprogram && npm run type-check` passed.
- `cd miniprogram && npm run build:weapp` passed with the existing three CSS ordering warnings.
- `git diff --check` passed for the membership page files.

### Focused-region decision

The optimized simulator capture keeps plan prices, check markers, benefit titles/descriptions, and the purchase summary readable at full-view scale, so a separate focused crop was not needed.

## 2026-09-03 Match company card — real-data detail refinement

### Scope and visual truth

- Scope: Match company-card data presentation and its internal spacing only. Top navigation, TabBar, carousel behavior, follow behavior, and other pages were not changed.
- Target device: WeChat DevTools iPhone 12/13 Pro, 390 x 844, DPR 3.
- Visual source: supplied reference `codex-clipboard-d02d9f9a-a5b2-41dc-b718-c451ef52a337.png`.
- Implementation capture: `/private/tmp/haigoo-match-data-final.jpg`.
- The source and implementation captures were inspected together in one visual comparison input.

### Comparison result

- Company location now appears beneath the industry when the existing company record contains an address. The active Eigen AI card displayed `总部 · 硅谷，美国`; the adjacent real Kraken record exposed `总部 · Remote First， US` and rating `4.1` in the rendered accessibility tree.
- The score circle keeps the existing score data while matching the reference more closely through lighter numeral weight, tighter tracking, and increased score/label separation.
- The identity block now has deliberate space after the industry/location facts before the divider.
- The role title is sourced from the real public job-history relation and selects the translated title first, falling back to the original title. No role fixture or synthetic publication date was added.
- The unfollowed Match-card action uses the existing icon system's `plus` glyph. The captured active company was already followed, so the screenshot correctly shows the followed state; the unfollowed state is covered by the focused source assertion.
- The time label is now `发布于` and accepts only the real latest job `source_published_at` value. It intentionally disappears when that field is absent instead of relabeling crawl, verification, or update time as publication time.

### Blocker

The current WeChat DevTools session is connected to the already-deployed development service, whose career-watch response does not yet include the newly added `publishedAt` field. The local service implementation and read-only database integration check return the real latest publication time, but the final DevTools screenshot cannot display or visually verify `发布于` until that development service is deployed. Deployment was not requested, so it was not performed.

### Verification

- `npm run test:mini-career-watch` passed.
- Root `npm run type-check` passed.
- `cd miniprogram && npm run type-check` passed.
- `cd miniprogram && npm run build:weapp` passed with the existing three CSS ordering warnings.
- Final DevTools console showed 0 errors; existing base-library deprecation and preload warnings remain.
- `git diff --check` passed before this QA record update.

## 2026-09-03 Match page and company card — Figma source correction

### Scope and visual truth

- Scope: Match results header, carousel deck, and company card only. Existing top navigation, bottom TabBar, real data, and business actions were retained.
- Target device: WeChat DevTools iPhone 12/13 Pro, 390 x 844, DPR 3.
- Figma Make source: file `GWvL94MvgSTAA0827B5WGg`, `MatchScreen.tsx`; supplied visual reference `codex-clipboard-dddf752b-7bca-4699-a5a2-f84dd06eb6e9.png`.
- Implementation capture: `/private/tmp/haigoo-match-figma-final.jpg` (DevTools displayed at 78% on a Retina desktop, so comparison used normalized screen proportions and app-owned content regions rather than raw pixel equality).
- State: authenticated Match feed, real Kraken company at carousel index 3 / 5, unfollowed state visible.

### Comparison and iteration history

- Pass 1 removed the oversized page/card void, but the sparse real-data state still concentrated free space between the role and verification rows, and the card radius was visibly tighter than the source.
- Pass 2 grouped recommendation, role, and verification into one flexible region, distributed residual height across its three meaningful blocks, and corrected the card to the source-equivalent 22 px radius after viewport scaling.
- The final source-and-implementation comparison was performed in one visual input. The final layout matches the reference direction: clear identity/reason/role/time/action hierarchy, a single immersive card, slight previous/next edges, no clipped neighboring score ring, a full-width primary follow control, and no blank success/scroll region beneath the deck.
- Product-specific differences are intentional: the native Haigoo top navigation and three-item TabBar remain, and only fields present in the live company data are displayed.

### Interaction and runtime verification

- Existing horizontal carousel, real company data, follow behavior, and TabBar implementation were left unchanged.
- The `编辑` action is vertically centered across the complete preference row and remains within the rounded container.
- The feed now owns exactly the remaining viewport height through a single flex chain; card deck and metadata cannot extend the document and expose a lower blank block when scrolling.
- Full-screen and focused-card checks confirmed readable copy, visible role/time/detail controls, and complete side-card slivers without neighboring card content leaking into view.
- Final DevTools console showed no application errors; only existing base-library deprecation/preload warnings remained.
- `cd miniprogram && npm run type-check` passed.
- `cd miniprogram && npm run build:weapp` passed with the existing three CSS ordering warnings.
- `git diff --check` passed.

## Previous QA record

previous result: blocked

## Scope

- Batch 1: onboarding/start screen and companies list.
- Batch 2: profile center and membership plans.
- Target device: WeChat DevTools iPhone 12/13 Pro, 390 x 844, DPR 3.
- Source: Figma Make file `GWvL94MvgSTAA0827B5WGg`, 402 x 874 content frame.

## Source Evidence

- The Figma Make source code and component hierarchy were read through the Figma design context API.
- Exact layout, type, spacing, colors, radii, image URL, and component order were extracted for `OnboardingScreen.tsx` and `CompaniesScreen.tsx`.
- The source hero asset is the Unsplash image referenced by `OnboardingScreen.tsx`; the local asset was replaced with that exact image request.
- Figma Make does not support the Figma `get_screenshot` API. The generated preview URL was accessible to browser automation, but direct Chrome rendering later returned `Error proxying request to container`, so a stable source PNG could not be captured for the required combined comparison.

## Implementation Evidence

- Companies baseline: `artifacts/figma-secondary-pages-2026-09-02/companies-before.png`
- Companies pass 1: `artifacts/figma-secondary-pages-2026-09-02/companies-pass-1.png`
- Companies pass 2: `artifacts/figma-secondary-pages-2026-09-02/companies-after.png`
- Onboarding source image: `artifacts/figma-secondary-pages-2026-09-02/onboarding-source-image.png`
- Profile baseline: `artifacts/figma-secondary-pages-2026-09-02/profile-before.png`
- Profile final: `artifacts/figma-secondary-pages-2026-09-02/profile-after.png`
- Membership final: `artifacts/figma-secondary-pages-2026-09-02/membership-after.png`
- Batch 2 source implementation was read directly from Figma Make `ProfileScreen.tsx` and `MembershipScreen.tsx`.

All final screenshots were captured from the same WeChat DevTools iPhone 12/13 Pro device profile. The simulator screenshot command returns the full device image, so system status/navigation/safe-area pixels remain explicitly treated as platform regions rather than product content pixels.

## Comparison History

### Companies Pass 1

Largest issues:

1. Card height remained about 20 px taller than the Figma list row.
2. Follow buttons were wider than the Figma control.
3. The custom WeChat navigation region consumed vertical space not present in the Figma content frame.

Fixes:

- Reduced card vertical padding.
- Reduced follow control width while preserving its label and state.
- Kept the custom navigation as a separate platform region rather than changing product navigation.

### Companies Pass 2

- The visible list density increased from about four cards to six cards in the same viewport.
- Company copy, company order, open-role counts, follow states, and navigation remained unchanged.
- No further high-risk visual restructuring was made without a stable source PNG.

### Onboarding

- Replaced the old neon keyboard image with the exact Figma-referenced remote-work photo.
- Changed the hero from capped 40vh to 46vh.
- Matched the Figma content padding, title scale/weight, feature spacing, check container, primary CTA height/radius, and brand mark.
- Preserved the product's current copy and resume-upload interaction as required.

### Profile and membership

- Matched the profile surface to the source treatment with a neutral page background, 58 px avatar scale, three-column-capable stat styling, black membership card, grouped white menu surfaces, 14 px source-equivalent radii, and Figma gray borders.
- Kept the real profile data contract and current two-stat data shape; no synthetic stat or menu item was added.
- Matched the membership selected-plan state to Figma's orange fill and white text, removed the extra visible selection glyph, and aligned plan spacing, benefit rows, neutral borders, and the fixed purchase region.
- Preserved real plan data, payment availability checks, purchase confirmation, membership renewal behavior, consultation navigation, and order navigation.

## Blocker

The required side-by-side, 50% overlay, and pixel-difference comparison cannot be completed honestly because the Figma Make source frame could not be exported as a stable image. Final implementation screenshots are now available; only the source PNG and therefore the computed overlay/diff evidence remain unavailable. The earlier blank simulator state was recovered and is no longer an active blocker.

The three remaining comparison constraints are recorded separately: system status/navigation/safe-area pixels are excluded from the Figma content frame; profile keeps the current two-stat real-data contract instead of inventing the source's third stat; membership keeps the current real plan/benefit/payment data instead of replacing it with source-only reviews or copy.

## Verification

- `cd miniprogram && npm run build:weapp` passed; existing CSS order and asset-size warnings remain.
- `cd miniprogram && npm run type-check` passed.
- `git diff --check -- miniprogram/src/pages/profile/index.scss miniprogram/src/pages/membership/index.scss design-qa.md` passed.

## 2026-09-04 Match company card — vertical identity and evidence layout

### Scope and evidence

- Source visual: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-0b9d95f1-ea2b-494e-aae0-11629cb3903d.png` (375 x 824 px).
- Implementation capture: `artifacts/match-card-visual-qa-2026-09-04/match-card-after.png` (273 x 584 px), captured from WeChat DevTools with the iPhone 12/13 Pro simulator displayed at 78%.
- Combined comparison: `artifacts/match-card-visual-qa-2026-09-04/match-card-comparison.png` (774 x 824 px). Both app surfaces were width-normalized to 375 px and placed in the same image for visual judgment.
- Reviewed state: real Appwrite recommendation, score 85, unfollowed, one real public opportunity. The current server data has no valid company rating or remote-culture signal for this record, so those missing evidence rows are intentionally absent.

### Full-view and focused comparison

- The full simulator crop keeps the page header, preference row, active card, pagination, and TabBar visible, confirming that the requested exterior regions did not move.
- The card itself is the focused comparison region. Its identity is now Logo → company name → industry/location in the left column, while the dynamic `85% / 匹配度` block is independently aligned at the upper-right.
- The Chinese quoted description precedes the divider. The evidence rows follow the divider, and the job module follows the available evidence without placeholders or a flexible spacer.
- The job module is directly followed by the existing follow action and company-detail link. There is no internal blank region over 80rpx.

### Findings

- No actionable P0/P1/P2 visual issue remains in the requested card-internal scope.
- The implementation uses real API-backed company, role, score, rating, location, timezone, salary, and follow-state inputs. Missing evidence is hidden instead of filled with synthetic values.
- Logo assets use the existing image URL with `aspectFit` inside a white, padded, bordered square. The initial fallback renders only when no logo URL exists.
- Long company names and industry/location metadata use single-line ellipsis inside `minmax(0, 1fr)`. Job titles use a two-line clamp. Missing ratings remove only the rating row; missing jobs remove the complete job region.
- The source mock shows all three evidence rows, while the real Appwrite state shows one. This is an intentional data-state difference required by the no-fabrication and hide-missing rules, not a visual defect.
- The source mock's English `ACCURACY` label and compact action are intentionally not copied: the accepted specification requires `匹配度`, and freezes the existing follow and company-detail actions.

### Comparison history

- Pass 1 removed the old horizontal identity row, score ring, recommendation heading, orange tag cluster, pink job icon, and `flex: 1` spacer. It established the required vertical identity, description-first order, conditional evidence rows, and light-gray job module.
- Pass 2 checked the built result in WeChat DevTools at the reference device profile. The full location remained readable, the card collapsed naturally around sparse evidence, and no follow-action or exterior-page regression appeared.

### Verification

- `node test-mini-company-match.js` passed.
- `npm run test:mini-career-watch` passed after its obsolete `发布于` card assertion was updated to the accepted job-module structure.
- `npm run type-check` passed.
- `node --check lib/services/career-watch-service.js` passed.
- `npm --prefix miniprogram run build:weapp` passed with the three pre-existing CSS ordering warnings.
- Impeccable layout detection returned no findings for the changed component styles.
- `git diff --check` passed for the scoped implementation and test files.

Final result: passed
