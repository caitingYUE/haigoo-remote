---

name: haigoo-medium-editorial-mobile
description: "Use only when designing Haigoo Mini Program reading surfaces such as company profiles, remote notes, and long-form career content. This document does not define the Mini Program's product positioning, home screen, Match interaction, or bottom navigation."
---

# Haigoo Medium Editorial Mobile Skill

> **Scope correction · 2026-09-01**
>
> This is a supporting pattern library for company-detail, note-detail, and long-form reading surfaces. It is not a whole-product Mini Program strategy. The Mini Program is a personalized Match-first product with exactly three primary tabs: `企业 / Match / 笔记`, and Match is the centered, moderately enlarged primary entry. Any later wording in this historical document that describes the Mini Program as a reading-first product, names Home/Discover as the main screen, proposes five tabs, or centers Search is superseded by `PRODUCT.md`, `docs/haigoo-platform-positioning.md`, `docs/haigoo-mini-design-system.md`, and the latest approved Match specification.

## Skill Purpose

Design or refine Haigoo Remote’s **company-detail, note-detail, and long-form reading surfaces** using a Medium-inspired editorial reading model, while preserving Haigoo’s existing brand language:

* modern editorial / fashion-journal sensibility
* a slight vintage print-magazine feeling
* line-based, minimal, calm, readable
* black / light gray / orange as the main visual system
* suitable for long-form reading: company profiles, remote notes, blog posts, curated content
* optimized for Chinese users’ mobile reading and scanning habits

This skill should **not** blindly clone Medium. It should borrow Medium’s strengths in **content hierarchy, scanability, reading comfort, and mobile information flow**, then merge them with Haigoo’s brand and business needs.

---

## Use This Skill When

Use this skill when the task is about:

* designing reading and detail surfaces inside Haigoo’s WeChat Mini Program
* adapting Haigoo editorial content into mobile reading UI
* designing article / company / note reading flows
* building content-first modules that support the Match journey
* improving mobile readability, list browsing, search, save, or follow behavior
* creating a unified mobile design system for content + company discovery

---

## Product Context

Haigoo is not a generic blog app and not a pure job board.

Its Match-first Mini Program should use this document only for the supporting content model:

1. **Remote company content**

   * company profiles
   * company culture / work style / hiring notes
   * official links / careers entry points

2. **Remote career content**

   * remote notes
   * work journals
   * curated long-form posts
   * career growth content

3. **Discovery / exploration**

   * browse topics
   * discover companies
   * discover writing
   * save content for later
   * return to key entries naturally

These reading surfaces should feel closer to a **content publication + curated discovery tool**, while the product as a whole remains a personalized Match experience rather than a publication app.

---

## Core Design Direction

### Primary Visual Reference

Use the following as the conceptual base:

* **Medium app** for mobile content reading patterns
* **Haigoo current web** for brand, typography attitude, and visual identity

### Desired Feeling

The product should feel:

* calm
* literate
* modern
* slightly editorial
* refined but not cold
* simple but not empty
* premium but not luxury-forced
* efficient but not overly SaaS-like

### Avoid

Do **not** make it feel like:

* a recruitment CRM
* a dashboard product
* a social media feed
* a card-heavy e-commerce interface
* an overly decorative lifestyle app
* a generic “AI startup” UI
* a direct 1:1 Medium clone

---

## Design Principles

### 1. Reading First

Every screen should prioritize reading comfort and content comprehension.

* clear hierarchy
* generous breathing room
* calm surfaces
* minimal distraction
* legible type and spacing
* long-form friendly layouts

### 2. Editorial, Not Dashboard

Prefer **editorial composition** over component stacking.

* fewer visual boxes
* stronger typography
* lighter structure
* more whitespace
* more rhythm between sections

### 3. Scan Fast, Read Deep

Users should be able to:

* quickly scan titles, tags, categories, and metadata
* quickly judge whether content is relevant
* switch into a focused reading mode easily

### 4. Minimal but Warm

The interface should be minimal, but not sterile.

* use thin lines and restrained borders
* use light gray backgrounds to soften stark contrast
* use orange only as accent and guidance
* allow quiet warmth through spacing and composition

### 5. Brand Continuity

The mini program must clearly feel like the same ecosystem as the web.

Keep continuity in:

* typographic confidence
* black / gray / orange palette
* line language
* elegant simplicity
* content-first personality

### 6. Designed for WeChat Context

The interface must work naturally inside WeChat Mini Program constraints.

* respect safe areas
* concise interaction
* easy thumb reach
* fast loading
* lightweight transitions
* avoid excessive custom gestures or complex interaction models

---

## Visual System

## Color

Use Haigoo’s existing web palette as the source of truth. If exact tokens are unavailable, use the following direction:

* **Primary text**: near-black
* **Secondary text**: medium gray
* **Background**: white or warm light gray
* **Section background**: very light neutral gray
* **Accent**: Haigoo orange
* **Border / divider**: light gray, visible but subtle

### Suggested token direction

* `--bg-primary`: #F7F7F5 or existing site background
* `--bg-card`: #FFFFFF
* `--text-primary`: #111111
* `--text-secondary`: #6B7280
* `--text-muted`: #9CA3AF
* `--line-primary`: #D9D9D4
* `--accent`: existing Haigoo orange
* `--accent-soft`: very light orange tint only when needed

### Rules

* Orange is for highlight, not for flooding large surfaces
* Large orange blocks should be rare
* Heavy gradients should be avoided
* Shadows should be extremely light or absent
* Dividers and spacing should do most of the structural work

---

## Typography

Typography is a core part of the brand expression.

### Tone

Use a **clean, confident, editorial sans-serif system** for most UI and Chinese content.

### Suggested stack

* Chinese: PingFang SC / HarmonyOS Sans / Noto Sans SC
* English UI: Inter / SF Pro / system sans
* Optional editorial accent: a subtle serif can be used very sparingly for English pull quotes or special feature headers, but it should not dominate the app

### Hierarchy

* Hero / large section title: bold, decisive, editorial
* Card title / article title: strong and readable
* Body text: calm, high readability
* Meta text: quiet but clear
* Labels / chips: compact and crisp

### Rules

* Prefer fewer font styles, stronger hierarchy
* Avoid overly tiny metadata
* Maintain comfortable line height for long reading
* Titles should be bold and expressive, but not cramped
* Chinese text must feel natural on mobile, not “desktop shrunk down”

---

## Shape, Line, and Surface

### Shape Language

* rounded corners, but restrained
* use soft rectangles rather than playful bubbles
* chips can be more rounded than cards
* primary containers should feel calm and stable

### Line Language

* thin, clean dividers
* subtle borders
* visible section separation without heavy chrome
* lines help organize content, not decorate it

### Surface Language

* mostly flat
* no heavy neumorphism
* minimal shadow
* rely on contrast, spacing, and typography

---

## Layout Patterns

## Global Structure

The app should mainly use these layout patterns:

1. **Editorial feed**
2. **Topic browsing**
3. **Article / content detail**
4. **Company profile detail**
5. **Saved / library**
6. **Personal center**

### Rhythm

Build rhythm with:

* title
* intro copy
* search
* chips
* list modules
* featured modules
* dividers
* whitespace blocks

Avoid dense screen packing.

---

## Key Mobile Screens

## 1. Supporting Discovery Surface

This is a secondary pattern for enterprise and note discovery. It is not the Mini Program home screen; Match is the primary screen.

### Goal

Help users explore credible company and career content after or alongside Match recommendations.

### Structure direction

* page title or brand-led intro
* search entry
* topic/category chips
* one featured editorial module
* latest company content
* latest remote notes / journals
* recommended long-form content
* optional “continue reading” / “saved recently”

### Inspired by Medium

Borrow from Medium:

* strong search presence
* topic chips
* clean content list
* clear article metadata
* minimal noise

### Adaptation for Haigoo

Unlike Medium, include stronger content buckets such as:

* Remote Companies
* Remote Notes
* Career Growth
* Recently Updated

### Do not

* do not start with a dashboard summary
* do not overuse banner carousels
* do not overload with too many shortcuts
* do not use oversized promotional cards everywhere

---

## 2. Company Feed / Company List

### Goal

Help users discover and browse companies comfortably.

### Structure

* page title
* search
* filter chips or lightweight filters
* editorial list of companies
* each item shows:

  * company name
  * short descriptor / industry
  * key remote clue
  * optional hero image or logo
  * update or content count if useful

### Style

This should feel more like a **curated company index** than a traditional directory table.

### Preferred card style

* lighter cards or list blocks
* title-first
* image optional, not mandatory for every item
* concise metadata
* orange used for actionable link or active state

---

## 3. Article / Note Detail

### Goal

Create a high-quality long-form reading experience.

### Structure

* back navigation
* title
* subtitle or summary
* metadata row
* author / source / time
* cover image if relevant
* body content
* section headings
* pull quote / key note styles if needed
* related content
* save / share / return actions

### Important

This screen should borrow the most from Medium.

### Rules

* strong title hierarchy
* body width comfortable for mobile
* paragraph spacing generous
* images integrated cleanly
* bottom action area simple
* no excessive UI chrome around the article

### Reading comfort

Prioritize:

* readability
* scrolling smoothness
* not too many interruptions
* clear distinction between content and action tools

---

## 4. Company Detail

### Goal

Turn company content into a readable, trustworthy editorial page.

### Content model

Could include:

* company name
* one-line description
* industry / region / remote mode
* business intro
* how they work
* role or career info
* official links
* latest openings or notes
* related articles

### Style

This is not a dry facts table.
It should feel like:

* part profile
* part article
* part reference page

Use sections with clear headings and quiet separators.

---

## 5. Saved / Library

### Goal

Support “read later” and personal knowledge collection.

### Possible tabs

* Saved
* History
* Liked / starred
* Followed topics

### Style

Clean, low-friction, library-like.

This screen should feel practical, not decorative.

---

## 6. Personal Center

### Goal

Keep personal center minimal and service-oriented.

### Include

* profile summary
* saved content
* reading history
* settings
* language option if needed
* membership / service entry if relevant

### Avoid

Do not let this become the visual center of the app.

Haigoo’s reading surfaces are content-led; the Mini Program identity remains personalized Match first.

---

## Navigation Model

Use a bottom tab pattern suitable for WeChat Mini Program.

### Current bottom tabs

* 企业 / Companies
* Match
* 笔记 / Notes

### Notes

* Match is centered and visually emphasized by roughly 15–20%, without becoming a detached floating control
* Keep labels short and intuitive
* Icon style should be simple, line-based, and consistent
* Search, saved items, and profile are contextual actions or secondary pages, not primary tabs

---

## Component Guidance

## Search Bar

* prominent but calm
* soft neutral background
* clear placeholder
* strong discoverability
* should feel like a natural reading/discovery entry

## Topic Chips

* lightweight
* rounded
* quiet neutral base
* active state can use orange accent or subtle tint
* not too many styles

## Content List Item

Support several variants:

1. text-first list item
2. list item with thumbnail
3. featured item
4. company item

All variants should share:

* strong title
* clean metadata
* calm spacing
* consistent rhythm

## Featured Module

Use sparingly.
A featured module can appear on top of a section, but it should not overpower the overall calm.

## Dividers

Dividers are important in this system.
Use them to create editorial rhythm.

## Empty States

Must remain clean and composed.
Avoid cartoonish illustrations unless they fit the brand language.

---

## Content Style Rules

## Titles

Titles should be visually strong and easy to scan.

## Metadata

Metadata should be quiet but readable:

* time
* author
* topic
* read time
* source
* company type

## Body Content

For long-form content:

* keep paragraphs airy
* headings distinct
* quotes and callouts subtle
* avoid noisy inline styles

## Bilingual / Chinese-first Reality

If English content exists, it should feel compatible with Chinese-first product use.
Do not let English typography break rhythm.

---

## Interaction Style

### General

* light
* direct
* low-friction
* minimal animation
* no gimmicks

### Transitions

* subtle
* quick
* avoid dramatic motion

### Feedback

* clear active states
* clear tap areas
* accessible contrast
* readable selected states

### Gestures

Do not rely on hidden gestures for key actions.

---

## What to Borrow from Medium

Strongly borrow:

* search-led discovery feel
* topic chips
* clean article listing
* content-first detail pages
* readable metadata
* focus on long-form reading
* quiet bottom navigation
* restraint in ornament

Do not copy literally:

* exact layout
* exact spacing ratios
* exact iconography
* exact visual identity
* exact article card structure
* exact branding or interaction details

---

## What to Preserve from Haigoo Web

Preserve:

* confident headline style
* editorial homepage spirit
* black / light gray / orange system
* line-based cleanliness
* modern + slightly nostalgic magazine feeling
* calm but curated content personality
* a sense of trust and cultural taste

---

## WeChat Mini Program Constraints

Always consider:

* safe area and status bar behavior
* performance on typical domestic devices
* moderate image usage
* fast first-screen rendering
* touch target size
* clear scroll behavior
* avoid web patterns that feel awkward in mini program context

Do not overbuild interactions that depend on:

* hover
* very custom gestures
* heavy animations
* desktop-scale layouts

---

## Output Requirements for Codex

When using this skill, Codex should:

1. **Start from brand continuity**

   * inspect existing Haigoo web style
   * preserve the overall visual family

2. **Translate web to mobile**

   * not shrink desktop layouts directly
   * redesign structure for mobile reading

3. **Use Medium as a pattern reference, not a template**

   * borrow the reading product logic
   * adapt it to Haigoo’s content categories

4. **Produce a coherent mobile system**

   * tokens
   * typography
   * spacing
   * component patterns
   * screen structure

5. **Prioritize these pages first**

   * Discover / Home
   * Companies list
   * Article / Note detail
   * Company detail
   * Saved
   * Me

6. **Explain design rationale briefly**

   * what was borrowed from Medium
   * what was preserved from Haigoo
   * what was changed for mini program reality

---

## Default Working Method

If asked to design or implement with this skill, follow this order:

1. summarize the brief in one short paragraph
2. identify the relevant mobile pages
3. define the mobile design direction using this skill
4. create or refine design tokens
5. build or improve the key screens
6. ensure visual consistency across pages
7. review whether the result still feels like Haigoo
8. verify reading comfort and scanability

---

## Acceptance Checklist

A result using this skill should pass the following test:

* Does it feel clearly related to Haigoo web?
* Does it feel editorial rather than dashboard-like?
* Does it support long-form reading comfortably?
* Does it borrow Medium’s strengths without looking copied?
* Is the black / light gray / orange balance well controlled?
* Are typography and spacing doing most of the work?
* Is it suitable for WeChat Mini Program constraints?
* Can users discover companies and content naturally?
* Does it feel calm, smart, and trustworthy?
* Would users be willing to read longer company or career content here?

If the answer to several of these is “no”, redesign rather than merely polishing details.

---

## Quick Prompt Template

Use this skill only for Haigoo Mini Program company profiles, remote notes, and long-form career content. Keep these supporting surfaces editorial, readable, and consistent with the black / light gray / orange system, but do not redefine the product as a reading app. The Mini Program remains Match-first, with `企业 / Match / 笔记` as its primary navigation. Borrow Medium’s strengths in content hierarchy, search, topic chips, content lists, and reading detail pages without cloning it. Optimize for Chinese mobile users and WeChat Mini Program constraints. Prioritize reading comfort, scanability, and continuity with the immersive Match journey.
