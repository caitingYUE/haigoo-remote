import * as cheerio from 'cheerio'
import { mapDescriptionFields, salaryRangeText } from './field-mapping.js'
import { readDeelPostings } from './embedded-postings.js'
import { isJobsyn, scanJobsyn, verifyJobsyn } from './jobsyn.js'
import {
  fetchPublic,
  requireJson,
  SourceError,
  validatePublicUrl
} from './http.js'
import {
  canonicalUrl,
  cleanText,
  plainText,
  externalIdentity,
  sourceFacts,
  hash
} from './policy.js'

export const ADAPTERS = [
  'greenhouse',
  'ashby',
  'lever',
  'workable',
  'bamboohr',
  'smartrecruiters',
  'workday',
  'html',
  'feed',
  'manual'
]
export function detectSource(raw) {
  if (!raw)
    return {
      adapter: 'manual',
      config: {},
      capabilities: {
        discover: false,
        details: false,
        updates: false,
        absence: false
      }
    }
  const u = new URL(raw),
    parts = u.pathname.split('/').filter(Boolean),
    host = u.hostname
  let adapter = 'html',
    config = {}
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    adapter = 'greenhouse'
    config = { board: parts[0] }
  } else if (host === 'jobs.ashbyhq.com') {
    adapter = 'ashby'
    config = { board: parts[0] }
  } else if (/^jobs\.(eu\.)?lever\.co$/.test(host)) {
    adapter = 'lever'
    config = { board: parts[0], eu: host.includes('.eu.') }
  } else if (host === 'apply.workable.com') {
    adapter = 'workable'
    config = { board: parts[0] }
  } else if (host.endsWith('.bamboohr.com')) adapter = 'bamboohr'
  else if (host.endsWith('.smartrecruiters.com')) {
    adapter = 'smartrecruiters'
    config = { board: parts[0] }
  } else if (host.endsWith('.myworkdayjobs.com') || host.endsWith('.myworkdaysite.com')) {
    adapter = 'workday'
    const locale = parts.find((p) => /^\w\w-\w\w$/.test(p)) || 'en-US'
    const recruiting = parts.indexOf('recruiting')
    config = host.endsWith('.myworkdaysite.com') && recruiting >= 0
      ? { tenant: parts[recruiting + 1], site: parts[recruiting + 2], locale }
      : { tenant: host.split('.')[0], site: parts.find((p) => !/^\w\w-\w\w$/.test(p)), locale }
  } else if (host.endsWith('linkedin.com')) adapter = 'manual'
  const structured = [
    'greenhouse',
    'ashby',
    'lever',
    'workable',
    'smartrecruiters',
    'workday',
    'bamboohr'
  ].includes(adapter)
  return {
    adapter,
    config,
    capabilities: {
      discover: adapter !== 'manual',
      details: adapter !== 'manual',
      updates: adapter !== 'manual',
      absence: structured
    }
  }
}
const location = (value) =>
  typeof value === 'string'
    ? value
    : cleanText(
        [
          value?.name,
          value?.city,
          value?.region,
          value?.country?.name || value?.country,
          value?.location_str
        ]
          .filter((x) => typeof x === 'string')
          .join(', ')
      )
function item(id, facts, extra = {}) {
  const mapped = mapDescriptionFields({ ...sourceFacts(facts), description: facts.description })
  return {
    external_id: String(
      id || externalIdentity(facts.url) || canonicalUrl(facts.url)
    ),
    ...sourceFacts(mapped),
    field_evidence: mapped.field_evidence,
    ...extra
  }
}
function posted(value) {
  return value && Number.isFinite(Date.parse(value))
    ? new Date(value).toISOString()
    : undefined
}
function listResult(
  jobs,
  { next = null, complete = true, total, reason } = {}
) {
  for (const job of jobs) validatePublicUrl(job.url)
  if (jobs.some((j) => !j.external_id || !j.title || !j.url))
    throw new SourceError('列表缺少岗位身份、标题或链接', 'partial')
  if (new Set(jobs.map((j) => j.external_id)).size !== jobs.length)
    throw new SourceError('列表存在重复岗位身份，需要复核分页', 'partial')
  return { jobs, next, complete, total, reason }
}
export function readJsonLd(html, baseUrl) {
  const $ = cheerio.load(html),
    jobs = []
  const visit = (data) => {
    if (Array.isArray(data)) {
      data.forEach(visit)
      return
    }
    if (!data || typeof data !== 'object') return
    const types = Array.isArray(data['@type']) ? data['@type'] : [data['@type']]
    if (types.includes('JobPosting')) {
      const address = (
        Array.isArray(data.jobLocation) ? data.jobLocation[0] : data.jobLocation
      )?.address
      const regions = Array.isArray(data.applicantLocationRequirements)
        ? data.applicantLocationRequirements
        : [data.applicantLocationRequirements]
      jobs.push(
        item(
          data.identifier?.value,
          {
            title: data.title,
            description: data.description,
            url: new URL(data.url || baseUrl, baseUrl).href,
            location:
              regions
                .filter(Boolean)
                .map((x) => x.name)
                .join(', ') ||
              location({
                city: address?.addressLocality,
                region: address?.addressRegion,
                country: address?.addressCountry
              }),
            is_remote:
              data.jobLocationType === 'TELECOMMUTE' ? true : undefined,
            job_type: Array.isArray(data.employmentType)
              ? data.employmentType.join(', ')
              : data.employmentType,
            salary: salaryRangeText({ ...(typeof data.baseSalary?.value === 'number' ? { value: data.baseSalary.value } : data.baseSalary?.value), currency: data.baseSalary?.currency }),
            published_at: posted(data.datePosted)
          },
          { valid_through: posted(data.validThrough) }
        )
      )
    }
    if (data['@graph']) visit(data['@graph'])
    if (data.itemListElement) visit(data.itemListElement)
    if (data.item) visit(data.item)
  }
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      visit(JSON.parse($(el).text()))
    } catch {
      /* Invalid blocks do not establish completeness. */
    }
  })
  return jobs
}
function pageBlocked(response) {
  const $ = cheerio.load(response.text)
  $('script,style').remove()
  const title = $('title').text(),
    text = cleanText($('body').text())
  if (
    /just a moment|access denied|verify you are human|checking your browser/i.test(
      title + ' ' + text.slice(0, 1000)
    )
  )
    throw new SourceError('来源返回验证或拦截页面', 'blocked')
}
export async function readDetail(
  url,
  { fetcher = fetchPublic, signal, selector } = {}
) {
  const response = await fetcher(url, { signal })
  if (response.status !== 200)
    throw new SourceError(
      `岗位详情暂不可读取（HTTP ${response.status}）`,
      'partial'
    )
  pageBlocked(response)
  const structured = readJsonLd(response.text, response.url || url)
  if (structured.length) {
    const matches = structured.filter(
      (job) => canonicalUrl(job.url) === canonicalUrl(url)
    )
    if (matches.length === 1) return matches[0]
    throw new SourceError(
      '详情中的岗位身份不一致或存在多个岗位，需人工核实',
      'partial'
    )
  }
  if (canonicalUrl(response.url || url) !== canonicalUrl(url))
    throw new SourceError('详情发生跳转，不能证明仍是当前岗位', 'partial')
  const $ = cheerio.load(response.text)
  // A posting heading may live in its own <header>; ASP.NET may wrap the
  // entire document in a <form>. Keep content, removing only form controls.
  const title = cleanText($('h1').first().text())
  $('script,style,nav,footer,noscript,input,select,textarea,button').remove()
  const candidates = selector ? [selector] : [
    '[data-testid="job-description"],.job-description,[itemprop="description"]',
    '.prose,.w-richtext', 'main,article,[role="main"],#main', '.description'
  ]
  let description = ''
  for (const candidate of candidates) {
    const texts = $(candidate).map((_, el) => plainText($(el).html() || '')).get()
      .filter(text => text.length >= 50)
    // Never join unrelated content containers into a fictitious posting.
    if (texts.length === 1) { description = texts[0]; break }
  }
  if (
    description.length < 50 ||
    /loading open roles|加载中/.test(description.slice(0, 300))
  )
    throw new SourceError('岗位详情内容尚未加载或不完整', 'partial')
  return item(externalIdentity(url), {
    title,
    description,
    url
  })
}

export async function scanPage(
  source,
  cursor,
  { fetcher = fetchPublic, signal } = {}
) {
  const cfg = source.config || {},
    u = new URL(source.url),
    board = encodeURIComponent(cfg.board || ''),
    opts = { signal }
  const json = async (url, options = {}) =>
    requireJson(await fetcher(url, { ...opts, ...options }))
  let jobs = []
  switch (source.adapter) {
    case 'manual':
      throw new SourceError(
        '此来源需要人工核实，可粘贴岗位原文生成待审草稿',
        'blocked'
      )
    case 'greenhouse': {
      const d = await json(
        `https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`
      )
      if (!Array.isArray(d.jobs) || d.meta?.total !== d.jobs.length)
        throw new SourceError('Greenhouse 列表数量与总数不一致', 'partial')
      jobs = d.jobs.map((j) =>
        item(
          j.id,
          {
            title: j.title,
            description: j.content,
            url: j.absolute_url,
            location: location(j.location)
          },
          { department: j.departments?.map((x) => x.name).join(', ') }
        )
      )
      return listResult(jobs, { total: d.meta.total })
    }
    case 'ashby': {
      const d = await json(
        `https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`
      )
      if (!Array.isArray(d.jobs))
        throw new SourceError('Ashby 列表结构变化', 'partial')
      jobs = d.jobs.map((j) =>
        item(
          externalIdentity(j.jobUrl),
          {
            title: j.title,
            description: j.descriptionHtml || j.descriptionPlain,
            url: j.jobUrl,
            location: [
              j.location,
              ...(j.secondaryLocations || []).map((l) => l.location)
            ]
              .filter(Boolean)
              .join('; '),
            is_remote: j.isRemote,
            job_type: j.employmentType,
            salary: j.compensation?.scrapeableCompensationSalarySummary || null,
            published_at: posted(j.publishedAt)
          },
          { department: j.department, listed: j.isListed !== false }
        )
      )
      return listResult(jobs, { total: jobs.length })
    }
    case 'lever': {
      const offset = cursor?.offset || 0,
        limit = 100
      const d = await json(
        `https://api.${cfg.eu ? 'eu.' : ''}lever.co/v0/postings/${board}?mode=json&limit=${limit}&skip=${offset}`
      )
      if (!Array.isArray(d))
        throw new SourceError('Lever 列表结构变化', 'partial')
      jobs = d.map((j) =>
        item(
          j.id,
          {
            title: j.text,
            description: [
              j.descriptionPlain || j.description,
              ...(j.lists || []).map((l) => `${l.text}\n${l.content}`),
              j.additionalPlain || j.additional
            ]
              .filter(Boolean)
              .join('\n'),
            url: j.hostedUrl,
            location: location(j.categories?.location),
            job_type: j.categories?.commitment,
            salary: salaryRangeText(j.salaryRange),
            is_remote: j.workplaceType
              ? j.workplaceType === 'remote'
              : undefined
          },
          { department: j.categories?.department }
        )
      )
      return listResult(jobs, {
        next: d.length === limit ? { offset: offset + limit } : null,
        complete: d.length < limit
      })
    }
    case 'workable': {
      const d = await json(
        `https://www.workable.com/api/accounts/${board}?details=true`
      )
      if (!Array.isArray(d.jobs))
        throw new SourceError('Workable 列表结构变化', 'partial')
      jobs = d.jobs.map((j) =>
        item(
          j.shortcode || j.id,
          {
            title: j.title,
            description: [j.description, j.requirements, j.benefits]
              .filter(Boolean)
              .join('\n'),
            url: j.url || j.shortlink,
            location:
              j.locations?.map(location).filter(Boolean).join('; ') ||
              location(j.location) ||
              location({ city: j.city, region: j.state, country: j.country }),
            is_remote: j.telecommuting ?? j.location?.telecommuting,
            job_type: j.employment_type,
            published_at: posted(j.published_on)
          },
          { department: j.department }
        )
      )
      // Workable repeats the same shortcode/JD for each recruiting location.
      // Merge only identical role facts; a conflicting identity remains an error.
      const unique = new Map()
      for (const job of jobs) {
        const previous = unique.get(job.external_id)
        if (!previous) {
          unique.set(job.external_id, job)
          continue
        }
        const core = job => {
          const rest = {...job}
          delete rest.location
          delete rest.published_at
          return rest
        }
        if (hash(core(previous)) !== hash(core(job)))
          throw new SourceError(
            'Workable 同一身份返回了冲突的岗位内容',
            'partial'
          )
        previous.location = [
          ...new Set(
            [
              ...(previous.location || '').split('; '),
              ...(job.location || '').split('; ')
            ].filter(Boolean)
          )
        ]
          .sort()
          .join('; ')
        if (
          job.published_at &&
          (!previous.published_at || job.published_at < previous.published_at)
        )
          previous.published_at = job.published_at
      }
      return listResult([...unique.values()], { total: unique.size })
    }
    case 'smartrecruiters': {
      if (cursor?.detailJobs)
        return detailPage([], source, cursor, { fetcher, signal })
      const offset = cursor?.offset || 0,
        limit = 100
      const d = await json(
        `https://api.smartrecruiters.com/v1/companies/${board}/postings?limit=${limit}&offset=${offset}`
      )
      if (!Array.isArray(d.content) || !Number.isInteger(d.totalFound))
        throw new SourceError('SmartRecruiters 列表不完整', 'partial')
      jobs = d.content.map((j) =>
        item(j.id, {
          title: j.name,
          url: j.ref?.includes('/postings/')
            ? `https://jobs.smartrecruiters.com/${cfg.board}/${j.id}`
            : j.ref,
          location: location(j.location),
          is_remote: j.location?.remote,
          job_type: j.typeOfEmployment?.label,
          published_at: posted(j.releasedDate)
        })
      )
      return detailPage(jobs, source, cursor, {
        fetcher,
        signal,
        nextList:
          offset + d.content.length < d.totalFound
            ? { offset: offset + d.content.length }
            : null,
        total: d.totalFound
      })
    }
    case 'bamboohr': {
      if (cursor?.detailJobs)
        return detailPage([], source, cursor, { fetcher, signal })
      const d = await json(`${u.origin}/careers/list`)
      if (!Array.isArray(d.result))
        throw new SourceError('BambooHR 列表结构变化', 'partial')
      jobs = d.result.map((j) =>
        item(j.id, {
          title: j.jobOpeningName,
          url: `${u.origin}/careers/${j.id}`,
          location: location(j.location)
        })
      )
      return detailPage(jobs, source, cursor, {
        fetcher,
        signal,
        total: jobs.length
      })
    }
    case 'workday': {
      if (cursor?.detailJobs)
        return detailPage([], source, cursor, { fetcher, signal })
      const offset = cursor?.offset || 0,
        limit = 20
      const d = await json(
        `${u.origin}/wday/cxs/${encodeURIComponent(cfg.tenant)}/${encodeURIComponent(cfg.site)}/jobs`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: { appliedFacets: {}, limit, offset, searchText: '' }
        }
      )
      if (!Array.isArray(d.jobPostings) || !Number.isInteger(d.total))
        throw new SourceError('Workday 列表结构变化', 'partial')
      jobs = d.jobPostings.map((j) =>
        item(j.bulletFields?.[0] || j.externalPath, {
          title: j.title,
          url: `${u.origin}/${cfg.locale}/${cfg.site}${j.externalPath}`,
          location: j.locationsText
        })
      )
      return detailPage(jobs, source, cursor, {
        fetcher,
        signal,
        nextList:
          offset + d.jobPostings.length < d.total
            ? { offset: offset + d.jobPostings.length }
            : null,
        total: d.total
      })
    }
    case 'feed': {
      if (cursor?.detailJobs)
        return detailPage([], source, cursor, { fetcher, signal })
      const r = await fetcher(source.url, opts)
      if (r.status !== 200) throw new SourceError('订阅源请求失败')
      const $ = cheerio.load(r.text, { xml: true })
      jobs = $('item,entry,offer')
        .map((_, el) => {
          const e = $(el),
            url =
              e.find('link').attr('href') || e.find('link,url').first().text()
          return item(e.find('guid,id').first().text() || canonicalUrl(url), {
            title: e.find('title').first().text(),
            url,
            description: e.find('description,content,summary').first().text()
          })
        })
        .get()
      return listResult(jobs, {
        complete: false,
        reason: '订阅源用于发现更新，不证明完整招聘清单'
      })
    }
    default: {
      if (isJobsyn(source.url)) {
        const result = await scanJobsyn(source, cursor, { fetcher, signal })
        return listResult(result.jobs.map(j => item(j.external_id, j)), result)
      }
      if (cursor?.detailJobs)
        return detailPage([], source, cursor, { fetcher, signal })
      const r = await fetcher(cursor?.pageUrl || source.url, opts)
      if (r.status !== 200)
        throw new SourceError(`招聘入口请求失败（HTTP ${r.status}）`)
      pageBlocked(r)
      const embedded = readDeelPostings(r.text, r.url || source.url)
      if (embedded) return listResult(embedded.map(j => item(j.external_id, j)), {
        complete: false, reason: '已读取招聘页内嵌岗位数据，列表完整性尚未确认'
      })
      // Some branded ATS sites negotiate JSON on their normal careers URL.
      // Pinpoint exposes complete posting fields here, rather than HTML links.
      if (r.text.trimStart().startsWith('{')) {
        let payload
        try { payload = JSON.parse(r.text) } catch { /* Fall through to HTML diagnostics. */ }
        if (Array.isArray(payload?.data) && payload.data.length && payload.data.every(j => j.id && j.title && j.url && typeof j.description === 'string')) {
          return listResult(payload.data.map(j => item(j.id, {
            title:j.title, url:j.url, description:[j.description,j.key_responsibilities,j.skills_knowledge_expertise,j.benefits].filter(Boolean).join('\n'),
            location:location(j.location), job_type:j.employment_type_text, is_remote:j.workplace_type==='remote'
          })), {complete:false, reason:'已取得岗位样本，列表完整性尚未确认'})
        }
      }
      const $ = cheerio.load(r.text),
        structured = readJsonLd(r.text, r.url || source.url)
      const href = $(cfg.nextSelector || 'a[rel="next"]')
        .first()
        .attr('href')
      const nextList = href
        ? { pageUrl: new URL(href, r.url || source.url).href }
        : null
      if (nextList?.pageUrl === (cursor?.pageUrl || source.url))
        throw new SourceError('分页链接循环', 'partial')
      if (structured.length > 0)
        return listResult(structured, {
          next: nextList,
          complete: !nextList && cfg.completeList === true,
          reason: cfg.completeList ? null : '未验证列表完整性'
        })
      const links = new Map()
      $(cfg.linkSelector || 'a[href]').each((_, el) => {
        const href = $(el).attr('href')
        if (!href) return
        let url
        try {
          url = new URL(href, r.url || source.url).href
        } catch {
          return
        }
        if (
          !/^https?:/.test(url) ||
          canonicalUrl(url) === canonicalUrl(source.url)
        )
          return
        const pathname = new URL(url).pathname
        if (/\/(?:vacancy-apply|registration|login|register)(?:[./]|$)/i.test(pathname)) return
        if (
          !cfg.linkSelector &&
          !/\/(jobs?|careers?|positions|vacancies|o|postings|p)\/(?!join(?:\/|$)|search(?:\/|$)|vacancy-search)[^/]+/.test(
            pathname
          )
        )
          return
        const title = cleanText($(el).text())
        if (!title || /privacy|cookie|contact|sign in/i.test(title)) return
        links.set(
          canonicalUrl(url),
          item(externalIdentity(url) || canonicalUrl(url), { title, url })
        )
      })
      jobs = [...links.values()]
      if (!jobs.length && !cursor?.entryVisited) {
        // Follow only an actual same-site recruitment link, never guessed URLs.
        const entry=$('a[href]').map((_,el)=>({href:$(el).attr('href'),label:cleanText($(el).text())})).get().find(link=> {
          try { const u=new URL(link.href,r.url||source.url); return u.origin===new URL(r.url||source.url).origin && canonicalUrl(u.href)!==canonicalUrl(r.url||source.url) && /^(?:view (?:all )?(?:jobs|openings)|open (?:roles|positions)|current (?:vacancies|opportunities)|vacancies|search jobs|查看岗位|招聘职位)$/i.test(link.label) && !/saved|login|register/i.test(u.href) } catch {return false}
        })
        if(entry) return listResult([], {next:{pageUrl:new URL(entry.href,r.url||source.url).href,entryVisited:true},complete:false})
      }
      if (!jobs.length)
        throw new SourceError(
          /(?:no open (?:positions|roles|jobs)|don.t have any open positions|暂无(?:在招)?岗位)/i.test(plainText(r.text))
            ? '招聘页明确表示当前没有开放岗位，暂时没有样本可供预检；不会据此下线已有岗位。'
            : $('script[src]').length && plainText(r.text).length<300
            ? '此页面只返回网页程序，岗位需在浏览器中动态加载；当前入口无法直接提取。请更换公开招聘列表，或跳过本家继续。'
            : '未找到可读取的岗位列表；请核对是否为企业介绍页、登录页或已更换招聘入口。可以修改链接重试，或跳过本家继续。',
          'partial'
        )
      return detailPage(jobs, source, cursor, {
        fetcher,
        signal,
        nextList,
        complete: cfg.completeList === true
      })
    }
  }
}
async function detailPage(
  jobs,
  source,
  cursor,
  { fetcher, signal, nextList = null, total, complete = true }
) {
  const all = cursor?.detailJobs || jobs,
    index = cursor?.detailIndex || 0
  if (cursor?.detailJobs) {
    nextList = cursor.nextList
    total = cursor.total
    complete = cursor.listComplete
  }
  const batch = all.slice(index, index + 5),
    result = []
  let failures = cursor?.detailFailures || 0
  for (const job of batch) {
    try {
      let detail
      if (source.adapter === 'workday') {
        const u = new URL(job.url),
          path = u.pathname.replace(
            `/${source.config.locale}/${source.config.site}`,
            ''
          )
        const d = requireJson(
          await fetcher(
            `${u.origin}/wday/cxs/${source.config.tenant}/${source.config.site}${path}`,
            { signal }
          )
        )
        if (!d.jobPostingInfo?.jobDescription)
          throw new SourceError('Workday 详情为空', 'partial')
        detail = { description: plainText(d.jobPostingInfo.jobDescription) }
      } else if (source.adapter === 'smartrecruiters') {
        const d = requireJson(
          await fetcher(
            `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(source.config.board)}/postings/${job.external_id}`,
            { signal }
          )
        )
        detail = {
          description: plainText(
            Object.values(d.jobAd?.sections || {})
              .map((s) => s.text)
              .join('\n')
          )
        }
      } else
        detail = await readDetail(job.url, {
          fetcher,
          signal,
          selector: source.config?.detailSelector
        })
      result.push(mapDescriptionFields({
        ...job,
        ...sourceFacts(detail),
        external_id: job.external_id,
        title: detail.title || job.title,
        url: job.url
      }))
    } catch (error) {
      if (signal?.aborted) throw error
      failures++
      result.push({ ...job, detail_error: error.message })
    }
  }
  const remaining = index + batch.length < all.length
  return listResult(result, {
    next: remaining
      ? {
          detailJobs: all,
          detailIndex: index + batch.length,
          nextList,
          total,
          listComplete: complete,
          detailFailures: failures
        }
      : nextList,
    total,
    complete: !remaining && !nextList && complete && failures === 0,
    reason: failures
      ? '部分详情读取失败'
      : !complete
        ? '未验证列表完整性'
        : null
  })
}
export async function verifyPosting(
  observation,
  { fetcher = fetchPublic, signal } = {}
) {
  const url = observation.payload?.url || observation.url
  if (!externalIdentity(url) && !observation.external_id)
    return { state: 'unknown', reason: '缺少稳定岗位身份' }
  try {
    // Public ATS detail APIs identify the exact posting even when the careers
    // website is a JavaScript shell or its human-readable slug has changed.
    const u=new URL(url), parts=u.pathname.split('/').filter(Boolean), postingId=externalIdentity(url)
    if(isJobsyn(url)) return await verifyJobsyn(url,{fetcher,signal})
    if(u.hostname==='jobs.deel.com' && postingId) {
      const boardUrl=`${u.origin}/${encodeURIComponent(parts[0])}`
      const response=await fetcher(boardUrl,{signal})
      if(response.status===200 && canonicalUrl(response.url||boardUrl)===canonicalUrl(boardUrl)) {
        const jobs=readDeelPostings(response.text,boardUrl)
        if(jobs?.some(j=>j.external_id===postingId)) return {state:'open',reason:'企业公开招聘页返回同一岗位 ID 的完整在招内容',url}
      }
      return {state:'unknown',reason:'未在企业公开列表中确认该岗位，不能仅凭列表缺失判定失效',url}
    }
    let endpoint
    if(/^jobs\.(eu\.)?lever\.co$/.test(u.hostname) && postingId) endpoint=`https://api.${u.hostname.includes('.eu.')?'eu.':''}lever.co/v0/postings/${encodeURIComponent(parts[0])}/${postingId}?mode=json`
    else if(/(^|\.)greenhouse\.io$/.test(u.hostname) && postingId && parts[0]!=='embed') endpoint=`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(parts[0])}/jobs/${encodeURIComponent(postingId)}`
    else if(u.hostname==='jobs.smartrecruiters.com' && postingId) endpoint=`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(parts[0])}/postings/${postingId}`
    if(endpoint) {
      try {
        const response=await fetcher(endpoint,{signal})
        if(canonicalUrl(response.url||endpoint)===canonicalUrl(endpoint)) {
          // Require an API response, not an intermediary's HTML error page.
          let data
          try { data=JSON.parse(response.text) } catch { data=null }
          if(data && [404,410].includes(response.status)) return {state:'closed',reason:`官方岗位接口确认该岗位已不可用（HTTP ${response.status}）`,url,checked_at:new Date().toISOString()}
          if(response.status===200 && data && String(data.id)===postingId && (data.text||data.title||data.name)) return {state:'open',reason:'官方岗位接口返回相同岗位 ID 的在招详情',url}
        }
      } catch(error) { if(signal?.aborted) throw error; if(error.status==='blocked') return {state:'unknown',reason:error.message,url} }
    }
    const r = await fetcher(url, { signal })
    if (canonicalUrl(r.url || url) !== canonicalUrl(url))
      return { state: 'unknown', reason: '岗位详情发生跳转，需要复核' }
    if ([404, 410].includes(r.status))
      return {
        state: 'closed',
        reason: `岗位详情 HTTP ${r.status}`,
        url,
        checked_at: new Date().toISOString()
      }
    if (r.status !== 200)
      return { state: 'unknown', reason: `HTTP ${r.status}` }
    pageBlocked(r)
    if (canonicalUrl(r.url || url) !== canonicalUrl(url))
      return { state: 'unknown', reason: '岗位详情发生跳转，需要复核' }
    const $ = cheerio.load(r.text)
    const heading=cleanText($('h1').first().text()).toLowerCase()
    $('script,style,nav,footer,header').remove()
    const visible = cleanText($('body').text())
    const identity = externalIdentity(url),
      jsonJobs = readJsonLd(r.text, url)
    const matchingJob = jsonJobs.some((j) =>
      identity
        ? externalIdentity(j.url) === identity
        : canonicalUrl(j.url) === canonicalUrl(url)
    )
    if (
      /this (?:job|position) (?:is no longer available|has been closed)|no longer accepting applications|该职位已关闭|该职位已下线/i.test(
        visible
      ) &&
      (visible.length < 6000 ||
        (observation.payload?.title &&
          visible
            .toLowerCase()
            .includes(observation.payload.title.toLowerCase())))
    )
      return matchingJob
        ? {
            state: 'unknown',
            reason: '同一页面同时存在当前岗位结构化数据和关闭文案，需人工核实',
            url
          }
        : {
            state: 'closed',
            reason: '岗位页面明确停止招聘',
            url,
            checked_at: new Date().toISOString()
          }
    if (
      jsonJobs.some((j) =>
        identity
          ? externalIdentity(j.url) === identity
          : canonicalUrl(j.url) === canonicalUrl(url)
      )
    )
      return { state: 'open', reason: '详情包含对应岗位结构化数据', url }
    const title=cleanText(observation.payload?.title || observation.title || '').toLowerCase()
    const description=(await readDetail(url,{fetcher:async()=>r,signal})).description || ''
    const apply=$('a[href],button,input[type="submit"]').toArray().some(el=>/apply(?: now| for| to| here|$)|申请职位|立即申请/i.test(cleanText($(el).text() || $(el).attr('value'))))
    if(title && heading===title && description.length>=200 && apply) return {state:'open',reason:'岗位专属页面的标题、正文和申请入口仍然存在',url}
    return { state: 'unknown', reason: '页面可访问，但尚不能证明岗位仍开放' }
  } catch (e) {
    return { state: 'unknown', reason: e.message }
  }
}
