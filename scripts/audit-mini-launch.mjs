import fs from 'node:fs'
import path from 'node:path'
import {createRequire} from 'node:module'
import {execFileSync} from 'node:child_process'
const root=path.resolve(import.meta.dirname,'..')
const require=createRequire(import.meta.url)
const globalModules=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim()
require(path.join(globalModules,'@cloudbase/cli/node_modules/reflect-metadata'))
const {getCloudrunService}=require(path.join(globalModules,'@cloudbase/cli/lib/commands/cloudrun/base.js'))
const parse=v=>typeof v==='string'?JSON.parse(v):Array.isArray(v)?Object.fromEntries(v.map(x=>[x.Key||x.key,x.Value||x.value])):v||{}
const results=[]
for(const [target,envId,serverName] of [['development','haigoo-dev-d2gctbzxma401b345','haigoo-mini'],['production','cloud1-d8ggt7rbl273f83c7','haigoo-mini-prod']]) {
 const service=await getCloudrunService(envId)
 const detail=await service.detail({serverName})
 const config=detail.ServerConfig||{},env=parse(config.EnvParams)
 results.push({target,envId,serverName,apiOrigin:env.HAIGOO_API_ORIGIN,jobSourceOrigin:env.HAIGOO_JOBS_API_ORIGIN||env.HAIGOO_API_ORIGIN,minInstances:config.MinNum,maxInstances:config.MaxNum,accessTypes:config.OpenAccessTypes,
  virtualPaymentEnv:env.WECHAT_VIRTUAL_PAYMENT_ENV,miniProgramState:env.WECHAT_MINI_PROGRAM_STATE||null,legacyJobCache:env.MINI_ENABLE_LEGACY_JOB_CACHE||null,
  configured:Object.fromEntries(['WECHAT_MINI_APP_ID','WECHAT_MINI_APP_SECRET','MINI_GATEWAY_SHARED_SECRET','MINI_SESSION_SECRET','MINI_SYNC_SECRET','WECHAT_VIRTUAL_PAYMENT_OFFER_ID','WECHAT_VIRTUAL_PAYMENT_APP_KEY','WECHAT_VIRTUAL_PAYMENT_PRODUCTS_JSON'].map(k=>[k,Boolean(String(env[k]||'').trim())])),
  productionHasPreviewBypass:target==='production'?Boolean(env.VERCEL_AUTOMATION_BYPASS_SECRET):null})
}
const output={checkedAt:new Date().toISOString(),checks:results}
fs.writeFileSync(path.join(root,'artifacts/mini-company-polish-2026-09-05/launch-runtime-config.json'),JSON.stringify(output,null,2)+'\n')
console.log(JSON.stringify(output,null,2))
