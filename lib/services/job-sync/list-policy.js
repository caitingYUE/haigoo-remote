import { listingGeography } from './list-geography.js'
import { detectSource } from './adapters.js'
import { externalIdentity, hash } from './policy.js'

// Generic sites may use ref/source as the job identifier, not tracking.
export function canonicalListingUrl(raw) {
  try {
    const u=new URL(raw)
    if(!['https:','http:'].includes(u.protocol)) return ''
    u.hash=''
    for(const key of [...u.searchParams.keys()]) if(/^(utm_|gh_src$|trid$|rsid$)/i.test(key)) u.searchParams.delete(key)
    u.searchParams.sort()
    u.pathname=u.pathname.replace(/\/$/,'')||'/'
    return u.href
  } catch {return ''}
}

export function listingIdentity(raw) {
  const url=canonicalListingUrl(raw)
  if(!url) return ''
  const u=new URL(url), detected=detectSource(url), id=externalIdentity(url)
  if(id && ['greenhouse','lever','ashby','workable','smartrecruiters'].includes(detected.adapter)) return `${detected.adapter}${detected.config.eu?':eu':''}:${String(detected.config.board).toLowerCase()}:${detected.adapter==='workable'?id:id.toLowerCase()}`
  const yc=u.hostname==='www.ycombinator.com'&&u.pathname.match(/^\/companies\/([^/]+)\/jobs\/([A-Za-z0-9]{7})-[^/]+$/)
  if(yc)return `ycombinator:${yc[1]}:${yc[2]}`
  if(detected.adapter==='bamboohr' && /\/careers\/\d+/.test(u.pathname)) return `${u.hostname}:${u.pathname.match(/\/careers\/(\d+)/)[1]}`
  if(detected.adapter==='workday') {
    const req=u.pathname.match(/_([^/]+)\/?$/)?.[1]
    if(req) return `${u.hostname}:${detected.config.site}:${req}`
  }
  if(['cummins.jobs','pearson.jobs'].includes(u.hostname)) {
    const guid=u.pathname.match(/\/([a-f0-9]{32})\/job/i)?.[1]
    if(guid) return `${u.hostname}:${guid.toLowerCase()}`
  }
  return url
}
export function comparable(sourceUrl,jobUrl,scope) {
  try {
    const a=new URL(sourceUrl),b=new URL(jobUrl),sa=detectSource(sourceUrl),sb=detectSource(jobUrl)
    if(['greenhouse','lever','ashby','workable','smartrecruiters'].includes(sa.adapter)) return sa.adapter===sb.adapter&&!!sa.config.board&&sa.config.board.toLowerCase()===sb.config.board?.toLowerCase()&&!!sa.config.eu===!!sb.config.eu&&!!externalIdentity(jobUrl)
    if(a.hostname==='www.ycombinator.com' && a.hostname===b.hostname && /^\/companies\/[^/]+\/jobs\/?$/.test(a.pathname) && !a.search) return b.pathname.startsWith(a.pathname.replace(/\/$/,'')+'/')&&/^\/companies\/[^/]+\/jobs\/[A-Za-z0-9]{7}-[^/]+$/.test(b.pathname)
    if(a.hostname==='hackmamba.io'&&/^\/career\/?$/.test(a.pathname)&&!a.search) return b.hostname==='threepipes.hackmamba.io'&&/^\/apply\/positions\/[a-z0-9]+$/.test(b.pathname)
    if(sa.adapter==='bamboohr') return a.hostname===b.hostname&&/\/careers\/\d+/.test(b.pathname)
    if(sa.adapter==='workday') return a.hostname===b.hostname&&sa.config.site===sb.config.site&&/\/job\/.+_[^/]+/.test(b.pathname)
    if(['cummins.jobs','pearson.jobs'].includes(a.hostname)) return a.hostname===b.hostname&&/^\/jobs\/?$/.test(a.pathname)&&!a.search&&/\/[a-f0-9]{32}\/job/i.test(b.pathname)
    if(scope?.url===canonicalListingUrl(sourceUrl) && scope.prefix===a.pathname.replace(/\/$/,'')+'/' && a.origin===b.origin) return b.pathname.startsWith(scope.prefix)
    return false // Generic HTML has no verified completeness/scope contract.
  }catch{return false}
}
export function listingEligibility(job) {
  const text=`${job.title || ''} ${job.location || ''}`
  if(job.is_remote===false || /\b(on[ -]?site|hybrid)\b|\b(?:not|non)[ -]remote\b|现场办公|混合办公|不支持远程|非远程/i.test(text)) return 'excluded'
  const suffix=job.title?.match(/\(([^()]+)\)\s*$/)?.[1]
  const geography=listingGeography(job.location||'')
  if(geography==='outside' || (geography==='unknown' && suffix && listingGeography(suffix)==='outside')) return 'excluded'
  const remote=job.is_remote===true || /\b(remote|work from anywhere|work from home)\b|远程|居家办公/i.test(text)
  if(!remote) return 'unknown'
  if(/\b(?:US|USA|UK|EU|Canada|Europe|Australia)[ -]only\b|\b(exclud\w*|except|not eligible|not available).{0,40}\b(China|APAC)\b/i.test(text)) return 'excluded'
  if(/\b(only|must|restricted|citizen|residen\w*|work authori\w*|work permit)\b|仅限|工作许可|国籍|常住/i.test(text)) return 'unknown'
  return geography==='target'?'eligible':'unknown'
}
export const activeJob = j => j.status==='active' && j.is_approved===true && !j.crawl_deleted_at
const keyOf=(kind,identity)=>`${kind}:${hash(identity)}`
export function compareListing(source,result,existing,previous={}) {
  // Upgrade old reminder keys in memory, retaining acknowledgements only for
  // the same listing. A manually changed job URL represents a new event.
  const upgraded=new Map((previous.findings||[]).map(f=>[f.key,keyOf(f.kind,f.kind==='missing'?`${f.jobId}:${listingIdentity(f.url)}`:listingIdentity(f.url))]))
  previous={...previous,findings:(previous.findings||[]).map(f=>({...f,key:upgraded.get(f.key)})),dismissed:(previous.dismissed||[]).map(key=>upgraded.get(key)||key)}
  const known=new Set(existing.map(j=>listingIdentity(j.url)).filter(Boolean)), listed=new Set(result.jobs.map(j=>listingIdentity(j.url)))
  const reasons=[],findings=new Map(), dismissed=new Set(previous.dismissed||[]), at=new Date().toISOString()
  if(!result.complete) reasons.push(result.reason || '列表不完整')
  const candidates=[]
  for(const job of result.jobs) {
    const identity=listingIdentity(job.url)
    if(!identity||known.has(identity)) continue
    const eligibility=listingEligibility(job)
    if(eligibility==='unknown') candidates.push({title:job.title,url:job.url,location:job.location,reason:'列表未明确提供适用地区或远程方式'})
    if(eligibility==='eligible') {
      const key=keyOf('new',identity)
      findings.set(key,{key,kind:'new',title:job.title,url:job.url,location:job.location,detectedAt:at,reason:'列表明确远程且覆盖目标地区，Haigoo 尚未录入'})
    }
  }
  if(candidates.length) reasons.push(`${candidates.length} 个未录入岗位缺少明确地区或远程信息`)
  let unmatched=0
  for(const job of existing.filter(activeJob)) {
    const identity=listingIdentity(job.url)
    if(identity&&listed.has(identity)) continue
    if(!identity||!comparable(source.url,job.url,result.scope)) {unmatched++;continue}
    if(result.complete) {
      const key=keyOf('missing',`${job.job_id}:${identity}`)
      findings.set(key,{key,kind:'missing',jobId:job.job_id,title:job.title,url:job.url,detectedAt:at,reason:'完整招聘列表中未找到此岗位，请人工确认'})
    }
  }
  if(unmatched) reasons.push(`${unmatched} 个在招岗位无法与当前招聘来源匹配`)
  // Inconclusive checks retain prior unresolved alerts, but presence/recording
  // can resolve an alert even when the remaining pages failed.
  for(const old of previous.findings||[]) {
    const identity=listingIdentity(old.url), job=existing.find(j=>j.job_id===old.jobId)
    if(old.kind==='new' && (known.has(identity)||(result.disputedUrls||[]).some(url=>listingIdentity(url)===identity))) continue
    if(old.kind==='missing' && (!job||!activeJob(job)||listingIdentity(job.url)!==identity||listed.has(identity))) continue
    if(findings.has(old.key)) findings.get(old.key).detectedAt=old.detectedAt
    else if(!result.complete || (old.kind==='new' && result.jobs.some(j=>listingIdentity(j.url)===identity && listingEligibility(j)==='unknown')) || (old.kind==='missing' && !comparable(source.url,old.url,result.scope))) findings.set(old.key,old)
  }
  for(const key of dismissed) {
    const old=(previous.findings||[]).find(f=>f.key===key)
    if(old && ((old.kind==='new'&&(known.has(listingIdentity(old.url))||(result.complete&&!listed.has(listingIdentity(old.url))))) || (old.kind==='missing'&&listed.has(listingIdentity(old.url))))) dismissed.delete(key)
  }
  for(const key of dismissed) if(!findings.has(key)) dismissed.delete(key)
  return {findings:[...findings.values()],dismissed:[...dismissed],unknown:reasons.length>0,reasons,candidates:candidates.slice(0,100),candidateCount:candidates.length}
}
export function visibleFindings(state,existing) {
  const known=new Set(existing.map(j=>listingIdentity(j.url)))
  return (state.findings||[]).filter(f=>!state.dismissed?.includes(f.key) && (f.kind==='new'?!known.has(listingIdentity(f.url)):existing.some(j=>j.job_id===f.jobId&&activeJob(j)&&listingIdentity(j.url)===listingIdentity(f.url))))
}
