import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'
import sharp from 'sharp'
import { deriveMembershipCapabilities } from './lib/shared/membership.js'
import { VIRTUAL_PAYMENT_PRODUCTS } from './lib/services/wechat-virtual-payment-service.js'

const read = (file) => fs.readFileSync(file, 'utf8')
const evaluate = (source, scope = {}) => vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2019 }
}).outputText, scope)

const detail = read('miniprogram/src/pages/job-detail/index.tsx')
const application = detail.slice(detail.indexOf('  const applicationMethod ='), detail.indexOf('  const facts ='))
const actionFor = (job) => evaluate(`${application}\napplicationMethod`, { job })
assert.equal(actionFor({ officialApplyUrl: 'https://example.com/job', publicApplicationEmail: 'jobs@example.com' }).action, '复制申请链接')
assert.equal(actionFor({ officialApplyUrl: '', publicApplicationEmail: 'jobs@example.com' }).action, '复制申请邮箱')
assert.equal(actionFor({ publicApplicationEmail: 'jobs@example.com' }).value, 'jobs@example.com')
assert.equal(actionFor({}), null)
assert.doesNotMatch(detail, /className='job-detail__application(?:'|-)/, 'the extra application panel must not repeat the bottom action')
assert.match(detail, /copyValue\(formatJobApplicationCopy\(job, companyName, applicationMethod.kind, applicationMethod.value\)/)

const membership = read('miniprogram/src/pages/membership/index.tsx')
const includedSource = membership.slice(membership.indexOf('function isBenefitIncluded('), membership.indexOf('export default function MembershipPage'))
const includesBenefit = evaluate(`${includedSource}\nisBenefitIncluded`)
for (const plan of Object.values(VIRTUAL_PAYMENT_PRODUCTS)) {
  const capabilities = deriveMembershipCapabilities({ member_type: plan.memberType, member_status: 'active' })
  assert.equal(capabilities.isActive, true, 'website free-usage grants active members unlimited applications')
  assert.equal(capabilities.canAccessCorporateEnglishVideos, true, 'notes access must match the actual server permission')
  assert.equal(includesBenefit(plan, { key: 'website_apply' }), true)
  assert.equal(includesBenefit(plan, { key: 'notes' }), true)
}
assert.equal(includesBenefit({ memberType: 'none' }, { key: 'notes' }), false)
for (const label of ['HaigooRemote官网无限申请', '远程职业笔记无限学习']) assert.ok(membership.includes(label))

const image = 'miniprogram/assets/home-hero-bg.jpg'
const metadata = await sharp(image).metadata()
assert.equal(metadata.format, 'jpeg')
assert.equal(metadata.width, 1125)
assert.ok(metadata.height > 800)
assert.ok(fs.statSync(image).size < 200 * 1024)
await sharp(image).raw().toBuffer() // Actually decode all pixels, not just the header.
const watch = read('miniprogram/src/pages/index/career-watch-page.tsx')
assert.match(watch, /import heroImage from '\.\.\/\.\.\/\.\.\/assets\/home-hero-bg\.jpg'/)
assert.match(watch, /src=\{heroImage\} mode='aspectFill' lazyLoad=\{false\}/)
const bundle = process.argv.find((argument) => argument.startsWith('--bundle='))?.slice('--bundle='.length)
if (bundle) {
  const packaged = path.join(bundle, 'assets/home-hero-bg.jpg')
  assert.deepEqual(fs.readFileSync(packaged), fs.readFileSync(image), 'the uploaded image must be the verified source')
  const script = read(path.join(bundle, 'pages/index/index.js'))
  assert.ok(script.includes('assets/home-hero-bg.jpg'))
  assert.ok(!script.includes('assets/home-hero-bg.webp'))
  assert.match(read(path.join(bundle, 'pages/index/index.wxss')), /\.watch-start__hero-image\{[^}]*position:absolute/)
}
console.log('mini experience feedback: image decoding/package, application actions and real membership entitlements passed')
