import { writeFile } from 'node:fs/promises'
import { scanPage } from '../lib/services/job-sync/adapters.js'
import { assessPreflight } from '../lib/services/job-sync/preflight.js'
import {
  catalogSource,
  VALIDATED_BOARDS
} from '../lib/services/job-sync/catalog.js'
const names = process.argv.includes('--all')
  ? Object.values(VALIDATED_BOARDS).flatMap(Object.keys)
  : process.argv.filter((a) => !a.startsWith('--')).slice(2)
const report = []
for (const name of names.length
  ? names
  : [
      'Canonical',
      'Remote People',
      'Supabase',
      'LILT',
      'Metabase',
      'Lionbridge',
      'ShaeWellness',
      'Intellect'
    ]) {
  const source = catalogSource({ name }),
    controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 120000)
  let cursor = null,
    count = 0,
    pages = 0,
    complete = false,
    missingDescriptions = 0
  const items = []
  let evidence = {}
  try {
    do {
      const page = await scanPage(source, cursor, { signal: controller.signal })
      items.push(...page.jobs)
      evidence = {
        list_complete: !page.next && page.complete,
        partial: evidence.partial || page.reason,
        total: page.total ?? evidence.total
      }
      count += page.jobs.length
      pages++
      cursor = page.next
      complete = page.complete
      missingDescriptions += page.jobs.filter(
        (j) => !j.description || j.description.length < 50
      ).length
    } while (cursor && pages < 100)
    report.push({
      ...assessPreflight(source, items, evidence),
      name,
      adapter: source.adapter,
      count,
      pages,
      complete,
      missingDescriptions
    })
  } catch (error) {
    report.push({
      name,
      adapter: source.adapter,
      count,
      pages,
      complete: false,
      error: error.message
    })
  } finally {
    clearTimeout(timer)
  }
  console.log(JSON.stringify(report.at(-1)))
}
const output = process.argv.find((a) => a.startsWith('--output='))
if (output)
  await writeFile(
    output.slice(9),
    JSON.stringify(
      { checked_at: new Date().toISOString(), sources: report },
      null,
      2
    ) + '\n'
  )
if (
  report.some(
    (r) => !r.preflight_passed || !r.complete || r.missingDescriptions
  )
)
  process.exitCode = 1
