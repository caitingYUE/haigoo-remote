import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const appConfig = read('miniprogram/src/app.config.ts')
const sourceFiles = [
  'miniprogram/src/app.scss',
  'miniprogram/src/components/editorial-top-bar/index.tsx',
  'miniprogram/src/components/editorial-search/index.tsx',
  'miniprogram/src/components/topic-scroller/index.tsx',
  'miniprogram/src/pages/index/index.tsx',
  'miniprogram/src/pages/companies/index.tsx',
  'miniprogram/src/pages/growth/index.tsx',
  'miniprogram/src/pages/profile/index.tsx',
  'miniprogram/src/pages/community/index.tsx',
  'miniprogram/src/pages/consultation/index.tsx',
  'miniprogram/src/pages/membership/index.tsx',
  'miniprogram/src/pages/note-detail/index.tsx',
  'miniprogram/src/pages/career-data/index.tsx',
  'miniprogram/src/pages/account-bind/index.tsx',
  'miniprogram/src/pages/account-settings/index.tsx',
  'miniprogram/src/pages/payment-orders/index.tsx',
  'miniprogram/src/custom-tab-bar/index.tsx'
]
const source = sourceFiles.map(read).join('\n')

assert.match(appConfig, /custom:\s*true/, 'centered Match navigation should use a custom tab bar')
for (const pagePath of ['pages/companies/index', 'pages/index/index', 'pages/growth/index']) {
  assert.ok(appConfig.includes(`pagePath: '${pagePath}'`), `missing primary tab: ${pagePath}`)
}
assert.ok(!appConfig.includes("pagePath: 'pages/profile/index'"), 'profile should open from the top-right avatar')
assert.match(appConfig, /selectedColor:\s*'#C94F22'/, 'native tab configuration should use the accessible Haigoo interactive orange')

for (const legacy of ['#5146e5', '#6d5dfc', '#7c3aed', '#8b5cf6']) {
  assert.ok(!source.toLowerCase().includes(legacy), `legacy purple returned: ${legacy}`)
}

for (const bannedCopy of [
  '>Free<',
  'MEMBERS ONLY',
  '锁定状态不会下载',
  '版权音频',
  '结构化视频笔记',
  '页面内购买状态',
  '网站账号',
  '职业证据',
  '结果结构示例',
  '当前展示 12 家企业预览'
]) {
  assert.ok(!source.includes(bannedCopy), `design copy regression: ${bannedCopy}`)
}

assert.match(source, /ContentSkeleton/, 'core pages should provide shaped loading feedback')
assert.match(source, /搜索笔记、主题或关键词/, 'growth feed should support search-led discovery')
assert.match(source, /TopicScroller/, 'growth feed should expose shared lightweight topic browsing')
assert.match(source, /EditorialTopBar/, 'primary pages should use the capsule-aware editorial top bar')
assert.ok(!read('miniprogram/src/pages/companies/index.scss').includes('linear-gradient'), 'company hero should use a restrained flat overlay')
assert.match(source, /consultation-error/, 'consultation form should provide inline errors')
assert.match(source, /primary-button--disabled/, 'async primary actions should expose disabled state')
assert.match(source, /重新加载/, 'error states should expose a clear recovery action')
assert.match(source, /原文件不留存/, 'Match must explain raw resume handling before upload')
assert.match(source, /简历匹配/, 'Match intro should expose resume and manual modes')
assert.match(source, /match-orbit/, 'Match intro should use one immersive circular primary action')
assert.match(source, /结果示例/, 'Match intro should preview the result before collecting data')
assert.match(source, /永久删除职业资料/, 'career data must expose a manual deletion action')
assert.match(read('miniprogram/src/app.scss'), /min-height:\s*88px/, 'primary touch targets should be at least 88rpx')

console.log('mini design-readiness checks passed')
