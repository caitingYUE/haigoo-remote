export const MINI_SMOKE_FIXTURES = Object.freeze({
  unused: Object.freeze({
    userId: '00000000-0000-4000-8000-000000000101',
    openid: 'smoke_preview_unused_202608',
    email: 'mini-smoke-unused@invalid.test'
  }),
  fixed: Object.freeze({
    userId: '00000000-0000-4000-8000-000000000102',
    openid: 'smoke_preview_fixed_202608',
    email: 'mini-smoke-fixed@invalid.test'
  }),
  member: Object.freeze({
    userId: '00000000-0000-4000-8000-000000000103',
    openid: 'smoke_preview_member_202608',
    email: 'mini-smoke-member@invalid.test'
  })
})

export const MINI_SMOKE_DIRECTION = Object.freeze({
  sourceMode: 'manual',
  roleFamilies: ['engineering'],
  customRoleTerms: [],
  companyPreferences: {},
  activePreferenceKeys: [],
  toleranceMode: 'balanced',
  status: 'active'
})
