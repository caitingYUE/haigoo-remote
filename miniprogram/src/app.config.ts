export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/jobs/index',
    'pages/learning/index',
    'pages/profile/index',
    'pages/account-bind/index',
    'pages/account-settings/index',
    'pages/legal/index',
    'pages/activity/index',
    'pages/job-detail/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f8f8fc',
    navigationBarTitleText: 'Haigoo Remote',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f8f8fc'
  },
  tabBar: {
    color: '#8a92a6',
    selectedColor: '#5146e5',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '首页'
      },
      {
        pagePath: 'pages/jobs/index',
        text: '岗位'
      },
      {
        pagePath: 'pages/learning/index',
        text: '会员'
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的'
      }
    ]
  }
})
