# Haigoo Remote Design System & Experience Direction

> Status: Palette-cohesion refresh implemented and under launch review  
> Updated: 2026-08-13  
> Product direction: **CONTEMPORARY EDITORIAL UTILITY × GLOBAL CAREER × QUIET PREMIUM**

## 2026-08-13 visual authority override

This section supersedes older color guidance elsewhere in this document. The first editorial pass felt dusty and mixed orange, muted green, violet, blue, and bright membership gold without a stable hierarchy. The current public product uses one visual authority:

- **Warm orange** (`#e96832`, interactive dark `#c94f22`) marks brand emphasis, selection, focus, and primary editorial accents.
- **Ink and cool neutrals** (`#182033`, `#344054`, `#667085`) carry text, high-commitment actions, and supporting information.
- **White and lifted cool gray** (`#ffffff`, `#f6f7fa`, `#f1f3f6`) replace heavy gray paper treatments and keep the experience bright.
- **Quiet copper-gold** is reserved for small Club identity markers. It must not color ordinary buttons, tabs, filters, or page-level surfaces.
- Success, warning, and danger colors stay local to feedback icons, thin borders, and critical status text. They do not become full competing surfaces.
- Purple, blue, and editorial green are no longer public UI accents. Company logos, photographs, and editorial media may retain their source colors.

Canonical implementation tokens live in `src/styles/palette-cohesion.css`, imported after the legacy style layers. New components must use those semantic tokens rather than extend the legacy palettes below.

This document is the source of truth for the current Haigoo Remote brand upgrade. It defines the visual system, information architecture, interaction principles, UX writing voice, responsive behavior, accessibility requirements, and compliance guardrails before implementation begins.

The redesign is not a cosmetic pass. It reframes Haigoo from a membership-led remote job product into an open, continuously maintained global work-information and career-exploration product.

---

## 1. Product promise

Haigoo Remote is:

- An open and free directory of global remote-work information collected from public sources.
- A calm place to understand companies, work patterns, and career possibilities.
- A lightweight personal workspace for saving opportunities, recording applications, and continuing career growth.
- A home for existing historical Club members whose real, existing benefits remain available.
- A place where independent career consulting may be introduced without being attached to any job-information or application flow.

Haigoo Remote is not:

- A recruiting marketplace or candidate-screening service.
- A personalized job-recommendation or matching product for new/free/anonymous users.
- A paid job-information directory.
- A referral or private-contact marketplace.
- A high-pressure membership conversion funnel.
- A training institution or a generic purple AI SaaS product.

### Experience principles

1. **Open by default** — public job information is visible without a paywall.
2. **Official by design** — the final application action returns to the employer's official channel.
3. **Evidence before claims** — activity signals and counts use real data only.
4. **Calm, not passive** — the interface feels actively maintained without urgency tactics.
5. **Editorial hierarchy over card density** — typography, dividers, rhythm, and photography do most of the visual work.
6. **Continuity for existing members** — historical benefits feel intentionally maintained, not left behind.
7. **No hidden commercial turn** — consulting remains separate from job discovery and application.

---

## 2. Audit scope and evidence

The production site at `https://haigooremote.com/` was reviewed at 1440 px desktop, 768 px tablet, and 375 px mobile. The repository's CSS, Tailwind configuration, shared header, homepage, job discovery, company directory, career-growth pages, profile/Club center, consultation component, and compliance switches were also inspected.

### Current-state screenshots

| Surface | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Homepage | `artifacts/brand-audit-2026-08-11/01-home-desktop-1440-viewport.png` | `artifacts/brand-audit-2026-08-11/06-home-tablet-768.png` | `artifacts/brand-audit-2026-08-11/10-home-mobile-375.png` |
| Remote jobs | `artifacts/brand-audit-2026-08-11/02-jobs-desktop-1440-viewport.png` | `artifacts/brand-audit-2026-08-11/07-jobs-tablet-768.png` | `artifacts/brand-audit-2026-08-11/11-jobs-mobile-375.png` |
| Remote companies | `artifacts/brand-audit-2026-08-11/03-companies-desktop-1440-viewport.png` | `artifacts/brand-audit-2026-08-11/08-companies-tablet-768.png` | `artifacts/brand-audit-2026-08-11/12-companies-mobile-375.png` |
| Career growth | `artifacts/brand-audit-2026-08-11/04-career-desktop-1440-viewport.png` | `artifacts/brand-audit-2026-08-11/09-career-tablet-768.png` | `artifacts/brand-audit-2026-08-11/13-career-mobile-375.png` |
| My / Club entry | Login redirect captured | — | `artifacts/brand-audit-2026-08-11/14-profile-login-mobile-375.png` |

### Evidence boundary

The authenticated profile/Club workspace could not be freshly captured without user credentials. Its audit is therefore based on source inspection and the supplied reference screenshots, while public pages are based on current production screenshots. This distinction must remain visible in later before/after reporting.

### Production versus local source

The local worktree already contains several compliance-oriented changes that are not reflected in the captured production site, including feature flags, revised homepage copy, hidden payment/recommendation surfaces, monthly application quota logic, and an expanded consultation component. Phase 2 must verify both states:

- **Production before:** what users currently see.
- **Local baseline:** the implementation state from which the redesign will be built.

Do not treat an improved local string as proof that production behavior is compliant or visually complete.

---

## 3. Current visual-system summary

### What already works

- Warm ivory backgrounds and sea/window photography give Haigoo a recognizable emotional atmosphere.
- Deep slate text is readable and calmer than a typical recruitment marketplace.
- The handwritten hero title is a recognizable brand asset.
- The career-growth page uses stronger imagery and editorial scale than the rest of the product.
- Lucide is already available and can become the shared icon system.
- The codebase contains explicit compliance switches that preserve dormant capabilities without deleting business logic.
- Existing job, company, favorite, application, membership, and career-content data can be reused.

### What currently conflicts

| Area | Current condition | User impact | Priority |
| --- | --- | --- | --- |
| Product story | Production still foregrounds matching, Club access, referrals, and member conversion | The open-product upgrade is invisible; users may read removals as decline | P0 |
| Information architecture | `精选企业` and `Club 中心` remain top-level; normal users receive `FREE` labels | Old membership framing dominates the new product | P0 |
| Job discovery | `推荐`, match language, rounded card stacks, gated details, and referral panels remain visible in production | Conflicts with objective ordering and official-apply positioning | P0 |
| Company directory | Search and full lists are described as Club-gated; employer intake is visible | Feels like a marketplace and weakens the open-information promise | P0 |
| Metadata | `index.html` still describes AI recommendation and an “all-in-one” job service | Search/social previews communicate an outdated product | P0 |
| Homepage hierarchy | Header search duplicates Hero search; several floating cards compete for attention | The first screen feels busy but not authoritative | P1 |
| Visual language | Large rounded containers, purple icon tiles, glass panels, gradients, and shadows recur everywhere | Creates a generic AI SaaS impression | P1 |
| Typography | Inter/system UI, image-based handwritten headings, and isolated oversized English display type coexist | Brand voice changes page by page; Chinese editorial hierarchy is weak | P1 |
| Responsive behavior | Desktop sections are frequently stacked on mobile rather than recomposed | First screens become long, card-heavy, or typographically oversized | P1 |
| Accessibility | No global skip link was found; some pale text and purple text fail normal-text AA; dialogs need focus auditing | Keyboard and low-vision use are less reliable | P1 |
| CSS architecture | Tailwind tokens, `index.css`, `landing.css`, and `landing-upgrade.css` define competing systems | Visual drift and regression risk increase with every page | P1 |

### Quantified implementation debt

- `src/index.css` repeats complete base/component layer blocks.
- Tailwind defines blue as `haigoo.primary`, while root CSS defines deep navy and page components frequently hardcode purple.
- A repository scan found hundreds of unique hex values in `src`, rather than a controlled palette.
- Rounded utility usage is dominated by `rounded-full`, `rounded-lg`, `rounded-xl`, and `rounded-2xl`, with many additional arbitrary 18–30 px values.
- Shadow and gradient utilities are repeatedly defined at component level.
- The Chinese hero title is a raster image rather than live, selectable text.
- The profile center is a very large mixed-responsibility component, making visual changes risky even when business logic is unchanged.

### Design interpretation

The codebase does not lack visual effort; it lacks a single visual authority. The redesign must consolidate the system before adding more page-specific styling.

---

## 4. Chosen design direction

### WARM EDITORIAL

Use warm paper-like surfaces, strong but restrained typography, fine rules, varied column widths, and deliberate image crops. The interface should feel composed like a contemporary global-work publication, not decorated like a landing-page template.

### GLOBAL CAREER

Language and imagery should cover work, place, direction, growth, and life design. Remote work is the primary information domain, not the only possible career identity.

### QUIET PREMIUM

Premium quality comes from precision, pacing, photography, and restraint. It must not rely on gradients, glassmorphism, oversized shadows, sales copy, or artificial scarcity.

### Explicitly rejected directions

- **Horizontal-scroll storytelling:** discoverability, accessibility, and mobile reliability are poor for an information utility.
- **Retro/VHS/film styling:** atmosphere is welcome, but visible nostalgia effects would make the job data feel less current and trustworthy.
- **Bento dashboard language:** the current problem is already excessive cardization.
- **Bodoni/Calistoga as primary Chinese display type:** these styles do not solve Simplified Chinese typography and risk turning the brand into a fashion or poster aesthetic.
- **Full serif interface:** job search, filters, account management, and multilingual data require a highly legible sans-serif UI.
- **Purple gradient system:** purple remains a brand accent, not a page background or universal component color.

---

## 5. Legacy audit token architecture (historical reference)

The tokens in this section document the 2026-08-11 audit baseline. They are retained for migration context only and must not be used for new UI. The canonical live palette is the 2026-08-13 override above and `src/styles/palette-cohesion.css`.

Use three layers:

1. **Primitive tokens** describe raw values.
2. **Semantic tokens** describe purpose.
3. **Component tokens** describe controlled component decisions.

Components must not introduce a new raw color, radius, or shadow unless the design system is intentionally revised.

### 5.1 Primitive color tokens

```css
:root {
  /* Ink */
  --color-ink-950: #0f172a;
  --color-ink-800: #1e293b;
  --color-ink-700: #334155;
  --color-ink-600: #475569;
  --color-ink-500: #64748b;
  --color-ink-400: #94a3b8;

  /* Warm paper */
  --color-ivory-50: #fffdf8;
  --color-ivory-100: #fbfaf6;
  --color-ivory-200: #f6f1e8;
  --color-ivory-300: #e9e1d5;

  /* Sand */
  --color-sand-100: #f4ebdd;
  --color-sand-300: #dfcdb6;
  --color-sand-600: #8b6536;

  /* Mist blue */
  --color-mist-50: #f4f8fb;
  --color-mist-100: #edf4f8;
  --color-mist-300: #c9dce8;
  --color-mist-600: #52738c;

  /* Muted sage */
  --color-sage-50: #f3f6f0;
  --color-sage-100: #e9f0e5;
  --color-sage-400: #8a9a83;
  --color-sage-700: #4e6250;

  /* Haigoo purple */
  --color-purple-50: #f4f1ff;
  --color-purple-100: #e9e5ff;
  --color-purple-500: #6f63f6;
  --color-purple-600: #5d50df;
  --color-purple-700: #5142df;

  /* Status */
  --color-success-50: #edf8f1;
  --color-success-700: #216e45;
  --color-warning-50: #fff7e6;
  --color-warning-700: #8a5a00;
  --color-danger-50: #fff1f0;
  --color-danger-700: #b42318;
}
```

`#6f63f6` has insufficient contrast for normal-size text on the warm page backgrounds. Use it for decoration, large text, icons, borders, and graphical accents. Use `#5d50df` or darker for normal interactive text.

### 5.2 Semantic color tokens

```css
:root {
  --bg-page: var(--color-ivory-100);
  --bg-surface: var(--color-ivory-50);
  --bg-subtle: var(--color-ivory-200);
  --bg-cool-subtle: var(--color-mist-50);
  --bg-success-subtle: var(--color-sage-50);

  --text-primary: var(--color-ink-950);
  --text-secondary: #596b80;
  --text-muted: var(--color-ink-500);
  --text-disabled: var(--color-ink-400);
  --text-on-dark: var(--color-ivory-50);

  --border-subtle: #e6e1d8;
  --border-default: #d9d3c9;
  --border-cool: var(--color-mist-300);

  --action-primary: var(--color-ink-950);
  --action-primary-hover: var(--color-ink-800);
  --action-brand: var(--color-purple-600);
  --action-brand-hover: var(--color-purple-700);
  --focus-ring: var(--color-purple-600);

  --status-success: var(--color-success-700);
  --status-warning: var(--color-warning-700);
  --status-danger: var(--color-danger-700);
}
```

### 5.3 Color usage ratio

- 70% warm ivory / warm white.
- 20% ink, borders, photography, and neutral information color.
- 7% mist, sand, or sage surfaces.
- 3% Haigoo purple accent.

Purple is not the default background for sections, cards, icon tiles, or dashboards.

---

## 6. Typography

### 6.1 Type roles

**Interface and body**

```css
--font-sans: "Inter", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
```

**Editorial display and quotations**

```css
--font-editorial: "Noto Serif SC", "Source Han Serif SC", "Songti SC", STSong, serif;
```

Before introducing a web font, verify licensing, Chinese glyph coverage, loading cost, and cumulative layout shift. Prefer a self-hosted, subsetted WOFF2 with `font-display: swap`. Do not add a runtime dependency on Google Fonts.

### 6.2 Brand-title rule

The phrase “用你喜欢的方式 / 工作和生活” remains a brand asset, but it should move toward live text:

- Use a confident editorial sans/serif composition for the words.
- Keep only one restrained handwritten accent, such as the existing small love mark or one underlined phrase.
- Do not render the complete heading as an image in the long term.
- Keep an accessible live `<h1>` from the first implementation step, even during a transitional visual treatment.

### 6.3 Type scale

```css
--text-caption: 0.75rem;                    /* 12 */
--text-label: 0.8125rem;                    /* 13 */
--text-body-sm: 0.875rem;                   /* 14 */
--text-body: 1rem;                          /* 16 */
--text-body-lg: 1.125rem;                   /* 18 */
--text-title-sm: 1.375rem;                  /* 22 */
--text-title: clamp(1.75rem, 2vw, 2.5rem);  /* 28–40 */
--text-display: clamp(2.75rem, 5vw, 5.5rem);/* 44–88 */
```

### 6.4 Typography behavior

- Chinese body line-height: 1.7–1.85.
- Interface line-height: 1.35–1.5.
- Display line-height: 1.02–1.14.
- Use weights 400, 500, 600, and 700. Reserve 800 only for rare Latin metadata; remove pervasive `font-black` styling.
- Chinese text uses neutral tracking; uppercase English metadata may use `0.10–0.16em` tracking.
- Long-form reading width: 38–46 Chinese characters per line.
- Avoid all-caps English labels when a natural Chinese label is clearer.

---

## 7. Spacing, grid, and content widths

### 7.1 Spacing scale

```css
--space-1: 0.25rem;  /* 4 */
--space-2: 0.5rem;   /* 8 */
--space-3: 0.75rem;  /* 12 */
--space-4: 1rem;     /* 16 */
--space-5: 1.25rem;  /* 20 */
--space-6: 1.5rem;   /* 24 */
--space-8: 2rem;     /* 32 */
--space-10: 2.5rem;  /* 40 */
--space-12: 3rem;    /* 48 */
--space-16: 4rem;    /* 64 */
--space-20: 5rem;    /* 80 */
--space-28: 7rem;    /* 112 */
--space-36: 9rem;    /* 144 */
```

Section spacing is responsive, not fixed:

- Mobile: 56–72 px.
- Tablet: 72–96 px.
- Desktop: 96–144 px.

### 7.2 Content widths

```css
--content-reading: 45rem; /* 720 */
--content-default: 75rem; /* 1200 */
--content-wide: 82.5rem;  /* 1320 */
--content-hero: 90rem;    /* 1440 */
--content-max: 97.5rem;   /* 1560 */
```

### 7.3 Grid

- 1440–1728: 12 columns, 24 px gaps, 48–72 px page gutters.
- 1024: 12 columns, 20 px gaps, 40 px gutters.
- 768: 8 columns, 20 px gaps, 32 px gutters.
- 375: 4 columns, 16 px gaps, 20 px gutters.
- Use asymmetry through column spans, not through arbitrary absolute positioning.
- Editorial text and imagery may break the internal grid, but interactive controls must retain predictable alignment.

---

## 8. Radius, borders, and elevation

```css
--radius-sm: 0.5rem;      /* 8: compact control */
--radius-control: 0.625rem;/* 10 */
--radius-card: 1rem;      /* 16 */
--radius-media: 1.125rem; /* 18 */
--radius-container: 1.375rem; /* 22 */
--radius-pill: 9999px;

--shadow-subtle: 0 1px 2px rgba(15, 23, 42, 0.04);
--shadow-floating: 0 14px 36px -24px rgba(15, 23, 42, 0.24);
--shadow-modal: 0 28px 72px -28px rgba(15, 23, 42, 0.38);
```

Rules:

- Large containers may use 20–24 px radius only when they truly group a complete region.
- Cards use 14–18 px radius.
- Buttons and compact pills may use full radius.
- Lists, quotes, process steps, filters, and text groups should often use dividers instead of boxes.
- No hover scale for content cards.
- Default content surfaces have no shadow. Use a shadow only when elevation communicates layer or interaction.
- Glass blur is limited to transient overlays over photography; it is not a global surface treatment.

---

## 9. Iconography and photography

### 9.1 Icons

- Use Lucide or existing consistent SVG line icons.
- Default size: 16, 18, 20, or 24 px.
- Stroke width: 1.75 px.
- Icons inherit text color.
- Do not place every icon inside a purple rounded tile.
- Do not use emoji as functional navigation or primary visual language.
- Every icon-only control requires an accessible name and at least a 44 × 44 px hit target.
- Do not mix line icons, hand-drawn emoji-like illustrations, and filled Material icons in one product surface.

### 9.2 Photography

Use:

- Sea, windows, natural light, cities, desks, mountains, trains, and lived-in travel settings.
- Work and life shown together without forced “digital nomad” clichés.
- A warm, slightly desaturated treatment with natural skin and sky color.
- Editorial crops that leave genuine negative space for text.
- Useful captions or contextual metadata where a photograph carries information.

Avoid:

- Suits, handshakes, interview tables, stock-office teamwork, AI robots, neon technology, and over-staged laptop-on-beach imagery.
- Large decorative images that delay LCP without advancing the page story.
- Heavy grain. If used, keep it below 2–3% opacity and remove it under `prefers-reduced-transparency` if implemented.

Performance:

- AVIF/WebP with responsive `srcset`.
- Set explicit dimensions/aspect ratio.
- Eager-load the LCP asset only; lazy-load below-the-fold photography.
- Avoid filter animations and scroll parallax on mobile.

---

## 10. Motion

```css
--duration-fast: 150ms;
--duration-standard: 200ms;
--duration-enter: 320ms;
--ease-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
```

- Job-row hover: background tint + arrow translate 3–4 px in 150–220 ms.
- Menu/drawer/modal: opacity plus 8–16 px movement in 240–320 ms.
- Section entrances may use a subtle 12 px fade-up once; no continuous floating decoration.
- Never animate layout-critical dimensions while content loads.
- Under `prefers-reduced-motion: reduce`, remove translation, parallax, marquee, autoplay, and non-essential entrance animation.
- Avoid `transition: all`; transition only the properties that change.

---

## 11. Global shell and information architecture

### 11.1 Primary navigation

1. 首页
2. 远程工作
3. 远程企业
4. 职业成长
5. 我的

Changes:

- `精选企业` → `远程企业`.
- `Club 中心` → `我的` for the top-level destination.
- Historical members see `Haigoo Club Member` inside the personal workspace, not as the global navigation model.
- Normal users never see `FREE`, `免费用户`, or an upgrade prompt.

### 11.2 Header search behavior

- Homepage: hide the Header search; Hero search is the only primary search.
- Desktop search-oriented inner pages: show a compact contextual Header search.
- Mobile jobs/companies: keep search in the page header or sticky filter region, not compressed into the global Header.
- Preserve the entered query across navigation where current logic supports it.
- Do not gate search-result visibility behind Club membership.

### 11.3 Header composition

- Warm ivory background with a fine bottom border; remove the default large shadow.
- Max-width aligns with page grid.
- Active navigation uses ink plus a quiet 1–2 px underline or dot; purple is secondary.
- At 375 px: logo, “我的” or profile control, language entry if essential, and one menu button.
- Mobile menu must trap focus, close on Escape, restore focus, and expose all five destinations.
- Add a visible-on-focus “跳到主要内容” link.

---

## 12. Homepage blueprint

### 12.1 Hero

**Headline**

> 用你喜欢的方式  
> 工作和生活

**Subheading**

> 从全球企业的公开渠道出发，发现不同的远程工作方式。  
> 岗位信息全部开放，申请回到企业官网，选择始终在你手里。

**Search placeholder**

> 搜索岗位、公司或技能

Desktop composition:

- 7/5 asymmetric grid.
- Left: headline, subheading, search, lightweight category navigation.
- Right: one composed photographic brand story, not several unrelated floating cards.
- Remove the duplicated top greeting banner.
- The “今日小确幸” thought may become a small caption without icon, or be removed if it competes with the brand story.

Mobile composition:

- Headline and search first.
- Atmosphere image becomes a wide editorial figure below the search, not a narrow desktop card stacked vertically.
- Categories become a horizontal text list or two-row compact grid with strong focus/scroll affordance.
- The promise strip follows immediately so the openness upgrade is visible in the first two screens.

### 12.2 Right-side brand story

**Lead**

> 从一份远程工作开始。

**Body**

> 有人想换一种工作方式，  
> 有人想换一个国家，  
> 也有人只是想把生活拿回来一点。  
>  
> Haigoo 持续整理来自全球企业公开渠道的远程机会。

**Metadata**

- PUBLIC SOURCE
- UPDATED
- DIRECT APPLY

No CTA is required. If the complete figure is clickable, it may link to Remote Jobs with an accessible text label.

### 12.3 Product promise strip

**Title**

> 所有岗位现已开放

**Items**

1. **公开来源** — 企业官网与公开 Careers 页面
2. **持续整理** — 关注职位状态与信息变化
3. **官网直达** — 申请回到企业官方渠道

Visual behavior:

- A full-width editorial rule/strip, not an alert or a four-card feature grid.
- Use one continuous surface with dividers.
- If real data exists, add one quiet live signal such as “今天更新” or “本周新增 24 个岗位”; never hardcode a number.

### 12.4 Category navigation

产品 / 开发 / 设计 / 市场 / 运营 / 商务 / 更多

- Use typography plus one consistent line icon if necessary.
- Avoid emoji-like image icons and large individual cards.
- Selected/hover state: underline or subtle mist background.

### 12.5 Recent jobs

**Section title**

> 最近更新的远程机会

**Section description**

> 整理自企业官网及公开招聘渠道，按公开时间与最近更新展示。

- Use the editorial job-row component defined below.
- Default order uses objective `updated_at` / `published_at` fields.
- No “人工精选”, “综合推荐”, “猜你喜欢”, “适合你的岗位”, or match score.
- Category tabs may remain as explicit user filters, never as inferred preference.

### 12.6 Remote companies

- Restore the existing company information section below the jobs.
- Use an editorial 3-column image-led layout on large screens, a 2-column layout at tablet, and one featured company plus compact rows on mobile.
- Do not imply endorsement, employer partnership, or candidate fit unless supported by factual fields.

### 12.7 Community

The community block may remain as an open peer-exchange area:

- “岗位分享”
- “自由分享好机会”
- “开放交流群，正在找机会的朋友可以互相探讨。”

It must not promise private jobs, prioritized leads, referrals, or member-only recruitment information.

---

## 13. Remote Jobs blueprint

Remote Jobs is the core product surface and should carry more visual authority than marketing content.

### 13.1 Page structure

Desktop:

- Page title and real activity signal.
- Search and filters in one calm toolbar.
- Optional split view remains if it helps scan → inspect behavior.
- Left list uses editorial rows; right detail uses the same token system and clear official-source context.

Mobile:

- Search stays visible near the top.
- Filters open in a full-height drawer with active-filter count and clear/reset actions.
- The list is not a vertical pile of desktop cards.
- Job detail opens as a new route or full-screen sheet with browser-back support.

### 13.2 Sorting

- UI labels: `默认` and `最新`.
- `默认` must map to a deterministic, non-personalized objective order.
- `最新` maps to the newest available `published_at` / `updated_at` behavior already supported by the backend.
- Personalized ranking, resume matching, and recommendation code remain dormant behind compliance switches.
- Empty-state copy must not mention “AI strong recommendation” when personalized discovery is off.

### 13.3 Editorial job row

Information priority:

1. Company
2. Job title
3. Function
4. Employment type
5. Remote region
6. Language, if real data exists
7. Source
8. Updated time
9. Official-apply arrow

Visual rules:

- No enclosing large rounded card by default.
- 1 px divider, 20–28 px vertical padding.
- Company logo is optional and small; typography remains primary.
- Tags are limited to information needed for scanning. Avoid six or more pills.
- Hover: mist tint and 4 px arrow shift.
- Selected row: cool subtle background plus a 2 px ink/purple accent at the leading edge.
- Entire row may be clickable, but nested save controls remain independently focusable.

### 13.4 Job detail

- Primary action: `官网直申`.
- Guest state: `官网直申（需登录）`.
- Free signed-in state retains the existing `n/20` display.
- Historical active members retain unlimited official application and email-application behavior according to real entitlements.
- Source and latest update are visible near the title.
- Public job information is not blurred or described as member-only.
- “帮我内推” remains hidden for guests and non-members; existing member behavior remains controlled by real entitlement and compliance switches.
- No consulting CTA, Club CTA, membership banner, or private contact upsell appears in the job flow.

---

## 14. Remote Companies blueprint

**Page title**

> 值得长期关注的远程企业

**Description**

> 了解它们做什么、如何工作，以及在哪里查看最新机会。

Information model:

- Company name and factual category.
- What the company does.
- Remote-work pattern or region, only when sourced.
- Official site / Careers source.
- Last verified or updated date.
- Current public opportunities, when real data exists.

Visual direction:

- Editorial company intelligence, not employer marketplace cards.
- Lead with one or two image-led features, then use compact company records.
- Remove Club-gated search language and “unlock complete list” CTA.
- Remove employer recruitment intake while the related compliance flag is off.
- Avoid “顶尖”, “最适合”, “更适合中国候选人”, or endorsement claims unless a published methodology supports them.

---

## 15. My Haigoo blueprint

### 15.1 Information architecture

**Page title:** 我的 Haigoo

Sidebar:

1. 首页
2. 我的收藏
3. 申请记录
4. 职业成长
5. 咨询服务
6. 关于 Haigoo
7. 反馈
8. 账户设置

For normal users:

- Do not show `Free User`, `免费用户`, an upgrade meter, price comparison, order history, PayPal, or redemption-code entry.
- Favorites and application records may be summarized on Home and remain reachable as workspace views/routes.
- Preserve existing favorite, application, feedback, and account data and actions.

For historical members:

- Show a quiet `Haigoo Club Member` or `Founding Member` badge only when supported by real membership data.
- Display `你的 Club 权益继续保留` and the true validity period.
- Render only entitlements that actually exist in the user record.
- Existing growth content, video notes, English practice, consulting, email application, and other real historical benefits remain accessible according to existing logic.
- Do not expose new Club purchase or upgrade entry points.

### 15.2 Dashboard

**Greeting**

> 晚上好，{userName}

**Subheading**

> 把看过的机会、做过的选择和下一步计划留在这里。

Quick access:

- 收藏的机会
- 申请记录
- 职业成长

Main content:

- Left: recent saved opportunities.
- Right: recent application records.
- Application status: 想申请 / 已申请 / 面试 / 结束.

Avoid three oversized KPI cards. Counts may appear as quiet metadata next to labels.

### 15.3 Workspace visual behavior

- Use a persistent, narrow sidebar at 1024+.
- At 768, use a top section switcher or compact drawer.
- At 375, Home becomes a composed timeline/list; do not stack every desktop module as a card.
- Empty states contain one useful next action, not an upsell.
- The profile/login/auth screens must adopt the same warm page, typography, border, and photography system so the experience does not drop back to an MVP aesthetic.

---

## 16. Consultation blueprint

Consultation is an independent career-guidance service. It must never be connected to a specific job page, search result, company page, or application action.

### 16.1 Hero

**Title**

> 职业卡住的时候，先把问题说清楚

**Description**

> 把经历、现实限制和长期目标放到同一张桌面上，  
> 一起看清现在真正需要解决的问题，以及下一步值得推进什么。

Tags:

- 方向判断
- 转型梳理
- 简历表达
- 成长规划

CTA:

> 说说你现在的问题 →

The QR code is removed from the Hero. The CTA opens an accessible modal/drawer with:

- 联系 Haigoo 顾问
- WeChat QR code
- `hi@haigooremote.com`
- Close control, focus trap, Escape handling, and focus restoration.

### 16.2 Problem stories

Use an editorial quote grid with numbers, dividers, and whitespace—no four-card SaaS grid.

**01**  
“申请很多，却迟迟没有回复。”  
问题也许不只是简历。

**02**  
“做过很多项目，但不知道怎么说清楚。”  
经历很多，职业资产却没有被看见。

**03**  
“想换方向，又怕过去几年白费。”  
真正需要判断的是：哪些能力可以带走。

**04**  
“每个选择都好像有代价。”  
那就先把限制、目标和优先级摆出来。

### 16.3 Outcomes

**Section title**

> 一次咨询，最后带走什么

**01 看清问题**  
不是泛泛聊职业，而是确认现在真正卡住的是方向、经历表达、能力缺口，还是现实约束。

**02 建立判断**  
把目标、优势、限制和可行动空间放到一起，形成更清楚的优先级。

**03 留下一份可以继续使用的东西**  
根据实际问题提供简历建议、行动清单、表达框架或阶段性准备材料。

Supporting note:

> 实际交付会根据你的问题不同而调整，不要求每个人走同一套流程。

Specific capabilities may appear further down as a compact text list, not a paid package comparison:

- 工作方向与简历初步诊断
- 简历诊断及职业发展评估
- 中 / 英文简历优化
- 30–60 分钟语音咨询
- 定制远程求职准备材料
- 定制求职简历

### 16.4 Compliance copy

Keep one calm footer note:

> 咨询提供职业分析、表达反馈和行动支持，不售卖岗位信息，不提供岗位推荐、内推或招聘撮合，也不承诺面试或录用结果。

Do not repeat defensive compliance warnings after every section.

---

## 17. UX writing system

### 17.1 Voice

| Attribute | We are | We are not |
| --- | --- | --- |
| Clear | State source, action, and boundary directly | Legalistic or vague |
| Calm | Give the user room to decide | Urgent, anxious, or scarcity-driven |
| Natural | Use spoken, human Chinese | Corporate slogans or AI-generated marketing |
| Judicious | Explain what matters and why | Overconfident or absolute |
| Honest | Distinguish public information from employer truth | Promise outcomes Haigoo cannot control |
| International | Respect different work and life paths | Use imported English to perform sophistication |

### 17.2 Banned marketing phrases

Do not use:

- 开启职业新篇章
- 赋能 / 高效赋能
- 解锁无限可能
- 精准匹配
- 一站式 / 全方位
- 助力
- 开启未来
- 立即升级
- 人工精选 / 猜你喜欢 / 适合你的岗位

### 17.3 Copy migration table

| Current / legacy copy | Target copy | Reason |
| --- | --- | --- |
| 精选企业 | 远程企业 | Factual category, no endorsement implication |
| Club 中心 | 我的 | Aligns information architecture with all users |
| 人工精选 | 最近更新 | Objective editorial ordering |
| 综合推荐 / 推荐 | 默认 | Removes personalized-ranking implication |
| 前往申请 | 官网直申 | Makes the destination and boundary explicit |
| 帮你获得理想的远程工作 | 发现不同的远程工作方式 | Avoids outcome promise |
| 登录后查看完整岗位结果 | 登录后可记录并前往官网申请 | Information remains open; account is tied to action/records |
| 免费用户 / FREE | Remove | No upsell hierarchy for ordinary users |
| 加入 Club 解锁完整名单 | Remove | Company/job information is not sold |
| 获取每日精选岗位推荐 | 岗位分享 | Community is peer exchange, not private recommendation |
| Club 权益 | Haigoo Club Member / 你的 Club 权益继续保留 | Treats historical members intentionally |
| 先和顾问说说你的情况 | 说说你现在的问题 → | More natural and specific |

### 17.4 Component copy patterns

**Source**

- `来源：企业 Careers 页面`
- `来源：企业官网`
- `公开信息更新于 8 月 11 日`
- `企业页面的信息可能随时变化，请以官网为准。`

**Time**

- `刚刚更新`, `今天更新`, `3 天前更新` only when calculated from real timestamps.
- Use an absolute date in title/accessible text when relative time is shown.

**Job empty state**

> 暂时没有符合这些条件的岗位。  
> 试试减少一个筛选条件，或查看最近更新。

Actions: `清除筛选` / `查看最近更新`

**Saved jobs empty state**

> 还没有收藏的机会。  
> 看到想继续了解的岗位时，可以先留在这里。

Action: `看看最近更新`

**Applications empty state**

> 还没有申请记录。  
> 从企业官网返回后，可以把进度记在这里。

Action: `浏览远程工作`

**Error**

> 这部分暂时没有加载出来。  
> 你的记录不会丢失，可以稍后重试。

Action: `重新加载`

**Official apply limit**

- Button retains `官网直申 n/20`.
- When monthly limit is reached: `本月 20 次官网直申已用完，下月会自动恢复。`
- Do not attach a membership upsell.

### 17.5 Metadata and SEO copy

Update stale document and social metadata during Phase 2. It must no longer describe AI recommendation, all-in-one job services, or paid job access.

Suggested direction:

- Title: `Haigoo Remote｜全球远程工作信息与职业探索`
- Description: `整理来自全球企业官网与公开 Careers 页面的远程工作信息。岗位免费开放，申请回到企业官方渠道。`

Final SEO wording must be checked against the actual shipped surface and bilingual route behavior.

---

## 18. Responsive behavior

Validation widths: **375 / 768 / 1024 / 1440 / 1728**.

### 375 px

- 20 px page gutters.
- Hero title remains within approximately 2.5–4 lines; never crop or scale below readable size.
- One primary search with a 48–52 px control height.
- Recompose image, promise, job rows, and dashboard into mobile-native sequences.
- No horizontally clipped metadata; optional metadata wraps or collapses behind an explicit disclosure.
- Filter and contact experiences use bottom/full-height drawers.
- Every tap target is at least 44 px.

### 768 px

- 32 px gutters and 8-column grid.
- Navigation may use a drawer, but core page search remains visible.
- Hero changes to a 5/3 or stacked editorial composition; avoid half-empty desktop absolute positioning.
- Two-column company and career layouts may be used when content density supports them.
- Job detail uses an overlay/full route rather than a squeezed split pane.

### 1024 px

- Full navigation appears if labels fit without compression.
- Hero uses a balanced 7/5 grid.
- Jobs may use split view with a narrower list.
- Profile uses compact persistent sidebar.

### 1440 / 1728 px

- Content does not stretch indefinitely; max widths and column spans create rhythm.
- Large photography may extend to the grid edge, but text remains within readable widths.
- Whitespace is generous but never produced by empty placeholder cards.

---

## 19. Accessibility requirements

- WCAG 2.2 AA for contrast and interaction.
- Add a skip link and semantic `<main id="main-content">`.
- Maintain a logical H1 → H2 → H3 hierarchy.
- All forms have persistent labels or accessible names; placeholder is not the only label.
- Focus is visible at 2 px minimum with sufficient offset and contrast.
- Keyboard order matches visual order.
- Drawers/modals trap focus, close with Escape, restore focus, and expose `aria-labelledby` / `aria-describedby`.
- Dynamic result counts and loading completion use restrained `aria-live="polite"` messaging.
- Relative dates include exact date via `<time datetime>` and accessible label/title.
- Decorative images use empty alt text; informative images have purpose-based alt text.
- Do not encode application status, selected filters, or membership state by color alone.
- Respect `prefers-reduced-motion` and avoid auto-moving marquees.
- Sticky headers must not hide anchored content; define `scroll-margin-top`.
- Test at 200% zoom, keyboard-only, and with a screen reader on the six priority surfaces.

---

## 20. Activity and trust signals

Allowed only when derived from existing real data:

- Latest information update timestamp.
- Jobs added today / this week.
- Current browsable job count.
- Current company count.
- Company record last verified date.

Rules:

- Never hardcode marketing counts.
- Define a single query/API source per metric.
- Show a neutral fallback when a metric is unavailable; do not show `0` as a dramatic product-health statement.
- Keep counts informational, not celebratory KPI cards.
- “刚刚更新”, “今天更新”, and “本周新增” are computed labels, not static copy.

---

## 21. Shared component direction

Phase 2 should establish these visual primitives before page rewrites:

- `PageShell`
- `ContentGrid`
- `SectionHeader`
- `EditorialRule`
- `SearchField`
- `FilterToolbar` and mobile `FilterDrawer`
- `JobRow`
- `CompanyFeature` and `CompanyRow`
- `SourceMeta`
- `RelativeTime`
- `ActivitySignal`
- `StatusChip`
- `MemberBadge`
- `EmptyState`
- `ContactAdvisorDialog`
- `QuickAccessLink`

Primitives encapsulate visual and accessibility behavior, not business rules. Existing data fetching, authentication, membership, application, favorite, and ingestion logic remain in their current services/pages.

---

## 22. Business-logic and compliance preservation

The following current capabilities remain implemented. Visual removal does not authorize deleting the underlying code.

| Capability | Public/free default | Historical active member | Preservation mechanism |
| --- | --- | --- | --- |
| Hero recommendations | Hidden | Preserved for eligible existing users | Existing compliance/eligibility switch |
| Personalized job ranking | Hidden; objective default sorting | Preserve only where current legitimate entitlement and compliance config allow | `personalizedJobDiscovery` flag and existing code |
| Resume parsing/matching | Not exposed in new public discovery | Existing use remains available where already entitled | Existing code retained |
| Referral/private contact | Hidden | Existing member behavior unchanged when allowed | `nonMemberReferralAccess` and membership logic |
| Job information | Free/open | Free/open | No member-only gating |
| Official application | Login required; 20/month | Existing unlimited/email entitlements continue | Current quota and membership logic |
| Membership banners | Hidden | No public purchase CTA | `membershipPromotionBanners` flag |
| PayPal/order flow | Hidden/closed | Existing historical records preserved | `paypalCheckout` flag and backend retained |
| Redemption codes | Hidden | Existing data/code preserved | `membershipRedemption` flag |
| ¥99 / ¥998 offers | Hidden | Historical benefit records preserved | `legacyClubStarterPartnerOffers` flag |
| Employer recruitment intake | Hidden | N/A | `employerRecruitmentIntake` flag |
| Consultation | Independent service page/workspace entry | Available according to real service/entitlement | No job-flow links |

Any new feature flag must be documented in `.env.example` and tested in both off/on states. Default-off compliance surfaces must never reappear because an environment variable is absent.

---

## 23. Implementation sequence

### Phase 1 — complete with this document

- Production and source audit.
- Desktop/tablet/mobile current screenshots.
- Visual-system summary.
- Design-system and page-blueprint specification.

### Phase 2 — priority implementation

1. Consolidate global tokens and base typography.
2. Rebuild Header and primary information architecture.
3. Recompose Homepage Hero and open-product promise.
4. Introduce editorial JobRow and objective-sort presentation.
5. Rebuild My Haigoo shell/dashboard without changing data logic.
6. Recompose consultation into editorial stories/outcomes and QR modal.
7. Align Remote Companies and Career Growth to the same system.
8. Update auth screens and stale metadata.

### Phase 3 — visual QA and iteration

- Capture before/after at all five required widths.
- Compare the same route, viewport, state, and scroll position.
- Audit keyboard, contrast, motion, focus, loading, empty, and error states.
- Test normal guest, signed-in free user, historical member, and returning recommendation user.
- Run copy search for banned/legacy phrases on active code paths.
- Verify all compliance flags off and on.

---

## 24. Design QA gates

Before considering Phase 2 complete, answer each question with evidence:

### Brand

- Does the product feel like a maintained global-work publication and personal workspace?
- Is the first impression “recently upgraded” rather than “features removed”?
- Is purple an accent rather than the page identity?
- Is the visual hierarchy carried by type, spacing, dividers, and photography rather than card count?

### Product meaning

- Is “所有岗位现已开放” unmistakable in the first two screens?
- Is official-source/direct-apply behavior clear without a defensive warning style?
- Are real update signals visible without invented data?
- Are existing members treated as intentional members with continuing benefits?

### Compliance

- Is job information free from member gating?
- Are recommendation, matching, referral, private-contact, employer-intake, and purchase surfaces hidden for ordinary users?
- Does every application end at an official employer channel?
- Is consultation absent from job/company discovery and application flows?
- Are PayPal, orders, redemption, and legacy plan offers closed in the public UI while code/data remain intact?

### UI quality

- Are there still too many rounded cards?
- Are any empty containers creating a “product was removed” feeling?
- Do 375 and 768 layouts feel intentionally composed rather than stacked desktop cards?
- Are all interactive elements usable by keyboard and touch?
- Do auth, profile, consultation, jobs, companies, and career content clearly belong to one system?

### UX writing

- Does each screen say what the information is, where it came from, and what the user can do next?
- Are banned AI/sales phrases absent from active public paths?
- Are empty/error states useful without upsell?
- Are claims factual, qualified, and based on real data?

---

## 25. Definition of success

The redesign succeeds when users feel, in this order:

1. **“这个产品最近明显升级了。”**
2. **“岗位现在居然全部开放了。”**
3. **“这个网站看起来很舒服，我愿意以后继续回来。”**

No visual flourish is successful if it weakens those three impressions or reintroduces recruitment, recommendation, or job-information monetization signals.

---

## 26. Phase 2 implementation checkpoint — 2026-08-11

This checkpoint implements the global visual foundation, Header, and public Homepage. It is intentionally routed only to guests, ordinary free users, and signed-in users who are not eligible for the historical recommendation experience. Existing Club Members and previously eligible recommendation users continue through the original `HomeHero` path and retain their current business behavior.

### Implemented surfaces

- Global three-layer design tokens and accessibility foundations.
- Header information architecture: 首页 / 远程工作 / 远程企业 / 职业成长 / 我的.
- Header search appears only on Remote Jobs routes; Homepage keeps the single Hero search.
- Public Homepage Hero, editorial category navigation, open-product promise, objective latest-job rows, career journal, remote-company profiles, community information, and operator card.
- Public document metadata no longer describes recommendation, AI matching, or an all-in-one paid job service.
- Responsive layouts verified at 375, 768, 1024, 1440, and 1728 pixels.

### Token implementation

The implementation lives in `src/styles/haigoo-design-system.css` and exposes:

- Primitive palettes: ink, warm ivory, sand, mist blue, muted sage, Haigoo purple.
- Semantic roles: page/surface backgrounds, primary/secondary/muted text, borders, actions, focus, and shadows.
- Component roles: header, search, editorial row, hover, radius, and motion behavior.
- Responsive shells: compact mobile gutters, 90rem default content width, and 97.5rem wide-screen content width.
- Typography: interface sans plus restrained editorial serif, with fluid display and section scales.

### Primary UX writing changes

| Previous active expression | Phase 2 expression | Reason |
| --- | --- | --- |
| 精选企业 | 远程企业 | Describes the information object without implying recommendation or employer marketplace selection. |
| Club 中心 | 我的 / 我的 Haigoo | Removes Club from the universal top-level IA while preserving member identity inside the workspace. |
| 首页 Header 搜索 + Hero 搜索 | Only Hero search | Removes duplicate primary actions. |
| 可以全球旅居，也可以居家办公…… | 从全球企业的公开渠道出发……岗位信息全部开放…… | Leads with source, openness, and user control. |
| 最新发布 | 最近更新的远程机会 | Creates a maintained editorial rhythm and avoids curation claims. |
| Generic recommendation/category cards | Editorial category navigation and objective rows | Moves the product meaning from recommendation to exploration. |
| 会员/Free user labels | No ordinary-user status label; historical users get Haigoo Club Member | Avoids upsell and treats real members as an intentional continuing cohort. |

### Components introduced or consolidated

- Added `HomeEditorialExperience` as the new public presentation layer.
- Consolidated Header navigation labels, active state, responsive menu, and account entry under the new IA.
- Reused the existing job modal, filters, job-fetching services, company-fetching services, career-content service, community asset, and operator-information component.
- Restyled `HomeCareerGuides` from a large rounded SaaS container into an editorial journal section; content access logic remains unchanged.
- Did not delete the legacy recommendation Hero, resume parsing, matching, plan modal, member entitlements, redemption, payment, referral, or email-apply implementation.

### Business logic preserved

- Authentication, email verification, search gate, and job detail hydration.
- Objective `recent` fetch and existing category filtering.
- Existing favorite, application, company, career-content, and notification data.
- Historical membership identity and entitlements.
- Returning-user recommendation eligibility and all existing restoration switches.
- Company cover-image lazy loading and existing community/operator assets.

### Compliance verification

- Public Hero contains no resume upload, match score, personalized recommendation, referral, or paid-job-access CTA.
- Public job rows are ordered by existing objective timestamps and identify source/update metadata.
- “所有岗位现已开放” is expressed as a product promise, not a defensive warning.
- Consultation is not linked from Homepage job/company discovery or application actions.
- Header has no membership purchase entry and ordinary users are not labeled “Free”.
- Historical member and returning recommendation logic remains available behind the existing eligibility/configuration path.

### Screenshot evidence

- Before, local 1440: `artifacts/brand-upgrade-phase2/00-local-baseline-home-1440.png`
- Before/after comparison, 1440: `artifacts/brand-upgrade-phase2/16-before-after-home-1440.png`
- Final Hero, 1440: `artifacts/brand-upgrade-phase2/15-final-home-1440.png`
- After Hero, 1440: `artifacts/brand-upgrade-phase2/03-after-home-hero-1440.png`
- After job rows, 1440: `artifacts/brand-upgrade-phase2/04-after-home-jobs-1440.png`
- After remote companies, 1440: `artifacts/brand-upgrade-phase2/05-after-home-companies-1440.png`
- After bottom operator card, 1440: `artifacts/brand-upgrade-phase2/06-after-home-bottom-1440.png`
- Mobile, 375: `artifacts/brand-upgrade-phase2/08-after-home-mobile-375.png`
- Mobile job rows, 375: `artifacts/brand-upgrade-phase2/10-after-home-mobile-job-rows-375.png`
- Tablet, 768: `artifacts/brand-upgrade-phase2/11-after-home-tablet-768.png`
- Tablet navigation, 768: `artifacts/brand-upgrade-phase2/14-after-tablet-menu-768.png`
- Desktop, 1024: `artifacts/brand-upgrade-phase2/12-after-home-desktop-1024.png`
- Wide desktop, 1728: `artifacts/brand-upgrade-phase2/13-after-home-wide-1728.png`

### Verification results

- `npm run type-check` — passed.
- `npm run test:compliance-ui` — passed.
- `npm run build` — passed.

### Next Phase 2 targets

1. Remote Jobs filter/list/detail visual system alignment.
2. My Haigoo dashboard and historical member treatment.
3. Consultation editorial stories/outcomes and contact modal.
4. Remote Companies and Career Growth page-level alignment.
5. Final UX-copy search and authenticated/free/member state matrix.

---

## 27. Phase 2 continuation checkpoint — Remote Jobs, My Haigoo, Consulting

This checkpoint extends the Homepage's flat editorial language into the product's core discovery and personal-service surfaces. It changes presentation and information hierarchy only; data access, authentication, application records, favorites, historical membership, and application entitlements remain in the existing components and services.

### Shared product-surface layer

`src/styles/editorial-product.css` adds reusable page roles for:

- Flat job list/detail shells and selected-row behavior.
- Editorial job-row hover and official-source arrow motion.
- My Haigoo shell, quick links, workspace panels, and responsive composition.
- Career-consulting story, outcome, capability, and contact-dialog layouts.
- Mobile reflow at 375 px and reduced-motion overrides.

These roles consume the existing semantic tokens from `haigoo-design-system.css`; they do not introduce a second brand palette.

### Remote Jobs

- Removed the decorative handwritten list banner from the active jobs surface.
- Added a factual publication header: `GLOBAL REMOTE WORK / 远程工作`.
- Kept only `默认 / 最新` objective sorting.
- Replaced rounded job cards with continuous information rows showing title, company, remote region, real updated label, limited skill metadata, and `官网直达`.
- Added keyboard activation and descriptive row labels.
- Converted the detail header stats and role-description blocks into divided editorial sections.
- Kept filters, search, favorites, applications, guest gates, official-application quota, email application for real members, and dormant recommendation/matching code unchanged.

### My Haigoo

- Reframed the ordinary-user workspace around `MY HAIGOO`, one greeting, and the line `把看过的机会、做过的选择和下一步计划留在这里。`
- Quick access is limited to saved opportunities, application records, and Career Growth.
- Saved roles and application records remain in the same data-backed components and are composed in two editorial columns on wide screens.
- Sidebar/mobile labels use `我的 Haigoo` and `咨询服务`; ordinary users receive no `Free User` label or upsell.
- Historical Club Members continue to use their existing member workspace, validity, benefits, recommendations, email-application entitlement, and QA according to real account state.

### Career consulting

- Hero QR code removed; one `说说你现在的问题` button opens the advisor contact dialog.
- Contact dialog includes focus entry, focus containment, Escape close, focus restoration, advisor QR, and email.
- Replaced card grids with numbered stories, divider-led outcomes, a compact capability list, and native FAQ disclosure.
- One calm footer note states the service boundary; defensive warnings are not repeated across the page.
- Consulting remains inside the personal workspace and is not linked from a job, company, search, or application action.

### UX writing changes

| Previous active expression | New expression | Reason |
| --- | --- | --- |
| Handwritten `远程工作` banner | `GLOBAL REMOTE WORK / 远程工作` | Builds publication authority without decorative SaaS framing. |
| Large job tag-card hierarchy | Company / title / region / updated / official source | Front-loads factual scanning information. |
| 每日精选岗位推荐 | 岗位分享 | Removes recommendation language from the community surface. |
| 我的 Club 首页 | 我的 Haigoo | Makes the workspace relevant to every user without implying membership. |
| Club 中心 | 咨询服务 (ordinary-user navigation) | Describes the actual service rather than a discontinued universal product tier. |
| 先和顾问说说你的情况 | 说说你现在的问题 | Shorter, user-led, and non-sales-oriented. |
| Five package-like service cards | Once-consulted outcomes + capability list | Explains user value without presenting a paid job-information plan. |

### Components removed or consolidated visually

- Removed the active Jobs filter illustration/handwriting composition; source assets and restoration code remain available.
- Consolidated job-card metadata into one `JobCardNew` editorial-list variant; grid variant and dormant personalized signals remain in source.
- Removed QR from the consulting Hero and consolidated contact into one dialog.
- Removed ordinary-user dashboard statistic cards and combined favorites/application history into the My Haigoo Home.

### Verification evidence

- Before/after Jobs: `artifacts/brand-upgrade-followup/jobs-before-after.png`
- Final Jobs desktop/mobile: `artifacts/brand-upgrade-followup/after/jobs-desktop-v2.png`, `artifacts/brand-upgrade-followup/after/jobs-mobile-375.png`
- Final Consulting desktop/mobile/modal: `artifacts/brand-upgrade-followup/after/consulting-desktop-v2.png`, `artifacts/brand-upgrade-followup/after/consulting-mobile-375.png`, `artifacts/brand-upgrade-followup/after/consulting-contact-modal.png`
- Detailed findings: `design-qa.md`

### Remaining recommended page-level work

1. Apply the same editorial intelligence layout to the full Remote Companies route and company detail route.
2. Recompose Career Growth index/watch/note pages around reading rhythm rather than rounded media cards.
3. Align login, registration, verification, feedback, and account-danger states to the updated page shell.
4. Run an authenticated browser matrix for ordinary user, historical trial/quarter member, and active Club Member using real non-production accounts.

---

## 28. Phase 2 continuation checkpoint — Remote Companies

This checkpoint extends the Homepage's flat editorial system into both Remote Companies routes. The page now behaves like a maintained company-intelligence index rather than an employer marketplace. Company ingestion, authentication, saved jobs, application records, historical membership, and company/job APIs remain unchanged.

### Directory structure

- Replaced the handwritten endorsement-style Hero with `REMOTE COMPANY INDEX / 远程企业` and the factual title `值得长期关注的远程企业`.
- Added a three-part information promise: understand the business, review published work practices, and confirm openings at the official source.
- Search and filters retain their existing account-access rules, but the copy no longer resembles a membership upsell.
- Reframed the old verification card as a flat, expandable information note that explicitly says inclusion is not an endorsement or recruiting recommendation.
- Introduced `CompanyDirectoryEntry`: the first two current records are image-led, while later records become compact divided rows. The existing Homepage company cards remain unchanged.
- Real `totalActiveJobs`, company update dates, categories, descriptions, and job counts are used when returned by the API. No activity number is hardcoded.

### Company detail routes

- `/c/:companyName` and `/companies/:companyName` now use one publication-style company profile with a factual Hero, update date, public-opening state, About section, public-source facts, and a continuous job list.
- `/company/:id` uses the same typography, dividers, list treatment, filter labels, loading state, and empty state.
- Removed nested large-radius cards, colored icon tiles, decorative background imagery, and recommendation-score props from the active company-detail job list.
- Guest visibility remains controlled by the existing authentication checks. Locked fields are calmer inline placeholders rather than large blurred panels.
- Historical members retain the real hiring-email field and copy action when `isMember` and company data permit it.

### UX writing changes

| Previous expression | New expression | Reason |
| --- | --- | --- |
| 发现更适合中国用户申请的远程友好企业 | 值得长期关注的远程企业 | Removes candidate targeting and endorsement language. |
| Haigoo 持续筛选全球远程友好公司 | 了解它们做什么、如何工作，以及在哪里查看最新机会 | Describes the user's evaluation task without promising suitability. |
| 企业信息整理标准 / 经过核验 | 信息说明 / 持续整理公开信息 | Positions Haigoo as an information organizer, not a certifier or recruiter. |
| 查看岗位 | 查看企业 | Matches the destination and avoids implying company-to-candidate routing. |
| 企业简介与信息 | 它们在做什么 / 企业资料 | Creates a clearer editorial reading hierarchy. |
| 暂无在招岗位 | 目前没有公开在招岗位 | Clarifies that the state reflects observed public sources. |

### Tokens and responsive behavior

- Uses existing warm ivory, deep ink, mist, sage, and Haigoo purple semantic tokens; no new brand palette was introduced.
- Company surfaces use serif display type, sans-serif factual metadata, 1–2 px rules, and restrained 14–18 px media radii.
- Verified document width equals viewport width at 375, 768, 1024, and 1440 px for both directory and detail routes.
- Mobile changes the information order and collapses feature/fact grids; it does not simply stack desktop cards.
- All active motion has a `prefers-reduced-motion` override.

### Evidence

- Before directory desktop/mobile: `artifacts/brand-upgrade-companies/before/companies-desktop.png`, `artifacts/brand-upgrade-companies/before/companies-mobile.png`
- After directory desktop/mobile: `artifacts/brand-upgrade-companies/after/companies-desktop.png`, `artifacts/brand-upgrade-companies/after/companies-mobile.png`
- Before detail desktop/mobile: `artifacts/brand-upgrade-companies/before/company-detail-desktop.png`, `artifacts/brand-upgrade-companies/before/company-detail-mobile.png`
- After detail desktop/mobile: `artifacts/brand-upgrade-companies/after/company-detail-desktop.png`, `artifacts/brand-upgrade-companies/after/company-detail-mobile.png`
- Combined comparisons: `artifacts/brand-upgrade-companies/compare/companies-before-after.png`, `artifacts/brand-upgrade-companies/compare/company-detail-before-after.png`, `artifacts/brand-upgrade-companies/compare/company-detail-mobile-before-after.png`
- Detailed QA: `design-qa.md`

### Next recommended page-level work

1. Recompose Career Growth index, watch, and article/note pages around reading rhythm instead of media-card grids.
2. Align login, registration, email verification, feedback, and account settings with the same flat shell.
3. Run the authenticated ordinary-user / historical-member / active-member state matrix with real non-production accounts.

---

## 29. Phase 2 continuation checkpoint — Career Growth

Career Growth now follows the same warm editorial system as the Homepage and Remote Companies. The route is positioned as a maintained field-notes library and personal learning workspace, not a course store, training funnel, or job-conversion surface. Video records, note blocks, categories, favorites, analytics, authentication, and historical Club permissions remain unchanged.

### Content index

- Added a single editorial masthead: `把工作方式，慢慢学成自己的。`
- Introduced a four-part table of contents for founder interviews, remote preparation, English interviews, and real meetings.
- Uses the real combined published-video count only after all four modules finish loading. No activity number is hardcoded.
- Replaced rounded section banners with rules, type hierarchy, and whitespace.
- Reframed media cards as image-led stories with restrained media radii and divided text blocks.
- Filters remain functional and use a quiet ink-selected state rather than purple elevation.

### Watch and note routes

- Locked watch states are now one media field plus one access explanation, instead of two large promotional cards.
- Login remains the only guest action; dormant Club promotion branches remain behind the existing compliance configuration.
- Active member video, clips, favorites, company information, source links, and notes behavior are preserved.
- Video notes use a reading-width document, a flat index rail, serif article hierarchy, and calmer quote/empty treatments.
- Removed nested page-level `main` landmarks from the watch and note routes; the global layout remains the single main landmark.

### UX writing changes

| Previous expression | New expression | Reason |
| --- | --- | --- |
| 提升认知、口语与申请成功率 | 听企业经营者谈判断、沟通与协作 | Removes an outcome promise and describes the content directly. |
| 熟悉远程工作所需的一切，不打无准备的仗 | 从沟通、简历表达和协作习惯开始准备 | Removes anxiety language and clarifies the learning scope. |
| 提前适应远程工作环境，丝滑过渡 | 观察真实会议中的表达、节奏和协作方式 | Uses natural, specific language. |
| 人工精选剪辑 | 从公开访谈中整理可反复练习的表达片段 | Aligns the learning copy with the public-source editorial model. |
| 找远程工作 | 浏览远程岗位 | Describes the destination without implying a placement service. |
| 登录后可播放外企英语内容 | 登录后可继续查看这项职业成长内容 | Uses the user's current context instead of an outdated product label. |

### Responsive and accessibility behavior

- One H1 per route and one global `main` landmark.
- 375, 768, 1024, and 1440 px document-width checks show no horizontal overflow.
- The mobile watch lock state is a continuous document and no longer depends on a fixed, clipped desktop viewport.
- Filter targets remain at least 44 px high; dialog actions retain explicit accessible names.
- Motion is limited to hover/selection feedback and disabled under `prefers-reduced-motion`.

### Preserved business behavior

- `membershipCapabilities.canAccessCorporateEnglishVideos` still controls historical member access.
- Guest/login, free/member, note visibility, audio download, favorites, analytics, and source URLs are untouched.
- Membership sales and consulting CTAs were not added to the career-learning flow.
- Existing dormant Club promotion code remains configuration-gated for future restoration.

---

## 30. Phase 2 continuation — Playback and My Haigoo

This continuation brings the Career Growth playback experience and the ordinary-user workspace into the same flat editorial language as the Homepage, Remote Companies, and Career Growth index. It changes presentation, hierarchy, responsive composition, and UX copy only. Video access, authentication, favorites, application records, historical membership, and compliance gates continue to use the existing services and data.

### Playback page

- Replaced the fixed-height SaaS split screen with a normal document flow and a video-first editorial layout.
- The video, company identity, publish date, content type, article title, speaker, summary, and practice materials now read as one continuous story.
- Rebuilt the company-information area as a restrained `COMPANY NOTES` dossier: compact tabs, serif section heading, numbered notes, fine dividers, and no nested purple cards.
- Kept company culture, business thinking, public openings, resources, favorites, clips, source URLs, and existing tab state intact.
- Module-video routes use the same reading panel, metadata, empty states, and note treatment rather than a separate card system.
- Locked states still use the existing `canAccessCorporateEnglishVideos` permission. When membership promotion is disabled, they remain informational and contain no purchase CTA.

### My Haigoo

- Repositioned the ordinary-user home as `MY HAIGOO · 个人工作台` with one clear greeting and a short orientation sentence.
- Replaced three oversized dashboard cards with a compact quick-access strip for saved opportunities, application records, and Career Growth.
- Merged saved opportunities and application records into a two-column editorial workspace on desktop; both remain part of the same page on mobile.
- Removed the ordinary-user advisor promotion card from the sidebar and replaced it with neutral workspace guidance.
- Renamed supporting navigation to `关于 Haigoo`, `反馈`, and `账户设置`; no `Free User` or upgrade label is shown.
- Application progress uses user-owned states: `想申请`, `已申请`, `面试`, and `已结束`. Historical stored status values are mapped to these labels without changing the database.
- Historical members continue through their existing member-aware branches and retain their real Club identity and benefits.

### Responsive and accessibility contract

- Desktop playback uses a wider media column and a sticky dossier; mobile turns it into a continuous article and places the dossier below the story.
- Desktop workspace uses a narrow flat sidebar and paired content columns; mobile uses a horizontal scrollable nav and flat quick-access rows rather than stacked dashboard cards.
- Verified at 1440 × 692 and 375 × 812 with document width equal to viewport width and one H1 / one global `main` landmark.
- Tab controls use semantic `tablist` / `tab` roles, focus remains visible, destructive application actions have explicit labels, and active controls meet the 44 px touch-target minimum.
- New hover transitions are subtle and covered by the existing `prefers-reduced-motion` override.

### UX writing changes

| Previous expression | New expression | Reason |
| --- | --- | --- |
| 企业文化（large functional panel） | `COMPANY NOTES` / 企业文化 | Positions the material as an editorial company dossier. |
| 我的收藏 | 收藏的机会 | Describes what the user saved, not the feature mechanism. |
| 我的申请 | 申请记录 | Keeps ownership with the user and avoids platform-placement language. |
| 已投递 / 已内推 / 内推成功 | 已申请 / 面试 / 已结束 | Removes recruitment-intermediation wording while preserving historical status values. |
| 暂无申请记录，快去看看吧 | 通过官网直申后，可以在这里继续记录进展 | Gives calm, specific next-step context without urgency. |
| 添加顾问了解 | 你的个人工作台 | Removes a conversion surface from the ordinary-user dashboard. |
| 注销账号 | 账户设置 | Makes the navigation destination broader and less destructive. |

### Evidence

- Playback before/after: `artifacts/brand-upgrade-playback-profile/compare/watch-desktop-before-after.png`
- My Haigoo before/after: `artifacts/brand-upgrade-playback-profile/compare/profile-desktop-before-after.png`
- Playback mobile: `artifacts/brand-upgrade-playback-profile/after/watch-mobile.png`
- My Haigoo mobile: `artifacts/brand-upgrade-playback-profile/after/profile-mobile.png`
- Detailed visual QA: `design-qa.md`

---

## 31. Phase 2 consistency closure — Flat editorial surfaces

This pass closes the remaining visual gaps between the upgraded homepage and several older product surfaces. It does not change data contracts, authorization, application records, saved jobs, historical Club access, or ingestion behavior.

### Homepage continuity

- Career Growth and Remote Companies now share the homepage shell, left edge, section rule, and vertical rhythm instead of using an isolated offset container.
- The legal and company-information footer is a flat editorial colophon with restrained rules and typography; the previous rounded watercolor card treatment is removed.
- Career content starts loading with the page so a user who scrolls quickly is less likely to encounter a large temporary skeleton block.

### Remote Jobs reading model

- The route uses normal document scrolling. The notice, filters, results, and detail view no longer create three competing sticky or nested scroll regions.
- On desktop, the result list is the primary column and the selected-job detail is the narrower secondary column. The detail may remain locally sticky, but the page itself owns scrolling.
- Loading, empty, selected, and filter states use flat fields, rules, restrained accent color, and content-led hierarchy instead of illustrated rounded containers.

### Supporting routes

- Career video cards, playback dossiers, profile documents, account menus, company details, and job-bundle states use the same radius and border discipline.
- Data-dependent routes show calm, complete fallback documents when local data is unavailable; no fake records or activity counts are introduced for visual testing.
- Job-bundle language describes themed public information and preparation content, not personalized recommendation, placement, or advisor-led application.

### Responsive contract

- Desktop prioritizes readable content width and one page scroll.
- Tablet collapses secondary columns before reducing core-content width.
- Mobile turns paired panes into one continuous document and keeps interactive targets at least 44 px high.
- Decorative imagery is never required to understand a loading, empty, or error state.
