// List metadata only. No detail requests, description mapping or translations.
import * as cheerio from 'cheerio'
import { detectSource } from './adapters.js'
import { fetchPublic, requireJson, SourceError, validatePublicUrl } from './http.js'
import { cleanText, externalIdentity } from './policy.js'
import { canonicalListingUrl as canonicalUrl } from './list-policy.js'
import { readYcList, readHackmambaList, cardMetadata } from './list-html.js'
import { countryName } from './list-geography.js'
import { isJobsyn, scanJobsyn } from './jobsyn.js'
import { readDeelPostings } from './embedded-postings.js'

export const isLinkedIn = raw => { try { return /(^|\.)linkedin\.com$/i.test(new URL(raw).hostname) } catch { return false } }
const loc = x => {
  if(typeof x === 'string') return x
  const countryValue=x?.countryCode||x?.country||x?.addressCountry||x?.postalAddress?.addressCountry||x?.address?.postalAddress?.addressCountry
  const country=typeof countryValue === 'string' ? (countryName(countryValue)||countryValue) : countryValue?.name
  return [x?.name,x?.city||x?.addressLocality,x?.region||x?.addressRegion,country].filter(Boolean).join(', ')
}
const listingText = value => cleanText(value).replace(/%[^%]*REMOTE[^%]*%/gi,' Remote ').replace(/%[^%]+%/g,' ')
const role = (id,title,url,location,is_remote) => ({external_id:String(id || externalIdentity(url) || canonicalUrl(url)),title:listingText(title),url:canonicalUrl(url),location:listingText(location),...(typeof is_remote==='boolean'?{is_remote}:{})})

async function page(source,cursor,{fetcher,signal}) {
  const u=validatePublicUrl(source.url), cfg=source.config || {}, board=encodeURIComponent(cfg.board || ''), offset=cursor?.offset || 0
  const json=async (url,options={}) => requireJson(await fetcher(url,{signal,...options}))
  const result=(jobs,total,next=null,complete=!next) => ({jobs,total,next,complete})
  switch(source.adapter) {
    case 'greenhouse': {
      const d=await json(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=false`)
      if(!Array.isArray(d.jobs)||d.meta?.total!==d.jobs.length) throw new SourceError('招聘列表数量不完整','partial')
      return result(d.jobs.map(j=>role(j.id,j.title,j.absolute_url,loc(j.location))),d.meta.total)
    }
    case 'lever': {
      const d=await json(`https://api.${cfg.eu?'eu.':''}lever.co/v0/postings/${board}?mode=json&limit=100&skip=${offset}`)
      if(!Array.isArray(d)) throw new SourceError('招聘列表格式变化','partial')
      return result(d.map(j=>role(j.id,j.text,j.hostedUrl,[...new Set([j.categories?.location,...(j.categories?.allLocations||[])])].filter(Boolean).map((value,i)=>i===0&&countryName(j.country)?`${value} (${countryName(j.country)})`:value).join('; '),['remote','onsite','hybrid'].includes(j.workplaceType)?j.workplaceType==='remote':undefined)),undefined,d.length===100?{offset:offset+100}:null)
    }
    case 'ashby': {
      const d=await json(`https://api.ashbyhq.com/posting-api/job-board/${board}`)
      if(!Array.isArray(d.jobs)) throw new SourceError('招聘列表格式变化','partial')
      const jobs=d.jobs.filter(j=>j.isListed!==false).map(j=>role(externalIdentity(j.jobUrl),j.title,j.jobUrl,[j.location,...(j.secondaryLocations||[]).map(l=>[l.location,loc(l.address)].filter(Boolean).join(', ')),loc(j.address)].filter(Boolean).join('; '),j.isRemote))
      return result(jobs,jobs.length)
    }
    case 'workable': {
      const d=await json(`https://www.workable.com/api/accounts/${board}?details=false`)
      if(!Array.isArray(d.jobs)) throw new SourceError('招聘列表格式变化','partial')
      const jobs=new Map()
      for(const j of d.jobs) {
        const r=role(j.shortcode||j.id,j.title,j.url||j.shortlink,j.locations?.map(loc).join('; ')||loc(j.location)||loc({city:j.city,region:j.state,country:j.country}),j.telecommuting??j.location?.telecommuting)
        const prior=jobs.get(r.external_id)
        if(prior && (prior.url!==r.url || prior.title!==r.title || prior.is_remote!==r.is_remote)) throw new SourceError('同一岗位返回冲突身份','partial')
        if(prior) r.location=[...new Set([prior.location,r.location])].filter(Boolean).join('; ')
        jobs.set(r.external_id,r)
      }
      return result([...jobs.values()],jobs.size)
    }
    case 'smartrecruiters': {
      const d=await json(`https://api.smartrecruiters.com/v1/companies/${board}/postings?limit=100&offset=${offset}`)
      if(!Array.isArray(d.content)||!Number.isInteger(d.totalFound)) throw new SourceError('招聘列表格式变化','partial')
      return result(d.content.map(j=>role(j.id,j.name,`https://jobs.smartrecruiters.com/${cfg.board}/${j.id}`,loc(j.location),j.location?.remote)),d.totalFound,offset+d.content.length<d.totalFound?{offset:offset+d.content.length}:null)
    }
    case 'bamboohr': {
      const d=await json(`${u.origin}/careers/list`)
      if(!Array.isArray(d.result)) throw new SourceError('招聘列表格式变化','partial')
      return result(d.result.map(j=>role(j.id,j.jobOpeningName,`${u.origin}/careers/${j.id}`,[loc(j.location),loc(j.atsLocation)].filter(Boolean).join('; '),typeof j.isRemote==='boolean'?j.isRemote:undefined)),d.result.length)
    }
    case 'workday': {
      const d=await json(`${u.origin}/wday/cxs/${encodeURIComponent(cfg.tenant)}/${encodeURIComponent(cfg.site)}/jobs`,{method:'POST',headers:{'Content-Type':'application/json'},body:{appliedFacets:{},limit:20,offset,searchText:''}})
      if(!Array.isArray(d.jobPostings)||!Number.isInteger(d.total)) throw new SourceError('招聘列表格式变化','partial')
      return result(d.jobPostings.map(j=>role(j.bulletFields?.[0]||j.externalPath,j.title,`${u.origin}/${cfg.locale}/${cfg.site}${j.externalPath}`,j.locationsText)),d.total,offset+d.jobPostings.length<d.total?{offset:offset+d.jobPostings.length}:null)
    }
    default: {
      if(isJobsyn(source.url)) return scanJobsyn(source,cursor,{fetcher,signal,listOnly:true})
      if(u.hostname==='app.usebraintrust.com') throw new SourceError('该入口包含多个雇主，无法确认本企业的岗位范围','partial')
      const r=await fetcher(cursor?.pageUrl||source.url,{signal})
      if(r.status!==200) throw new SourceError(`招聘网站返回 HTTP ${r.status}`,'partial')
      const base=r.url||source.url
      if(new URL(base).origin!==u.origin) throw new SourceError('招聘页已跳转到其他站点，请更新招聘链接','partial')
      const embedded=readDeelPostings(r.text,base,{listOnly:true})
      if(embedded) return {...result(embedded.map(j=>role(j.external_id,j.title,j.url,j.location,j.is_remote)),undefined,null,false),reason:'已读取列表，但网站未提供可验证的完整数量'}
      // Pinpoint provides JSON at its public career-list URL.
      if(r.text.trimStart().startsWith('{')) {
        let data;try { data=JSON.parse(r.text) } catch { /* HTML diagnostics below. */ }
        if(Array.isArray(data?.data)) return {...result(data.data.map(j=>role(j.id,j.title,j.url,loc(j.location),j.workplace_type?j.workplace_type==='remote':undefined)),undefined,null,false),reason:'招聘网站未提供可验证的完整列表'}
      }
      const $=cheerio.load(r.text), jobs=new Map()
      const isBreezy=/\.breezy\.hr$/i.test(u.hostname)
      const isApplyToJob=/\.applytojob\.com$/i.test(u.hostname)
      const isJobPath=pathname=>isBreezy?/^\/p\/[^/]+$/i.test(pathname):isApplyToJob?/^\/apply\/[^/]+(?:\/[^/]+)?$/i.test(pathname):/\/(?:jobs?|careers?|positions|vacancies|postings|o)\/[^/]+/i.test(pathname)
      const hackmamba=readHackmambaList($,base)
      if(hackmamba)return {...hackmamba,next:null}
      const yc=readYcList($,base)
      if(yc)return {...yc,next:null}
      // Follow an explicit same-site vacancy index, not arbitrary detail links.
      if(!cursor && u.hostname==='careers.abagri.com') {
        const href=$('a[href]').filter((_,el)=>$(el).text().trim()==='Vacancies').first().attr('href')
        if(href) {const next=new URL(href,base);if(next.origin===u.origin&&canonicalUrl(next.href)!==canonicalUrl(base))return {...result([],undefined,{pageUrl:next.href},false),entry:true}}
      }
      $('script[type="application/ld+json"]').each((_,el)=>{
        let data;try{data=JSON.parse($(el).text())}catch{return}
        const visit=(v,depth=0)=>{
          if(!v||typeof v!=='object'||depth>12) return
          if(Array.isArray(v)) {v.forEach(x=>visit(x,depth+1));return}
          if([v['@type']].flat().includes('JobPosting') && v.url && v.title) {
            const url=new URL(v.url,base).href
            const places=[v.applicantLocationRequirements||[]].flat().map(loc)
            const r=role(v.identifier?.value,v.title,url,places.concat([v.jobLocation||[]].flat().map(x=>loc(x.address))).filter(Boolean).join('; '),v.jobLocationType==='TELECOMMUTE'?true:undefined)
            jobs.set(r.url,r)
          }
          for(const [k,x] of Object.entries(v)) if(k!=='description') visit(x,depth+1)
        };visit(data)
      })
      $('script,style,nav,footer,header').remove()
      const emptyMessage=$('.w-dyn-empty').filter((_,el)=>/don.t have any open positions|no open (?:positions|roles|jobs)/i.test($(el).text()) && !$(el).parents().addBack().is('[hidden],[aria-hidden=true],.w-condition-invisible,[style*="display:none"],[style*="display: none"]') && !$(el).parent().find('.w-dyn-item').length)
      const disputedUrls=emptyMessage.length?[...jobs.keys()].filter(url=>!$('a[href]').toArray().some(el=>{try{return canonicalUrl(new URL($(el).attr('href'),base).href)===url}catch{return false}})):[]
      for(const url of disputedUrls)jobs.delete(url)
      $(cfg.linkSelector||'a[href]').each((_,el)=>{
        let url;try{url=new URL($(el).attr('href'),base)}catch{return}
        if(url.origin!==u.origin||!/^https?:$/.test(url.protocol)||canonicalUrl(url.href)===canonicalUrl(base)||/\/(?:vacancy-apply|login|register|search|show_more)(?:\/|$)/i.test(url.pathname)) return
        if(!cfg.linkSelector&&!isJobPath(url.pathname)) return
        const titleNode=$(el).find('h1,h2,h3,[title]').first()
        const title=cleanText(titleNode.attr('title')||titleNode.text()||$(el).text())
        if(!title || /^(?:apply|learn more|read more|view all|more info|privacy|cookie)/i.test(title)) return
        // Read only an unambiguous single-role card, never the entire page.
        const card=$(el).closest('li,article,[data-job-id],.job-card,.job-listing')
        const eployLocation=$(el).closest('.vsr-job-big').find('[data-id=div_content_VacV_AllLocations]').clone();eployLocation.find('script,style').remove()
        let location=''
        if(eployLocation.length) location=cleanText(eployLocation.text())
        else {
          const inline=$(el).find('.location').first().length?$(el).find('.location').first().clone():$(el).clone()
          inline.find('h1,h2,h3,[title]').first().remove();inline.find('.type,.department').remove()
          const inlineLocation=cleanText(inline.text())
          if(inlineLocation && inlineLocation!==title) location=inlineLocation.slice(0,700)
        }
        if(!location && card.length && card.find('a[href]').filter((_,a)=>{try{return isJobPath(new URL($(a).attr('href'),base).pathname)}catch{return false}}).length===1) {
          const copy=card.clone(),link=copy.find('a').first();link.remove();location=cleanText(copy.text()).slice(0,700)
        } else if(!location) location=cardMetadata($,el,base)
        const key=canonicalUrl(url.href)
        if(!jobs.has(key)) jobs.set(key,role(null,title,key,location))
      })
      const nextHref=$(cfg.nextSelector||'a[rel="next"]').first().attr('href') || $('a[href]').filter((_,el)=>/show\s+\d+\s+more/i.test($(el).text())).first().attr('href')
      const next=nextHref?{pageUrl:new URL(nextHref,base).href}:null
      if(next && new URL(next.pageUrl).origin!==u.origin) throw new SourceError('分页跨站，无法确认招聘范围','partial')
      const countText=$('h1,h2,h3').map((_,el)=>$(el).text()).get().join(' ')
      const declared=countText.match(/Open\s+(?:Positions|Roles|Jobs)\s*\(\s*(\d+)\s*\)/i) || countText.match(/\b(\d+)\s+(?:jobs?|positions?|roles?)\b/i)
      const prefix=u.pathname.replace(/\/$/,'')+'/'
      const complete=(!!declared && Number(declared[1])===jobs.size && jobs.size>0 && !next && [...jobs.values()].every(j=>new URL(j.url).origin===u.origin&&new URL(j.url).pathname.startsWith(prefix))) || ((isBreezy||isApplyToJob)&&jobs.size>0&&!next)
      return {...result([...jobs.values()],declared?Number(declared[1]):undefined,next,complete),scope:complete?{url:canonicalUrl(source.url),prefix}:undefined,disputedUrls,reason:disputedUrls.length?'页面显示暂无职位，但内嵌数据仍含历史岗位；已排除矛盾的新增提示':complete?'':jobs.size?'已读取岗位链接，但网站未提供可验证的完整列表':'未读取到可确认的招聘列表（可能需要登录或动态加载）'}
    }
  }
}

export async function scanListing(source,{fetcher=fetchPublic,signal,maxPages=20}={}) {
  if(!source.url) return {jobs:[],complete:false,reason:'未设置企业招聘网址',pages:0}
  let detected
  try { detected=detectSource(source.url) } catch { return {jobs:[],complete:false,reason:'招聘网址无效，请修改后重新检查',pages:0} }
  source={...source,adapter:detected.adapter==='manual'?'html':detected.adapter,config:{...detected.config,...source.config}}
  const jobs=new Map(),cursors=new Set(),disputedUrls=new Set();let cursor=null,pages=0,total
  const originalFetch=fetcher
  fetcher=async(url,options)=>{
    try {const response=await originalFetch(url,options);if(![502,503,504].includes(response.status))return response}
    catch(error){if(signal?.aborted||!(error instanceof SourceError)||!/HTTP (502|503|504)/.test(error.message))throw error}
    // One retry in this manually started run, with the same deadline. No retry of access denials.
    return originalFetch(url,options)
  }
  try {
    for(;pages<maxPages;) {
      if(signal?.aborted) throw new SourceError('检查达到时间上限，未读完整列表','partial')
      const key=JSON.stringify(cursor)
      if(cursors.has(key)) throw new SourceError('分页重复，无法确认完整列表','partial')
      cursors.add(key)
      const r=await page(source,cursor,{fetcher,signal});pages++
      if(r.total!==undefined) {if(total!==undefined&&total!==r.total) throw new SourceError('检查期间列表总数发生变化','partial');total=r.total}
      const before=jobs.size
      for(const j of r.jobs) {
        validatePublicUrl(j.url)
        if(!j.title||!j.external_id) throw new SourceError('招聘列表缺少岗位身份','partial')
        if(jobs.has(j.url)) throw new SourceError('分页包含重复岗位，列表可能变化','partial')
        jobs.set(j.url,role(j.external_id,j.title,j.url,j.location,j.is_remote))
      }
      for(const url of r.disputedUrls||[])disputedUrls.add(url)
      if(r.next&&!r.entry&&before===jobs.size) throw new SourceError('分页未返回新岗位','partial')
      if(!r.next) {
        if(total!==undefined&&total!==jobs.size) throw new SourceError('岗位数量与列表总数不一致','partial')
        const safeCountFallback=total!==undefined&&total===jobs.size&&!/不一致|矛盾|重复/i.test(r.reason||'')
        return {jobs:[...jobs.values()],complete:r.complete===true || safeCountFallback,reason:r.reason||'',pages,scope:r.scope,disputedUrls:[...disputedUrls]}
      }
      cursor=r.next
    }
    throw new SourceError('分页超过本次读取上限，未读完整列表','partial')
  } catch(error) {
    return {jobs:[...jobs.values()],complete:false,disputedUrls:[...disputedUrls],reason:signal?.aborted?'检查超时，未读完整列表':(error instanceof SourceError?error.message:'招聘网站暂时无法读取'),pages}
  }
}
