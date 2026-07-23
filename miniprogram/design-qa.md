# Design QA: 微信小程序视觉优化

- Source visual truth:
  - `/Users/caitlinyct/Desktop/Haigoo Assistant/Hai 产品小程序demo/0-welcome.png`
  - `/Users/caitlinyct/Desktop/Haigoo Assistant/Hai 产品小程序demo/2-job list.png`
  - `/Users/caitlinyct/Desktop/Haigoo Assistant/Hai 产品小程序demo/2-0job_noapply.png`
  - `/Users/caitlinyct/Desktop/Haigoo Assistant/Hai 产品小程序demo/3-profile.png`
- Implementation screenshot path: unavailable; the updated WeChat simulator screen has not been captured in this task.
- Intended viewport: iPhone 12/13 simulator, approximately 390 × 844 CSS pixels.
- State: mock user, mock resume preference, recommended job list, job detail, learning, and profile preview states.

## Findings

- [P1] Rendered implementation evidence is unavailable.
  - Location: WeChat Developer Tools simulator for 首页、岗位、岗位详情、学习、我的.
  - Evidence: all four source visuals were opened and inspected, but there is no post-change simulator screenshot to place beside them.
  - Impact: image crop, native navigation height, text wrapping, bottom-tab clearance, remote image loading, and fixed application footer cannot be judged reliably from source code or compiled WXSS alone.
  - Fix: capture the five updated simulator screens at the same iPhone 12/13 viewport, combine each relevant source and implementation image, then complete the visual comparison loop.

## Required Fidelity Surfaces

- Fonts and typography: code uses the existing system Chinese font stack, 600–800 optical hierarchy, and explicit line heights. Visual wrapping and perceived weight remain unverified without a simulator screenshot.
- Spacing and layout rhythm: the implementation uses 24–30 rpx radii, 20–38 rpx section spacing, white cards, and fixed bottom application controls. Native navigation and tab-bar interaction with these dimensions remains unverified.
- Colors and visual tokens: the main action color is unified to `#5146e5`, with `#f8f8fc` page backgrounds, white surfaces, soft lavender chips, and muted blue-gray body copy.
- Image quality and asset fidelity: visible images use existing Haigoo assets from `haigooremote.com`; icons use `@nutui/icons-react-taro`. Actual network loading, crop, and sharpness remain unverified in the simulator.
- Copy and content: the mini program keeps Haigoo-specific Chinese copy and existing remote-job product logic rather than copying the English demo text.

## Full-view Comparison Evidence

Blocked. A rendered WeChat simulator screenshot is required before a full-view comparison can be made.

## Focused Region Comparison Evidence

Blocked. The following regions need focused checks once screenshots are available:

- 首页 hero image crop, CTA, search bar, and first recommended card.
- 岗位 card title wrapping, company icon treatment, match score, and action row.
- 岗位详情 hero spacing, tag wrapping, long-form reading rhythm, and fixed footer.
- 我的 avatar crop, tab underline, record-card spacing, and Club CTA.
- 学习 hero, progress card, category chips, and video-card cover contrast.

## Primary Interactions

- Code-level paths are connected for job search, category filtering, job detail navigation, save state, application action sheet, profile tabs, and tab switching.
- Simulator interaction testing is pending for touch targets, horizontal scrolling, fixed-footer clearance, and native navigation behavior.
- Console error inspection is pending because no post-change simulator session was captured.

## Comparison History

- No visual comparison iteration has been completed yet. The implementation was built from the supplied references and passed static checks, but visual evidence is still required before recording P0/P1/P2 fixes.

## Implementation Checklist

- [x] Replace decorative text symbols with a real icon library.
- [x] Unify page background, surface cards, purple action color, radii, and shadows.
- [x] Redesign job list cards around match score, company visual, tags, and a clear CTA.
- [x] Redesign job detail around a centered company hero, readable sections, match card, and fixed apply action.
- [x] Redesign profile around avatar identity, segmented tabs, stacked records, and membership CTA.
- [x] Add an image-led home hero and simplify the learning page visual hierarchy.
- [x] Pass TypeScript, ESLint, diff-format, and WeChat production-build checks.
- [ ] Capture updated simulator screenshots and complete the side-by-side visual QA loop.

final result: blocked
