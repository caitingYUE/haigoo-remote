import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8')
const source = read('./miniprogram/src/utils/runtime-compat.ts')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 }
}).outputText
const module = { exports: {} }
const context = vm.createContext({ module, exports: module.exports, Date, Number, String })
vm.runInContext(output, context)

const { formatCalendarDate, formatMonthDayTime, normalizeComparableText } = module.exports
assert.equal(formatCalendarDate('2026-08-29T04:05:00.000Z').split('.').length, 3)
assert.match(formatMonthDayTime('2026-08-29T04:05:00.000Z'), /^\d{2}\.\d{2} \d{2}:\d{2}$/)
assert.equal(formatCalendarDate('not-a-date'), '')
assert.equal(normalizeComparableText(' Product Manager '), 'product manager')

const miniSources = [
  './miniprogram/src/pages/index/career-watch-page.tsx',
  './miniprogram/src/pages/job-detail/index.tsx',
  './miniprogram/src/pages/membership/index.tsx',
  './miniprogram/src/pages/profile/index.tsx',
  './miniprogram/src/services/career-match-service.ts'
].map(read).join('\n')
assert.doesNotMatch(miniSources, /Intl\.DateTimeFormat|toLocaleDateString|\.normalize\(/)
assert.match(miniSources, /normalizeCareerWatchResponse/)
assert.match(miniSources, /暂时无法刷新，当前显示上次结果/)

console.log('mini runtime compatibility checks passed')
