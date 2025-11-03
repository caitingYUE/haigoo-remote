// 修正的测试数据生成脚本 - 确保格式与Job接口匹配
// 在浏览器控制台中运行此脚本

function generateCorrectTestData() {
  console.log('🔧 生成修正的测试数据...');
  
  // 清除现有数据
  localStorage.removeItem('haigoo_recommendation_history');
  
  // 创建符合Job接口的测试职位数据
  const createTestJob = (id, title, company, dayOffset = 0) => {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    
    return {
      id: id,
      title: title,
      company: company,
      location: '北京',
      type: 'full-time', // 必须是 'full-time' | 'part-time' | 'contract' | 'remote' | 'freelance' | 'internship'
      salary: {
        min: 15000,
        max: 25000,
        currency: 'CNY'
      },
      description: `这是一个${title}的职位描述。我们正在寻找有经验的候选人加入我们的团队。`,
      requirements: ['相关工作经验', '良好的沟通能力', '团队合作精神'],
      responsibilities: ['负责日常工作任务', '参与项目开发', '与团队协作'],
      skills: ['JavaScript', 'React', 'TypeScript'],
      postedAt: date.toISOString().split('T')[0], // YYYY-MM-DD 格式
      source: '测试数据',
      sourceUrl: 'https://example.com',
      experienceLevel: 'Mid',
      category: '前端开发',
      isRemote: true,
      recommendationScore: 85 + Math.floor(Math.random() * 15) // 85-100
    };
  };
  
  // 生成历史数据
  const historyData = [];
  
  // 昨天的数据
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  
  historyData.push({
    date: yesterdayStr,
    jobs: [
      createTestJob('yesterday-1', '前端开发工程师 (昨天)', '科技公司A', 1),
      createTestJob('yesterday-2', '产品经理 (昨天)', '互联网公司B', 1),
      createTestJob('yesterday-3', 'UI设计师 (昨天)', '设计公司C', 1)
    ],
    timestamp: yesterday.getTime()
  });
  
  // 前天的数据
  const dayBeforeYesterday = new Date();
  dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
  const dayBeforeYesterdayStr = dayBeforeYesterday.toISOString().split('T')[0];
  
  historyData.push({
    date: dayBeforeYesterdayStr,
    jobs: [
      createTestJob('daybeforeyesterday-1', '后端开发工程师 (前天)', '科技公司D', 2),
      createTestJob('daybeforeyesterday-2', '数据分析师 (前天)', '数据公司E', 2)
    ],
    timestamp: dayBeforeYesterday.getTime()
  });
  
  // 大前天的数据
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
  
  historyData.push({
    date: threeDaysAgoStr,
    jobs: [
      createTestJob('threedaysago-1', '全栈开发工程师 (大前天)', '创业公司F', 3),
      createTestJob('threedaysago-2', '项目经理 (大前天)', '咨询公司G', 3),
      createTestJob('threedaysago-3', 'DevOps工程师 (大前天)', '云服务公司H', 3)
    ],
    timestamp: threeDaysAgo.getTime()
  });
  
  // 保存到localStorage
  localStorage.setItem('haigoo_recommendation_history', JSON.stringify(historyData));
  
  console.log('✅ 修正的测试数据已生成！');
  console.log('历史数据:', historyData);
  console.log('数据格式验证:');
  
  // 验证数据格式
  historyData.forEach((dayData, index) => {
    console.log(`第${index + 1}天 (${dayData.date}):`, dayData.jobs.length, '个职位');
    dayData.jobs.forEach((job, jobIndex) => {
      console.log(`  职位${jobIndex + 1}:`, job.title, '- ID:', job.id);
      console.log(`    公司: ${job.company}, 类型: ${job.type}, 远程: ${job.isRemote}`);
    });
  });
  
  return historyData;
}

// 验证localStorage数据的函数
function verifyStoredData() {
  console.log('🔍 验证存储的数据...');
  
  const stored = localStorage.getItem('haigoo_recommendation_history');
  if (!stored) {
    console.log('❌ 没有找到存储的数据');
    return false;
  }
  
  try {
    const parsed = JSON.parse(stored);
    console.log('✅ 数据解析成功');
    console.log('数据条数:', parsed.length);
    
    parsed.forEach((dayData, index) => {
      console.log(`日期 ${index + 1}: ${dayData.date} (${dayData.jobs.length} 个职位)`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ 数据解析失败:', error);
    return false;
  }
}

// 检查页面渲染的函数
function checkPageRendering() {
  console.log('🔍 检查页面渲染...');
  
  // 检查历史推荐按钮
  const historyButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
    btn.textContent.includes('昨天推荐') || 
    btn.textContent.includes('前天推荐') || 
    btn.textContent.includes('大前天推荐')
  );
  
  console.log('找到历史推荐按钮:', historyButtons.length);
  historyButtons.forEach((btn, index) => {
    console.log(`按钮 ${index + 1}:`, btn.textContent.trim());
  });
  
  // 检查是否有展开的历史推荐内容
  const historyHeaders = Array.from(document.querySelectorAll('h3')).filter(h3 => 
    h3.textContent.includes('昨天推荐') || 
    h3.textContent.includes('前天推荐') || 
    h3.textContent.includes('大前天推荐')
  );
  
  console.log('找到历史推荐标题:', historyHeaders.length);
  
  if (historyHeaders.length === 0) {
    console.log('💡 提示: 请点击"查看昨天推荐"按钮来展开历史推荐内容');
  }
  
  return {
    buttons: historyButtons.length,
    headers: historyHeaders.length
  };
}

// 完整测试流程
function runCompleteTest() {
  console.log('🚀 开始完整测试流程...');
  
  // 1. 生成数据
  const data = generateCorrectTestData();
  
  // 2. 验证存储
  const isStored = verifyStoredData();
  
  // 3. 检查页面
  const pageStatus = checkPageRendering();
  
  console.log('\n📊 测试结果总结:');
  console.log('- 数据生成:', data ? '✅ 成功' : '❌ 失败');
  console.log('- 数据存储:', isStored ? '✅ 成功' : '❌ 失败');
  console.log('- 页面按钮:', pageStatus.buttons > 0 ? '✅ 找到' : '❌ 未找到');
  console.log('- 展开内容:', pageStatus.headers > 0 ? '✅ 已展开' : '⚠️ 未展开');
  
  if (isStored && pageStatus.buttons > 0 && pageStatus.headers === 0) {
    console.log('\n💡 下一步: 请点击"查看昨天推荐"按钮来查看历史推荐内容');
  }
  
  return {
    dataGenerated: !!data,
    dataStored: isStored,
    buttonsFound: pageStatus.buttons > 0,
    contentExpanded: pageStatus.headers > 0
  };
}

// 导出函数到全局
window.generateCorrectTestData = generateCorrectTestData;
window.verifyStoredData = verifyStoredData;
window.checkPageRendering = checkPageRendering;
window.runCompleteTest = runCompleteTest;

console.log('✅ 修正的测试脚本已加载！');
console.log('');
console.log('可用函数:');
console.log('- generateCorrectTestData() - 生成修正的测试数据');
console.log('- verifyStoredData() - 验证存储的数据');
console.log('- checkPageRendering() - 检查页面渲染状态');
console.log('- runCompleteTest() - 运行完整测试流程');
console.log('');
console.log('🚀 运行 runCompleteTest() 开始完整测试');