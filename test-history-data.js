// 测试过往推荐功能的数据生成脚本
// 在浏览器控制台中运行此脚本来生成测试数据

function generateTestHistoryData() {
  const testJobs = [
    {
      id: 'test-1',
      title: 'Senior Frontend Developer',
      company: 'TechCorp',
      location: 'San Francisco, CA',
      type: 'Full-time',
      description: 'We are looking for a senior frontend developer...',
      requirements: ['React', 'TypeScript', '5+ years experience'],
      salary: '$120,000 - $150,000',
      postedDate: new Date().toISOString(),
      tags: ['React', 'TypeScript', 'Frontend'],
      category: 'Engineering',
      remote: true,
      experience: 'Senior',
      companySize: 'Large',
      benefits: ['Health Insurance', 'Remote Work'],
      applicationUrl: 'https://example.com/apply/1'
    },
    {
      id: 'test-2',
      title: 'Product Manager',
      company: 'StartupXYZ',
      location: 'New York, NY',
      type: 'Full-time',
      description: 'Join our product team...',
      requirements: ['Product Management', 'Analytics', '3+ years experience'],
      salary: '$100,000 - $130,000',
      postedDate: new Date().toISOString(),
      tags: ['Product', 'Management', 'Analytics'],
      category: 'Product',
      remote: false,
      experience: 'Mid-level',
      companySize: 'Startup',
      benefits: ['Equity', 'Flexible Hours'],
      applicationUrl: 'https://example.com/apply/2'
    },
    {
      id: 'test-3',
      title: 'Data Scientist',
      company: 'DataCorp',
      location: 'Seattle, WA',
      type: 'Full-time',
      description: 'Analyze large datasets...',
      requirements: ['Python', 'Machine Learning', 'Statistics'],
      salary: '$110,000 - $140,000',
      postedDate: new Date().toISOString(),
      tags: ['Python', 'ML', 'Data'],
      category: 'Data Science',
      remote: true,
      experience: 'Mid-level',
      companySize: 'Large',
      benefits: ['Health Insurance', 'Learning Budget'],
      applicationUrl: 'https://example.com/apply/3'
    }
  ];

  // 生成昨天的数据
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // 生成前天的数据
  const dayBeforeYesterday = new Date();
  dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
  const dayBeforeYesterdayStr = dayBeforeYesterday.toISOString().split('T')[0];

  // 生成大前天的数据
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];

  const historyData = [
    {
      date: yesterdayStr,
      jobs: testJobs.map(job => ({...job, id: job.id + '-yesterday'})),
      timestamp: yesterday.getTime()
    },
    {
      date: dayBeforeYesterdayStr,
      jobs: testJobs.map(job => ({...job, id: job.id + '-daybeforeyesterday', title: job.title + ' (前天)'})),
      timestamp: dayBeforeYesterday.getTime()
    },
    {
      date: threeDaysAgoStr,
      jobs: testJobs.map(job => ({...job, id: job.id + '-threedaysago', title: job.title + ' (大前天)'})),
      timestamp: threeDaysAgo.getTime()
    }
  ];

  // 保存到localStorage
  localStorage.setItem('haigoo_recommendation_history', JSON.stringify(historyData));
  
  console.log('测试数据已生成！');
  console.log('历史数据:', historyData);
  
  return historyData;
}

// 清理测试数据的函数
function clearTestHistoryData() {
  localStorage.removeItem('haigoo_recommendation_history');
  console.log('测试数据已清理！');
}

// 查看当前历史数据的函数
function viewHistoryData() {
  const data = localStorage.getItem('haigoo_recommendation_history');
  if (data) {
    console.log('当前历史数据:', JSON.parse(data));
  } else {
    console.log('没有历史数据');
  }
}

console.log('测试脚本已加载！');
console.log('使用 generateTestHistoryData() 生成测试数据');
console.log('使用 clearTestHistoryData() 清理测试数据');
console.log('使用 viewHistoryData() 查看当前数据');