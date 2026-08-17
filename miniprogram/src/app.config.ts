export default defineAppConfig({
  lazyCodeLoading: 'requiredComponents',
  pages: [
    'pages/index/index',
    'pages/companies/index',
    'pages/growth/index',
    'pages/profile/index',
    'pages/company-detail/index',
    'pages/note-detail/index',
    'pages/consultation/index',
    'pages/membership/index',
    'pages/account-bind/index',
    'pages/account-settings/index',
    'pages/legal/index',
    'pages/payment-orders/index',
    'pages/career-data/index',
    'pages/community/index',
    'pages/web-view/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'Haigoo Remote',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f6f7fa'
  },
  tabBar: {
    custom: true,
    color: '#667386',
    selectedColor: '#C94F22',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/companies/index',
        text: '企业',
        iconPath: 'assets/icons/tab-companies.png',
        selectedIconPath: 'assets/icons/tab-companies-active.png'
      },
      {
        pagePath: 'pages/index/index',
        text: 'Match',
        iconPath: 'assets/icons/target.png',
        selectedIconPath: 'assets/icons/target.png'
      },
      {
        pagePath: 'pages/growth/index',
        text: '笔记',
        iconPath: 'assets/icons/tab-growth.png',
        selectedIconPath: 'assets/icons/tab-growth-active.png'
      }
    ]
  }
})
