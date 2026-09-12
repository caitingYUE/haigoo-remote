# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

Haigoo serves Chinese-speaking professionals exploring global remote work and long-term career growth.

- The website serves broad discovery needs: public remote jobs, company research, career content, application records, and account services.
- The WeChat Mini Program serves users who want a more personal, repeatable way to discover companies and roles aligned with their direction.
- The primary Mini Program audience is a career-conscious professional who values credible information, efficient judgment, personal relevance, and a calm premium experience.

## Product Purpose

Haigoo helps users understand remote-work opportunities, identify directions worth pursuing, and continue the work of researching companies, following opportunities, preparing applications, and growing their careers.

The website and Mini Program are two connected products rather than one responsive product reproduced on two platforms:

- The website is the open, general-purpose information and career workspace.
- The Mini Program is the personalized Match product, centered on helping each user find remote companies and roles suited to their career direction.
- Account, membership, follow, favorite, application, resume, and career-direction data may be shared where the product contract supports it.

## Positioning

### Website

An open, continuously maintained remote-work information and career workspace. Public information is organized for objective discovery and official application.

### WeChat Mini Program

A personalized remote-career Match product. Its defining mechanism is a user-controlled direction profile that produces an explainable, continuously useful stream of matched remote companies and jobs.

Match is not a decorative recommendation module. It is the Mini Program's primary product identity, default destination, strongest persistent navigation entry, and organizing principle for future features.

## Operating Context

The user typically opens the Mini Program in short mobile sessions to:

1. Set or update a career direction manually or from a resume.
2. Review a small number of matched remote companies through an immersive stacked-card experience.
3. Understand why a company fits, inspect a representative open role, and open company or job details.
4. Follow companies and optionally enable WeChat reminders.
5. Return to updates, application activity, saved information, and career-growth content.

The website supports longer research, broad browsing, detailed comparison, and desktop-oriented career work. The Mini Program should link data and continuity with the website without copying the website's information architecture or visual composition.

## Capabilities and Constraints

- Mini Program technology: Taro, React, TypeScript, SCSS, WeChat Mini Program APIs.
- The Mini Program's bottom navigation is `企业 / Match / 笔记`; Match remains centered and visually emphasized.
- Profile is opened from the shared top-right avatar rather than occupying a bottom tab.
- Match uses real company, role, verification, profile, preference, and follow-state data. It must not fabricate companies, jobs, ratings, headquarters, reasons, scores, activity, or freshness.
- The interface may display a numeric reference match score only when the score is derived from the user's current direction and settings, the response includes a readable breakdown and data-coverage confidence, and the user can inspect how it was calculated. Low-confidence results use a qualitative fit band rather than a falsely precise number.
- Public company ratings display only with an accepted source and a valid value. Headquarters display only from a verified company address field. Open-role summaries use real active job titles or normalized role families.
- Swiping changes the active company only. It never follows, unfollows, dismisses, or requests WeChat permission implicitly.
- Company follow and WeChat notification permission remain separate actions and states.
- Official application follows WeChat platform constraints and uses the existing verified-link flow.
- The Mini Program may have access and membership boundaries distinct from the website, but they must be explicit and must not imply facts that are not true for a company or role.

## Brand Commitments

- Brand names: `海狗远程` and `HaigooRemote`.
- Product voice: calm, clear, intelligent, warm, specific, and non-anxious.
- Core palette: bright white and cool light-gray surfaces, near-black ink, and restrained warm orange.
- The Match experience may feel rewarding and emotionally engaging, like revealing a well-chosen card, but must not become childish, casino-like, noisy, or manipulative.
- The centered Match navigation item remains visibly stronger than its peers because it expresses the Mini Program's product positioning.
- The visible Match icon is approximately 35–40% larger than the side-tab icons, with a small upward offset that remains inside the Tab surface and safe area.
- Chinese carries task-critical meaning. English is limited to brand identity and small atmospheric metadata.

## Evidence on Hand

- Current Mini Program source: `miniprogram/src/`.
- Existing Match interaction specification: `docs/superpowers/specs/2026-09-01-mini-match-follow-loop-design.md`.
- Current Mini Program design system: `docs/haigoo-mini-design-system.md`.
- Current implementation QA and screenshots: `design-qa.md`, `artifacts/miniprogram-release-qa-2026-08-28/`, and `output/miniprogram-match-visual-qa/` where available.
- User-supplied current-state screenshots are the primary evidence for the 2026-09-01 visual-quality review.

Future work must not invent conversion claims, user testimonials, company endorsements, hiring activity, or match accuracy metrics without supplied evidence.

## Product Principles

1. **Match is the Mini Program product**: new Mini Program features should strengthen direction setup, explainable matching, opportunity judgment, following, return visits, or career progress.
2. **Connected, not duplicated**: website and Mini Program share useful data and brand trust but keep distinct product structures suited to their contexts.
3. **Emotion earns attention; evidence earns trust**: the reveal can be delightful, while every recommendation remains concise, explainable, and verifiable.
4. **User control is explicit**: no swipe, animation, permission prompt, or subscription flow may silently change a durable user state.
5. **Quiet premium over pressure**: confidence comes from typography, spacing, motion quality, credible content, and consistency rather than urgency, excessive orange, or sales language.

## Accessibility & Inclusion

- Primary touch targets are at least 44 CSS px / 88 rpx.
- Navigation, follow state, reminders, card position, loading, errors, and disabled states require accessible names and non-color signals.
- Match motion must have a reduced-motion variant.
- Text must remain readable on small screens and at larger system text sizes without hiding essential actions.
