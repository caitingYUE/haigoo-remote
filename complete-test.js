// 完整的历史推荐数据测试脚本
// 在浏览器控制台中运行此脚本来测试整个数据流

console.log('🚀 开始完整的历史推荐数据测试...');

// 1. 清理现有数据
function clearAllData() {
  console.log('🧹 清理现有数据...');
  localStorage.removeItem('haigoo_recommendation_history');
  console.log('✅ 数据已清理');
}

// 2. 生成测试数据
function generateCompleteTestData() {
  console.log('📝 生成测试数据...');
  
  const testJobs = [
    {
      id: 'test-job-1',
      title: '高级前端开发工程师',
      company: '阿里巴巴',
      location: '杭州',
      type: 'full-time',
      salary: '25-40k',
      description: '负责前端架构设计和开发',
      requirements: ['React', 'TypeScript', '3年以上经验'],
      responsibilities: ['前端架构设计', '代码审查', '团队协作'],
      skills: ['React', 'TypeScript', 'Node.js'],
      postedAt: new Date().toISOString(),
      source: 'test',
      experienceLevel: 'senior',
      category: 'engineering',
      isRemote: false,
      recommendationScore: 0.95
    },
    {
      id: 'test-job-2',
      title: 'React 开发工程师',
      company: '腾讯',
      location: '深圳',
      type: 'full-time',
      salary: '20-35k',
      description: '开发高质量的React应用',
      requirements: ['React', 'JavaScript', '2年以上经验'],
      responsibilities: ['功能开发', '性能优化', '用户体验提升'],
      skills: ['React', 'JavaScript', 'CSS'],
      postedAt: new Date().toISOString(),
      source: 'test',
      experienceLevel: 'mid',
      category: 'engineering',
      isRemote: true,
      recommendationScore: 0.88
    },
    {
      id: 'test-job-3',
      title: 'TypeScript 全栈工程师',
      company: '字节跳动',
      location: '北京',
      type: 'full-time',
      salary: '30-50k',
      description: '全栈开发，前后端技术栈',
      requirements: ['TypeScript', 'Node.js', '4年以上经验'],
      responsibilities: ['全栈开发', '系统设计', '技术选型'],
      skills: ['TypeScript', 'Node.js', 'React', 'Express'],
      postedAt: new Date().toISOString(),
      source: 'test',
      experienceLevel: 'senior',
      category: 'engineering',
      isRemote: false,
      recommendationScore: 0.92
    }
  ];

  // 生成三天的历史数据
  const dates = [];
  for (let i = 1; i <= 3; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }

  const historyData = dates.map((date, index) => ({
    date: date,
    jobs: testJobs.map(job => ({
      ...job,
      id: `${job.id}-${date}`,
      postedAt: new Date(date).toISOString()
    })),
    timestamp: new Date(date).getTime()
  }));

  // 存储到 localStorage
  localStorage.setItem('haigoo_recommendation_history', JSON.stringify(historyData));
  console.log('✅ 测试数据已生成并存储');
  console.log('📊 生成的数据:', historyData);
  
  return historyData;
}

// 3. 验证数据存储
function verifyDataStorage() {
  console.log('🔍 验证数据存储...');
  
  const storedData = localStorage.getItem('haigoo_recommendation_history');
  if (!storedData) {
    console.error('❌ 未找到存储的数据');
    return false;
  }
  
  try {
    const parsedData = JSON.parse(storedData);
    console.log('✅ 数据解析成功');
    console.log('📊 存储的数据结构:', parsedData);
    
    if (Array.isArray(parsedData) && parsedData.length === 3) {
      console.log('✅ 数据格式正确，包含3天的历史数据');
      
      parsedData.forEach((dayData, index) => {
        console.log(`📅 第${index + 1}天数据:`, {
          date: dayData.date,
          jobCount: dayData.jobs?.length || 0,
          timestamp: dayData.timestamp
        });
      });
      
      return true;
    } else {
      console.error('❌ 数据格式不正确');
      return false;
    }
  } catch (error) {
    console.error('❌ 数据解析失败:', error);
    return false;
  }
}

// 4. 检查页面状态
function checkPageState() {
  console.log('🔍 检查页面状态...');
  
  // 检查 React 应用是否存在
  const reactRoot = document.querySelector('#root');
  if (!reactRoot) {
    console.error('❌ 未找到 React 根元素');
    return false;
  }
  
  console.log('✅ React 应用已加载');
  
  // 检查是否有历史推荐相关的元素
  const historyElements = document.querySelectorAll('[class*="history"], [class*="past"], [class*="昨天"], [class*="前天"]');
  console.log(`📊 找到 ${historyElements.length} 个可能的历史推荐相关元素`);
  
  // 检查是否有"查看昨天推荐"按钮
  const viewHistoryButton = Array.from(document.querySelectorAll('button')).find(btn => 
    btn.textContent?.includes('查看昨天推荐') || btn.textContent?.includes('昨天推荐')
  );
  
  if (viewHistoryButton) {
    console.log('✅ 找到"查看昨天推荐"按钮');
    console.log('🎯 按钮元素:', viewHistoryButton);
  } else {
    console.log('⚠️ 未找到"查看昨天推荐"按钮，可能已经展开或页面结构不同');
  }
  
  return true;
}

// 5. 模拟点击查看历史推荐
function simulateViewHistory() {
  console.log('🖱️ 尝试模拟点击查看历史推荐...');
  
  const viewHistoryButton = Array.from(document.querySelectorAll('button')).find(btn => 
    btn.textContent?.includes('查看昨天推荐') || btn.textContent?.includes('昨天推荐')
  );
  
  if (viewHistoryButton) {
    console.log('🎯 找到按钮，模拟点击...');
    viewHistoryButton.click();
    
    // 等待一下让 React 重新渲染
    setTimeout(() => {
      console.log('🔍 检查点击后的页面状态...');
      
      const historyCards = document.querySelectorAll('[class*="RecommendationCard"], [class*="job-card"], .grid > div');
      console.log(`📊 找到 ${historyCards.length} 个可能的职位卡片`);
      
      const historyTitles = Array.from(document.querySelectorAll('h3')).filter(h3 => 
        h3.textContent?.includes('昨天推荐') || h3.textContent?.includes('前天推荐') || h3.textContent?.includes('大前天推荐')
      );
      console.log(`📊 找到 ${historyTitles.length} 个历史推荐标题`);
      
      if (historyTitles.length > 0) {
        console.log('✅ 历史推荐已成功显示！');
        historyTitles.forEach(title => {
          console.log('📅 显示的历史推荐:', title.textContent);
        });
      } else {
        console.log('⚠️ 未找到历史推荐标题，可能需要手动检查');
      }
    }, 1000);
  } else {
    console.log('⚠️ 未找到"查看昨天推荐"按钮，可能历史推荐已经显示或页面结构不同');
  }
}

// 6. 完整测试流程
function runCompleteTest() {
  console.log('🎯 开始完整测试流程...');
  console.log('='.repeat(50));
  
  // 步骤1: 清理数据
  clearAllData();
  
  // 步骤2: 生成测试数据
  const testData = generateCompleteTestData();
  
  // 步骤3: 验证数据存储
  const storageValid = verifyDataStorage();
  
  // 步骤4: 检查页面状态
  const pageValid = checkPageState();
  
  // 步骤5: 模拟查看历史推荐
  if (storageValid && pageValid) {
    setTimeout(() => {
      simulateViewHistory();
    }, 500);
  }
  
  console.log('='.repeat(50));
  console.log('🎯 测试完成！请检查页面上是否显示了历史推荐数据。');
  console.log('💡 如果没有显示，请尝试手动点击"查看昨天推荐"按钮。');
  
  return {
    dataGenerated: !!testData,
    storageValid,
    pageValid
  };
}

// 7. 数据检查工具
function inspectCurrentData() {
  console.log('🔍 检查当前数据状态...');
  
  const storedData = localStorage.getItem('haigoo_recommendation_history');
  if (storedData) {
    try {
      const data = JSON.parse(storedData);
      console.log('📊 当前存储的数据:', data);
      console.log('📈 数据统计:', {
        totalDays: data.length,
        totalJobs: data.reduce((sum, day) => sum + (day.jobs?.length || 0), 0),
        dates: data.map(day => day.date)
      });
    } catch (error) {
      console.error('❌ 数据解析错误:', error);
    }
  } else {
    console.log('⚠️ 未找到存储的历史推荐数据');
  }
}

// 导出函数供控制台使用
window.testHistoryRecommendations = {
  runCompleteTest,
  clearAllData,
  generateCompleteTestData,
  verifyDataStorage,
  checkPageState,
  simulateViewHistory,
  inspectCurrentData
};

console.log('✅ 测试脚本已加载！');
console.log('🎯 运行 testHistoryRecommendations.runCompleteTest() 开始完整测试');
console.log('🔍 运行 testHistoryRecommendations.inspectCurrentData() 检查当前数据');
console.log('🧹 运行 testHistoryRecommendations.clearAllData() 清理数据');