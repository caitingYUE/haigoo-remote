import assert from 'node:assert/strict'
import fs from 'node:fs'

const helper = fs.readFileSync('server-utils/user-helper.js', 'utf8')
const handler = fs.readFileSync('lib/api-handlers/users.js', 'utf8')
const page = fs.readFileSync('src/pages/UserManagementPage.tsx', 'utf8')
const types = fs.readFileSync('src/types/auth-types.ts', 'utf8')

assert.match(helper, /WITH mini_identity_summary AS/)
assert.match(helper, /LEFT JOIN mini_identity_summary mini ON mini\.user_id = u\.user_id/)
assert.match(helper, /accountSource: user\.account_source \|\| 'website'/)
assert.match(helper, /hasMiniAccount: user\.has_mini_account === true/)
assert.match(helper, /source === 'both'/)
assert.match(handler, /source: req\.query\.source/)
assert.match(types, /accountSource\?: 'website' \| 'both'/)
assert.match(page, /accountSourceLabel/)
assert.match(page, /已绑定小程序/)
assert.match(page, /source: sourceFilter/)
assert.match(page, /账号渠道/)

console.log('Admin Mini Program account source contracts passed')
