import assert from 'node:assert/strict'
import fs from 'node:fs'

const editorial = fs.readFileSync('src/components/home/HomeEditorialExperience.tsx', 'utf8')
const hero = fs.readFileSync('src/components/HomeHero.tsx', 'utf8')

assert.doesNotMatch(editorial, /CareerWatchSection|career-watch/, 'the website home must not render the personalized Career Watch module')
assert.match(editorial, /最近更新的远程机会/, 'the legacy public jobs section must be restored')
assert.match(editorial, /role="tablist"/, 'the public jobs section must expose category tabs')
assert.match(editorial, /tabs\.map\(\(tab\)/, 'the section must render the HomeHero category tabs')
assert.match(editorial, /jobs\.slice\(0, 6\)/, 'the section must cap each category at six jobs')
assert.doesNotMatch(editorial, /登录并设置关注|调整关注方向|开始关注|不感兴趣/, 'the website must not guide users through personalized watch settings')

for (const label of ['全部', '自由职业', '人事行政', '产品设计', '技术研发', '运营营销', '销售商务']) {
  assert.match(hero, new RegExp(`label: '${label}'`), `legacy category ${label} must remain available`)
}

assert.match(hero, /sortBy: 'recent'/, 'category requests must use recent ordering')
assert.match(hero, /spreadJobsByCompany\(res\.jobs \|\| \[\], 6, 2\)/, 'category requests must use the company spreading policy')
assert.match(hero, /const deferred: T\[\] = \[\]/, 'the spreading policy must defer duplicate-company jobs for backfill')
assert.match(hero, /resumeDailyCard=\{hasResumeRecommendationSignal/, 'resume users must retain the Hero role-reference card')

console.log('Home editorial feed rollback tests passed.')
