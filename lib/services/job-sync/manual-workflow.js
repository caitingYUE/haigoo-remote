import * as cheerio from 'cheerio'
import { randomUUID } from 'node:crypto'
import { db } from './store.js'
import { scanPage, verifyPosting, detectSource } from './adapters.js'
import { postingIdentity } from './url-checks.js'
import { fetchPublic, validatePublicUrl } from './http.js'
import { canonicalUrl, hash, sourceFacts, eligibility, plainText } from './policy.js'

const FIELDS = ['title','description','url','location','salary','job_type','experience_level','is_remote','region','timezone','requirements','benefits','category','tags']
const terminal = new Set(['approved','rejected','skipped','complete'])
const editable = (row) => Object.fromEntries(FIELDS.filter(k => row[k] !== undefined && row[k] !== null).map(k => [k,row[k]]))
const json = JSON.stringify
const now = () => new Date().toISOString()
const validIds = value => [...new Set((Array.isArray(value) ? value : String(value || '').split(',')).map(String).filter(Boolean))].slice(0,100)
const fail = message => { throw new Error(message) }
function evidenceText(body) {
  try {
    const data=JSON.parse(body), paragraphs=[]
    const visit=value=>{
      if(!value || typeof value!=='object' || paragraphs.length>=100) return
      for(const [key,child] of Object.entries(value)) {
        if(typeof child==='string' && /^(title|name|text|description|descriptionHtml|content|key_responsibilities|skills_knowledge_expertise|benefits)$/i.test(key)) paragraphs.push(plainText(child))
        else if(child && typeof child==='object') visit(child)
      }
    }
    visit(data)
    return paragraphs.filter(Boolean).join('\n\n').slice(0,24000)
  } catch { return plainText(body).slice(0,24000) }
}
const evidenceView = raw => raw && ({...raw,...(raw.requests ? {requests:raw.requests.slice(-10).map(r=>({...r,text:r.text ?? evidenceText(r.body || '')})),omittedRequests:Math.max(0,raw.requests.length-10)} : {})})
const itemView = i => ({id:i.id,sessionId:i.session_id,companyId:i.company_id,companyName:i.company_name,kind:i.status==='pending'?'update':i.kind,status:i.status,raw:evidenceView(i.raw),draft:i.draft,before:i.before_payload,reason:i.reason,jobId:i.job_id,version:i.version})

export function validateManualPatch(input = {}) {
  if (!input || Array.isArray(input) || typeof input !== 'object') fail('审核内容必须为字段对象')
  const patch = {}
  for (const [key,value] of Object.entries(input)) {
    if (!FIELDS.includes(key)) fail(`不可修改字段：${key}`)
    if (['tags','requirements','benefits'].includes(key)) {
      if (!Array.isArray(value) || value.some(x => typeof x !== 'string') || value.length>100) fail(`${key} 必须为文本列表`)
    } else if (key==='is_remote') {
      if (typeof value!=='boolean' && value!==null) fail('is_remote 必须为布尔值')
    } else if (typeof value!=='string' && value!==null) fail(`${key} 必须为文本`)
    if (typeof value==='string' && value.length>100000) fail('岗位内容过长')
    patch[key]=key==='description' ? plainText(value) : value
  }
  if (patch.url) { validatePublicUrl(patch.url); patch.url=canonicalUrl(patch.url) }
  return patch
}

async function refreshPublication(companyId) {
  const { reconcileCompanyDirectoryHistory, rebuildCompanyHiringProfile } = await import('../mini-company-match-service.js')
  await reconcileCompanyDirectoryHistory(companyId,{rebuild:false})
  await rebuildCompanyHiringProfile(companyId)
}

export function createManualWorkflow({query=db,fetcher=fetchPublic,scan=scanPage,verify=verifyPosting,publish=refreshPublication}={}) {
  const q=query
  const row=async id => {
    const [s]=await q('SELECT * FROM job_crawl_sessions WHERE id=$1',[id])
    if (!s) fail('操作记录不存在')
    return s
  }
  async function sourceFor(company) {
    const url=String(company.careers_page || '').trim()
    let detected
    try { detected=detectSource(url) } catch { detected={adapter:'manual',config:{},capabilities:{}} }
    // Exact URL only: a former source record must never override the current company URL.
    const configs=url ? await q(`SELECT s.* FROM job_sync_sources s JOIN job_sync_source_companies m ON m.source_id=s.id WHERE m.company_id=$1 AND s.url=$2 ORDER BY s.revision DESC LIMIT 1`,[company.company_id,url]) : []
    const existing=configs[0]
    const source={url,adapter:existing?.adapter || detected.adapter,config:existing?.config || detected.config,capabilities:existing?.capabilities || detected.capabilities}
    return {...source,sourceId:existing?.id || null,sourceRevision:existing?.revision || 0,version:hash([url,source.adapter,source.config,source.capabilities,existing?.revision || 0])}
  }
  async function currentCompany(id) {
    const [co]=await q("SELECT * FROM trusted_companies WHERE company_id=$1 AND status='active'",[id])
    if (!co) fail('企业不存在或已停用')
    return co
  }
  async function qualification(co,source) {
    const [r]=await q('SELECT * FROM job_crawl_qualifications WHERE company_id=$1',[co.company_id])
    return r && r.url===source.url && r.source_version===source.version
      ? {status:r.status,url:r.url,reason:r.reason}
      : {status:'unreviewed',url:source.url,reason:r ? '招聘来源已变化，请重新预检' : undefined}
  }
  async function detail(id, focusCompany, requestedOffset = 0) {
    const s=await row(id)
    const focus=s.companies.find(c=>c.companyId===focusCompany) || s.companies.find(c=>!terminal.has(c.status)) || s.companies[0]
    const offset=Math.max(0,Number(requestedOffset)||0)
    const summary={}
    s.companies.forEach(c=>{summary[c.status]=(summary[c.status]||0)+1})
    const counts=await q("SELECT status,kind,COUNT(*)::integer AS count FROM job_crawl_items WHERE session_id=$1 AND status<>'superseded' GROUP BY status,kind",[id])
    counts.forEach(i=>{summary['item_'+i.status]=(summary['item_'+i.status]||0)+i.count;summary['item_'+i.status+'_'+i.kind]=i.count})
    const [total]=await q("SELECT COUNT(*)::integer AS count FROM job_crawl_items WHERE session_id=$1 AND company_id=$2 AND status<>'superseded'",[id,focus?.companyId||''])
    const items=(await q("SELECT id,session_id,company_id,company_name,kind,status,job_id,version,reason,jsonb_build_object('title',draft->>'title') AS draft FROM job_crawl_items WHERE session_id=$1 AND company_id=$2 AND status<>'superseded' ORDER BY created_at,id LIMIT 25 OFFSET $3",[id,focus?.companyId||'',offset])).map(itemView)
    const companies=s.companies.map(c => {
      const {source,cursor,seen,verifyJobs,raw,history,...view}=c
      return {...view,items:[]}
    })
    const publicationErrors=await q(`SELECT company_id AS "companyId",status,error FROM job_crawl_publications WHERE session_id=$1 AND status<>'done' ORDER BY updated_at`,[id])
    return {publicationErrors,id:s.id,mode:s.mode,status:s.status,companyIds:s.company_ids,companies,items,itemsTotal:total.count,itemsOffset:offset,itemsCompanyId:focus?.companyId,currentCompanyId:focus?.companyId,summary}
  }
  async function get(params={}) {
    if(params.itemId) {
      const [item]=await q('SELECT * FROM job_crawl_items WHERE id=$1',[params.itemId])
      if(!item) fail('岗位结果不存在')
      return {success:true,item:itemView(item)}
    }
    if(params.evidenceCompanyId && params.sessionId) {
      const s=await row(params.sessionId),c=s.companies.find(c=>c.companyId===params.evidenceCompanyId)
      if(!c) fail('企业不在本次操作范围内')
      return {success:true,evidence:evidenceView(c.raw)}
    }
    if(params.sessionId) return {success:true,session:await detail(params.sessionId,params.focusCompanyId,params.offset)}
    const ids=validIds(params.companyIds || params.companyId)
    const qualifications={}
    for(const id of ids) {
      const co=await currentCompany(id), source=await sourceFor(co)
      qualifications[id]=await qualification(co,source)
    }
    const sessions=ids.length ? await q(`SELECT id FROM job_crawl_sessions WHERE company_ids && $1::text[] AND status<>'complete' ORDER BY updated_at DESC LIMIT 10`,[ids]) : []
    const history=params.companyId ? await q(`SELECT i.id,i.session_id,i.company_id,i.company_name,i.kind,i.status,i.job_id,i.version,i.reason,jsonb_build_object('title',i.draft->>'title') AS draft,COUNT(*) OVER()::integer AS review_total FROM job_crawl_items i JOIN jobs j ON j.job_id=i.job_id
      WHERE i.company_id=$1 AND ((i.status='deleted' AND j.crawl_deleted_at IS NOT NULL)
        OR (i.status IN ('draft','pending') AND j.status='active' AND j.crawl_deleted_at IS NULL
          AND (j.is_approved IS NOT TRUE OR (i.status='draft' AND i.kind<>'create')))) ORDER BY i.updated_at DESC,i.id LIMIT 25 OFFSET $2`,[params.companyId,Math.max(0,Number(params.offset)||0)]) : []
    return {success:true,qualifications,sessions:await Promise.all(sessions.map(s=>detail(s.id))),reviewItems:history.map(itemView),reviewTotal:history[0]?.review_total||0}
  }
  async function start(body,actor) {
    if (!['preflight','update'].includes(body.mode)) fail('请选择爬虫预检或更新检查')
    const ids=validIds(body.companyIds)
    if (!ids.length || !body.requestId || String(body.requestId).length>200) fail('缺少当前页企业范围或操作标识')
    const [previous]=await q('SELECT * FROM job_crawl_sessions WHERE actor=$1 AND request_id=$2',[actor,String(body.requestId)])
    if(previous) {
      if(previous.mode!==body.mode || json(previous.company_ids)!==json(ids)) fail('REQUEST_CONFLICT')
      return previous.id
    }
    const companies=[]
    for(const id of ids) {
      const co=await currentCompany(id),source=await sourceFor(co),qual=await qualification(co,source)
      const skip=body.mode==='update' ? qual.status!=='approved' : qual.status==='approved' && !body.forcePreflight
      companies.push({companyId:id,name:co.name,url:source.url,companyUrl:source.url,source,status:skip?'skipped':'queued',attempt:1,retries:0,stage:skip?(body.mode==='update'?'未通过预检，已跳过':'来源已通过预检，已跳过'):'等待读取招聘来源',progress:{checked:0,pages:0},seen:[],cursor:null,raw:{requests:[]},history:[]})
    }
    const id=randomUUID()
    const [saved]=await q(`INSERT INTO job_crawl_sessions(id,request_id,actor,mode,status,company_ids,companies) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(actor,request_id) DO UPDATE SET request_id=EXCLUDED.request_id RETURNING id,mode,company_ids`,[id,String(body.requestId),actor,body.mode,companies.every(c=>terminal.has(c.status))?'complete':'running',ids,json(companies)])
    if(saved.mode!==body.mode || json(saved.company_ids)!==json(ids)) fail('REQUEST_CONFLICT')
    return saved.id
  }
  function statusFor(companies,mode) {
    if(companies.some(c=>c.status==='failed')) return 'paused'
    if(mode==='preflight' && companies.some(c=>c.status==='awaiting_review')) return 'awaiting_review'
    return companies.every(c=>terminal.has(c.status)) ? (mode==='update'?'awaiting_review':'complete') : 'running'
  }
  async function control(body,actor) {
    const s=await row(body.sessionId), companies=structuredClone(s.companies)
    let status=s.status,qual=null
    const c=companies.find(x=>x.companyId===body.companyId)
    if(body.action==='cancel') status='cancelled'
    else if(body.action==='continue') {
      if(s.status==='complete') return s.id
      // A failed request is never automatically retried by continue.
      if(companies.some(x=>x.status==='failed')) fail('本次请求失败，请对该企业点击继续重试')
      status=statusFor(companies,s.mode)
    } else {
      if(!c) fail('企业不在本次操作范围内')
      if(s.status==='cancelled' && !(c.status==='failed' && ['retry','skip','qualify'].includes(body.action))) fail('本次操作已结束，请先点击继续')
      if(body.action==='skip') {c.status='skipped';c.stage='已跳过本家';c.canApprove=false}
      else if(body.action==='retry') {
        if(body.requestId && c.retryRequests?.includes(String(body.requestId))) return s.id
        if(body.expectedAttempt!==undefined && Number(body.expectedAttempt)!==c.attempt) fail('RETRY_CONFLICT')
        if(!body.requestId && body.expectedAttempt===undefined) fail('缺少重试操作标识，请刷新页面')
        const unattempted=!c.url && !(c.raw?.requests?.length)
        if(c.retries>=5 && !unattempted) fail('已达到本轮 5 次重试上限，请确认结果或跳过')
        if(!['failed','awaiting_review'].includes(c.status)) fail('当前步骤尚未结束，不能重复重试')
        // Existing decisions survive; only uncommitted observations may be refreshed.
        if(s.mode==='update' && (await q("SELECT id FROM job_crawl_items WHERE session_id=$1 AND company_id=$2 AND status IN ('draft','pending','published','deleted') LIMIT 1",[s.id,c.companyId])).length) fail('该企业已有保存结果，请重新发起更新检查')
        let url=body.url===undefined?c.url:String(body.url).trim()
        validatePublicUrl(url)
        if(s.mode==='update' && url!==c.url) fail('更新检查不能修改来源，请重新预检')
        const co=await currentCompany(c.companyId)
        if(co.careers_page!==c.companyUrl && (co.careers_page || '')!==c.companyUrl) fail('SOURCE_CONFLICT')
        const source=await sourceFor({...co,careers_page:url})
        c.retryRequests=[...(c.retryRequests||[]),String(body.requestId||`attempt-${c.attempt}`)].slice(-6)
        c.history.push({attempt:c.attempt,error:c.error,raw:c.raw,stage:c.stage})
        Object.assign(c,{url,source,retries:c.retries+(unattempted?0:1),attempt:c.attempt+(unattempted?0:1),status:'queued',stage:'等待手动重试',error:undefined,canApprove:false,cursor:null,seen:[],verifyJobs:undefined,progress:{checked:0,pages:0},raw:{requests:[]},partial:null})
      } else if(body.action==='qualify') {
        if(s.mode==='preflight' && c.status===body.decision) return s.id
        if(s.mode!=='preflight' || !['approved','rejected'].includes(body.decision) || !['awaiting_review','failed'].includes(c.status)) fail('当前状态不能进行预检判定')
      if(body.decision==='approved' && (!c.canApprove || !(c.raw?.sampleComplete || c.raw?.complete) || c.status==='failed')) fail('尚无属于本企业且字段完整的岗位样本，不能通过')
        if(body.decision==='approved' && !c.raw?.requests?.length) fail('缺少真实抓取证据')
        const co=await currentCompany(c.companyId),source=await sourceFor({...co,careers_page:c.url})
        if(source.version!==c.source.version) fail('SOURCE_CONFLICT')
        qual={source:c.source,url:c.url,companyUrl:c.companyUrl,sourceVersion:c.source.version,status:body.decision,reason:String(body.reason||c.error||'人工审核').slice(0,2000)}
        c.status=body.decision;c.stage=body.decision==='approved'?'人工确认可爬虫':'人工确认不可爬虫'
      } else fail('未知操作')
      status=statusFor(companies,s.mode)
    }
    await q('SELECT control_manual_crawl($1,$2,$3,$4,$5,$6,$7,$8)',[s.id,s.revision,json(companies),status,actor,body.action,body.companyId||null,qual?json(qual):null])
    return s.id
  }
  function checkSource(source,co) {
    if(!source.url) fail('缺少招聘页，请填写该企业的招聘 URL 后重试')
    const u=validatePublicUrl(source.url)
    if(['greenhouse','ashby','lever','workable','smartrecruiters'].includes(source.adapter) && !source.config.board) fail('这是招聘平台首页，请填写该企业的专属招聘页面')
    if(source.adapter==='manual' && !(source.config?.rolloutTier==='B' && detectSource(source.url).adapter==='html')) fail('该页面暂不支持提取，请补充企业专属招聘页面')
    if(u.hostname==='app.usebraintrust.com') fail('此链接是 Braintrust 多企业招聘市场，公开接口中的岗位属于不同雇主，不能全部归入本企业。请填写企业自招页面后重试。')
    if(/(^|\.)(indeed\.com|linkedin\.com|remoteok\.com|weworkremotely\.com|wellfound\.com)$/.test(u.hostname)) fail('共享招聘平台无法确认企业归属，请使用企业专属招聘页')
    if(source.adapter==='html' && u.pathname==='/' && co.website && new URL(co.website).hostname===u.hostname) fail('当前网址为企业官网首页，请填写专属招聘页面')
  }
  async function step(id) {
    const token=randomUUID()
    const [s]=await q(`UPDATE job_crawl_sessions SET lease_token=$2,lease_until=NOW()+INTERVAL '70 seconds' WHERE id=$1 AND status='running' AND (lease_token IS NULL OR lease_until<NOW()) RETURNING *`,[id,token])
    if(!s) return id
    const companies=structuredClone(s.companies), c=companies.find(x=>!terminal.has(x.status))
    if(!c) {
      await q('SELECT save_manual_crawl_step($1,$2,$3,$4,$5,$6)',[id,token,s.revision,json(companies),s.mode==='update'?'awaiting_review':'complete','[]'])
      return id
    }
    let mayVerifyExisting=false
    const proposals=[],requests=[],ownershipIssues=[],controller=new AbortController(), timer=setTimeout(()=>controller.abort(new Error('请求超时，请手动重试')),45000)
    const fence=async()=>{
      const [live]=await q('SELECT status,lease_token,revision,lease_until FROM job_crawl_sessions WHERE id=$1',[id])
      if(live?.status!=='running'||live.lease_token!==token||live.revision!==s.revision||!live.lease_until||new Date(live.lease_until).getTime()<=Date.now()) fail('SESSION_CANCELLED')
      if(controller.signal.aborted) throw controller.signal.reason
    }
    const capture=async(url,opts={})=>{
      await fence()
      const response=await fetcher(url,{...opts,signal:controller.signal})
      // Preserve explicit organization evidence lost by the normalized adapter.
      const $=cheerio.load(String(response.text||''))
      const visit=value=>{
        if(Array.isArray(value)) {value.forEach(visit);return}
        if(!value || typeof value!=='object') return
        if([].concat(value['@type']||[]).includes('JobPosting') && value.hiringOrganization?.name) {
          const normalize=x=>String(x).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g,'').replace(/(?:incorporated|corporation|limited|company|inc|ltd|llc)$/,'')
          const employer=normalize(value.hiringOrganization.name), company=normalize(c.name)
          const board=normalize(c.source?.config?.board || '')
          // Citi's official site incorrectly labels its hiring organization as
          // an audience segment. This exception is pinned to both official
          // domains and these two observed labels, never an arbitrary employer.
          const citiAudience=new URL(response.url||url).hostname==='jobs.citi.com' &&
            new URL(coWebsite || 'https://invalid.example').hostname.replace(/^www\./,'')==='citigroup.com' &&
            ['earlycareer','professional'].includes(employer)
          if(employer && company && employer!==company && employer!==board && !citiAudience) ownershipIssues.push(`岗位标注企业为 ${value.hiringOrganization.name}，与 ${c.name} 不一致`)
        }
        for(const child of Object.values(value)) if(child && typeof child==='object')visit(child)
      }
      $('script[type="application/ld+json"]').each((_,el)=>{try{visit(JSON.parse($(el).text()))}catch{}})
      requests.push({url:response.url||url,status:response.status,text:evidenceText(response.text||''),body:String(response.text||'').slice(0,120000),truncated:String(response.text||'').length>120000,checked_at:now()})
      await fence()
      return response
    }
    let coWebsite=''
    try {
      const co=await currentCompany(c.companyId),source=await sourceFor({...co,careers_page:c.url})
      coWebsite=co.website||''
      if((co.careers_page||'')!==c.companyUrl || source.version!==c.source.version) fail('招聘来源已变化，请重新预检')
      checkSource(source,co)
      const mappings=source.sourceId ? await q('SELECT company_id FROM job_sync_source_companies WHERE source_id=$1',[source.sourceId]) : []
      if(mappings.some(m=>m.company_id!==c.companyId)) fail('该来源关联多个企业，无法确认岗位归属，请使用本企业专属招聘页')
      const scanSource=source.adapter==='manual' && source.config?.rolloutTier==='B' && detectSource(source.url).adapter==='html' ? {...source,adapter:'html'} : source
      if(scanSource.adapter==='html') {
        const companyHost=co.website ? new URL(co.website).hostname.replace(/^www\./,'') : ''
        const sourceHost=new URL(source.url).hostname.replace(/^www\./,'')
        const normalize=x=>String(x).toLowerCase().replace(/[^a-z0-9]/g,'')
        const yc=new URL(source.url).pathname.match(/^\/companies\/([^/]+)\/jobs\/?$/)
        const deel=new URL(source.url).pathname.match(/^\/([^/]+)\/?$/)
        const companyBoard=(sourceHost==='ycombinator.com' && yc && normalize(yc[1])===normalize(co.name)) ||
          (sourceHost==='jobs.deel.com' && deel && normalize(deel[1])===normalize(co.name))
        let historicalDomain=false
        if(!companyBoard && !(sourceHost===companyHost || sourceHost.endsWith('.'+companyHost))) {
          const owners=await q("SELECT DISTINCT company_id FROM jobs WHERE url LIKE $1 AND status='active' AND is_approved IS TRUE",[new URL(source.url).origin+'/%'])
          historicalDomain=owners.length===1 && owners[0].company_id===co.company_id
        }
        if(!companyBoard && !historicalDomain && (!companyHost || !(sourceHost===companyHost || sourceHost.endsWith('.'+companyHost)))) fail('无法确认招聘域名归属。请使用企业官网域名下的招聘页或企业专属 ATS 页面；已有岗位将保持原样。')
      }
      if(s.mode==='update' && (await qualification(co,source)).status!=='approved') fail('招聘来源尚未通过预检或资格已失效')
      mayVerifyExisting=s.mode==='update' && c.stage!=='检查已发布岗位链接'
      c.status='running'
      if(c.stage==='检查已发布岗位链接') {
        const next=c.verifyJobs?.shift()
        if(next) {
          const identity=postingIdentity(next.url)
          const result=identity ? await verify({payload:next,external_id:identity},{fetcher:capture,signal:controller.signal}) : {state:'unknown',reason:'通用申请页面或无法确定岗位身份，需要人工核实'}
          await fence()
          const key=canonicalUrl(next.url),observed=c.seen.includes(key)
          if(result.state==='closed' || (!observed && result.state==='unknown')) proposals.push({id:randomUUID(),companyId:c.companyId,companyName:c.name,sourceUrl:c.url,sourceVersion:c.source.version,identityKey:key,kind:result.state==='closed'?'close':'unknown',raw:{...result,source:c.source,requests,checked_at:now()},draft:editable(next),before:editable(next),reason:result.reason,jobId:next.job_id,baseRevision:next.sync_revision})
          c.progress.checked++
        }
        if(!c.verifyJobs?.length) {c.status='complete';c.stage=c.partial?'部分完成：'+c.partial:'检查结束，等待人工处理'}
      } else {
        c.stage='获取招聘列表与岗位详情'
        if(c.progress.pages>=200) fail('分页超过 200 页，请核对来源后重试')
        const page=await scan(scanSource,c.cursor,{fetcher:capture,signal:controller.signal})
        await fence()
        if(page.next && hash(page.next)===hash(c.cursor)) fail('分页未前进，请核对来源后重试')
        const existing=await q('SELECT * FROM jobs WHERE company_id=$1',[c.companyId])
        for(const observation of s.mode==='preflight'?page.jobs.slice(0,5):page.jobs) {
          const facts=sourceFacts(observation),key=canonicalUrl(facts.url)
          if(!key || c.seen.includes(key)) continue
          c.seen.push(key)
          const matches=existing.filter(j=>canonicalUrl(j.url)===key || j.crawl_identity_key===key)
          const job=matches.length===1?matches[0]:null
          const usable=!ownershipIssues.length && !!facts.title && (facts.description||'').length>=50 && !observation.detail_error
          const before=job?editable(job):{}
          // Only extracted fact fields can change automatically. Human classification stays intact.
          const draft={...before,...editable(facts)}
          const kind=matches.length>1?'unknown':!usable?'unknown':job?.crawl_deleted_at?'restore':!job?'create':Object.entries(editable(facts)).some(([k,v])=>hash(before[k])!==hash(v))?'update':'unchanged'
          proposals.push({id:randomUUID(),companyId:c.companyId,companyName:c.name,sourceUrl:c.url,sourceVersion:c.source.version,identityKey:key,kind,raw:{source:c.source,requests,source_payload:observation,checked_at:now()},draft,before,reason:matches.length>1?'存在多个相同申请链接的岗位，请先核对':ownershipIssues[0]||observation.detail_error,jobId:job?.job_id,baseRevision:job?.sync_revision})
        }
        c.cursor=page.next;c.progress.pages++;c.progress.discovered=c.seen.length
        c.raw={requests:[...(c.raw?.requests||[]),...requests].slice(-20),checked_at:now(),complete:!!page.complete,reason:page.reason}
        c.partial=c.partial||page.reason||ownershipIssues[0]||proposals.find(i=>i.kind==='unknown')?.reason|| (proposals.some(i=>i.kind==='unknown')?'部分岗位字段不完整或归属无法确认':null)||(!page.next && !page.complete?'未能完整读取招聘列表':null)
        if(s.mode==='preflight' && proposals.some(i=>['create','update','unchanged','restore'].includes(i.kind)) && !ownershipIssues.length && !proposals.some(i=>i.kind==='unknown')) {
          c.canApprove=true;c.raw.sampleComplete=true;c.status='awaiting_review';c.stage='已取得完整岗位样本，等待人工判定';c.error=page.complete?undefined:'本次仅验证字段提取能力，不代表已读取所有岗位。更新检查会继续读取列表并逐条检查已有岗位。'
          c.cursor=null
        } else {
        c.canApprove=!c.partial && !ownershipIssues.length && (c.canApprove||proposals.some(i=>['create','update','unchanged','restore'].includes(i.kind)))
        if(!page.next) {
          if(s.mode==='preflight') {c.canApprove=c.canApprove && page.complete===true;c.status='awaiting_review';c.stage=c.seen.length?'字段提取完成，等待人工判定':'当前无在招岗位，暂无法验证字段提取';c.error=c.partial||undefined}
          else {
            c.verifyJobs=existing.filter(j=>j.status==='active'&&j.is_approved===true&&!j.crawl_deleted_at)
            c.progress.total=c.verifyJobs.length;c.progress.checked=0
            c.error=c.partial||undefined
            c.stage=c.verifyJobs.length?'检查已发布岗位链接':c.partial?'部分完成：'+c.partial:'检查结束，等待人工处理'
            if(!c.verifyJobs.length)c.status='complete'
          }
        }
        }
      }
    } catch(error) {
      if(error.message==='SESSION_CANCELLED') return id
      c.status='failed';c.stage='检查中断，请手动重试';c.error=error.message;c.canApprove=false
      c.raw={requests:[...(c.raw?.requests||[]),...requests].slice(-20),checked_at:now(),error:error.message}
      if(mayVerifyExisting) {
        c.verifyJobs=await q("SELECT * FROM jobs WHERE company_id=$1 AND status='active' AND is_approved IS TRUE AND crawl_deleted_at IS NULL",[c.companyId])
        c.partial='新增岗位列表读取失败：'+error.message
        c.progress.total=c.verifyJobs.length;c.progress.checked=0
        if(c.verifyJobs.length) {c.status='running';c.stage='检查已发布岗位链接';c.error=c.partial+'。正在独立检查已有岗位，不会据此判定失效。'}
      }
    } finally {clearTimeout(timer)}
    await q('SELECT save_manual_crawl_step($1,$2,$3,$4,$5,$6)',[id,token,s.revision,json(companies),statusFor(companies,s.mode),json(proposals)])
    return id
  }
  async function decide(body,actor) {
    const [item]=await q('SELECT * FROM job_crawl_items WHERE id=$1',[body.itemId])
    if(!item || (body.sessionId && item.session_id!==body.sessionId)) fail('ITEM_SCOPE_INVALID')
    const patch=validateManualPatch(body.patch || {})
    const decision=body.action==='restore'?'restore':body.decision
    if(['draft','publish'].includes(decision)) {
      const combined={...item.draft,...patch}
      if(!combined.title?.trim()||(combined.description||'').length<50) fail('请填写岗位名称和至少 50 字符的职位描述')
      validatePublicUrl(combined.url)
    }
    if(decision!=='restore' && decision!=='cancel') {
      const co=await currentCompany(item.company_id),source=await sourceFor(co)
      if(source.version!==item.source_version) fail('SOURCE_CONFLICT')
    }
    const eligible=eligibility({...item.draft,...patch}).status==='eligible'||body.eligibilityConfirmed===true
    const [result]=await q('SELECT decide_manual_crawl($1,$2,$3,$4,$5,$6,$7) AS value',[item.session_id,item.id,Number(body.version),decision,json(patch),actor,eligible])
    let publicationError
    if(decision!=='cancel' && !result.value?.replayed) publicationError=await publishPending(item.session_id,item.company_id)
    return {id:item.session_id,publicationError,result:result.value}
  }
  async function publishPending(sessionId,companyId) {
    const s=await row(sessionId)
    if(!s.company_ids.includes(companyId)) fail('COMPANY_MISMATCH')
    const [pending]=await q("SELECT * FROM job_crawl_publications WHERE session_id=$1 AND company_id=$2 AND status<>'done'",[sessionId,companyId])
    if(!pending) return
    try {
      await publish(companyId)
      await q("UPDATE job_crawl_publications SET status='done',error=NULL,updated_at=NOW() WHERE session_id=$1 AND company_id=$2 AND version=$3",[sessionId,companyId,pending.version])
    } catch(error) {
      const message='岗位已保存，但前台同步暂未完成：'+error.message
      await q("UPDATE job_crawl_publications SET status='failed',error=$4,updated_at=NOW() WHERE session_id=$1 AND company_id=$2 AND version=$3",[sessionId,companyId,pending.version,message])
      return message
    }
  }
  async function post(body={},actor) {
    if(!actor) fail('缺少操作人')
    let id,result
    if(body.action==='start') id=await start(body,actor)
    else if(body.action==='step') id=await step(body.sessionId)
    else if(['retry','qualify','skip','cancel','continue'].includes(body.action)) id=await control(body,actor)
    else if(body.action==='retry-publication') {id=body.sessionId;result={publicationError:await publishPending(id,body.companyId)}}
    else if(['decide','restore'].includes(body.action)) {result=await decide(body,actor);id=result.id}
    else fail('未知操作')
    return {success:true,session:await detail(id,body.focusCompanyId,body.offset),...(result?.publicationError?{publicationError:result.publicationError,warning:result.publicationError}:{}),...(result?.result?{result:result.result}:{})}
  }
  return {get,post,sourceFor,detail}
}
export const manualWorkflow=createManualWorkflow()
