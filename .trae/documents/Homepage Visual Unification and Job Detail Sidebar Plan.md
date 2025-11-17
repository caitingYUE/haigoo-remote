# Goals
- Unify page background, header, and content colors to the brand gradient without layered mismatches
- Fix search capsule layout and spacing (icon, placeholder, Explore button)
- Switch tabs, buttons, and accents from purple to brand blue
- Use a single background for the list section (no overlapping white + yellow containers)
- Insert a compact feature highlight strip between hero and tabs
- Replace the current job detail modal with a right-side sidebar that does not occlude content
- Update theme tokens to match logo and head-image palette

# Current References (where changes apply)
- Header bar and navigation: `src/components/Header.tsx`
- Homepage hero + search + list section: `src/pages/LandingPage.tsx`, `src/styles/landing.css`
- Legacy home list & tabs (for parity of behavior): `src/pages/HomePage.tsx:252-275` (tabs code block)
- Job card colors and hover accents: `src/components/JobCard.tsx:124-150, 152-229`
- Tag badges used in cards: `src/components/SingleLineTags.tsx:28-35`
- Job detail overlay (to be reworked to sidebar): `src/components/JobDetailModal.tsx:200-289`

# Design Tokens (to be created/updated)
- Brand core: `--brand-blue #3182CE`, `--brand-navy #1A365D`, `--brand-teal #0EA5A3`, `--brand-orange #F59F0B`, `--brand-sand #F5F5DC`
- Light tints: `--brand-blue-10`, `--brand-teal-10`, `--brand-orange-10`
- Component tokens: header bg, nav link hover, tab active bg/text, tag bg/text, card border/hover, list-section gradient
- Location: `src/styles/landing.css` (centralized), then referenced by components

# Implementation Plan
## 1. Header Unification
- Remove the three nav tabs (Job Search, AI Copilot, Community)
- Enlarge logo and add text label “Haigoo Remote Club” beside it
- Set header background to transparent (or the same gradient as hero if preferred) and unify link hover to brand blue
- Code: update `src/components/Header.tsx` and add helper classes in `landing.css`

## 2. Hero & Background
- Keep a single gradient background for the hero (blue→sand)
- Overlay the foreground SVG `src/assets/home_bg.svg` positioned so it never collides with text
- Place title + search capsule in a safe content block (left-aligned) with fixed max-width; adjust at responsive breakpoints
- Code: `LandingPage.tsx` layout and `landing.css` hero classes

## 3. Search Capsule Fixes
- Make the search bar a single capsule of height 56px, radius 28, inner padding 20px
- Align icon spacing (8–12px), placeholder color `#A0AEC0`
- Embed the Explore button inside the capsule (same height & radius), min width 160px
- Code: capsule classes in `landing.css`; JSX in `LandingPage.tsx`

## 4. Tabs & Accents Switch to Blue
- Replace purple tab selected state with brand blue: active pill = `--brand-blue-10` bg + `--brand-blue` text
- Ensure hover states use neutral/blue and remove any lingering purple classes
- Code: switch classes in `HomePage.tsx:252-275` to use `.tab-pill` and `.active`; styles in `landing.css`

## 5. List Section Background (single layer)
- Remove double-layer white/yellow containers below hero
- Use one gradient: `list-section` (sand→white), applied to the whole list wrapper
- Code: `LandingPage.tsx` list wrapper class; `landing.css` gradient

## 6. Feature Highlights Strip (between hero & tabs)
- Add a compact strip with 2–3 bullet highlights (e.g., “日更数千个远程岗位”、“AI为你求职保驾护航”) in one row
- Style: minimal, brand navy text, small icons
- Code: new block in `LandingPage.tsx` and CSS in `landing.css`

## 7. Job Detail Sidebar (replace modal)
- Convert the center modal to a right-side drawer
- Width 560–640px; full height; sticky bottom CTA in brand blue
- Keep list clickable and readable behind the drawer; drawer scrolls independently
- Code: rework container and transitions in `JobDetailModal.tsx:200-289`; add a boolean to open as drawer; ensure ESC/click-out closes

## 8. Job Card Palette Harmony
- Title color: brand navy; hover: brand blue
- Company initial avatar: brand blue/teal/orange/navy rotation
- Hover border: brand blue 30% tint
- Code: `JobCard.tsx:124-150, 152-229`

## 9. Tags & Badges Harmonization
- Update `SingleLineTags` to use brand blue badge classes for xs/sm variants, plus badges in neutral gray when collapsed
- Code: `SingleLineTags.tsx:28-35` referencing new classes in `landing.css`

## 10. Accessibility & Responsiveness
- Ensure keyboard focus rings match brand blue
- Maintain readable contrast over gradient and foreground SVG
- Responsive title-wrap width by breakpoint to prevent overlaps

# Testing & Verification
- Visual diff at 1440/1280/1024/768/375: margins, capsule alignments, tab colors, single-layer background
- Emulate page with large/small foreground SVG to verify no overlap with text and search
- Click-through job card → drawer: verify scroll independence, ESC & outside click close
- Lighthouse color contrast & accessibility checks (buttons, links, inputs)

# Rollout & Risk Mitigation
- Changes scoped to LandingPage, Header, JobCard, SingleLineTags, JobDetailModal, and shared CSS
- Easy rollback by toggling classes; keep previous purple palette behind a feature flag if needed

# Deliverables
- Updated components and CSS tokens
- A short design note documenting the brand token usage and component rules
- Screenshot set for each breakpoint

# Acceptance Criteria
- Header/bg/tabs/buttons unified to blue palette; no visible purple
- Single background for list section; no double layers
- Search capsule and Explore button visually aligned and proportional
- No text overlap with foreground SVG; drawer detail view clear and readable
- Visual QA sign-off from design