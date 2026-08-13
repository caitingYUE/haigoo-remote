/**
 * Temporary compliance switches for the public website.
 *
 * Risky acquisition and matching surfaces default to off. They can be restored
 * after the relevant operating qualification is available without deleting the
 * underlying implementation.
 */
const enabled = (value: unknown) => String(value || '').trim().toLowerCase() === 'true'

export const COMPLIANCE_FEATURES = {
  /** The duplicated Haigoo greeting above the hero title is hidden; system notices still render. */
  homeHeroGreetingBanner: enabled(import.meta.env.VITE_ENABLE_HOME_HERO_GREETING_BANNER),
  /** Restore the legacy Hero recommendation UI for all users with one switch. */
  heroRecommendationsForAllUsers: enabled(import.meta.env.VITE_ENABLE_HERO_RECOMMENDATIONS_FOR_ALL_USERS),
  /** Keep the legacy hero experience only for signed-in users who used it before. */
  returningUserHeroRecommendations: !enabled(import.meta.env.VITE_DISABLE_RETURNING_USER_HERO_RECOMMENDATIONS),
  /** Club roles are private and are never exposed to guests or free accounts. */
  memberOnlyJobGating: true,
  /** Active Club members can explicitly narrow the list to Club roles. */
  memberOnlyJobFilter: true,
  /** Employer-side recruiting intake can be restored only after the two-sided service is compliant. */
  employerRecruitmentIntake: enabled(import.meta.env.VITE_ENABLE_EMPLOYER_RECRUITMENT_INTAKE),
  /** Personalized ranking and resume-match scores on public job discovery surfaces. */
  personalizedJobDiscovery: enabled(import.meta.env.VITE_ENABLE_PERSONALIZED_JOB_DISCOVERY),
  /** Referral/contact entry for free and anonymous users. Active members remain unaffected. */
  nonMemberReferralAccess: enabled(import.meta.env.VITE_ENABLE_NON_MEMBER_REFERRAL_ACCESS),
  /** Cross-page banners that convert job-information traffic into Club purchases. */
  membershipPromotionBanners: enabled(import.meta.env.VITE_ENABLE_MEMBERSHIP_PROMOTION_BANNERS),
  /** Company identity and operator information is not a membership promotion and stays visible by default. */
  homeClubInfoCard: !enabled(import.meta.env.VITE_DISABLE_HOME_CLUB_INFO_CARD),
  /** Club is presented as one advisor-led consulting service instead of purchasable information tiers. */
  clubConsultingOnly: !enabled(import.meta.env.VITE_DISABLE_CLUB_CONSULTING_ONLY),
  /** Online checkout stays implemented but is closed until the payment surface is restored explicitly. */
  paypalCheckout: enabled(import.meta.env.VITE_ENABLE_PAYPAL_CHECKOUT),
  /** Consultation-card redemption is available unless it is explicitly paused. The API remains the authority for every redemption. */
  membershipRedemption: !enabled(import.meta.env.VITE_DISABLE_MEMBERSHIP_REDEMPTION),
  /** Legacy Club Starter (¥99) and Partner (¥998) offer/catalog surfaces are hidden by default. */
  legacyClubStarterPartnerOffers: enabled(import.meta.env.VITE_ENABLE_LEGACY_CLUB_STARTER_PARTNER_OFFERS),
  /** Free users manage saved roles and applications from the Club home instead of separate tool pages. */
  nonMemberProfileUtilitiesOnHome: !enabled(import.meta.env.VITE_DISABLE_NON_MEMBER_PROFILE_HOME),
} as const
