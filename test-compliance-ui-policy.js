import assert from 'node:assert/strict'
import fs from 'node:fs'

const hero = fs.readFileSync('src/components/HomeHero.tsx', 'utf8')
const community = fs.readFileSync('src/components/WeChatCommunityPanel.tsx', 'utf8')
const profile = fs.readFileSync('src/pages/ProfileCenterPage.tsx', 'utf8')
const consulting = fs.readFileSync('src/components/ClubConsultingOverview.tsx', 'utf8')
const compliance = fs.readFileSync('src/config/compliance.ts', 'utf8')

assert.ok(hero.includes('COMPLIANCE_FEATURES.homeHeroGreetingBanner'), 'the duplicate Hero greeting must stay behind a restore switch')
assert.ok(hero.includes('COMPLIANCE_FEATURES.heroRecommendationsForAllUsers'), 'all-user Hero recommendations must have a one-switch restore path')
assert.ok(hero.includes('COMPLIANCE_FEATURES.returningUserHeroRecommendations'), 'historical recommendation users must retain their compatibility path')
assert.ok(hero.includes("text('开放交流群，正在找机会的朋友可以互相探讨。'"), 'the homepage community description must use the approved copy')
assert.ok(hero.includes("text('岗位分享'"), 'the homepage community card must say 岗位分享')
assert.ok(hero.includes("text('自由分享好机会'"), 'the homepage community card must say 自由分享好机会')
assert.ok(hero.includes("text('心动的企业'"), 'the company-card section must remain on the homepage')
assert.ok(hero.includes('COMPLIANCE_FEATURES.homeClubInfoCard'), 'the homepage company identity card must not depend on membership promotion banners')
assert.ok(community.includes('开放交流群，正在找机会的朋友可以互相探讨。'), 'shared community surfaces must use the same approved description')

assert.ok(profile.includes('membershipRedemptionEnabled = COMPLIANCE_FEATURES.membershipRedemption'), 'redemption must be controlled by the compliance switch')
assert.ok(profile.includes('COMPLIANCE_FEATURES.legacyClubStarterPartnerOffers'), 'legacy ¥99/¥998 catalog surfaces must be switchable')
assert.ok(profile.includes("CLUB_SERVICE_PLANS.filter((plan) => plan.id === 'half_year')"), 'the default member offer catalog must retain only the ¥499 consulting service')
assert.ok(profile.includes('price: 99'), 'the legacy ¥99 implementation must remain in source')
assert.ok(profile.includes("price: '¥998 / 年'"), 'the legacy ¥998 implementation must remain in source')
assert.ok(profile.includes("text('我的权益工作台'"), 'the existing member benefits dashboard must remain')
assert.ok(profile.includes("text('有效期至'"), 'existing member expiry details must remain')
assert.ok(profile.includes("text('Club 服务 QA'"), 'existing member Club QA must remain')
assert.ok(profile.includes('memberRecommendedJobs.map'), 'existing member recommendations must remain')
assert.ok(profile.includes('公开岗位信息面向所有用户开放；Club 专属岗位仅向有效会员开放'), 'public and Club-only role visibility must be described accurately')
assert.ok(profile.includes('会员在有效期内保留不限次官网直申与邮箱申请'), 'existing member email application entitlement must remain')
assert.ok(consulting.includes('申请很多，却迟迟没有回复'), 'the consulting page must start from realistic career pain points')
assert.ok(consulting.includes('想转型，又判断不准从哪里开始'), 'the consulting page must cover career transition uncertainty')
assert.ok(consulting.includes('咨询只适合远程求职吗？'), 'the consulting page must explain that the service is broader than remote work')
assert.ok(consulting.includes('不包含岗位信息售卖、岗位推荐、内推或招聘撮合'), 'the consulting page must keep a clear compliance boundary')

for (const key of [
  'heroRecommendationsForAllUsers',
  'returningUserHeroRecommendations',
  'membershipRedemption',
  'legacyClubStarterPartnerOffers',
  'paypalCheckout',
  'homeClubInfoCard',
  'nonMemberProfileUtilitiesOnHome',
]) {
  assert.ok(compliance.includes(key), `missing compliance feature switch: ${key}`)
}

console.log('Compliance UI policy tests passed.')
