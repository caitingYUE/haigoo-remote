# Design QA: 英语面试连续横向轨道

- Source visual truth: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-855d1cde-e670-4483-8e67-385f6acd7b27.png`
- Initial implementation screenshot: `/private/tmp/haigoo-english-interview-continuous-initial.png`
- Scrolled-state screenshot: `/private/tmp/haigoo-english-interview-continuous-scrolled.png`
- Mobile screenshot: `/private/tmp/haigoo-english-interview-continuous-mobile.png`
- Combined comparison evidence: `/private/tmp/haigoo-english-interview-continuous-comparison.png`
- Viewports: desktop 2048 × 1058; mobile 390 × 844
- State: authenticated Club member, 英语面试「全部」分类

## Findings

- No actionable P0/P1/P2 findings remain.
- The desktop initial state preserves the intended composition: one large card occupies the left two-row column and four compact cards form two rows on the right.
- The featured card and supporting cards share one continuous horizontal track. Pointer dragging changed the rail from `scrollLeft = 0` to `scrollLeft = 400`, confirming that the full composition moves together.
- English interview previous/next buttons and page counters are absent on desktop and mobile.

## Required Fidelity Surfaces

- Fonts and typography: Existing Haigoo typography, hierarchy, truncation, and line heights are preserved.
- Spacing and layout rhythm: The desktop rail uses a 24 px gap, a half-width featured column, and two compact supporting columns visible initially; additional columns continue horizontally without increasing the section height.
- Colors and visual tokens: Existing white surfaces, blue-gray borders, purple filters, green Club pills, radii, and shadows are unchanged.
- Image quality and asset fidelity: Existing video covers and object-fit behavior are retained without generated or stretched replacements.
- Copy and content: Titles, descriptions, categories, dates, access states, filters, links, and tracking hooks remain unchanged.

## Full-view Comparison Evidence

The combined comparison places the supplied source state above the rendered implementation. The implementation preserves the source composition while removing the right-side paging controls requested in the latest interaction specification.

## Focused Region Comparison Evidence

The source image and implementation screenshots both show the complete English interview module at readable desktop scale, so no additional crop was required.

## Interaction and Responsive Checks

- Desktop pointer drag moved the rail continuously from 0 to 400 px; the URL remained `/careerlearning`, confirming drag-click suppression.
- All English interview cards participate in the same scroll container; the first card is no longer fixed.
- Exact button queries for `上一页英语面试` and `下一页英语面试` returned zero on desktop and mobile.
- Mobile document width equals viewport width (390 px), with no horizontal page overflow.
- Browser console returned zero errors after a clean reload and data load.
- ESLint, TypeScript type checking, production build, and `git diff --check` all pass.

## Comparison History

1. P1: The first featured card remained fixed while only the supporting grid paged.
   - Fix: Moved the featured card and all supporting cards into one continuous horizontal scroll container.
   - Post-fix evidence: Pointer drag moves the complete track and exposes later columns while the featured card exits the viewport.
2. P2: The right-side previous/next controls and page indicator added visual noise and implied discrete paging.
   - Fix: Removed those controls and the page counter; desktop now uses direct drag/touch/wheel scrolling.
3. P2: Straight column-flow ordering placed the third item in the top row before the second item.
   - Fix: Preserved row-major content order while rendering through the two-row CSS grid.
4. P2: The responsive fallback still displayed English-specific paging controls.
   - Fix: Removed English interview paging controls from non-featured breakpoints as well, while retaining swipe/drag navigation.

## Implementation Checklist

- [x] Keep the initial left-large/right-two-row composition.
- [x] Move the entire module as one continuous horizontal track.
- [x] Remove the right-side paging buttons and page number.
- [x] Preserve filters, links, analytics, membership badges, and video content.
- [x] Verify desktop dragging, mobile layout, console output, type checking, linting, and production build.

final result: passed

---

# Design QA: 统一配色与现代化精修（2026-08-13）

- User reference: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-20e6e48e-d47c-4ad6-8dab-cbfba4ee48f7.png`
- Baseline: `artifacts/palette-unification-2026-08-13/01-before-jobs-desktop.png`
- Final jobs desktop: `artifacts/palette-unification-2026-08-13/12-final-jobs-desktop.png`
- Before/after comparison: `artifacts/palette-unification-2026-08-13/11-before-after-jobs.png`
- Homepage desktop: `artifacts/palette-unification-2026-08-13/06-home-desktop.png`
- Jobs mobile: `artifacts/palette-unification-2026-08-13/09-jobs-mobile.png`
- Homepage mobile: `artifacts/palette-unification-2026-08-13/10-home-mobile.png`
- Standards review: `artifacts/palette-unification-2026-08-13/web-interface-guidelines-review.md`
- Viewports: desktop 1440 × 1000; mobile 390 × 844
- State: local guest preview with real development job data; membership visuals additionally verified in source and semantic tokens.

## Design Read

- Surface: Operate / product workspace.
- Direction: contemporary editorial utility, bright and calm rather than dusty or magazine-heavy.
- Coherence rule: orange for brand/action/selection; ink and cool neutrals for structure; copper only for small Club identity; semantic status colors stay local.
- Dials: boldness 6, motion 4, density 6.

## Findings and fixes

1. P1 resolved: orange, bright membership gold, violet/blue, and dark editorial green competed on the same job screen.
   - Fix: introduced a final semantic palette-cohesion layer and remapped legacy utilities by role.
   - Evidence: final live color probe reports no legacy purple or dark-green text in the jobs surface.
2. P1 resolved: membership color leaked into ordinary save/share controls and page accents.
   - Fix: ordinary actions are neutral; one quiet copper-gold is reserved for Club badges, member plans, subscription controls, and referral contact cards.
3. P2 resolved: selected rows, tabs, tiny section rules, filters, and loading/empty actions used unrelated colors.
   - Fix: all interaction and selection states now resolve to the same warm-orange scale.
4. P2 resolved: notification feedback used large green/yellow/red/indigo surfaces.
   - Fix: notifications use a neutral white surface with a thin semantic edge and local icon color.
5. P2 resolved: several icon-only controls were smaller than 44 px or lacked an accessible name.
   - Fix: delete, close, carousel, LinkedIn, and navigation controls now use labelled 44 px targets.
6. P3 resolved: `transition-all`, three-dot loading copy, and missing image dimensions conflicted with the final web-interface review.
   - Fix: transitions are property-scoped, loading copy uses `…`, and reviewed images declare intrinsic dimensions.
7. Regression prevention resolved: `DESIGN.md` still named purple as the public accent.
   - Fix: added a 2026-08-13 visual-authority override and marked the older palette as historical migration context.

## Audit health

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Accessibility | 4/4 | skip link retained, visible focus, labelled controls, live status, 44 px targets |
| Performance | 3/4 | lazy images and scoped transitions; large legacy detail component remains technical debt |
| Theming | 3/4 | semantic authority is coherent; legacy hard-coded utilities are still bridged by compatibility selectors |
| Responsive | 4/4 | no overflow at 1440 px or 390 px; mobile list hierarchy remains clear |
| Implementation integrity | 4/4 | Impeccable scan clean; design tokens and documentation agree |
| **Total** | **18/20** | **Excellent — minor architectural cleanup remains** |

## Verification

- [x] Same-viewport before/after visual comparison inspected.
- [x] Jobs, homepage, career growth, and login visually checked on local server.
- [x] Jobs and homepage checked at 390 × 844 with zero horizontal overflow.
- [x] Save/share, tabs, selection, loading, empty, QR modal source, and notification treatment reviewed.
- [x] Impeccable deterministic scan: 0 findings.
- [x] Primary contrast: accent/white 4.54:1; muted/white 4.97:1; member copper/member surface 7.57:1.
- [x] Production build: passed.
- [x] Compliance UI policy: passed.
- [x] Job access policy: passed.
- [x] Hero recommendation policy: passed.
- [x] Targeted ESLint: 0 errors; inherited warnings documented.

final result: passed

---

# Design QA: Taste Skill 视觉升级（2026-08-13）

- User reference: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-463dbddd-062a-4dae-88d8-64c3a2c9d2c2.png`
- Live reference capture: `artifacts/taste-visual-upgrade-2026-08-13/10-qa-reference-1276x718.png`
- Homepage implementation: `artifacts/taste-visual-upgrade-2026-08-13/11-qa-home-1276x718.png`
- Same-input comparison: `artifacts/taste-visual-upgrade-2026-08-13/12-qa-side-by-side.png`
- Additional desktop evidence: `artifacts/taste-visual-upgrade-2026-08-13/03-after-home-desktop.png`, `04-after-jobs-desktop.png`, `05-after-career-desktop.png`, `06-after-login-desktop.png`
- Mobile evidence: `artifacts/taste-visual-upgrade-2026-08-13/13-after-home-mobile-final.png`, `08-after-jobs-mobile.png`, `09-after-login-mobile.png`
- Comparison viewport: 1276 × 718 CSS px at deviceScaleFactor 1; mobile viewport: 390 × 844 CSS px.
- State: unauthenticated public homepage, Remote Jobs, Career Growth, and login flow using local application data.

## Findings

- No actionable P0/P1/P2 visual or interaction findings remain in the reviewed scope.
- The visual system now uses a brighter white/cool-daylight canvas, deep neutral ink, and one orange public accent. Member gold remains a separate semantic status color.
- Floating navigation, pill controls, high-contrast sans typography, soft depth, and restrained ambient light carry the reference's modern product character without copying its brand or decorative collage.
- Actual Haigoo product and lifestyle imagery remains the focal visual source. Existing routes, data, permissions, analytics hooks, and forms are preserved.
- The interface is intentionally locked to a light theme for this direction; dark mode is outside this visual brief.

## Required fidelity surfaces

- Typography: Replaced the heavy editorial serif hierarchy with an `Avenir Next` / system sans stack, tightened headline rhythm, and retained readable Chinese fallbacks.
- Spacing and layout: Introduced a floating desktop header, stronger Hero whitespace, consistent 14/18/28 px control/card radii, and responsive single-column mobile composition.
- Colors: Public accent is orange; member-only semantics remain gold. Former blue-purple visual accents are removed from the reviewed public states.
- Imagery: Reused real project images and logos with fixed aspect ratios, cover behavior, and soft shadows. No fake assets or CSS-drawn replacement illustrations were added.
- Copy: Visible English dash constructions touched in the refreshed surfaces were normalized; product wording, business claims, and Chinese route labels remain unchanged.
- Icons: Existing Lucide outline icons are retained consistently, with accessible labels on icon-only controls.
- Accessibility and behavior: Keyboard focus is visible, login input focus uses the orange semantic ring, mobile navigation has an accessible name, reduced motion disables refresh animations, and the 390 px pages have no horizontal overflow.

## Interaction and responsive evidence

- Mobile menu opened through `打开移动菜单`; selecting Remote Jobs navigated to `/jobs`.
- The unauthenticated role filter opened the expected login dialog instead of exposing member-only filtering.
- Homepage search accepted `产品经理` and preserved the expected login redirect with the search query.
- Login email focus rendered the orange border, focus ring, and shadow state.
- Browser console review found no runtime errors; only existing React Router future warnings and development logs were present.
- Homepage, Remote Jobs, Career Growth, and login were inspected at desktop and mobile breakpoints.

## Comparison history

1. P2: The previous global treatment used a warm gray paper field, serif display type, long flat dividers, and dark muted accents that felt heavy and archival.
   - Fix: Rebuilt shared tokens and page-level surfaces around bright daylight neutrals, bold sans hierarchy, orange action cues, floating controls, and selective soft depth.
   - Post-fix evidence: `12-qa-side-by-side.png` and the four desktop route captures.
2. P2: The first mobile Hero refresh allowed the decorative heart to clip against the right edge at 390 px.
   - Fix: Removed the decorative heart below the tablet breakpoint while preserving the desktop composition.
   - Post-fix evidence: `13-after-home-mobile-final.png` shows clean 390 px bounds and an unclipped headline/search stack.
3. P3: The reference uses a floating product collage and a serif subheading.
   - Decision: Kept Haigoo's real imagery and all-sans hierarchy because the user's stated problem was the existing magazine/serif weight; only the reference's clarity, light, accent, and floating depth were carried over.

## Implementation checklist

- [x] Install and read the requested Taste Skill package.
- [x] Refresh shared design tokens and global public surfaces.
- [x] Upgrade Homepage, Remote Jobs, Career Growth, profile/consultation shells, membership surfaces, and authentication cards through shared styles.
- [x] Preserve business behavior, routes, permissions, and data integrations.
- [x] Verify desktop/mobile rendering and primary interactions.
- [x] Pass TypeScript, production build, UI compliance, job-access policy, Hero recommendation, and whitespace checks.

final result: passed

---

# Design QA: Career Growth 播放页与「我的 Haigoo」

- Playback visual reference supplied by user: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-8c67502d-3bc0-44d2-9c4d-2088baf2c966.png`
- Playback before: `artifacts/brand-upgrade-playback-profile/before/watch-desktop.png`
- Playback after: `artifacts/brand-upgrade-playback-profile/after/watch-desktop.png`
- Playback comparison: `artifacts/brand-upgrade-playback-profile/compare/watch-desktop-before-after.png`
- Profile before: `artifacts/brand-upgrade-playback-profile/before/profile-desktop.png`
- Profile after: `artifacts/brand-upgrade-playback-profile/after/profile-desktop.png`
- Profile comparison: `artifacts/brand-upgrade-playback-profile/compare/profile-desktop-before-after.png`
- Mobile evidence: `artifacts/brand-upgrade-playback-profile/after/watch-mobile.png`, `artifacts/brand-upgrade-playback-profile/after/profile-mobile.png`
- Viewports: desktop 1440 × 692; mobile 375 × 812
- State: authenticated ordinary user with real saved-opportunity and application-record data; published CEO interview with live company notes

## Findings

- No actionable P0/P1/P2 visual or interaction findings remain in this scope.
- Playback now makes the video the primary object and presents supporting information as an editorial company dossier, rather than a second application-like product panel.
- My Haigoo has a clear greeting → quick access → saved opportunities / application records hierarchy and no longer reads like a sparse MVP dashboard.
- Both pages use warm ivory, deep ink, serif display type, fine rules, restrained purple accents, and low-radius media consistently with the redesigned Homepage.
- Desktop and mobile captures show no horizontal overflow. Each route retains one H1 and the global single `main` landmark.
- Mobile changes information order and control treatment; it is not a simple vertical stack of the previous desktop cards.
- The final mobile playback capture records the iframe before its remote poster painted, but the responsive media frame, content order, title wrapping, and document width are verified; the desktop capture verifies the loaded video state.

## Comparison history

1. P2: The playback page used a fixed-height two-card layout, a purple title pill, nested rounded note cards, and a vertical icon rail that visually competed with the video.
   - Fix: Changed to normal document flow, enlarged the video column, placed story metadata beneath it, and rebuilt the right side as a flat sticky dossier.
   - Post-fix evidence: `watch-desktop-before-after.png` shows a single video-first hierarchy and divider-led supporting content.
2. P2: The ordinary-user profile had excessive empty space, disconnected large counters, a consultation promotion card, and separate feature-page framing.
   - Fix: Added one compact personal workspace with a quiet sidebar, restrained greeting, quick-access strip, and paired saved/application records.
   - Post-fix evidence: `profile-desktop-before-after.png` shows useful real data above the fold and no ordinary-user upsell surface.
3. P2: Historical application statuses exposed old referral/intermediation language.
   - Fix: Mapped existing stored values to user-owned progress labels (`想申请`, `已申请`, `面试`, `已结束`) without changing persisted values or services.
   - Post-fix evidence: final desktop profile capture and source review of `MyApplicationsTab.tsx`.
4. P2: Several interactive targets were visually compact but below the 44 px touch target.
   - Fix: Raised application status and delete controls to a 44 px minimum, preserved visible focus, and added an explicit destructive action label.
   - Post-fix evidence: source review and successful TypeScript production build.

## Preserved behavior and compliance checks

- [x] Video access still uses existing authentication and membership capabilities.
- [x] Existing company notes, clips, favorites, public openings, resources, and source links remain data-driven.
- [x] Saved-opportunity and application-record fetch/update/delete behavior is unchanged.
- [x] No membership sale, consulting CTA, recommendation ranking, recruiter contact, or job-payment surface was added.
- [x] Dormant historical membership, redemption, and payment code remains configuration-gated rather than deleted.
- [x] Compliance UI policy test passed.
- [x] TypeScript check, production build, and diff whitespace check passed.

final result: passed

---

# Design QA: Career Growth editorial rebuild

**Findings**

- [P2] Full visual comparison remains blocked by the in-app Browser capture service.
  - Location: `/careerlearning` and `/careerlearning/watch/module/:id`, desktop and mobile implementation captures.
  - Evidence: the Browser repeatedly returned `Page.captureScreenshot` timeouts after the implementation rendered and interactions completed. The mobile notes route produced a valid post-build screenshot, but the content-index and watch-route captures could not be normalized reliably.
  - Impact: typography, spacing, and hierarchy were verified through the live Browser DOM and the visible preview, but the required same-viewport combined image comparison is incomplete.
  - Fix: recapture the two missing routes in the in-app Browser when its screenshot service is responsive, combine them with the existing source captures, and rerun the visual pass before declaring the phase complete.

**Verified surfaces**

- Source visual truth: the existing Homepage flat editorial system and `artifacts/brand-upgrade-career/before/career-list-desktop.png` / `career-list-mobile.png`.
- Valid implementation evidence: `artifacts/brand-upgrade-career/after/notes-page-mobile.png`.
- Valid combined comparison: `artifacts/brand-upgrade-career/compare/notes-mobile-before-after.jpg`.
- Mobile implementation viewport: 375 × 812 CSS px, deviceScaleFactor 2; output normalized to 375 × 812 px by the Browser.
- State: unauthenticated user, real local API data, remote-preparation note ID `273fa1b4-2044-42cc-a238-bf1cd386cdd5`.

**Interaction and responsive evidence**

- Remote-preparation filter `初级` reached the selected state.
- Video-notes dialog opened, exposed its accessible dialog name, and closed from `关闭视频笔记`.
- Console errors: none. Existing React Router future warnings only.
- `/careerlearning`, watch, and notes routes matched client width to scroll width at 375, 768, 1024, and 1440 px.
- The career index exposes one H1 and one global main landmark.
- The mobile watch lock layout measured 343 px wide inside a 375 px viewport and no longer uses the old fixed, clipped card stack.
- Type checking, compliance UI policy tests, production build, and `git diff --check` pass.

**Implementation checklist**

- [x] Editorial career masthead and real content count.
- [x] Flat chapter headers, filters, and story rows.
- [x] Flat watch lock state and mobile document flow.
- [x] Reading-width notes document and index rail.
- [x] Preserve guest/member permissions, notes, favorites, audio, analytics, and source links.
- [ ] Recapture index and watch-route implementation screenshots and complete same-viewport image comparison.

final result: blocked

---

# Design QA: Remote Companies editorial rebuild

- Style source visual truth: `artifacts/brand-upgrade-phase2/15-final-home-1440.png`
- Original directory source capture: `artifacts/brand-upgrade-companies/before/companies-desktop.png`
- Directory implementation screenshot: `artifacts/brand-upgrade-companies/after/companies-desktop.png`
- Original detail source capture: `artifacts/brand-upgrade-companies/before/company-detail-desktop.png`
- Detail implementation screenshot: `artifacts/brand-upgrade-companies/after/company-detail-desktop.png`
- Mobile source/implementation: `artifacts/brand-upgrade-companies/before/company-detail-mobile.png`, `artifacts/brand-upgrade-companies/after/company-detail-mobile.png`
- Full-view comparison evidence: `artifacts/brand-upgrade-companies/compare/companies-before-after.png`, `artifacts/brand-upgrade-companies/compare/company-detail-before-after.png`
- Focused mobile comparison evidence: `artifacts/brand-upgrade-companies/compare/company-detail-mobile-before-after.png`
- Desktop viewport: 1440 × 900 CSS px at deviceScaleFactor 1; source and implementation normalized to 1440 × 900 px for comparison.
- Mobile viewport: 375 × 812 CSS px at deviceScaleFactor 1; source and implementation are 375 × 812 px.
- State: unauthenticated public directory and Scopic detail route; real local API data.

## Findings

- No actionable P0/P1/P2 findings remain.
- The directory now reads as a maintained company index: title, source policy, search, methodology, update status, and company records form one continuous hierarchy.
- The detail page replaces nested rounded cards with one flat company document. Locked guest fields no longer dominate the page, and the official-source boundary is explicit.
- The active company job list no longer receives match/recommendation scores. Historical member email access remains conditional on the existing `isMember` state and real company data.

## Required fidelity surfaces

- Fonts and typography: Homepage serif/sans roles are reused. Directory headings stay to two deliberate lines at 375 and 1440 px; metadata remains small but readable and form inputs are at least 16 px on mobile.
- Spacing and layout rhythm: 1–2 px rules establish section rhythm. Feature images use the existing 18 px media radius; normal company records and facts do not become cards.
- Colors and visual tokens: warm ivory, deep ink, mist, sage, and purple accent map to existing semantic variables. Purple is limited to links/focus/action accents.
- Image quality and asset fidelity: existing company cover and logo assets are reused, aspect-ratio space is reserved, and below-fold images are lazy loaded. No replacement CSS/SVG illustration was introduced.
- Copy and content: endorsement, targeting, and recommendation framing is removed from static page copy. Dynamic company descriptions remain source data and are not rewritten in the UI layer.
- Icons: one existing Lucide outline family is used, with text labels on actions and no emoji icons.
- Accessibility: company records are semantic buttons, inputs have labels, icon-only search has an accessible name, expansion exposes `aria-expanded`, focus rings come from the global system, and reduced motion is respected.

## Interaction and responsive evidence

- Expand/collapse `查看整理说明` was tested; the control changed to `收起整理说明` and exposed the five information notes.
- Selecting `查看 Scopic 的企业资料` navigated to `/c/Scopic`.
- Browser console error log after directory → detail navigation: empty.
- Directory document width checks: 375/375, 768/768, 1024/1024, 1440/1440 (client/scroll width).
- Detail document width checks: 375/375, 768/768, 1024/1024, 1440/1440 (client/scroll width).
- Directory featured columns: 1 at 375; 2 at 768, 1024, and 1440. Detail Hero/About sections: 1 column at 375 and 768; 2 columns at 1024 and 1440.

## Comparison history

1. P2: The first directory Hero pass allowed the Chinese particle `的` to wrap onto its own line.
   - Fix: Split the title into two authored line spans and reduced the mobile display scale to 11.5vw.
   - Post-fix evidence: browser measurements show a two-line 88 px heading at 375 px and a two-line 141 px heading at 1440 px, with document width equal to the viewport.
2. P2: The first implementation produced nested `<main>` landmarks inside the global layout.
   - Fix: Replaced page-local `<main>` wrappers with neutral content containers while retaining the global main landmark.
   - Post-fix evidence: final DOM snapshots show one global main region with sequential h1 → h2 → h3 hierarchy.
3. P2: Company-detail job rows still received legacy match-score values.
   - Fix: Removed the `matchScore` prop from both active company-detail presentations while retaining the underlying matching code elsewhere.
   - Post-fix evidence: final component calls include only factual list display, application-method state, and existing saved-job behavior.

## Validation

- `npm run test:compliance-ui` — passed.
- `npm run type-check` — passed.
- `npm run build` — passed.
- `git diff --check` — passed.

final result: passed

---

# Design QA: 远程工作、我的 Haigoo 与职业咨询平面化（2026-08-11）

- Baseline Remote Jobs: `artifacts/brand-upgrade-followup/before/jobs-desktop.png`
- Final Remote Jobs desktop: `artifacts/brand-upgrade-followup/after/jobs-desktop-v2.png`
- Final Remote Jobs mobile: `artifacts/brand-upgrade-followup/after/jobs-mobile-375.png`
- Combined Remote Jobs comparison: `artifacts/brand-upgrade-followup/jobs-before-after.png`（左：改造前；右：改造后）
- Final consulting desktop: `artifacts/brand-upgrade-followup/after/consulting-desktop-v2.png`
- Final consulting mobile: `artifacts/brand-upgrade-followup/after/consulting-mobile-375.png`
- Final contact modal: `artifacts/brand-upgrade-followup/after/consulting-contact-modal.png`
- Viewports: 1440 × 1000 desktop and 375 × 812 mobile.
- State: Remote Jobs uses real locally returned job data; the consultation presentation was rendered through a temporary development-only visual-QA route that was removed after capture. The production consultation entry remains authentication-protected inside My Haigoo.

## Findings

- No actionable P0/P1/P2 findings remain on the rendered Remote Jobs and consulting surfaces.
- Remote Jobs no longer depends on a handwritten banner, decorative illustration header, or stacked rounded job cards. The list uses company/title/region/update/source rows, objective sort labels, fine dividers, and one accent arrow.
- Job detail sections use editorial rules and whitespace rather than repeated large cards. Guest visibility and masked metadata behavior are unchanged.
- The consulting Hero no longer displays a QR code. One CTA opens an accessible contact dialog with focus entry, focus containment, Escape close, focus restoration, QR, and email.
- The consulting page is organized around four realistic moments, three outcomes, a compact capability list, FAQ, and one boundary note. It does not resemble a package comparison or recruitment funnel.
- The My Haigoo free-user Home uses one greeting, three compact quick links, saved opportunities, and application records. The global/sidebar language is “我的 Haigoo / 咨询服务”; historical members retain their member-only workspace and real entitlements.
- Desktop and 375 px captures show no horizontal page overflow. The consultation headline was reduced and given explicit wrap rules after the first visual QA exposed clipping.

## Comparison History

1. P1: Remote Jobs was visually dominated by a decorative handwritten filter banner and large independently rounded cards.
   - Fix: Replaced it with a flat publication header, continuous job rows, factual metadata, and divider-led selection states.
   - Evidence: `jobs-before-after.png`.
2. P1: Job detail repeated rounded content cards and shadows, breaking the new Homepage's editorial language.
   - Fix: Converted the detail header stats to divided columns and the description/requirements/skills content to rule-separated reading sections.
   - Evidence: `after/jobs-desktop-v2.png`.
3. P1: The consultation QR code occupied the Hero and made contact conversion the visual center of the service.
   - Fix: Moved QR and email into a modal/drawer launched by one calm CTA.
   - Evidence: `after/consulting-contact-modal.png`.
4. P2: The first consultation Hero pass forced the Chinese heading past the right edge at 1440 px.
   - Fix: Added explicit min-width and word wrapping, constrained the text measure, and lowered the maximum display size.
   - Evidence: `after/consulting-desktop-v2.png` and `after/consulting-mobile-375.png`.

## Interaction and Compliance Checks

- Job rows expose descriptive keyboard labels and Enter/Space activation without changing the existing selection callback.
- Sort remains `默认 / 最新`; personalized score rendering remains controlled by `COMPLIANCE_FEATURES.personalizedJobDiscovery`.
- Primary application copy remains `官网直申（需登录）` for guests; existing quota/member behavior remains in `JobDetailPanel`.
- No consulting, Club purchase, membership banner, referral, or private-contact CTA was added to the public job flow.
- Consultation modal focus management and close controls were verified through the browser semantic snapshot.
- `npm run test:compliance-ui`, `npm run type-check`, and `npm run build` pass.

final result: passed

---

# Design QA: 首页 Hero、品牌企业卡片与职业咨询中心重构（2026-08-11）

- Source visual truth:
  - `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-8cba5d67-a3eb-4269-bb3e-33ef98b6ca35.png`
  - `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-bf7a08db-98e6-4d6b-9d42-e017bf185100.png`
  - `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-9bf8e259-3442-435d-90f2-61c8a2add856.png`
- Final desktop implementation:
  - `artifacts/design-qa/turn3-home-final-1440x748.png`
  - `artifacts/design-qa/turn3-club-final-1440x748.png`
- Final mobile implementation:
  - `artifacts/design-qa/turn3-home-mobile-v1.png`
  - `artifacts/design-qa/turn3-club-mobile-v1.png`
- Full-view comparison evidence:
  - `artifacts/design-qa/turn3-home-comparison-1440x748.png`
  - `artifacts/design-qa/turn3-club-comparison-1440x748.png`
- Focused region evidence:
  - `artifacts/design-qa/turn3-home-club-card-v1.png`
  - `artifacts/design-qa/turn3-club-mid-v1.png`
  - `artifacts/design-qa/turn3-club-bottom-v1.png`
- CSS viewport: 1440 × 748 desktop and 390 × 844 mobile.
- Density normalization: source screenshots are 2880 × 1496 at 2× density; comparison copies were downsampled to 1440 × 748 and compared with 1440 × 748 browser captures at deviceScaleFactor 1.
- State: authenticated free user; compliance switches at their default production-safe values.

## Findings

- No actionable P0/P1/P2 findings remain.
- Hero now has one small contextual note and one consolidated companion/source panel instead of three competing floating surfaces.
- The restored Haigoo Remote Club card is visible independently of membership promotion banners and includes brand identity, operator, contact, social links, and company information.
- The non-member Club center now presents career pain points, broader career-planning scenarios, service scope, process, FAQ, and explicit service boundaries without pricing or checkout.
- Desktop and mobile document widths equal their viewports; no horizontal overflow was detected.

## Required Fidelity Surfaces

- Fonts and typography: Existing brand handwriting, Chinese sans-serif hierarchy, and body type are retained. Hero title, consulting headline, section headings, and detail text have distinct optical weights and stable line wrapping at desktop and mobile sizes.
- Spacing and layout rhythm: Hero content aligns to a restrained two-column frame; category choices share one dock; right-side information is consolidated. Club sections use consistent 24–30 px radii, balanced section gaps, and a clear reading sequence.
- Colors and visual tokens: Existing warm ivory, slate, pale blue, and Club violet tokens remain. Contact and boundary surfaces use warm neutrals rather than purchase-oriented color treatments.
- Image quality and asset fidelity: Existing source photography, handwriting assets, Haigoo character art, QR code, company covers, and brand logo are preserved. No placeholder imagery, custom SVG art, or CSS illustration substitutes were introduced.
- Copy and content: Career support is explicitly broader than remote work and uses realistic common scenarios without presenting them as customer testimonials. The page clearly excludes job-information sales, recommendations, referrals, recruitment matching, and hiring guarantees.
- Icons and interactions: Existing Lucide icon family is used consistently. Hero search navigates to the filtered jobs page, the consulting CTA scrolls to the advisor contact, and FAQ disclosure controls open correctly with keyboard-visible focus styling.
- Accessibility and responsiveness: Semantic headings, native details/summary controls, visible focus, alt text for QR imagery, 390 px layout checks, and practical mobile tap targets are present.

## Comparison History

1. P1: The Hero used three visually independent floating cards, making the right side feel scattered and weakening the relationship between the title, search, and source explanation.
   - Fix: Consolidated the Haigoo companion and three source attributes into one bottom glass panel, aligned the small-joy note to the image, tightened the content frame, and grouped category choices into one dock.
   - Post-fix evidence: `turn3-home-comparison-1440x748.png` shows a stable left-to-right hierarchy with fewer floating boundaries.
2. P1: The Haigoo Remote Club company identity card was incorrectly tied to the membership-promotion flag and disappeared when conversion banners were disabled.
   - Fix: Added a separate default-on `homeClubInfoCard` compliance switch and restored the card without restoring any membership sales banner.
   - Post-fix evidence: `turn3-home-club-card-v1.png` shows brand, operator, contact, and social details below the company/community section.
3. P1: The non-member Club center had a sparse product-list layout that did not explain user pain, broader career-planning scenarios, consulting process, expected support, or decision boundaries.
   - Fix: Rebuilt the page around common career problems, scenario-based guidance, service scope, four-step process, FAQ, and a single advisor contact path with no price or checkout.
   - Post-fix evidence: `turn3-club-comparison-1440x748.png`, `turn3-club-mid-v1.png`, and `turn3-club-bottom-v1.png` show the complete hierarchy and interactive FAQ state.
4. P2: The first FAQ retained the browser's default focus outline after interaction, creating a visually heavy rectangle.
   - Fix: Added an intentional rounded focus-visible ring that matches Club violet tokens.
   - Post-fix evidence: final source uses the controlled focus style and targeted ESLint reports no errors.

## Primary Interactions Tested

- Hero search with “产品经理” navigates to `/jobs?search=产品经理`.
- Primary consulting CTA scrolls to the Haigoo advisor QR/contact surface.
- FAQ disclosure opens and exposes the complete answer.
- Browser console checked with zero errors.

## Implementation Checklist

- [x] Rebalance Hero typography, search, categories, note, and companion/source surfaces.
- [x] Restore the Haigoo Remote Club company identity card independently of sales banners.
- [x] Expand Club center around real career pain points and broader career planning.
- [x] Keep pricing, checkout, job sales, matching, and hiring promises out of the non-member experience.
- [x] Verify desktop, mobile, interactions, console, TypeScript, ESLint, and compliance regression tests.

final result: passed

---

# Design QA: Hero 精简、交流群文案与会员边界收口（2026-08-11）

- Source visual truth: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-f009c0c9-17be-4725-a0a0-b1046e8167d4.png`
- Desktop implementation: `/Users/caitlinyct/Haigoo_Admin/Haigoo_assistant/artifacts/design-qa/home-hero-refinement-1960x1099.jpg`
- Mobile implementation: `/Users/caitlinyct/Haigoo_Admin/Haigoo_assistant/artifacts/design-qa/home-hero-refinement-mobile.jpg`
- Full-view comparison evidence: `/Users/caitlinyct/Haigoo_Admin/Haigoo_assistant/artifacts/design-qa/home-hero-refinement-comparison.jpg`
- Focused company/community evidence: `/Users/caitlinyct/Haigoo_Admin/Haigoo_assistant/artifacts/design-qa/home-companies-community-refinement.jpg`
- Free Club evidence: `/Users/caitlinyct/Haigoo_Admin/Haigoo_assistant/artifacts/design-qa/free-club-consulting-refinement.jpg`
- Source pixels: 2048 × 1099; desktop browser content: 1960 × 1099; mobile: 390 × 844; device scale factor: 1.
- Normalization: the source was fit into a 1960 × 1099 white canvas before side-by-side comparison because the in-app browser content area capped the desktop capture at 1960 px wide.
- States: anonymous/new-user homepage, signed-in free Club center/home, and existing Partner member Club center.

## Findings

- No actionable P0/P1/P2 findings remain.
- The duplicated Haigoo greeting above the Hero title is absent for anonymous and free users. Genuine system notices retain their independent render path.
- “今日小确幸” remains as a text-led note and no longer shows the redundant sparkle icon.
- The right-side Haigoo companion card, public-source strip, search, category controls, company cards, and community QR remain intact.
- The community module uses the approved copy: “岗位分享 / 自由分享好机会 / 开放交流群，正在找机会的朋友可以互相探讨。”
- Existing Partner members retain Hero recommendations, expiry status, member recommendation workspace, email-application entitlement copy, benefits dashboard, detailed benefit cards, and Club QA.
- The ¥99 and ¥998 offer cards, their comparison catalog, PayPal/orders, and redemption entry are absent with default compliance flags. The ¥499 career-transition consulting entry remains available to members.
- Signed-in free users see the single career-consulting presentation with no price, product comparison, order, payment, or redemption entry. Favorites, applications, and feedback remain available.
- Mobile document width equals viewport width at 390 px; no horizontal overflow or clipped persistent controls were found.
- Browser console contained no errors; only existing React Router future-flag warnings were present.

## Required Fidelity Surfaces

- Fonts and typography: Existing Haigoo handwritten title assets, weights, line breaks, supporting-copy hierarchy, and bilingual routes are unchanged. Removing the two redundant decorative elements improves hierarchy without changing brand typography.
- Spacing and layout rhythm: The Hero retains its two-column desktop composition, existing mobile single-column behavior, note/card radii, search rhythm, category grid, and information strip. Removing the top greeting also removes its reserved title offset.
- Colors and visual tokens: Warm ivory background, sea-view image, slate text, purple actions, cream borders, and existing Club tokens remain unchanged.
- Image quality and asset fidelity: The original sea-view background, Haigoo mascot asset, company covers, QR codes, and icon library assets remain in use; no placeholder or code-drawn replacement was introduced.
- Copy and content: Requested community copy is exact in Chinese. Enterprise cards remain visible. Free/member segmentation copy states the public-information and consulting boundaries without removing historical member entitlements.

## Comparison History

1. P2 from annotated source: the greeting above the Hero title duplicated the right-side Haigoo card.
   - Fix: gated the ordinary greeting behind `VITE_ENABLE_HOME_HERO_GREETING_BANNER=false` while preserving system notices.
   - Post-fix evidence: the anonymous desktop/mobile captures show no greeting above the title; the right companion card remains on desktop.
2. P2 from annotated source: the sparkle badge competed with the “今日小确幸” note.
   - Fix: removed the badge wrapper and kept the note title/body unchanged.
   - Post-fix evidence: the desktop comparison shows a clean text-led note with no empty spacing or alignment regression.
3. P1 compliance regression risk: existing member pages exposed the ¥99/¥998 catalog while also carrying historical member tools.
   - Fix: kept historical member status, workspace, recommendation, email-apply copy, benefit details, and QA, but gated the two legacy offers and their comparison catalog behind a restore switch.
   - Post-fix evidence: Partner-member browser inspection showed the full member workspace and only the ¥499 consulting entry; no ¥99, ¥998, redemption, order, or PayPal entry was present.

## Implementation Checklist

- [x] Remove duplicate Hero greeting without hiding system notices.
- [x] Remove the “今日小确幸” badge icon.
- [x] Apply the exact community copy and preserve the QR/actions.
- [x] Preserve the company card section.
- [x] Preserve historical member recommendations, email applications, validity, workbench, benefits, and QA.
- [x] Hide ¥99/¥998 offers, comparison catalog, redemption, PayPal, and orders behind restore switches.
- [x] Verify anonymous, free, member, desktop, and mobile states.
- [x] Pass type-check, production build, quota/recommendation tests, source assertions, console, overflow, and diff checks.

final result: passed

---

# Design QA: 新用户 Hero 与 Club 咨询中心 — 2026-08-11

- Source visual truth: `/Users/caitlinyct/Desktop/Haigoo Assistant/治愈系UI/插画风-首页.png`
- New-user Hero implementation: `artifacts/design-qa/home-hero-new-desktop-final.png`
- Mobile Hero implementation: `artifacts/design-qa/home-hero-new-mobile.png`
- Member-preserved Hero: `artifacts/design-qa/home-hero-member-preserved-desktop.png`
- Free-user Club home: `artifacts/design-qa/free-club-home-desktop.png`
- Free-user consulting page: `artifacts/design-qa/free-club-consulting-desktop.png`
- Side-by-side Hero comparison: `artifacts/design-qa/home-hero-reference-comparison.png`
- Viewports: desktop 1536 × 1024 CSS px; mobile 390 × 844 CSS px; device scale factor 1
- Pixel normalization: source and desktop implementation are both 1536 × 1024 px in the comparison; no density resampling beyond equal-size normalization
- States: new/free-user Hero branch without recommendations; existing Partner-member Hero branch; free-user unified Club home and consulting-only Club page

## Findings

- No actionable P0/P1/P2 findings remain.
- The new-user Hero now uses the reference's core composition: handwritten value proposition and search on the left, a warm remote-work scene on the right, a small daily note, a Haigoo companion card, and a compact trust strip.
- The implementation intentionally reuses the product's existing sea-view background, Haigoo illustration, category images, colors, radii, and typography instead of copying the reference's laptop photography or introducing a second illustration style.
- The free-user Club page presents one `职业咨询服务`, the requested service contents, advisor QR code, and email contact. Price, plan comparison, PayPal, and order UI are absent.
- The unified free-user Club home contains saved roles and application records in a responsive two-column desktop layout; resume optimization and Copilot are absent. Existing members retain the original resume assistant and member workspace.

## Required Fidelity Surfaces

- Fonts and typography: Existing responsive handwritten WebP title assets are preserved. Supporting text uses the established Haigoo font stack, weights, and line heights; mobile wrapping remains readable without truncation.
- Spacing and layout rhythm: The desktop Hero keeps a balanced two-column composition and aligns the companion/trust overlays to the right-side scene. Mobile collapses to one content column with no page-level overflow (`390 px` client and scroll width).
- Colors and visual tokens: Warm ivory surfaces, muted blue-gray copy, lavender actions, fine beige borders, and soft shadows match the reference direction while staying within existing product tokens.
- Image quality and asset fidelity: Existing high-resolution sea-view and Haigoo raster assets are used at contained/cropped ratios without stretching, replacement SVGs, emoji, or placeholder artwork.
- Copy and content: Hero compliance copy, public-source labels, the exact consultation deliverables, advisor contact, and Club information boundary are present. Job-selling, price, PayPal, order, and plan-comparison copy are absent from the new free-user surfaces.

## Full-view Comparison Evidence

`artifacts/design-qa/home-hero-reference-comparison.png` places the 1536 × 1024 source and implementation together at equal scale. Both show a left-led value proposition, search and role categories, with the scene and lightweight companion content occupying the right half. The implementation uses a slimmer trust strip so the existing `我们如何整理信息` module remains visible directly below the Hero.

## Focused Region Comparison Evidence

No extra crop was required: at 1536 × 1024 the title, note card, companion card, category controls, and trust copy remain legible in the combined comparison. The Club screenshots separately verify the denser information panels and QR-code treatment.

## Interaction and Responsive Checks

- Existing Partner member: `今日为你推荐的5个匹配岗位` remains visible and the new visitor scene is hidden.
- Direct `/profile?tab=orders` navigation redirects to `/profile?tab=resume` while the PayPal flag is off.
- Visible PayPal queries return no result on the member Club page; browser console reports zero errors.
- Free Club consulting render contains the requested service list and QR contact, with no price, PayPal, or comparison text.
- Free Club home render excludes resume assistant and Copilot and includes saved/application modules; the application module's loading state was also verified.
- Mobile Hero document width equals the 390 px viewport with no horizontal overflow.

## Comparison History

1. P2: Removing recommendations left the right half of the Hero visually underused.
   - Fix: Added a reference-matched daily note, Haigoo companion card, and public-source trust strip over the existing remote-work scene.
   - Post-fix evidence: `home-hero-reference-comparison.png` shows a balanced two-column composition at equal viewport size.
2. P1: The first member-preservation condition still required a user ID, so a valid member account without that field could enter the new-user Hero.
   - Fix: Members now preserve recommendations directly; the user-ID requirement applies only to nonmember legacy-usage eligibility.
   - Post-fix evidence: `home-hero-member-preserved-desktop.png` and the browser DOM both show the original daily-five recommendation panel for the active Partner member.
3. P2: The initial free Club home stacked saved and application panels, placing applications below the first desktop viewport.
   - Fix: Moved both panels into one responsive two-column desktop grid while preserving the mobile stack.
4. P2: The consultation introduction mentioned that prices were hidden, exposing internal implementation language.
   - Fix: Reduced the copy to service scope and advisor contact only; the final render contains no price wording.

## Implementation Checklist

- [x] Fill the new/free-user Hero without restoring personalized recommendations.
- [x] Preserve member and historical-recommendation experiences.
- [x] Reduce free-user Club to one consultation service and advisor contact.
- [x] Remove independent free-user saved/application navigation and aggregate both on Club home.
- [x] Hide orders and prevent PayPal front-end initialization by default.
- [x] Verify desktop, mobile, segmentation, direct-route behavior, console output, type checking, quota tests, recommendation tests, and production build.

final result: passed

---

# Design QA: Club 开通方式与兑换码入口 — 2026-08-08

- Source plan-card reference: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-cee96a53-2058-4198-8268-c851692d4f2a.png`
- Source Club hero reference: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-62a21c5b-2bff-46c2-8503-79098d42571a.png`
- Plan-card implementation: `artifacts/design-qa/club-plan-cards-desktop.jpg`
- Payment-method dialog: `artifacts/design-qa/club-payment-tabs-desktop.jpg`
- Redemption dialog: `artifacts/design-qa/club-redemption-desktop.jpg`
- Mobile payment dialog: `artifacts/design-qa/club-payment-tabs-mobile.jpg`
- Side-by-side comparison: `artifacts/design-qa/club-payment-interaction-comparison.png`
- State: authenticated free user at `http://localhost:3000/profile?tab=membership`; PayPal feature flag disabled so advisor assistance is selected initially.

## Findings

- No actionable P0/P1/P2 findings remain for the requested flow.
- The Club page always exposes the existing membership-code entry and the redemption dialog remains fully functional independently of PayPal availability.
- Plan cards no longer disclose PayPal/advisor options before plan selection. Each CTA opens one payment dialog with two equal tabs, and advisor content renders inside that dialog rather than opening a second modal.
- The payment dialog uses the selected plan card's exact “适合谁” copy. The previously invented assessment/action-plan sentence is absent from the rendered payment flow.
- Decorative title icons and eyebrow pills were removed from the payment, plan-chooser, order and redemption surfaces added for this feature. Functional benefit checks and status treatments remain.

## Interaction and responsive checks

- Verified PayPal and advisor tabs are both present and mutually selectable inside one dialog; the dialog count remains one in the advisor state.
- Verified the advisor tab displays the QR code and the PayPal tab removes it while retaining the same selected plan context.
- Verified `兑换会员码` opens `兑换会员权益` with the code input and `确认兑换` action.
- Verified desktop and 390 × 844 mobile payment-dialog layouts. The mobile dialog remains vertically scrollable and keeps both method tabs visible.
- Browser console contains no errors; only existing React Router v7 future-flag warnings were observed.
- TypeScript type checking, production build, PayPal tests, membership-redemption tests and `git diff --check` pass. Targeted ESLint reports zero errors and thirteen pre-existing warnings in `ProfileCenterPage.tsx`.

## Comparison history

1. P1: Payment options were exposed below every plan card and duplicated interaction decisions before checkout.
   - Fix: Removed the plan-card hint and moved both methods into equal tabs inside the payment dialog.
2. P1: Advisor assistance opened another modal from the payment dialog.
   - Fix: Rendered QR code, instructions and completion action directly in the advisor tab.
3. P1: The redemption-code entry depended on runtime readiness state and could disappear.
   - Fix: Preserved it as a fixed channel entry while keeping server-side validation on submission.
4. P2: Payment copy introduced new product language unrelated to the selected plan card.
   - Fix: Reused each plan's existing “适合谁” copy verbatim.
5. P2: Decorative icons and pill labels made the new surfaces feel visually over-designed.
   - Fix: Simplified headings, actions and the redemption dialog while retaining established Haigoo layout and brand color.

final result: passed

---

# Mini Program Visual Refresh & Enterprise Information QA — 2026-07-22

## Scope and Evidence

- Reference home: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-e1f1f3db-c6d9-4b30-853c-bee40d317722.png`
- Reference jobs: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-d7df3be5-9f25-43d0-af34-8944022be536.png`
- Implementation: `miniprogram/src/pages/index`, `miniprogram/src/pages/jobs`, `miniprogram/src/pages/learning`, `miniprogram/src/pages/job-detail`, `miniprogram/src/pages/profile`, and `miniprogram/src/pages/account-bind`
- Home comparison: `artifacts/miniprogram-design-qa/home-comparison.png`
- Jobs comparison: `artifacts/miniprogram-design-qa/jobs-comparison.png`
- Final page captures: `artifacts/miniprogram-design-qa/home-final.png`, `jobs-final.png`, `membership-final.png`, and `company-final.png`
- Comparison viewport: 794 × 1131 browser content. The 794 × 1536 home reference was compared at equal width using a top-region crop to 1131 px.
- States checked: H5 visual preview with realistic local job fallback, free-user membership state, and job-detail enterprise tab after an actual click.

## Findings

- No actionable P0/P1/P2 visual findings remain.
- The current H5 preview intentionally uses the real website hero crop and the existing HAIGOO logo/avatar assets rather than approximated CSS artwork.
- H5 API requests cannot reach the mini-program cloud runtime; realistic jobs are supplied only in the H5 preview fallback. The WeChat build continues to use live backend data.
- Minor P3 difference: transparent padding inside the original logo asset requires optical scaling; the implementation preserves the real asset and light logo background as requested.

## Required Fidelity Surfaces

- Typography: dark navy headings, restrained gray supporting copy, and purple emphasis aligned with the supplied references.
- Spacing: rounded but flat white cards, compact job-card rhythm, and section spacing aligned to the reference hierarchy.
- Colors: cool off-white page background, white surfaces, purple actions/pills, and no decorative dark gradients.
- Image assets: website hero background, existing brand logo, user avatar, and company logos use native assets with contained aspect ratios.
- Copy: home hero, membership/subscription entry points, top-six popular categories, and company profile fields match the requested product states.

## Interaction and Data Checks

- Home, jobs, membership, subscription, account binding, and job detail share the same flat visual system.
- Job categories are sorted by backend aggregation count, limited to six, and preceded by the dedicated `🔥 热门` control.
- The job-detail `企业信息` tab was clicked and verified with company description, tags, industry, location, and website fields.
- Membership users receive subscription content/entry states; free users receive the three-service membership presentation.

## Comparison History

1. P1: Dark gradients and warm decorative surfaces diverged from the supplied flat references.
   - Fix: Replaced them with white/cool-gray surfaces, purple accents, restrained borders, and soft elevation.
2. P2: The home hero used decorative CSS artwork and did not visually connect to the website.
   - Fix: Reused the website hero image with a uniform overlay and reference-matched text/CTA composition.
3. P2: Category ordering was not guaranteed by popularity and the client ignored the CloudRun `categories` response.
   - Fix: Sorted aggregation counts in CloudRun and the client, limited the result to six, and added the `🔥 热门` control.
4. P2: Enterprise information was sparse and buried at the bottom of job details.
   - Fix: Promoted it to the second detail tab and exposed the available structured company fields.
5. P2: H5 nested image rendering could crop job/company logos during visual QA.
   - Fix: Added contained sizing for the generated inner image element while retaining native mini-program behavior.

## Implementation Checklist

- [x] Match the supplied home and jobs visual direction.
- [x] Keep the logo area light and use the existing brand asset.
- [x] Apply the same flat design language to membership and subscription pages.
- [x] Limit category filters to six popularity-ranked options and mark the hot entry.
- [x] Present enterprise information as the second job-detail tab.
- [x] Verify home, jobs, membership, and company-tab screenshots.
- [x] Verify TypeScript, Node syntax, and production WeChat build.

final result: passed

---

# Design QA: Club 支付方案收束与单色卡片

- Reference visual: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-f52fa4db-5463-416e-b5f0-abd0796e175c.png`
- Final plan-card screenshot: `/private/tmp/club-payment-plan-actions.png`
- Final benefit-detail screenshot: `/private/tmp/club-benefit-details.png`
- Final FAQ screenshot: `/private/tmp/club-benefits-and-faq.png`
- Combined comparison evidence: `/private/tmp/club-pricing-visual-comparison.png`
- Viewport and state: local desktop preview at `http://localhost:3000/profile?tab=membership`; authenticated legacy quarterly member

## Findings

- No actionable P0/P1/P2 findings remain for the requested pricing surface.
- The three cards use a shared white surface, neutral border and one black CTA treatment, echoing the supplied pricing reference without replacing Haigoo's typography, rounded cards or existing brand purple.
- Plan-title stage chips are absent, while the three-item stage selector remains above the cards. Selecting a stage uses the brand-purple card ring, status label and CTA; unselected plan CTAs remain black.
- The explanation is reduced to payment plans, benefit details and membership QA. The intentionally retained footer contains the existing service promise and advisor-contact module; service-flow, delivery-sample, service-boundary and duplicate support panels remain hidden.
- Unsupported cells retain a muted gray minus treatment; included cells retain the purple check treatment.

## Interaction and implementation checks

- Clicking `申请远程陪伴` opens the existing advisor dialog with the Club Member service context; the dialog can be closed normally.
- The legacy quarterly-member preview no longer presents all three cards as purple upgrade panels; it keeps the neutral card system and black CTAs.
- `npm run build` and `git diff --check` pass.

## Comparison note

The combined comparison confirms the intended shared traits from the reference—white cards, restrained borders, black CTAs and a clear plan-to-details hierarchy—while preserving Haigoo's three-column layout and Chinese service content.

final result: passed

# Design QA: 英文 Hero WebP 与首页性能收紧

- Source visual truth: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-c78f8d4d-847f-4a37-b8ef-8e86b0e88503.png`
- Chinese regression reference: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-e08e62eb-9c1c-49d5-a333-77e7c25359b6.png`
- Final English implementation: `/private/tmp/haigoo-en-final-1280x720-20260718.png`
- Final Chinese implementation: `/private/tmp/haigoo-zh-final-2048x1080-20260718.png`
- Mobile English implementation: `/private/tmp/haigoo-after-en-mobile-20260718.png`
- Mobile Chinese implementation: `/private/tmp/haigoo-after-zh-mobile-20260718.png`
- Full-view comparison evidence: `/private/tmp/haigoo-en-final-comparison-1280-20260718.png`
- Focused featured-tabs evidence: `/private/tmp/haigoo-en-featured-tabs-final-20260718.png`
- Viewports: 2048 × 1080, 1280 × 720, and 390 × 844
- State: authenticated member with live recommendation data; English `/en` and default Chinese `/`

## Findings

- No actionable P0/P1/P2 findings remain.
- The English display title is now a bold transparent WebP picture with responsive 680/1020/1360 sources instead of a runtime-loaded custom font.
- English navigation and homepage section labels are shorter, and the seven Featured Jobs filters remain on one horizontal line at desktop width.
- Both language versions preserve the original two-column Hero composition and have a safe vertical gap between the greeting banner and title.
- The mobile document width equals the 390 px viewport in both languages, with no page-level horizontal overflow.

## Required Fidelity Surfaces

- Fonts and typography: The English title keeps the supplied handwritten character while using a heavier raster treatment matching the Chinese title. Interface typography remains unchanged.
- Spacing and layout rhythm: Greeting-to-title spacing is stabilized across languages. Search, categories, recommendation card, and lower sections retain their established rhythm.
- Colors and visual tokens: Existing navy title color, warm background, purple heart, borders, shadows, and card surfaces are preserved.
- Image quality and asset fidelity: English title sources are transparent WebP files at 680, 1020, and 1360 px. Their file sizes are approximately 10, 16, and 22 KB; the unused 4.2 MB font is no longer shipped in the production public bundle.
- Copy and content: Requested labels are now `Companies`, `Daily 5 recommended matches`, `Featured Jobs`, `Marketing`, `Sales`, `Featured Companies`, and `Wechat Group`. Job content remains in its source language.

## Interaction and Responsive Checks

- English and Chinese routes load independently and preserve the existing header, search, category, recommendation, and membership interactions.
- Responsive image selection uses the 680 px title source on mobile and the high-density source on desktop.
- Featured Jobs filters share one row at 1280 px; smaller screens use horizontal overflow inside the filter control without creating page overflow.
- Browser screenshots confirm 2048 px desktop, 1280 px desktop, and 390 px mobile layouts.
- TypeScript, production build, targeted ESLint, and `git diff --check` pass; targeted ESLint reports warnings only and zero errors.

## Comparison History

1. P1: The English Hero depended on a 4.2 MB custom font file at runtime.
   - Fix: Rasterized the exact two-line title into three responsive WebP assets and removed the font declaration and public font from the production bundle.
   - Post-fix evidence: Production `dist` contains no `.ttf` file, and the three title sources are approximately 10–22 KB each.
2. P2: Long English labels increased header pressure and caused the final Featured Jobs filter to wrap.
   - Fix: Applied the requested shorter copy and made the filter group a single non-wrapping horizontal row with compact spacing.
   - Post-fix evidence: All seven filters share the same top coordinate in the 1280 px browser measurement.
3. P2: The taller image-based title could sit too close to the absolute greeting banner, especially in Chinese.
   - Fix: Added banner-aware top spacing to the left Hero column at mobile and desktop breakpoints.
   - Post-fix evidence: English and Chinese desktop captures show a clear gap, while both mobile captures remain fully visible.
4. P2: The English heart initially sat below the new raster title rather than beside the final word.
   - Fix: Repositioned the existing heart asset to the end of the second title line.
   - Post-fix evidence: The final 1280 px capture shows the heart aligned after the period without touching the recommendation card.

## Implementation Checklist

- [x] Replace the English runtime font title with responsive WebP sources.
- [x] Remove the unused font from the production bundle.
- [x] Shorten all requested English navigation and homepage labels.
- [x] Keep Featured Jobs filters on one line.
- [x] Restore safe Chinese greeting-to-title spacing.
- [x] Verify English and Chinese desktop/mobile layouts and production output.

final result: passed

---

# Design QA: 英文首页 Hero、语言路由与响应式导航

- Source visual truth: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-141ee66d-51fa-4663-8df6-ecbe0b069f72.png`
- Implementation screenshot: `/private/tmp/haigoo-en-hero-final.png`
- Club benefits screenshot: `/private/tmp/haigoo-en-club-final.png`
- Mobile screenshot: `/private/tmp/haigoo-en-mobile-final.png`
- Combined comparison evidence: `/private/tmp/haigoo-hero-comparison.png`
- Viewports: desktop 1280 × 720; compact desktop 1024 × 768; mobile 390 × 844
- State: authenticated Club member, English `/en`; live job content remains in its original source language

## Findings

- No actionable P0/P1/P2 findings remain.
- The English Hero now follows the reference composition with a two-line handwritten headline, concise supporting copy, search/categories on the left, and recommendations on the right.
- The desktop header fits without overlap at 1280 px and 1024 px. Search, navigation gaps, user identity, and badges adapt progressively; mobile retains the existing menu interaction.
- English routes consistently use `/en`, while unprefixed routes default to Chinese. Switching languages preserves the current internal destination.
- Club highlights, plans, comparison table, FAQ, service promise, and supporting labels use concise English copy.

## Required Fidelity Surfaces

- Fonts and typography: The English headline uses the existing local Haigoo handwriting font with responsive sizing and a stable two-line composition.
- Spacing and layout rhythm: Header widths and gaps shrink by breakpoint without changing navigation order or interaction targets.
- Colors and visual tokens: Existing brand colors, borders, shadows, card radii, and warm Hero background are preserved.
- Image quality and asset fidelity: Existing logo, heart, category icons, and company imagery are reused without generated replacements.
- Copy and content: Interface copy is localized; job titles and employer-provided job metadata remain original as requested.

## Interaction and Responsive Checks

- Language toggle changes `/` to `/en` and changes `/en` back to `/`; English navigation retains the `/en` prefix.
- The English language control reads `CH` and keeps an accessible Chinese-language label.
- Header document width equals viewport width at 1280 px, 1024 px, and 390 px, with no horizontal page overflow.
- Search, navigation, account controls, mobile menu, and Club membership interactions remain reachable.
- Browser console returned zero errors during route, membership, and responsive checks.

## Comparison History

1. P2: The first English Hero pass wrapped the headline to three lines.
   - Fix: Reduced responsive headline sizing and tuned the English line grouping to preserve the intended two-line expression.
2. P2: Fixed header widths squeezed navigation and account controls on narrower desktop screens.
   - Fix: Added flexible search sizing, breakpoint-based gaps, and progressive hiding of secondary account text while preserving the avatar and controls.
3. P2: English copy was incomplete across the Club benefits experience.
   - Fix: Added concise English strings for value highlights, plan cards, benefits comparison, FAQ, service promise, and side navigation.
4. P2: Language state did not have a shareable route contract.
   - Fix: Made `/en` the pathname source of truth and localized internal navigation while retaining the existing route definitions.

## Implementation Checklist

- [x] Use `CH` as the English-page language switch label.
- [x] Prevent header overlap across desktop and mobile breakpoints.
- [x] Add concise English Club benefits content.
- [x] Add `/en` routing and preserve paths on language switch.
- [x] Recompose the English Hero from the supplied visual reference.
- [x] Preserve original-language job content and existing interactions.

final result: passed

---

# Design QA: Hero 标题粗细与中英文比例回调

- English issue reference: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-54d5d506-6b8e-4da2-8f77-acc62941b1e1.png`
- Chinese current-state reference: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-fd345169-6dfb-4d96-8b15-52f1b69c5f42.png`
- Chinese online reference: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-2939c8c4-80a5-49bd-a731-d780738225bb.png`
- Final English screenshot: `/private/tmp/haigoo-hero-en-thin-2048x1080-20260718.png`
- Final Chinese screenshot: `/private/tmp/haigoo-hero-zh-balanced-2048x1080-20260718.png`
- Mobile English screenshot: `/private/tmp/haigoo-hero-en-thin-mobile-20260718.png`
- Mobile Chinese screenshot: `/private/tmp/haigoo-hero-zh-balanced-mobile-20260718.png`
- English comparison evidence: `/private/tmp/haigoo-hero-en-weight-comparison-20260718.png`
- Chinese comparison evidence: `/private/tmp/haigoo-hero-zh-online-comparison-20260718.png`
- Viewports: desktop 2048 × 1080; mobile 390 × 844
- State: authenticated member with live recommendation data; `/en` and default `/`

## Findings

- No actionable P0/P1/P2 findings remain.
- English title keeps its existing size and line breaks while removing the artificial outline weight.
- English alpha coverage fell from 4,166,681 to 2,019,813 at the 680 px source, a 51.5% reduction.
- Chinese desktop title width fell from 126.2% to 102%, closely matching the online title-to-column proportion.
- Chinese mobile retains a separate 122% width so the title stays readable and visually full without page overflow.

## Required Fidelity Surfaces

- Fonts and typography: Both titles preserve the original Haigoo handwriting source. English now has the intended light handwritten stroke; Chinese keeps its original stroke but uses the online-like scale.
- Spacing and layout rhythm: The smaller Chinese title reduces empty visual tension and lets description, search, and category cards rise naturally. English spacing and right-card alignment remain unchanged.
- Colors and visual tokens: Title navy, heart purple, warm background, borders, and card tokens are unchanged.
- Image quality and asset fidelity: The same transparent WebP source set and real heart asset remain in use. No runtime font was reintroduced.
- Copy and content: No copy, recommendation data, search behavior, category behavior, or language routing changed in this pass.

## Comparison History

1. P1: English raster title was more than twice as visually dense as the intended handwritten reference.
   - Fix: Regenerated all three WebP sizes without the 2/3/4 px artificial outlines.
   - Post-fix evidence: Alpha coverage decreased 51.5% while bounding dimensions and two-line layout stayed stable.
2. P2: Chinese desktop title occupied too much of the left column compared with the online Hero.
   - Fix: Reduced desktop image width from 126.2% to 102% and preserved the existing negative alignment offset.
   - Post-fix evidence: Desktop comparison shows title, description, search, and category proportions close to the online reference.
3. P2: Applying desktop scale globally made the mobile Chinese title too small.
   - Fix: Added a mobile-specific 122% width before the `sm` breakpoint.
   - Post-fix evidence: The 390 px capture keeps both Chinese lines prominent and document width remains exactly 390 px.

## Implementation Checklist

- [x] Reduce English stroke density by at least 50%.
- [x] Preserve English title size and line breaks.
- [x] Match Chinese desktop title scale to the online reference.
- [x] Keep Chinese mobile title readable.
- [x] Verify desktop/mobile overflow and both language routes.
- [x] Pass build, TypeScript, targeted ESLint, and diff checks.

final result: passed

---

# Design QA: Hero 标题爱心定位

- Chinese issue reference: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-4ba388bf-61f3-4429-8f5e-09d47b038a54.png`
- English issue reference: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-a43fea84-92b5-4648-a40c-5274f0848737.png`
- Final Chinese screenshot: `/private/tmp/haigoo-heart-zh-desktop-20260718.png`
- Final English screenshot: `/private/tmp/haigoo-heart-en-desktop-20260718.png`
- Mobile Chinese screenshot: `/private/tmp/haigoo-heart-zh-mobile-20260718.png`
- Mobile English screenshot: `/private/tmp/haigoo-heart-en-mobile-20260718.png`
- Chinese comparison evidence: `/private/tmp/haigoo-heart-zh-comparison-20260718.png`
- English comparison evidence: `/private/tmp/haigoo-heart-en-comparison-20260718.png`
- Viewports: desktop 2048 × 1080; mobile 390 × 844
- State: authenticated member with live recommendation data; default `/` and `/en`

## Findings

- No actionable P0/P1/P2 findings remain.
- English Hero no longer renders the standalone heart image at either viewport.
- Chinese desktop heart now sits directly after “生活” instead of drifting toward the right edge of the title container.
- Chinese mobile uses a separate responsive horizontal position so it remains close to the second-line text without overlap or page overflow.
- Existing title images, sizing, copy, routes, recommendations, search, and Hero spacing remain unchanged.

## Comparison History

1. P2: The standalone English heart competed with the punctuation and looked detached from the handwritten title.
   - Fix: Removed the heart node from the English render branch.
   - Post-fix evidence: DOM count for `hero-love-inline` is 0 on `/en` at desktop and mobile.
2. P2: The Chinese heart used a percentage based on the full title container, placing it well beyond the shorter second line.
   - Fix: Positioned the asset against the measured second-line image bounds, with separate mobile and desktop percentages.
   - Post-fix evidence: DOM count remains 1 on `/`; the heart follows “生活” at both verified viewports.

## Implementation Checklist

- [x] Remove the English title heart.
- [x] Reposition the Chinese title heart near the second-line ending.
- [x] Preserve desktop and mobile layout stability.
- [x] Verify DOM state on both language routes.
- [x] Pass build, TypeScript, targeted ESLint, and diff checks.

final result: passed

---

# Design QA: 英文 Hero 新手写标题资源

- Source visual truth: `/Users/caitlinyct/Downloads/已生成图像 1 (1).png`
- Final desktop implementation: `/private/tmp/haigoo-new-title-en-desktop-pass1-20260718.png`
- Final mobile implementation: `/private/tmp/haigoo-new-title-en-mobile-final-20260718.png`
- Chinese regression screenshot: `/private/tmp/haigoo-new-title-zh-regression-20260718.png`
- Focused comparison evidence: `/private/tmp/haigoo-new-title-en-comparison-20260718.png`
- Full-view comparison evidence: the final desktop implementation above; the source is a title-only raster rather than a full-page mockup.
- Viewports: desktop 2048 × 1080; mobile 390 × 844
- State: authenticated member with live recommendation data; English `/en` and default Chinese `/`

## Findings

- No actionable P0/P1/P2 findings remain.
- The browser-rendered handwriting preserves the supplied letterforms, word spacing, two-line composition, punctuation, and dark navy color.
- The checkerboard pattern in the supplied RGB PNG was removed and is not present in the page asset.
- Desktop title aligns with the Hero content column and remains clear of the recommendation card.
- Mobile title fits within the 390 px viewport with 2.5 px of right-side safety space and no horizontal document overflow.
- The Chinese title asset, heart position, and layout remain unchanged.

## Required Fidelity Surfaces

- Fonts and typography: The supplied handwriting remains rasterized as authored; no fallback font substitution is used.
- Spacing and layout rhythm: Desktop keeps the existing Hero column alignment; mobile uses a slightly narrower width and smaller negative offset to protect the final period.
- Colors and visual tokens: Ink is normalized to the existing Hero navy and remains legible on the warm background.
- Image quality and asset fidelity: Source background was converted to true transparency and exported as responsive lossless WebP assets at 680, 1020, and 1360 px widths.
- Copy and content: The title text remains exactly “Work and live / the way you love.” and all surrounding English and Chinese content is unchanged.

## Comparison History

1. P2: The source PNG contained a baked checkerboard instead of transparency.
   - Fix: Derived a soft alpha mask from the neutral checkerboard range, retained antialiased handwriting edges, and exported transparent WebP sources.
   - Post-fix evidence: The focused comparison shows a clean warm page background with no checkerboard artifacts or gray halo.
2. P2: The first mobile fit extended the raster to x=391 in a 390 px viewport, leaving the final period too close to the clipped edge.
   - Fix: Reduced mobile width from 108% to 106% and negative offset from -2% to -1%, while preserving the desktop scale at the `sm` breakpoint.
   - Post-fix evidence: Final mobile bounds are x=16.5–387.5 px and document width equals viewport width at 390 px.

## Implementation Checklist

- [x] Replace the English Hero title with the supplied handwriting.
- [x] Remove the baked checkerboard and preserve transparent antialiasing.
- [x] Export responsive, lossless WebP assets.
- [x] Align desktop and mobile proportions independently.
- [x] Verify English desktop/mobile and Chinese desktop regression.
- [x] Pass build, TypeScript, targeted ESLint, and diff checks.

final result: passed

---

# Design QA: 英文 Hero 标题宽度收紧

- Source visual truth: `/var/folders/31/06qzndgs1cbb3kw9z360dtq80000gn/T/codex-clipboard-90a6b324-4eeb-477b-8bee-aeac78f3d895.png`
- Final desktop implementation: `/private/tmp/haigoo-title-width-en-desktop-20260718.png`
- Final mobile implementation: `/private/tmp/haigoo-title-width-en-mobile-20260718.png`
- Chinese regression screenshot: `/private/tmp/haigoo-title-width-zh-regression-20260718.png`
- Full-view comparison evidence: `/private/tmp/haigoo-title-width-full-comparison-20260718.png`
- Focused comparison evidence: `/private/tmp/haigoo-title-width-focus-comparison-20260718.png`
- Viewports: desktop 2048 × 1080; mobile 390 × 844
- State: authenticated member with live recommendation data; English `/en` and default Chinese `/`

## Findings

- No actionable P0/P1/P2 findings remain.
- Desktop search control is 576 px wide; the title canvas is constrained to the same 576 px grid and its visible ink spans approximately 565 px.
- Mobile title and search control both occupy the same 350 px content width; visible ink remains inset to approximately x=26.8–363.2 px.
- The reduced title height improves the balance between the Hero title, supporting copy, search field, and right recommendation card.
- The Chinese title keeps its original 630 px wrapper, responsive image sizing, and single heart asset.

## Required Fidelity Surfaces

- Fonts and typography: The supplied handwritten raster and its two-line composition are unchanged; only rendered scale is reduced.
- Spacing and layout rhythm: English title now shares the search control’s `max-w-xl` grid and preserves a small optical inset from the search border.
- Colors and visual tokens: Navy ink and warm background treatment are unchanged.
- Image quality and asset fidelity: The existing responsive lossless WebP set remains in use; scaling stays above the selected source’s required display density.
- Copy and content: Title text and all surrounding English and Chinese content remain unchanged.

## Comparison History

1. P2: The English title’s visible width extended beyond the search field and dominated the left Hero column.
   - Fix: Reduced the English wrapper from 630 px to 576 px and changed image scale from 108% to 102% at desktop.
   - Post-fix evidence: Browser bounds show the 576 px search and title grids aligned; estimated visible title ink is 565 px wide.
2. P2: A desktop-only reduction could leave the mobile title wider than its search field.
   - Fix: Set the mobile image to 100% of the same 350 px content width, retaining the 102% optical correction only from `sm` upward.
   - Post-fix evidence: Mobile image and search bounds are both x=20–370 px with document width equal to the 390 px viewport.

## Implementation Checklist

- [x] Keep the English title no wider than the search field.
- [x] Preserve small optical insets for transparent image padding.
- [x] Apply the same width contract at 390 px.
- [x] Keep the Chinese Hero unchanged.
- [x] Verify full-view and focused before/after evidence.
- [x] Pass build, TypeScript, targeted ESLint, and diff checks.

final result: passed

---

# Final validation checkpoint: Playback and My Haigoo

- Full findings and comparison history: `Design QA: Career Growth 播放页与「我的 Haigoo」` above.
- Same-viewport comparisons: `artifacts/brand-upgrade-playback-profile/compare/watch-desktop-before-after.png`, `artifacts/brand-upgrade-playback-profile/compare/profile-desktop-before-after.png`.
- Mobile evidence: `artifacts/brand-upgrade-playback-profile/after/watch-mobile.png`, `artifacts/brand-upgrade-playback-profile/after/profile-mobile.png`.
- Production build, TypeScript check, compliance UI policy test, and whitespace diff check all pass after the final 44 px target correction.
- Visual review confirms no remaining P0/P1/P2 issue in the requested playback and My Haigoo scope.

final result: passed
