# Mini Program Secondary Screens Figma Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Match the existing mini-program startup, company directory, profile, and membership screens to the supplied Figma Make visual source without changing product data, copy, navigation count, or behavior.

**Architecture:** Keep the current Taro pages, API contracts, shared controls, and navigation. Apply page-scoped markup only where the Figma hierarchy cannot be expressed by existing markup, and prefer scoped SCSS overrides for dimensions, spacing, typography, color, radii, and shadows.

**Tech Stack:** Taro 4.2.1, React 18, TypeScript, SCSS, WeChat Mini Program developer tools.

**Spec:** Figma Make file `GWvL94MvgSTAA0827B5WGg`, especially `OnboardingScreen.tsx`, `CompaniesScreen.tsx`, `ProfileScreen.tsx`, and `MembershipScreen.tsx`.

## Global Constraints

- Preserve real page data, copy, component counts, ordering, navigation count, and interactions.
- Treat Figma as the only visual authority; do not redesign or polish beyond it.
- Separate WeChat status, capsule, tab bar, and safe-area regions from app-owned content.
- Use existing image and icon assets; do not replace source assets with emoji, CSS drawings, or approximate glyphs.
- Limit global/shared component edits; prefer page-scoped styles so unrelated screens do not change.
- Verify on WeChat developer tools iPhone 12/13 Pro at the same data and interaction state.

---

### Task 1: Startup Screen

**Files:**
- Modify: `miniprogram/src/pages/index/career-watch-page.tsx`
- Modify: `miniprogram/src/pages/index/index.scss`

**Interfaces:**
- Consumes the existing `startSetup` and `uploadResume` actions.
- Produces the existing `start` state with Figma-aligned image crop, content rhythm, feature rows, and CTA placement.

- [x] Capture the guest startup state and normalize it to the 390 x 844 device content viewport.
- [x] Compare hero height/crop, 24px content padding, 32px title, feature spacing, and CTA placement against Figma.
- [x] Apply only startup-state markup/style corrections and rebuild the WeChat bundle.
- [x] Capture again and retain the iteration only if the largest visual differences decrease.

### Task 2: Company Directory

**Files:**
- Modify: `miniprogram/src/pages/companies/index.tsx`
- Modify: `miniprogram/src/pages/companies/index.scss`
- Modify shared search/topic components only when page-scoped CSS cannot match Figma.

**Interfaces:**
- Consumes existing company search, industry filtering, follow state, pagination, and detail navigation.
- Produces the same directory behavior with Figma-aligned header, search/filter controls, 44px logo rows, metadata, and compact follow action.

- [x] Capture the logged-in default directory state and normalize it to the same viewport.
- [x] Compare header, search, filters, row height, logo, typography, metadata, and follow control against Figma.
- [x] Apply scoped markup/style corrections while preserving all real company fields and actions.
- [x] Rebuild, capture, and retain only improvements.

### Task 3: Profile Center

**Files:**
- Modify: `miniprogram/src/pages/profile/index.tsx`
- Modify: `miniprogram/src/pages/profile/index.scss`

**Interfaces:**
- Preserve existing account, membership, followed-company, settings, and navigation actions.
- Produce the Figma profile hierarchy and visual treatment with current real data.

- [x] Capture the logged-in profile state.
- [x] Align profile header, stats, membership treatment, grouped menu rows, and safe-area behavior.
- [x] Rebuild and compare at the same state.

### Task 4: Membership Plans

**Files:**
- Modify: `miniprogram/src/pages/membership/index.tsx`
- Modify: `miniprogram/src/pages/membership/index.scss`

**Interfaces:**
- Preserve current purchasable plans, prices, selected plan, payment flow, legal text, and entitlement copy.
- Produce the Figma header, plan selector, benefit list, review/trust areas when backed by current data, and fixed CTA hierarchy.

- [x] Capture the default membership selection state.
- [x] Align header, plan cards, benefit rows, scroll region, and purchase CTA to Figma without changing plan data.
- [x] Rebuild and compare at the same selection state.

### Task 5: Visual QA

**Files:**
- Create or update: `design-qa.md`
- Create: `artifacts/mini-figma-secondary-screens/` screenshots and comparisons.

**Interfaces:**
- Consumes source references and final WeChat captures for all four screens.
- Produces a final QA record with viewport, state, comparison history, remaining findings, and `final result`.

- [ ] Put each source and implementation capture into a combined comparison image.
- [x] Record typography, spacing, color, asset, and copy findings by severity.
- [x] Fix remaining P0/P1/P2 items or mark the exact blocker.
- [x] Run `npm run build:weapp` and `git diff --check`.
