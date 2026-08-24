import assert from 'node:assert/strict'
import fs from 'node:fs'

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

const adminTeam = read('../src/pages/AdminTeamPage.tsx')
const adminMini = read('../src/pages/AdminMiniProgramPage.tsx')
const adminMiniApi = read('../api/admin/mini-notes.js')
const localServer = read('../local-server.js')
const miniGateway = read('../lib/api-handlers/mini-gateway.js')
const userApi = read('../lib/api-handlers/users.js')
const userHelper = read('../server-utils/user-helper.js')
const userPage = read('../src/pages/UserManagementPage.tsx')

for (const required of [
  "lazy(() => import('./AdminMiniProgramPage'))",
  "'mini-program'",
  "activeTab === 'mini-program'"
]) {
  assert.ok(adminTeam.includes(required), `admin navigation is missing ${required}`)
}

assert.ok(adminMini.includes('listMiniNotes'), 'mini admin page must load the canonical notes list')
assert.ok(adminMini.includes('saveMiniNote'), 'mini admin page must save through the canonical notes API')
assert.ok(adminMiniApi.includes('requireAdmin'), 'mini notes API must require an administrator')
assert.ok(adminMiniApi.includes('career-growth-notes-service'), 'mini notes API must use the canonical notes service')
assert.ok(localServer.includes("app.all('/api/admin/mini-notes'"), 'local API routing must include mini notes')

for (const action of ['content_home', 'companies', 'growth_notes', 'membership_plans', 'match_feed']) {
  assert.match(miniGateway, new RegExp(`['"]${action}['"]`), `production mini gateway must expose ${action}`)
}

assert.ok(userApi.includes('source: req.query.source'), 'user API must forward the account-source filter')
assert.ok(userHelper.includes('mini_wechat_identities'), 'user list must join mini identities')
assert.ok(userHelper.includes("account_source = 'both'"), 'user list must distinguish bound mini accounts')
assert.ok(userPage.includes('sourceFilter'), 'user management must expose account-source filtering')
assert.ok(userPage.includes('官网 + 小程序'), 'user management must label bound accounts')

console.log('admin release contract checks passed')
