// Local-only acceptance fixtures. No credentials, database connections or external writes.
import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { createCompanyTop100Handler, companyTop100Snapshot, getCompanyTop100LiveData } from '../lib/services/company-top100-service.js'
import { deriveMembershipCapabilities } from '../lib/shared/membership.js'

const root = process.cwd(), research = process.argv.find(a => a.startsWith('--research='))?.slice(11)
if (!research) throw Error('An explicit public-company research fixture directory is required')
const controlPath = process.argv.find(a=>a.startsWith('--control='))?.slice(10)
if(controlPath && !controlPath.startsWith('/private/tmp/'))throw Error('Controls must stay in private temporary storage')
function control(){try{return controlPath?JSON.parse(fs.readFileSync(controlPath,'utf8')):{}}catch{return {}}}
async function delay(ms){if(ms)await new Promise(resolve=>setTimeout(resolve,Math.min(Number(ms),25000)))}
const companies = JSON.parse(fs.readFileSync(path.join(research,'companies.json'))), jobs = JSON.parse(fs.readFileSync(path.join(research,'jobs.json')))
const map = new Map(companies.map(c => [c.company_id,c])), secret = randomBytes(48).toString('hex')
const app = express(); app.use(express.json()); app.disable('x-powered-by')
const future = new Date(Date.now()+86400000*90).toISOString(), past = new Date(Date.now()-86400000).toISOString()
const users = Object.fromEntries(['member','starter','trial','free','expired','admin'].map(kind => [kind,{
  userId:`top100-local-${kind}`, user_id:`top100-local-${kind}`, email:`${kind}@top100.invalid`, username:`Top100 Fixture ${kind}`,
  emailVerified:true, email_verified:true, status:'active', roles:{user:true,...kind==='admin'?{admin:true}:{}},
  memberStatus:kind==='free'?'none':'active', memberType:kind==='trial'?'trial_week':kind==='starter'?'starter':'quarter',
  memberExpireAt:kind==='expired'?past:future, created_at:'2025-01-01T00:00:00Z', profile:{}
}]))
const byId = new Map(Object.values(users).map(u=>[u.userId,u]))
function localUser(id){const u=byId.get(id);return u && control().upgradeUser===id ? {...u,memberType:'quarter',memberStatus:'active'} : u}
function viewer(req) { try { return localUser(jwt.verify(req.headers.authorization?.replace('Bearer ',''),secret).userId) } catch { return null } }
function activeJobs(id) {
 const list=jobs.filter(j=>(!id||j.company_id===id)&&j.status==='active'&&j.is_approved===true&&!j.crawl_deleted_at), cfg=control()
 if(cfg.extraJobs && id===cfg.extraCompanyId && list.length){for(let i=0;i<Math.min(cfg.extraJobs,80);i++)list.push({...list[0],job_id:`local-pagination-${i}`,title:`Local acceptance role ${i+1}`,url:'http://127.0.0.1:3100/',description:'Local-only acceptance fixture, not a real vacancy.'})}
 return list
}
const ranking = createCompanyTop100Handler({extractToken:req=>req.headers.authorization?.replace('Bearer ',''),verifyToken:t=>jwt.verify(t,secret),getUser:id=>Promise.resolve(localUser(id)),isAdmin:u=>!!u.roles.admin,enrich:entries=>getCompanyTop100LiveData(entries,async sql=>sql.startsWith('SELECT *')?entries.map(e=>map.get(e.companyId)).filter(Boolean):entries.map(e=>({company_id:e.companyId,count:activeJobs(e.companyId).length})))})
const companyDto = c=>({id:c.company_id,name:c.name,website:c.website,careersPage:c.careers_page,industry:c.industry,description:c.description,logo:c.logo,employeeCount:c.employee_count,foundedYear:c.founded_year,companyRating:c.company_rating,ratingSource:c.rating_source,tags:c.tags||[],isTrusted:true,createdAt:c.created_at,updatedAt:c.updated_at})
const jobDto = j=>({id:j.job_id,title:j.title,company:map.get(j.company_id)?.name||j.company,companyId:j.company_id,location:j.location,jobType:j.job_type,type:j.job_type,isRemote:j.is_remote,salary:j.salary,description:j.description,url:j.url,source:j.source,sourceType:j.source_type,isTrusted:true,isApproved:true,memberOnly:j.member_only,publishedAt:j.published_at||j.created_at,tags:j.tags||[]})
app.all('/api/auth',async(req,res)=>{
  if(req.query.action==='login') { const u=users[String(req.body.email||'').split('@')[0]]; if(!u||req.body.password!=='fixture-only')return res.status(401).json({success:false,error:'Local fixture login only'}); return res.json({success:true,user:u,token:jwt.sign({userId:u.userId},secret,{expiresIn:'1h'})}) }
  const u=viewer(req),cfg=control(); await delay(cfg.authDelay); if(cfg.authStatus)return res.status(cfg.authStatus).json({success:false}); if(cfg.authBodyDelay && u){res.setHeader('Content-Type','application/json');res.write('{"success":true,"user":');await delay(cfg.authBodyDelay);if(controlPath)fs.appendFileSync('/private/tmp/haigoo-top100-control-events.jsonl',JSON.stringify({at:Date.now(),resource:'auth-delayed-body',userId:u.userId})+'\n');return res.end(JSON.stringify(u)+'}')} return u?res.json({success:true,user:u}):res.status(401).json({success:false})
})
app.all('/api/data',async(req,res)=>{
  const cfg=control()
  if(controlPath)fs.appendFileSync('/private/tmp/haigoo-top100-control-events.jsonl',JSON.stringify({at:Date.now(),resource:req.query.resource,action:req.query.action,companyId:req.query.companyId,page:req.query.page,method:req.method})+'\n')
  if(req.query.action==='top100'){
    await delay(cfg.rankingDelay)
    if(cfg.rankingStatus){res.setHeader('Cache-Control','private, no-store');return res.status(cfg.rankingStatus).json({success:false,code:'LOCAL_CONTROLLED_ERROR'})}
    if(cfg.malformedRanking){const send=res.json.bind(res);res.json=body=>send(body.companies?{...body,companies:body.companies.map((r,i)=>i? r : {...r,roles:null})}:body)}
    return ranking(req,res)
  }
  if(String(req.query.resource||'').includes('processed-jobs')) {
    await delay(cfg.jobsDelay)
    if(cfg.jobsStatus)return res.status(cfg.jobsStatus).json({error:'Local controlled jobs failure'})
    const u=viewer(req),full=deriveMembershipCapabilities(u).canAccessRemotePremiumJobs
    let list=activeJobs(req.query.companyId).filter(j=>full||!j.member_only)
    if(req.query.search)list=list.filter(j=>`${j.title} ${j.description} ${j.location}`.toLowerCase().includes(String(req.query.search).toLowerCase()))
    if(req.query.type)list=list.filter(j=>j.job_type===req.query.type)
    if(req.query.isRemote!==undefined)list=list.filter(j=>Boolean(j.is_remote)===(req.query.isRemote==='true'))
    const page=Number(req.query.page)||1,limit=Number(req.query.limit)||24
    return res.json({jobs:list.slice((page-1)*limit,page*limit).map(jobDto),total:list.length,page,pageSize:limit,totalPages:Math.ceil(list.length/limit),aggregations:{}})
  }
  if(req.query.id) { if(cfg.companyStatus)return res.status(cfg.companyStatus).json({success:false}); const c=map.get(req.query.id);return c?res.json({success:true,company:companyDto(c)}):res.status(404).json({success:false}) }
  return res.json({success:true,companies:companies.slice(0,8).map(companyDto),total:8,totalPages:1,availableCategories:[]})
})
app.get('/api/company-assets',(req,res)=>{const c=map.get(req.query.companyId);return /^https?:\/\//.test(c?.logo||'')?res.redirect(c.logo):res.status(404).end()})
app.all('/api/user-profile',async(req,res)=>{
 if(req.query.action==='submit_feedback')await delay(control().feedbackDelay)
 if(req.query.action==='submit_feedback' && controlPath)fs.writeFileSync('/private/tmp/haigoo-top100-local-feedback.json',JSON.stringify(req.body))
 return res.json({success:true,notifications:[],feedbacks:[],user:viewer(req),favorites:[],applications:[]})
})
app.all('/api/users',(req,res)=>res.json({success:true,feedbacks:[],user:viewer(req),profile:{},applications:[],favorites:[],subscriptions:[]}))
app.all('/api/membership',(req,res)=>res.json({success:true,plans:[],membership:{memberType:viewer(req)?.memberType,expireAt:viewer(req)?.memberExpireAt}}))
app.all('/api/analytics',(req,res)=>res.json({success:true}))
app.all(/^\/api\//,(req,res)=>res.json({success:true,data:[],items:[]}))
app.use(express.static(path.join(root,'dist'),{dotfiles:'allow',setHeaders:res=>res.setHeader('Cache-Control','no-store')}))
app.get(/.*/,(req,res)=>res.sendFile(path.join(root,'dist/index.html'),{dotfiles:'allow'}))
app.listen(3100,'127.0.0.1',()=>console.log('Local Top100 acceptance server: http://127.0.0.1:3100 — fixtures only, no database writes'))
