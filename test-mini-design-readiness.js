import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const appConfig = read('miniprogram/src/app.config.ts')
const companiesPage = read('miniprogram/src/pages/companies/index.tsx')
const topBarStyles = read('miniprogram/src/components/editorial-top-bar/index.scss')
const primaryPages = [
  'miniprogram/src/pages/index/career-watch-page.tsx',
  'miniprogram/src/pages/companies/index.tsx',
  'miniprogram/src/pages/growth/index.tsx',
  'miniprogram/src/pages/profile/index.tsx'
]
const sourceFiles = [
  'miniprogram/src/app.scss',
  'miniprogram/src/components/editorial-search/index.tsx',
  'miniprogram/src/components/topic-scroller/index.tsx',
  ...primaryPages,
  'miniprogram/src/pages/company-detail/index.tsx',
  'miniprogram/src/pages/membership/index.tsx',
  'miniprogram/src/pages/note-detail/index.tsx',
  'miniprogram/src/pages/career-data/index.tsx',
  'miniprogram/src/pages/account-bind/index.tsx',
  'miniprogram/src/pages/account-settings/index.tsx',
  'miniprogram/src/custom-tab-bar/index.tsx'
]
const styleFiles = [
  'miniprogram/src/app.scss',
  'miniprogram/src/pages/index/index.scss',
  'miniprogram/src/pages/companies/index.scss',
  'miniprogram/src/pages/company-detail/index.scss',
  'miniprogram/src/pages/growth/index.scss',
  'miniprogram/src/pages/profile/index.scss',
  'miniprogram/src/pages/membership/index.scss',
  'miniprogram/src/custom-tab-bar/index.scss'
]
const source = sourceFiles.map(read).join('\n')
const styles = styleFiles.map(read).join('\n')

assert.match(appConfig, /custom:\s*true/)
for (const pagePath of ['pages/index/index', 'pages/companies/index', 'pages/growth/index']) {
  assert.ok(appConfig.includes(`pagePath: '${pagePath}'`), `missing primary tab: ${pagePath}`)
}
assert.doesNotMatch(appConfig, /pagePath:\s*'pages\/profile\/index'/)
assert.match(appConfig, /selectedColor:\s*'#C94F22'/)

for (const legacy of ['#5146e5', '#6d5dfc', '#7c3aed', '#8b5cf6']) {
  assert.ok(!source.toLowerCase().includes(legacy) && !styles.toLowerCase().includes(legacy), `legacy purple returned: ${legacy}`)
}
assert.doesNotMatch(source, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, 'UI copy must not contain emoji or dingbat glyphs')
assert.doesNotMatch(styles, /linear-gradient|radial-gradient/, 'core mini surfaces must stay flat and restrained')
assert.doesNotMatch(read('miniprogram/src/pages/membership/index.scss'), /#0[0-9a-f]{5}|#1[0-9a-f]{5}/i, 'membership page must not return to a dark theme')

for (const page of primaryPages.slice(0, 3)) assert.match(read(page), /EditorialTopBar/, 'primary tab pages must expose the avatar profile entry')
assert.doesNotMatch(read('miniprogram/src/pages/profile/index.tsx'), /EditorialTopBar/)
assert.match(source, /ContentSkeleton/)
assert.match(read('miniprogram/src/pages/membership/index.tsx'), /membership-topbar/)
assert.match(source, /搜索笔记、主题或关键词/)
assert.match(source, /TopicScroller/)
assert.match(source, /primary-button--disabled/)
assert.match(source, /重新加载/)
assert.match(source, /上传简历，快速识别方向/)
assert.match(source, /可选择 1–5 个方向/)
assert.doesNotMatch(source, /match-orbit|结果示例|AI 轨道/)
assert.match(source, /删除求职资料/)
assert.match(read('miniprogram/src/app.scss'), /min-height:\s*88px/)
assert.match(read('miniprogram/src/custom-tab-bar/index.scss'), /safe-area-inset-bottom/)
assert.doesNotMatch(read('miniprogram/src/pages/companies/index.scss'), /\.companies-navigation-mask/)
assert.doesNotMatch(read('miniprogram/src/pages/companies/index.scss'), /\.companies-tools::before/)
assert.match(read('miniprogram/src/pages/companies/index.scss'), /\.companies-tools\s*\{[^}]*background:\s*(?:#fff|var\(--color-surface\))/)
assert.doesNotMatch(read('miniprogram/src/pages/companies/index.scss'), /backdrop-filter/)
assert.match(topBarStyles, /position:\s*sticky/)
assert.match(topBarStyles, /top:\s*0/)
assert.match(companiesPage, /buildCompanyRoleSummary/)
assert.match(companiesPage, /company-card__industry/)
assert.doesNotMatch(companiesPage, /多个岗位开放申请中|等岗位开放申请中|formatUpdatedAt/)

for (const fake of ['Automattic', 'GitLab', 'Stripe', '$120k', '4.2k 阅读', '5.8k']) {
  assert.doesNotMatch(source, new RegExp(fake.replace('$', '\\$')), `prototype data leaked into UI: ${fake}`)
}

console.log('mini design-readiness checks passed')
