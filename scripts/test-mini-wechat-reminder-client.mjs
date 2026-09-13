import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
const tick=()=>new Promise(setImmediate)
function moduleFrom(file, deps, globals={}) {
  const module={exports:{}}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,
    {module,exports:module.exports,require:name=>{if(name.endsWith('.scss'))return {};assert.ok(name in deps,`Unexpected import ${name}`);return {default:deps[name],...deps[name]}},console,...globals})
  return module.exports
}
let scope='user-a',now=0
class Clock extends Date {static now(){return now}}
const reads=[]
const service=moduleFrom('miniprogram/src/services/company-follow-state.ts',{
  '@tarojs/taro':{getStorageSync:()=>null,eventCenter:{trigger(){}}},
  './retained-resource-cache':{invalidateMiniResource(){}},
  './session':{careerWatchStorageKey:x=>x,getMiniUser:()=>({userId:scope}),getMiniSessionCacheKey:()=>scope,hasAuthenticatedSession:()=>scope!=='guest'},
  './api-client':{requestJson:()=>{const r=deferred();reads.push(r);return r.promise}}
},{Date:Clock})
const p1=service.refreshCompanyReminderSnapshot();const p2=service.refreshCompanyReminderSnapshot()
assert.equal(p1,p2);assert.equal(reads.length,1,'cards share a single status request')
reads[0].resolve({follows:[]});await p1;await service.refreshCompanyReminderSnapshot();assert.equal(reads.length,1)
now=60_001;const old=service.refreshCompanyReminderSnapshot();service.invalidateReminderSnapshot()
reads[1].resolve({follows:[{company_id:'outdated'}]});assert.equal(await old,null,'late read cannot undo a local toggle')
const fromA=service.refreshCompanyReminderSnapshot();scope='user-b';reads[2].resolve({follows:[{company_id:'private-a'}]})
assert.equal(await fromA,null,'account changes discard an old response')
scope='guest';assert.equal(await service.refreshCompanyReminderSnapshot(),null)
console.log('PASS shared status: deduplication, 60s quiet refresh, mutation ordering, account isolation')

let cursor=0,shown,apiCalls=0,auth=deferred(),statusRead=deferred()
const slots=[]
const react={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return [slots[i],value=>{slots[i]=value}]},
  useRef(initial){const i=cursor++;if(!(i in slots))slots[i]={current:initial};return slots[i]},
  useEffect(fn,deps){const i=cursor++;if(!slots[i]||deps.some((v,n)=>v!==slots[i].deps[n])){slots[i]?.cleanup?.();slots[i]={deps,cleanup:fn()}}}
}
const Component=moduleFrom('miniprogram/src/components/wechat-reminder-action/index.tsx',{
  react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
  '@tarojs/components':{Button:'button',Text:'text'},
  '@tarojs/taro':{requestSubscribeMessage:()=>auth.promise,useDidShow:fn=>{shown=fn},showToast(){},navigateTo(){},showModal:async()=>({cancel:true})},
  '../mini-icon':()=>null,'../../services/career-match-service':{setMatchNotifications:async()=>{apiCalls++;return {success:true}}},
  '../../services/company-follow-state':{emitCompanyFollowChange(){},invalidateReminderSnapshot(){},refreshCompanyReminderSnapshot:()=>statusRead.promise},
  '../../services/session':{getMiniSessionCacheKey:()=>scope},'../../services/analytics-service':{trackMiniEvent(){}},'../../services/api-client':{ApiRequestError:class extends Error {}}
}).default
scope='user-a'
const props={companyId:'company-a',available:true,templateId:'template',enabled:false}
const render=()=>{cursor=0;return Component(props)}
let tree=render();statusRead.resolve(null);await tick();const click=()=>tree.props.onClick({stopPropagation(){}})
click();click();auth.resolve({template:'accept'});await tick();assert.equal(apiCalls,1,'rapid double click must not record two authorizations')
tree=render();assert.equal(tree.props.children[1].props.children,'已预约一次提醒')
// An authoritative read only changes the button, without loading or rebuilding page data.
statusRead=deferred();shown();statusRead.resolve({follows:[]});await tick();tree=render();assert.equal(tree.props.children[1].props.children,'提醒我一次')
auth=deferred();click();scope='user-b';auth.resolve({template:'accept'});await tick()
assert.equal(apiCalls,1,'native prompt acceptance for an old account cannot enable the new account')
assert.equal(typeof shown,'function')
console.log('PASS reminder control: double-click exclusion, silent server status, native authorization account isolation')
