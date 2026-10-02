import { requireJson, SourceError } from './http.js'
import { canonicalUrl } from './policy.js'

// Public APIs referenced by the official careers clients. Keep employer IDs and
// origin scoped: this shared search service also contains unrelated employers.
const SITES = {
  'cummins.jobs': { employers: [13404], filters: { locations:'location', 'work-type':'jobtype', 'job-titles':'title', 'career-path':'careerpath', 'recruitment-job-type':'recruitmentjobtype' } },
  'pearson.jobs': { employers: [53296,43695], filters: { locations:'location', 'workplace-type':'workplacetype', category:'category', organization:'organization', schedule:'schedule' } }
}
export const isJobsyn = url => !!SITES[new URL(url).hostname]
export async function verifyJobsyn(url, { fetcher, signal }) {
  const u=new URL(url),site=SITES[u.hostname],guid=u.pathname.match(/\/([a-f0-9]{32})\/job\/?$/i)?.[1]?.toUpperCase()
  if(!site || !guid) return {state:'unknown',reason:'缺少可确认的官方岗位 ID',url}
  const endpoint=`https://microsites.dejobs.org/${u.hostname.split('.')[0]}-jobs/data/${guid}.json`
  const r=await fetcher(endpoint,{signal})
  if(r.status!==200 || canonicalUrl(r.url||endpoint)!==canonicalUrl(endpoint))
    return {state:'unknown',reason:`官方岗位详情暂不可确认（HTTP ${r.status}），不能据此判定失效`,url}
  const j=requireJson(r)
  if(j.guid!==guid || !site.employers.includes(j.buid)) return {state:'unknown',reason:'官方详情的岗位身份或企业归属不一致',url}
  if(Object.hasOwn(j,'deleted_at')) return j.deleted_at && Number.isFinite(Date.parse(j.deleted_at))
    ? {state:'closed',reason:'官方岗位详情明确标记已撤下',url,checked_at:new Date().toISOString()}
    : {state:'unknown',reason:'官方岗位撤下标记不完整，需要人工核实',url}
  return j.title_exact && j.description?.length>=50
    ? {state:'open',reason:'官方详情返回同一企业、同一岗位 ID 的完整在招内容',url}
    : {state:'unknown',reason:'官方岗位详情不完整，需要人工核实',url}
}
export async function scanJobsyn(source, cursor, { fetcher, signal, listOnly = false }) {
  const u = new URL(source.url), site = SITES[u.hostname]
  if (!site) throw new SourceError('不支持此招聘站点', 'partial')
  const parts = u.pathname.split('/').filter(Boolean), params = new URLSearchParams()
  if (parts.pop() !== 'jobs' || parts.length % 2 || u.search)
    throw new SourceError('招聘链接包含尚未支持的筛选条件，请使用官网招聘列表路径', 'partial')
  for (let i=0;i<parts.length;i+=2) {
    const field=site.filters[parts[i]]
    if (!field) throw new SourceError('招聘链接包含尚未支持的筛选条件', 'partial')
    params.set(field, decodeURIComponent(parts[i+1]))
  }
  const offset = cursor?.jobsynOffset ?? 0
  if (!Number.isInteger(offset) || offset < 0) throw new SourceError('招聘分页位置无效', 'partial')
  params.set('num_items', '20'); params.set('offset', String(offset))
  const data = requireJson(await fetcher(`https://prod-search-api.jobsyn.org/api/v1/solr/search?${params}`, {
    signal, headers: { 'X-Origin':u.hostname, Accept:'application/json' }
  }))
  const page = data.pagination
  if (!Array.isArray(data.jobs) || !Number.isInteger(page?.total) || page.total<0 || !/^\d+$/.test(String(page.offset)) || Number(page.offset)!==offset ||
    typeof page.has_more_pages!=='boolean' || !data.meta?.canonical ||
    canonicalUrl(new URL(data.meta.canonical,u).href)!==canonicalUrl(u.href))
    throw new SourceError('招聘接口返回的筛选范围或分页信息不一致', 'partial')
  const jobs = data.jobs.map(j => {
    if (!site.employers.includes(j.buid) || !/^[a-f0-9]{32}$/i.test(j.guid) || !j.title_slug ||
      !j.location_exact || !j.title_exact || (!listOnly && (typeof j.description!=='string' || j.description.length<50)))
      throw new SourceError('招聘接口岗位的企业归属、身份或正文不完整', 'partial')
    const city = j.location_exact.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'')
    let extra={};try { extra=JSON.parse(j.other || '{}') } catch { /* Optional metadata. */ }
    return {
      external_id:j.guid, title:j.title_exact, ...(listOnly ? {} : {description:j.description}),
      url:new URL(`/${city}/${j.title_slug}/${j.guid}/job/`,u.origin).href,
      location:listOnly ? j.location_exact.replace(/\bCHN\b/g,'China') : j.location_exact, published_at:j.date_new,
      job_type: j.job_shift==='FULL_TIME'?'Full-time':j.job_shift==='PART_TIME'?'Part-time':undefined,
      is_remote:extra.WorkPlaceTypeCode==='Remote'||j.job_shift==='Off-site Remote'||(listOnly && (params.get('workplacetype')==='remote'||params.get('jobtype')==='off-site-remote'))?true:undefined
    }
  })
  const end = offset + jobs.length
  if (end>page.total || (page.has_more_pages && (!jobs.length || end>=page.total)) || (!page.has_more_pages && end!==page.total))
    throw new SourceError('招聘接口返回不完整分页，不能确认列表范围', 'partial')
  return {jobs, total:page.total, next:page.has_more_pages?{jobsynOffset:end}:null, complete:!page.has_more_pages}
}
