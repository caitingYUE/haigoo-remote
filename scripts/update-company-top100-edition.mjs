import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { validateCompanyTop100, validateCompanyTop100Edition, getCompanyTop100Edition, companyTop100Snapshot } from '../lib/services/company-top100-service.js'

// Stage a reviewed snapshot and its public edition together. Deployment remains
// a separate verified step; no date-only rollovers or database writes.
export function prepareCompanyTop100Edition(candidate, current = companyTop100Snapshot, today = new Date().toISOString().slice(0,10)) {
  validateCompanyTop100(candidate)
  if (candidate.version === current.version || candidate.researchedAt <= current.researchedAt || candidate.researchedAt > today) throw new Error('A release needs a new version and a completed, newer review date')
  const quarterMonth = Math.floor((Number(candidate.researchedAt.slice(5,7))-1)/3)*3+1
  const quarterStart = `${candidate.researchedAt.slice(0,4)}-${String(quarterMonth).padStart(2,'0')}-01`
  if (!candidate.version.startsWith(`${candidate.researchedAt}.v`) || !/\.v[1-9]\d*$/.test(candidate.version)) throw new Error('Version must identify its completed review date')
  if (candidate.companies.some(row => row.reviewedAt > candidate.researchedAt || row.reviewedAt < quarterStart)) throw new Error('Every company needs a review in the edition quarter, no later than the edition date')
  return getCompanyTop100Edition(candidate)
}

export async function writeCompanyTop100Edition(candidate, edition, directory) {
  validateCompanyTop100Edition(edition,candidate)
  await fs.mkdir(directory, { recursive: true })
  const files = [['company-top100-current.json',candidate],['company-top100-edition.json',edition]]
  const staged = []
  try {
    for (const [name,value] of files) {
      const target = path.join(directory,name), temporary = `${target}.${process.pid}.tmp`
      await fs.writeFile(temporary,JSON.stringify(value,null,2)+'\n',{flag:'wx'})
      staged.push([temporary,target])
    }
    for (const [temporary,target] of staged) await fs.rename(temporary,target)
  } finally { for (const [temporary] of staged) await fs.rm(temporary,{force:true}) }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), input = args.find(arg => !arg.startsWith('--'))
  if (!input || args.some(arg => arg.startsWith('--') && arg !== '--write')) throw new Error('Usage: node scripts/update-company-top100-edition.mjs reviewed-ranking.json [--write]')
  const candidate = JSON.parse(await fs.readFile(input,'utf8'))
  const edition = prepareCompanyTop100Edition(candidate)
  if (args.includes('--write')) await writeCompanyTop100Edition(candidate,edition,path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../lib/data'))
  console.log(JSON.stringify({mode:args.includes('--write')?'staged':'dry-run',...edition,total:candidate.companies.length},null,2))
}
