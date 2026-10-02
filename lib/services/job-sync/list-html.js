import {SourceError} from './http.js'
import {cleanText} from './policy.js'
import {canonicalListingUrl} from './list-policy.js'

export function readYcList($,base) {
  const u=new URL(base),match=u.pathname.match(/^\/companies\/([^/]+)\/jobs\/?$/)
  if(u.hostname!=='www.ycombinator.com'||!match||u.search)return null
  const raw=$('[data-page]').attr('data-page')
  if(!raw)return null
  let page;try{page=JSON.parse(raw)}catch{return null}
  const p=page.props, prefix=`/companies/${match[1]}/jobs/`
  if(page.component!=='WaasShowJobsPage'||p?.company?.slug!==match[1]||!Array.isArray(p.jobPostings))throw new SourceError('招聘列表的企业身份或结构不一致','partial')
  const jobs=p.jobPostings.map(j=>{
    const url=new URL(j.url,base)
    if(url.origin!==u.origin||!url.pathname.startsWith(prefix)||j.companyUrl!==`/companies/${match[1]}`||!j.id||!j.title||j.isIncomplete!==false)throw new SourceError('招聘列表中存在不完整或其他企业的岗位','partial')
    return {external_id:String(j.id),title:cleanText(j.title),url:url.href,location:cleanText(j.location)}
  })
  const rendered=new Set($('a[href]').map((_,e)=>{try{const v=new URL($(e).attr('href'),base);return v.origin===u.origin&&v.pathname.startsWith(prefix)&&v.pathname.length>prefix.length?canonicalListingUrl(v.href):null}catch{return null}}).get().filter(Boolean))
  const complete=jobs.length>0&&rendered.size===jobs.length&&jobs.every(j=>rendered.has(canonicalListingUrl(j.url)))&&!$('a[rel=next]').length&&!p.nextPage&&!p.pagination
  return {jobs,total:jobs.length,complete,reason:complete?'':'招聘页面的岗位清单与展示数量尚无法完整核对'}
}

export function cardMetadata($,el,base) {
  const url=new URL($(el).attr('href'),base).href
  // Bounded ascent accommodates simple div cards. Never read the whole page.
  let card=$(el).parent()
  for(let depth=0;depth<3&&card.length;depth++,card=card.parent()) {
    if(/^(body|html|main)$/i.test(card[0].name))break
    const links=card.find('a[href]').map((_,a)=>{try{return new URL($(a).attr('href'),base).href}catch{return ''}}).get()
    if(links.some(link=>link!==url))break
    const copy=card.clone();copy.find('a,script,style').remove();copy.find('*').append(' ');const text=cleanText(copy.text())
    if(text&&text.length<=300)return text
  }
  return ''
}

export function readHackmambaList($,base) {
  const u=new URL(base)
  if(u.hostname!=='hackmamba.io'||!/^\/career\/?$/.test(u.pathname)||u.search)return null
  let rows
  $('astro-island[props]').each((_,el)=>{try{const p=JSON.parse($(el).attr('props'));if(p.initialJobs?.[0]===1)rows=p.initialJobs[1]}catch{/* Unrelated component. */}})
  if(!Array.isArray(rows))return null
  const count=$('h1,h2,h3').text().match(/Open\s+Positions\s*\(\s*(\d+)\s*\)/i)
  const jobs=rows.map(row=>{
    const j=row?.[0]===0?row[1]:null,link=j?.link?.[1],title=j?.title?.[1],location=j?.location?.[1],slug=j?.slug?.[1]?.current?.[1]
    const url=new URL(link)
    if(url.origin!=='https://threepipes.hackmamba.io'||!/^\/apply\/positions\/[a-z0-9]+$/.test(url.pathname)||!title||!slug||typeof location!=='string'||!$('a[href]').toArray().some(el=>$(el).attr('href')===link))throw new SourceError('招聘卡片和结构化列表身份不一致','partial')
    return {external_id:url.pathname.split('/').pop(),title:cleanText(title),url:url.href,location:cleanText(location)}
  })
  const complete=!!count&&Number(count[1])===jobs.length&&!$('a[rel=next]').length
  return {jobs,total:jobs.length,complete,reason:complete?'':'招聘页面声明数量与岗位清单不一致'}
}
