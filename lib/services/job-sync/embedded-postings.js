import * as cheerio from 'cheerio'
import { SourceError } from './http.js'

// Read the public React Flight payload as data, never evaluate site JavaScript.
// Text records use UTF-8 byte lengths and can span several script elements.
export function readFlightRecords(html) {
  const $ = cheerio.load(html), chunks = []
  $('script:not([src])').each((_, el) => {
    const match = $(el).text().trim().match(/^self\.__next_f\.push\((\[1,[\s\S]*\])\);?$/)
    if (!match) return
    try { const data = JSON.parse(match[1]); if (typeof data[1] === 'string') chunks.push(data[1]) } catch { /* Not a data record. */ }
  })
  const input = Buffer.from(chunks.join('')), records = new Map()
  let offset = 0
  while (offset < input.length) {
    const colon = input.indexOf(58, offset)
    if (colon < 0) break
    const id = input.subarray(offset, colon).toString()
    if (id === '') { // Resource hints, e.g. :HL[...], have no record ID.
      const newline = input.indexOf(10, colon)
      if (newline < 0) break
      offset = newline + 1
      continue
    }
    if (!/^[a-f0-9]+$/i.test(id)) break
    offset = colon + 1
    if (input[offset] === 84) { // T<hex byte length>,<text>
      const comma = input.indexOf(44, offset)
      const lengthText = input.subarray(offset + 1, comma).toString()
      if (comma < 0 || !/^[a-f0-9]+$/i.test(lengthText)) break
      const length = parseInt(lengthText, 16), end = comma + 1 + length
      if (end > input.length) break
      records.set(id, input.subarray(comma + 1, end).toString())
      offset = end
    } else {
      const newline = input.indexOf(10, offset), end = newline < 0 ? input.length : newline
      try { records.set(id, JSON.parse(input.subarray(offset, end).toString())) } catch { /* Imports/metadata aren't posting facts. */ }
      offset = end + 1
    }
  }
  return records
}

export function readDeelPostings(html, url, { listOnly = false } = {}) {
  const u = new URL(url)
  if (u.hostname !== 'jobs.deel.com') return null
  const slug = u.pathname.split('/').filter(Boolean)[0]
  const records = readFlightRecords(html)
  let props
  for (const record of records.values()) {
    if (Array.isArray(record) && Array.isArray(record[3]?.jobPostings)) props = record[3]
  }
  if (!props) return null
  if (!slug || props.orgSlug !== slug || props.careerPageSettings?.urlSlug !== slug)
    throw new SourceError('招聘平台返回的企业身份与当前招聘页不一致', 'partial')
  const boardId = props.careerPageSettings.jobBoard?.id
  return props.jobPostings.map(posting => {
    if (!/^[a-f0-9-]{36}$/i.test(posting.id) || !posting.title || !boardId ||
      !posting.jobPostingPublications?.some(p => p.jobBoard?.id === boardId && p.currentState?.stateSlug === 'published_basic'))
      throw new SourceError('招聘平台岗位身份或公开状态不完整', 'partial')
    const ref = posting.richtextDescription
    const description = typeof ref === 'string' && /^\$[a-f0-9]+$/i.test(ref) ? records.get(ref.slice(1)) : ref
    if (!listOnly && (typeof description !== 'string' || description.length < 50))
      throw new SourceError('招聘平台岗位正文尚未完整返回', 'partial')
    return {
      external_id: posting.id, title: posting.title, ...(listOnly ? {} : {description}),
      url: `${u.origin}/${encodeURIComponent(slug)}/job-details/${posting.id}/overview`,
      location: posting.job?.jobLocations?.map(x => x.location?.name).filter(Boolean).join(', '),
      job_type: posting.job?.jobEmploymentTypes?.map(x => x.employmentType?.name).filter(Boolean).join(', '),
      is_remote: posting.job?.workArrangementEnum === 'REMOTE' ? true : undefined
    }
  })
}
