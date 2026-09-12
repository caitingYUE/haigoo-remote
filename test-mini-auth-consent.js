import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'

const read = (path) => fs.readFileSync(path, 'utf8')
function load(path, dependencies) {
  const module = { exports: {} }
  vm.runInNewContext(ts.transpileModule(read(path), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX
  } }).outputText, { module, exports: module.exports, Date, require: (key) => {
    assert.ok(key in dependencies, `Unexpected dependency: ${key}`)
    return dependencies[key]
  } })
  return module.exports
}

// Isolated test doubles: no real login, business records or emails.
let token = '', authenticated = false
const calls = [], saved = []
const legal = load('miniprogram/src/config/legal.ts', {})
const auth = load('miniprogram/src/services/mini-auth-service.ts', {
  '@tarojs/taro': { default: { login: async () => { calls.push('wechat'); return { code: 'test-only' } } } },
  './api-client': { requestJson: async (path, options) => { calls.push({ path, options }); return { token: 'test-only', user: { userId: 'test-only' } } } },
  './analytics-service': { trackMiniEvent: async () => {} },
  './session': { clearMiniSession: () => {}, getMiniSessionToken: () => token, hasAuthenticatedSession: () => authenticated, saveMiniSession: (session) => saved.push(session) },
  '../config/legal': legal
})
for (token of ['', 'existing-session']) {
  for (const operation of [
    () => auth.loginWithWechat(),
    () => auth.bindWebsiteAccount('test@example.com', 'password'),
    () => auth.registerAndBindWebsiteAccount('test@example.com', 'password'),
    () => auth.requestPasswordReset('test@example.com')
  ]) await assert.rejects(operation(), /请先阅读并同意/)
}
assert.equal(calls.length, 0, 'missing consent must block WeChat and all network calls, even with a cached token')
assert.equal(saved.length, 0)
await assert.rejects(auth.refreshWechatSession(), /请先登录/)
assert.equal(calls.length, 0, 'refresh must not provide a guest-login bypass')
await auth.loginWithWechat(true)
assert.equal(calls[0], 'wechat')
await auth.bindWebsiteAccount('test@example.com', 'password', true)
await auth.requestPasswordReset('test@example.com', true)
token = ''
await auth.registerAndBindWebsiteAccount('test@example.com', 'password', undefined, true)
const registration = calls.find((call) => call.path === '/mini/account/register')
assert.equal(registration.options.data.privacyVersion, '2026-09-06')
assert.equal(registration.options.data.agreementVersion, legal.MINI_AGREEMENT_VERSION)
authenticated = true
await auth.refreshWechatSession()

const jsx = (type, props) => ({ type, props })
const navigation = [], checked = []
const Consent = load('miniprogram/src/components/auth-consent/index.tsx', {
  'react/jsx-runtime': { jsx, jsxs: jsx },
  '@tarojs/components': Object.fromEntries(['Checkbox', 'CheckboxGroup', 'Label', 'Text', 'View'].map((name) => [name, name])),
  '@tarojs/taro': { navigateTo: (args) => navigation.push(args.url) }, './index.scss': {}
}).default
const tree = Consent({ accepted: false, onChange: (value) => checked.push(value) })
const [group, links] = tree.props.children
assert.equal(group.props.children.props.children[0].props.checked, false)
links.props.children[0].props.onClick()
links.props.children[2].props.onClick()
assert.deepEqual(navigation, ['/pages/legal/index?type=terms', '/pages/legal/index?type=privacy'])
assert.equal(checked.length, 0, 'reading policies never implies consent')
group.props.onChange({ detail: { value: ['accepted'] } })
group.props.onChange({ detail: { value: [] } })
assert.deepEqual(checked, [true, false])

// Exercise each account form handler before and after checking the checkbox.
for (const mode of ['bind', 'register', 'forgot']) {
  for (const accepted of [false, true]) {
    let stateIndex = 0, writes = 0, wechatCalls = 0
    const states = [mode, 'test@example.com', 'Password123', 'Password123', '', false, false, false, accepted]
    const Page = load('miniprogram/src/pages/account-bind/index.tsx', {
      'react/jsx-runtime': { jsx, jsxs: jsx },
      react: { useState: () => [states[stateIndex++], () => {}] },
      '@tarojs/components': Object.fromEntries(['Button', 'Input', 'Text', 'View'].map((name) => [name, name])),
      '@tarojs/taro': { useRouter: () => ({ params: {} }), navigateBack: () => {}, showToast: () => {}, showModal: () => {} },
      '../../services/mini-auth-service': { loginWithWechat: async (consent) => { assert.equal(consent, true); wechatCalls++ },
        bindWebsiteAccount: async (...args) => { assert.equal(args[2], true); writes++ },
        registerAndBindWebsiteAccount: async (...args) => { assert.equal(args[3], true); writes++ },
        requestPasswordReset: async (...args) => { assert.equal(args[1], true); writes++; return {} } },
      '../../services/session': { getMiniSessionToken: () => '' },
      '../../components/mini-icon': { default: () => null }, '../../components/auth-consent': { default: Consent }, './index.scss': {}
    }).default
    const page = Page()
    const button = page.props.children[1].props.children.find((child) => child?.type === 'Button')
    await button.props.onClick()
    assert.equal(writes, accepted ? 1 : 0, `${mode}: consent before account request`)
    assert.equal(wechatCalls, accepted ? 1 : 0, `${mode}: consent before WeChat login`)
  }
}
for (const file of ['index/career-watch-page.tsx', 'consultation/index.tsx']) {
  const page = read(`miniprogram/src/pages/${file}`)
  assert.doesNotMatch(page, /loginWithWechat/)
  assert.match(page, /pages\/profile\/index/)
}
const gateway = read('lib/api-handlers/mini-gateway.js')
const versionBlock = gateway.match(/const PRIVACY_VERSION = '[^']+'[\s\S]*?const SUPPORTED_PRIVACY_VERSIONS = new Set\([^\n]+\)/)[0]
const versions = vm.runInNewContext(`${versionBlock}; SUPPORTED_PRIVACY_VERSIONS`)
assert.ok(versions.has(legal.MINI_PRIVACY_VERSION))
assert.ok(versions.has('2026-07-29'), 'rolling deployment keeps previously installed clients working')
assert.equal(versions.has(''), false)
assert.equal(versions.has('invented-version'), false)
assert.equal((gateway.match(/!SUPPORTED_PRIVACY_VERSIONS.has\(privacyVersion\)/g) || []).length, 3)
const policy = read('miniprogram/src/pages/legal/index.tsx')
for (const text of ['邮箱的收集与使用', 'Resend', '密码重置', '会员生效', '失效', '营销', '保存期限', '解除微信绑定不会删除网站账号邮箱']) assert.ok(policy.includes(text), text)
console.log('PASS: auth consent blocks all unauthorised submissions; links, form modes, refresh and policy version compatibility verified.')
