import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const tick=()=>new Promise(setImmediate)
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}}
function load(file,dependencies){
  const module={exports:{}}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{
    module,exports:module.exports,Date,Error,setTimeout,clearTimeout,console:{error(){},log(){}},require(name){if(name in dependencies)return dependencies[name];throw Error(`Unexpected dependency ${name}`)}
  });return module.exports
}
const storage=new Map()
const taro={getStorageSync:key=>storage.get(key),setStorageSync:(key,value)=>storage.set(key,value),removeStorageSync:key=>storage.delete(key)}
const session=load('miniprogram/src/services/session.ts',{'@tarojs/taro':taro,'../config/api':{CLOUD_ENV_ID:'qa'}})
const account={token:'token-a',userId:'a',email:'a@example.invalid'}
const requests=[]
let loginWait=null
const auth=load('miniprogram/src/services/mini-auth-service.ts',{
  '@tarojs/taro':{default:{login:()=>loginWait?.promise||Promise.resolve({code:'test'})}},
  './api-client':{requestJson:(path,options)=>{const r=deferred();requests.push({...r,path,options});return r.promise}},
  './session':session,'./analytics-service':{trackMiniEvent:async()=>{}},'../config/legal':{MINI_AGREEMENT_VERSION:'test',MINI_PRIVACY_VERSION:'test'}
})
for(const operation of ['bind','register']){
  session.saveMiniSession(account)
  const pending=operation==='bind'?auth.bindWebsiteAccount(' A@Example.Invalid ','Password123',true):auth.registerAndBindWebsiteAccount(' A@Example.Invalid ','Password123','QA',true)
  const rejected=assert.rejects(pending,/账号状态已变化/)
  const request=requests.at(-1)
  assert.equal(request.options.data.email,'a@example.invalid')
  await assert.rejects(auth.bindWebsiteAccount('b@example.invalid','Password123',true),/正在进行/)
  assert.equal(await auth.refreshWechatSessionIfStale(),null,'automatic session checks cannot interrupt account mutations')
  auth.logoutMiniAccount()
  request.resolve({token:'late',user:{userId:'a'}})
  await rejected
  assert.equal(session.getMiniSessionToken(),'','late bind/register cannot restore logout')
}
session.saveMiniSession(account)
let pending=auth.bindWebsiteAccount('a@example.invalid','Password123',true)
requests.at(-1).resolve({token:'bound',user:{userId:'a'}});await pending
assert.equal(session.getMiniSessionToken(),'bound')
pending=auth.unbindWebsiteAccount('wrong')
let checked=assert.rejects(pending,/wrong password/)
requests.at(-1).reject(Error('wrong password'));await checked
assert.equal(session.getMiniUser().userId,'a','failed account mutation preserves session')
loginWait=deferred();pending=auth.loginWithWechat(true);checked=assert.rejects(pending,/账号状态已变化/)
auth.logoutMiniAccount();loginWait.resolve({code:'late-code'});await tick()
requests.at(-1).resolve({token:'late-login',user:{userId:'a'}});await checked
assert.equal(session.getMiniSessionToken(),'');loginWait=null
session.saveMiniSession(account)
storage.set(session.careerWatchStorageKey('a'),{private:'a'});storage.set(session.careerWatchStorageKey('b'),{private:'b'})
storage.set('haigoo:match-intent','old-intent');auth.logoutMiniAccount()
assert.equal(storage.has(session.careerWatchStorageKey('a')),false)
assert.equal(storage.has(session.careerWatchStorageKey('b')),true)
assert.equal(storage.has('haigoo:match-intent'),false)
// The actual API client distinguishes bad credentials from expired identity.
session.saveMiniSession(account)
let apiResponse={statusCode:401,data:{code:'INVALID_CREDENTIALS',error:'账号密码验证失败'}}
const client=load('miniprogram/src/services/api-client.ts',{
  '@tarojs/taro':{default:{cloud:{callContainer:async()=>apiResponse}}},
  '../config/api':{CLOUD_ENV_ID:'qa',CLOUD_SERVICE_NAME:'qa'},'./cloud-runtime':{waitForCloudRuntime:async()=>{}},'./session':session
})
await assert.rejects(client.requestJson('/mini/account/unbind',{authenticated:true}),/密码验证失败/)
assert.equal(session.getMiniSessionToken(),'token-a')
apiResponse={statusCode:401,data:{error:'微信登录已失效，请重新登录'}}
await assert.rejects(client.requestJson('/mini/account/unbind',{authenticated:true}),/微信登录已失效/)
assert.equal(session.getMiniSessionToken(),'')
// Runtime initialization must not move an old request onto a newly logged-in account.
session.saveMiniSession(account)
const ready=deferred();let sent=0
const coldClient=load('miniprogram/src/services/api-client.ts',{
  '@tarojs/taro':{default:{cloud:{callContainer:async()=>{sent++;return{statusCode:200,data:{success:true}}}}}},
  '../config/api':{CLOUD_ENV_ID:'qa',CLOUD_SERVICE_NAME:'qa'},'./cloud-runtime':{waitForCloudRuntime:()=>ready.promise},'./session':session
})
pending=coldClient.requestJson('/mini/account/delete',{authenticated:true,method:'POST',data:{password:'Password123'}})
checked=assert.rejects(pending,/账号状态已变化/)
auth.logoutMiniAccount();session.saveMiniSession({...account,userId:'b',token:'b'})
ready.resolve();await checked;assert.equal(sent,0)
console.log('PASS: account request races, duplicate mutations, logout cache cleanup, stale login/bind/register and credential-vs-session errors')

function pageHarness(file,services){
  let cursor=0
  const slots=[],modals=[],navigation=[],toasts=[]
  const react={
    useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v}]},
    useRef(value){const i=cursor++;if(!(i in slots))slots[i]={current:value};return slots[i]}
  }
  const jsx=(type,props)=>({type,props})
  const Page=load(file,{
    react,'react/jsx-runtime':{jsx,jsxs:jsx},'@tarojs/components':new Proxy({},{get:(_,key)=>key}),
    '@tarojs/taro':{showModal:options=>{const m=deferred();modals.push({...m,options});return m.promise},showToast:options=>toasts.push(options),reLaunch:options=>navigation.push(options),navigateTo:options=>navigation.push(options),navigateBack:()=>{},useRouter:()=>({params:{}}),setClipboardData:async()=>{}},
    '../../services/mini-auth-service':services,'../../services/session':session,'./index.scss':{},'../../components/mini-icon':{default:'icon'},'../../components/auth-consent':{default:'consent'}
  }).default
  return{slots,modals,navigation,toasts,render(){cursor=0;return Page()}}
}
function find(tree,predicate){if(!tree||typeof tree!=='object')return null;if(predicate(tree))return tree;for(const child of [tree.props?.children].flat(Infinity)){const match=find(child,predicate);if(match)return match}return null}
const clicks={unbind:0,delete:0,logout:0,feedback:0}
let accountResponse=Promise.resolve({success:true})
const settings=pageHarness('miniprogram/src/pages/account-settings/index.tsx',{
  unbindWebsiteAccount:()=>{clicks.unbind++;return accountResponse},deleteMiniAccount:()=>{clicks.delete++;return accountResponse},
  logoutMiniAccount:()=>{clicks.logout++;auth.logoutMiniAccount()},submitMiniFeedback:async()=>{clicks.feedback++}
})
session.saveMiniSession(account)
const button=label=>find(settings.render(),n=>n.type==='Button'&&n.props.children===label)
await button('解除微信绑定').props.onClick();assert.equal(settings.modals.length,0,'password required before confirmation')
let tree=settings.render();find(tree,n=>n.props?.className==='settings-password').props.onInput({detail:{value:'Password123'}})
pending=button('永久注销账号').props.onClick()
button('永久注销账号').props.onClick();assert.equal(settings.modals.length,1,'rapid taps open only one confirmation')
settings.modals.at(-1).resolve({confirm:false});await pending;assert.equal(clicks.delete,0)
pending=button('永久注销账号').props.onClick();settings.modals.at(-1).resolve({confirm:true});await tick()
settings.modals.at(-1).resolve({confirm:false});await pending;assert.equal(clicks.delete,0,'cancel second confirmation sends no deletion')
// Switch account while confirmation is open: never apply it to the new account.
pending=button('解除微信绑定').props.onClick();session.saveMiniSession({...account,userId:'b',token:'b'})
settings.modals.at(-1).resolve({confirm:true});await pending;assert.equal(clicks.unbind,0)
session.saveMiniSession(account)
const failed=deferred();accountResponse=failed.promise
pending=button('永久注销账号').props.onClick();settings.modals.at(-1).resolve({confirm:true});await tick();settings.modals.at(-1).resolve({confirm:true});await tick()
failed.reject(Error('offline'));await pending;assert.equal(clicks.logout,0);assert.equal(session.getMiniUser().userId,'a')
accountResponse=Promise.resolve({success:true})
pending=button('解除微信绑定').props.onClick();settings.modals.at(-1).resolve({confirm:true});await pending
assert.equal(clicks.unbind,1);assert.equal(clicks.logout,1);assert.equal(settings.navigation.at(-1).url,'/pages/index/index')
assert.equal(session.getMiniSessionToken(),'')
// Form submission lock works before React re-renders, and tabs cannot change mid-request.
let forms=0;const formPending=deferred()
const bind=pageHarness('miniprogram/src/pages/account-bind/index.tsx',{
  loginWithWechat:async()=>{},bindWebsiteAccount:()=>{forms++;return formPending.promise},registerAndBindWebsiteAccount:async()=>{},requestPasswordReset:async()=>({})
})
session.saveMiniSession(account)
tree=bind.render();find(tree,n=>n.type==='consent').props.onChange(true)
find(tree,n=>n.type==='Input'&&n.props.placeholder==='name@example.com').props.onInput({detail:{value:'a@example.invalid'}})
find(tree,n=>n.type==='Input'&&n.props.placeholder==='输入 Haigoo 账号密码').props.onInput({detail:{value:'Password123'}})
tree=bind.render();const submit=find(tree,n=>n.type==='Button')
pending=submit.props.onClick();submit.props.onClick();await tick();assert.equal(forms,1)
find(tree,n=>n.props?.['aria-role']==='tab'&&n.props.children?.props?.children==='创建账号').props.onClick()
assert.equal(bind.slots[0],'bind','mode stays fixed during submission')
formPending.resolve({});await pending
console.log('PASS: account page password validation, both delete cancellations, confirmation account switch, duplicate taps, offline preservation, successful unbind/logout navigation and bind form submission lock')
