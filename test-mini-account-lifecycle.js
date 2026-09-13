import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import ts from 'typescript'
import { pathToFileURL } from 'node:url'
import * as helpers from './server-utils/auth-helpers.js'

// Real production function bodies + real PostgreSQL SQL, isolated storage and mail.
// No environment files, production connections, real WeChat identities or outgoing mail.
const entry = process.argv.find(a => a.startsWith('--pglite='))?.slice(9)
assert.ok(entry, 'Supply --pglite=/test-only/pglite/dist/index.js')
const { PGlite } = await import(pathToFileURL(entry))
const db = new PGlite()
const read = file => fs.readFileSync(file, 'utf8')
function functions(file, names, dependencies) {
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true)
  const selected = source.statements.filter(n => ts.isFunctionDeclaration(n) && names.includes(n.name?.text))
  assert.equal(selected.length, names.length)
  return vm.runInNewContext(`${selected.map(n => n.getText(source)).join('\n')}; ({${names.join(',')}})`, {
    ...dependencies, console: { log() {}, warn() {}, error() {} }, Buffer, crypto, Date, Set,
    process: { env: { WECHAT_MINI_APP_ID: 'qa-app' } },
    fetch() { throw Error('Network forbidden in account lifecycle tests') }
  })
}
const q = async (sql, params) => (await db.query(sql, params)).rows
let refuseLink = false, rateAllowed = true, mailFails = false
const mail = []
const neonHelper = { isConfigured: true, query: async (sql, params) => {
  if (refuseLink && sql.includes('INSERT INTO mini_wechat_identities')) return []
  return q(sql, params)
} }
const normalize = user => user && ({ ...user, userId: user.user_id, passwordHash: user.password_hash, emailVerified: user.email_verified, verificationExpires: user.verification_expires })
const getUserById = async id => normalize((await q('SELECT payload FROM users WHERE user_id=$1', [id]))[0]?.payload)
const getUserByEmail = async email => normalize((await q('SELECT payload FROM users WHERE email=$1', [email]))[0]?.payload)
const saveUser = async user => { await q('INSERT INTO users VALUES ($1,$2,$3)', [user.user_id,user.email,JSON.stringify(user)]); return { success: true } }
const updateUser = async (id, updates) => {
  const user = await getUserById(id)
  if (!user) return { success: false }
  const aliases = { passwordHash: 'password_hash', emailVerified: 'email_verified', verificationToken: 'verification_token', verificationExpires: 'verification_expires', resetToken: 'reset_token', resetExpires: 'reset_expires' }
  for (const [k,v] of Object.entries(updates)) user[aliases[k] || k] = v
  await q('UPDATE users SET payload=$2 WHERE user_id=$1', [id, JSON.stringify(user)])
  return { success: true }
}
const rateLimit = async (_req,res) => { if (!rateAllowed) res.status(429).json({ error: '操作频繁' }); return { allowed: rateAllowed, keyHashes: [] } }
const response = () => ({ statusCode: 200, status(code) { this.statusCode=code; return this }, json(value) { this.payload=value; return this }, end() {}, setHeader() {} })
const call = async (fn,body={}) => { const res=response(); await fn({ method:'POST',body,query:{},headers:{} },res); return res }
try {
  await db.exec(`CREATE TABLE users(user_id varchar PRIMARY KEY, email text UNIQUE, payload jsonb);
    CREATE TABLE admin_messages(type text,title text,content text);
    CREATE TABLE deleted_account_locks(email text,user_id text,blocked_until timestamptz,reason text,created_at timestamptz,updated_at timestamptz);
    CREATE TABLE mini_job_views(app_id text,openid text);
    CREATE TABLE mini_career_profiles(user_id varchar REFERENCES users ON DELETE CASCADE,data text);`)
  await db.exec(read('server-utils/dal/migrations/054_mini_wechat_identities.sql'))
  await db.exec(read('server-utils/dal/migrations/056_mini_launch_readiness.sql'))
  const deletionSource=read('server-utils/user-helper.js')
  const start=deletionSource.indexOf('    async deleteUserById(userId) {')
  const method=deletionSource.slice(start,deletionSource.indexOf('\n    /**',start)).trim().replace(/,$/,'')
  for (const table of [...method.matchAll(/DELETE FROM (\w+) WHERE user_id/g)].map(m=>m[1])) {
    if(table !== 'users') await db.exec(`CREATE TABLE IF NOT EXISTS ${table}(user_id varchar, data text)`)
  }
  const userHelper={ getUserById,getUserByEmail }
  Object.assign(userHelper,vm.runInNewContext(`({${method}})`, { neonHelper, isSuperAdminEmail: email=>email==='protected@example.invalid', console:{log(){},warn(){},error(){}} }))
  const profileSource=ts.createSourceFile('profile.js',read('lib/api-handlers/user-profile.js'),ts.ScriptTarget.Latest,true)
  let deleteBlock
  const visit=n=>{ if(ts.isIfStatement(n) && n.expression.getText(profileSource)==="action === 'delete_account' && req.method === 'POST'") deleteBlock=n.thenStatement.getText(profileSource); ts.forEachChild(n,visit) }
  visit(profileSource); assert.ok(deleteBlock)
  const deleteHandler=vm.runInNewContext(`(async function(req,res,user) ${deleteBlock})`, { neonHelper,NEON_CONFIGURED:true,deleteUserById:id=>userHelper.deleteUserById(id),console:{log(){},warn(){},error(){}} })
  const auth=functions('api/auth.js',['handleRegister','handleLogin','handleVerifyEmail','handleResendVerification','handleRequestPasswordReset','handleResetPassword','hashPasswordResetToken','matchesPasswordResetToken'],{
    ...helpers,neonHelper,getUserById,getUserByEmail,saveUser,updateUser,
    consumeAuthRateLimit:rateLimit,clearAuthRateLimit:async()=>{},isSuperAdminEmail:()=>false,
    getActiveDeletedAccountLock:async email=>(await q('SELECT * FROM deleted_account_locks WHERE email=$1 AND blocked_until>NOW()',[email]))[0],
    buildDeletedAccountLockMessage:()=> '注销后30天内不能注册',isEmailServiceConfigured:()=>true,
    sendVerificationEmail:async(email,_name,token)=>{if(mailFails)throw Error('mail offline');mail.push({type:'verify',email,token})},
    sendPasswordResetEmail:async(email,_name,token)=>{if(mailFails)throw Error('mail offline');mail.push({type:'reset',email,token})}
  })
  const gateway=functions('lib/api-handlers/mini-gateway.js',['handleSession','handleBind','handleRegister','handleRequestPasswordReset','handleUnbind','handleDeleteAccount','validateAccountPassword','requireBoundUser','getIdentityUser','userSummary','getIdentity','normalizeEmail','isOpenId','ensureDatabase','captureResponse','invoke'],{
    ...helpers,neonHelper,userHelper,IDENTITY_TABLE:'mini_wechat_identities',CONSENTS_TABLE:'mini_account_consents',
    AGREEMENT_VERSION:'2026-07-29',SUPPORTED_PRIVACY_VERSIONS:new Set(['2026-09-06']),consumeRateLimit:rateLimit,clearRateLimit:async()=>{},
    deriveMembershipCapabilities:user=>({isActive:!!user.isMember,memberTier:'test'}),getContinuousMembershipExpireAt:async user=>user.memberExpireAt||null,
    authHandler:async(req,res)=>auth[req.query.action==='register'?'handleRegister':'handleRequestPasswordReset'](req,res),
    userProfileHandler:async(req,res)=>deleteHandler(req,res,await getUserById(helpers.verifyToken(req.headers.authorization.slice(7)).userId))
  })
  const registration=(openid,email)=>({openid,email,password:'Password123',agreementVersion:'2026-07-29',privacyVersion:'2026-09-06',acceptedAt:new Date().toISOString()})
  assert.equal((await call(gateway.handleRegister,{...registration('wechat-a','a@example.invalid'),privacyVersion:''})).statusCode,400)
  assert.equal((await call(gateway.handleRegister,{...registration('wechat-a','a@example.invalid'),password:'short'})).statusCode,400)
  assert.equal((await q('SELECT * FROM users')).length,0)
  const registered=await call(gateway.handleRegister,registration('wechat-a',' A@Example.Invalid '))
  assert.equal(registered.statusCode,201)
  const a=registered.payload.user.userId
  assert.ok(a);assert.equal(mail.length,1)
  assert.equal((await q('SELECT * FROM mini_account_consents WHERE user_id=$1',[a])).length,1)
  assert.equal((await call(gateway.handleSession,{openid:'wechat-a'})).payload.user.userId,a)
  await q('INSERT INTO favorites VALUES ($1,$2)',[a,'keep-me'])
  await q('INSERT INTO mini_career_profiles VALUES ($1,$2)',[a,'private-a'])
  await updateUser(a,{isMember:true,verificationExpires:'2000-01-01T00:00:00Z'})
  assert.equal((await call(gateway.handleRegister,registration('wechat-b','a@example.invalid'))).statusCode,409)
  assert.equal((await getUserById(a)).isMember,true,'duplicate expired-unverified registration never replaces account')
  assert.equal((await q('SELECT * FROM favorites WHERE user_id=$1',[a])).length,1)
  assert.equal((await call(gateway.handleBind,{openid:'wechat-b',email:'a@example.invalid',password:'wrong'})).payload.code,'INVALID_CREDENTIALS')
  assert.equal((await call(gateway.handleBind,{openid:'wechat-b',email:'a@example.invalid',password:'Password123'})).statusCode,409)
  const identityBefore=JSON.stringify(await q('SELECT * FROM mini_wechat_identities'))
  assert.equal((await call(gateway.handleUnbind,{openid:'wechat-a',password:'wrong'})).statusCode,401)
  assert.equal((await call(gateway.handleDeleteAccount,{openid:'wechat-a',password:'Password123',expectedUserId:'other'})).statusCode,409)
  assert.equal(JSON.stringify(await q('SELECT * FROM mini_wechat_identities')),identityBefore)
  assert.equal((await call(gateway.handleUnbind,{openid:'wechat-a',password:'Password123'})).statusCode,200)
  assert.equal((await call(gateway.handleSession,{openid:'wechat-a'})).payload.bound,false)
  assert.equal((await getUserById(a)).isMember,true)
  assert.equal((await q('SELECT * FROM favorites WHERE user_id=$1',[a])).length,1)
  assert.equal((await call(gateway.handleBind,{openid:'wechat-b',email:'a@example.invalid',password:'Password123'})).statusCode,200)
  assert.equal((await call(gateway.handleUnbind,{openid:'wechat-a',password:'Password123'})).statusCode,401)
  await updateUser(a,{status:'disabled'})
  assert.equal((await call(gateway.handleSession,{openid:'wechat-b'})).statusCode,403)
  assert.equal((await call(gateway.handleDeleteAccount,{openid:'wechat-b',password:'Password123'})).statusCode,403)
  await updateUser(a,{status:'active'})
  rateAllowed=false
  assert.equal((await call(gateway.handleUnbind,{openid:'wechat-b',password:'Password123'})).statusCode,429)
  rateAllowed=true
  // Email verification, reset and reverse login with the old/new passwords.
  assert.equal((await call(auth.handleVerifyEmail,{email:'a@example.invalid',token:mail[0].token})).statusCode,400)
  await call(auth.handleResendVerification,{email:'a@example.invalid'})
  assert.equal((await call(auth.handleVerifyEmail,{email:'a@example.invalid',token:mail.at(-1).token})).statusCode,200)
  assert.equal((await getUserById(a)).email_verified,true)
  const resetExisting=await call(gateway.handleRequestPasswordReset,{openid:'wechat-b',email:'a@example.invalid'})
  const resetUnknown=await call(gateway.handleRequestPasswordReset,{openid:'wechat-b',email:'missing@example.invalid'})
  assert.deepEqual(resetExisting.payload,resetUnknown.payload)
  const reset=mail.at(-1).token
  assert.notEqual((await getUserById(a)).reset_token,reset,'store hash only')
  assert.equal((await call(auth.handleResetPassword,{email:'a@example.invalid',token:'wrong',newPassword:'NewPassword456'})).statusCode,400)
  assert.equal((await call(auth.handleResetPassword,{email:'a@example.invalid',token:reset,newPassword:'NewPassword456'})).statusCode,200)
  assert.equal((await call(auth.handleResetPassword,{email:'a@example.invalid',token:reset,newPassword:'AgainPassword789'})).statusCode,400)
  assert.equal((await call(auth.handleLogin,{email:'a@example.invalid',password:'Password123'})).statusCode,401)
  assert.equal((await call(auth.handleLogin,{email:'a@example.invalid',password:'NewPassword456'})).statusCode,200)
  // Registration mail outage cannot roll back/duplicate an already created account.
  mailFails=true
  const bRegistration=await call(gateway.handleRegister,registration('wechat-c','b@example.invalid'))
  assert.equal(bRegistration.statusCode,201);const b=bRegistration.payload.user.userId
  assert.match(bRegistration.payload.message,/暂时未发出/)
  mailFails=false
  await q('INSERT INTO favorites VALUES ($1,$2)',[b,'keep-b'])
  // Real guarded UPSERT with stale pre-check results: a second identity cannot be overwritten.
  const gatewaySource=read('lib/api-handlers/mini-gateway.js')
  const bindSql= gatewaySource.slice(gatewaySource.indexOf('async function handleBind'),gatewaySource.indexOf('async function handleRegister')).match(/`INSERT INTO \$\{IDENTITY_TABLE\}[\s\S]*?`/)[0].slice(1,-1).replaceAll('${IDENTITY_TABLE}','mini_wechat_identities')
  await call(gateway.handleUnbind,{openid:'wechat-c',password:'Password123'})
  assert.equal((await q(bindSql,['qa-app','wechat-b',b])).length,0)
  assert.equal((await q('SELECT user_id FROM mini_wechat_identities WHERE openid=$1',['wechat-b']))[0].user_id,a)
  const registerSql=gatewaySource.slice(gatewaySource.indexOf('async function handleRegister'),gatewaySource.indexOf('async function handleRequestPasswordReset')).match(/`WITH linked_identity[\s\S]*?`/)[0].slice(1,-1).replaceAll('${IDENTITY_TABLE}','mini_wechat_identities').replaceAll('${CONSENTS_TABLE}','mini_account_consents')
  assert.equal((await q(registerSql,['qa-app','wechat-b',b,'2026-07-29','2026-09-06'])).length,0)
  assert.equal((await q('SELECT user_id FROM mini_wechat_identities WHERE openid=$1',['wechat-b']))[0].user_id,a)
  refuseLink=true
  assert.equal((await call(gateway.handleBind,{openid:'wechat-c',email:'b@example.invalid',password:'Password123'})).statusCode,409)
  refuseLink=false
  // Force a database failure halfway through deletion: all records roll back.
  await db.exec(`CREATE FUNCTION fail_qa_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test deletion failure'; END; $$;
    CREATE TRIGGER fail_delete BEFORE DELETE ON favorites FOR EACH ROW EXECUTE FUNCTION fail_qa_delete();`)
  assert.equal((await call(gateway.handleDeleteAccount,{openid:'wechat-b',password:'NewPassword456'})).statusCode,500)
  assert.ok(await getUserById(a)); assert.equal((await q('SELECT * FROM mini_career_profiles WHERE user_id=$1',[a])).length,1)
  assert.equal((await q('SELECT * FROM deleted_account_locks WHERE user_id=$1',[a])).length,0)
  await db.exec('DROP TRIGGER fail_delete ON favorites')
  assert.equal((await call(gateway.handleDeleteAccount,{openid:'wechat-b',password:'NewPassword456'})).statusCode,200)
  assert.equal(await getUserById(a),undefined)
  for(const table of ['mini_wechat_identities','mini_account_consents','mini_career_profiles','favorites']) assert.equal((await q(`SELECT * FROM ${table} WHERE user_id=$1`,[a])).length,0)
  assert.ok(await getUserById(b));assert.equal((await q('SELECT * FROM favorites WHERE user_id=$1',[b])).length,1)
  assert.equal((await call(gateway.handleRegister,registration('wechat-d','a@example.invalid'))).statusCode,403)
  assert.equal((await call(gateway.handleSession,{openid:'wechat-b'})).payload.bound,false)
  await q("UPDATE deleted_account_locks SET blocked_until=NOW()-INTERVAL '1 day' WHERE user_id=$1",[a])
  const afterCooldown=await call(gateway.handleRegister,registration('wechat-d','a@example.invalid'))
  assert.equal(afterCooldown.statusCode,201)
  assert.notEqual(afterCooldown.payload.user.userId,a)
  assert.equal((await q('SELECT * FROM favorites WHERE user_id=$1',[afterCooldown.payload.user.userId])).length,0)
  console.log('PASS: isolated PostgreSQL lifecycle — registration, consent, duplicate protection, login, verification/reset, bind conflicts, guarded UPSERT, unbind/rebind, inactive users, throttling, delete rollback/cascade, other-account isolation and 30-day lock; no live user data or email.')
} finally { await db.close() }
