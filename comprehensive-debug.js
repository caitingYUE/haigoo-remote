// 全面调试过往推荐功能
// 在浏览器控制台中运行此脚本

function comprehensiveDebug() {
  console.log('=== 🔍 全面调试过往推荐功能 ===');
  
  // 1. 检查 localStorage 数据
  console.log('\n📦 1. 检查 localStorage 数据:');
  const historyKey = 'haigoo_recommendation_history';
  const historyData = localStorage.getItem(historyKey);
  
  if (historyData) {
    try {
      const parsed = JSON.parse(historyData);
      console.log(`✅ 找到历史数据，共 ${parsed.length} 条记录`);
      
      parsed.forEach((item, index) => {
        console.log(`   ${index + 1}. 日期: ${item.date}`);
        console.log(`      职位数量: ${item.jobs?.length || 0}`);
        console.log(`      时间戳: ${new Date(item.timestamp).toLocaleString()}`);
        if (item.jobs && item.jobs.length > 0) {
          console.log(`      示例职位: ${item.jobs[0].title}`);
        }
      });
    } catch (error) {
      console.error('❌ 解析历史数据失败:', error);
    }
  } else {
    console.log('❌ 未找到历史数据');
  }
  
  // 2. 检查日期匹配
  console.log('\n📅 2. 检查日期匹配:');
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dayBeforeYesterday = new Date();
  dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  
  const expectedDates = {
    '昨天': yesterday.toISOString().split('T')[0],
    '前天': dayBeforeYesterday.toISOString().split('T')[0],
    '大前天': threeDaysAgo.toISOString().split('T')[0]
  };
  
  console.log('预期日期格式:');
  Object.entries(expectedDates).forEach(([label, date]) => {
    console.log(`   ${label}: ${date}`);
  });
  
  if (historyData) {
    const parsed = JSON.parse(historyData);
    console.log('\n实际数据中的日期:');
    parsed.forEach(item => {
      const match = Object.entries(expectedDates).find(([_, date]) => date === item.date);
      console.log(`   ${item.date} ${match ? `(${match[0]})` : '(未匹配)'}`);
    });
  }
  
  // 3. 检查 React 组件状态
  console.log('\n⚛️ 3. 检查 React 组件状态:');
  
  // 尝试找到 React 组件实例
  const rootElement = document.querySelector('#root');
  if (rootElement) {
    const reactFiberKey = Object.keys(rootElement).find(key => 
      key.startsWith('__reactFiber') || key.startsWith('__reactInternalInstance')
    );
    
    if (reactFiberKey) {
      console.log('✅ 找到 React Fiber');
      
      // 检查页面上的展开按钮
      const expandButton = Array.from(document.querySelectorAll('button')).find(btn => 
        btn.textContent.includes('查看昨天推荐') || btn.textContent.includes('生成测试历史数据')
      );
      
      if (expandButton) {
        console.log('✅ 找到相关按钮:', expandButton.textContent.trim());
      } else {
        console.log('❌ 未找到展开按钮');
      }
      
      // 检查历史推荐区域
      const historyHeaders = Array.from(document.querySelectorAll('h3')).filter(h3 => 
        h3.textContent.includes('昨天推荐') || 
        h3.textContent.includes('前天推荐') || 
        h3.textContent.includes('大前天推荐')
      );
      
      console.log(`📋 找到 ${historyHeaders.length} 个历史推荐标题`);
      historyHeaders.forEach((header, index) => {
        console.log(`   ${index + 1}. ${header.textContent.trim()}`);
        
        // 检查该标题下是否有职位卡片
        const parentDiv = header.closest('div');
        if (parentDiv) {
          const jobCards = parentDiv.querySelectorAll('[class*="grid"]');
          console.log(`      下方网格容器数量: ${jobCards.length}`);
          
          jobCards.forEach((grid, gridIndex) => {
            const cards = grid.children.length;
            console.log(`      网格 ${gridIndex + 1} 中的卡片数量: ${cards}`);
          });
        }
      });
      
    } else {
      console.log('❌ 无法访问 React Fiber');
    }
  }
  
  // 4. 检查网络请求和服务调用
  console.log('\n🌐 4. 检查服务调用:');
  
  // 模拟调用 recommendationHistoryService
  if (window.recommendationHistoryService) {
    console.log('✅ 找到 recommendationHistoryService');
    
    try {
      const history = window.recommendationHistoryService.getHistory();
      console.log(`   getHistory() 返回 ${history.length} 条记录`);
      
      const pastRecommendations = window.recommendationHistoryService.getPastRecommendations(3);
      console.log(`   getPastRecommendations(3) 返回 ${pastRecommendations.length} 条记录`);
      
      const yesterdayRecs = window.recommendationHistoryService.getYesterdayRecommendations();
      console.log(`   getYesterdayRecommendations() 返回:`, yesterdayRecs ? '有数据' : '无数据');
      
    } catch (error) {
      console.error('❌ 调用服务方法失败:', error);
    }
  } else {
    console.log('❌ 未找到 recommendationHistoryService');
  }
  
  // 5. 检查控制台错误
  console.log('\n🚨 5. 检查可能的错误:');
  
  // 检查是否有 React 错误边界
  const errorBoundaries = document.querySelectorAll('[data-error-boundary]');
  if (errorBoundaries.length > 0) {
    console.log(`⚠️ 发现 ${errorBoundaries.length} 个错误边界`);
  } else {
    console.log('✅ 未发现错误边界');
  }
  
  return {
    hasHistoryData: !!historyData,
    historyCount: historyData ? JSON.parse(historyData).length : 0,
    hasExpandButton: !!Array.from(document.querySelectorAll('button')).find(btn => 
      btn.textContent.includes('查看昨天推荐')
    ),
    historyHeadersCount: Array.from(document.querySelectorAll('h3')).filter(h3 => 
      h3.textContent.includes('推荐')
    ).length
  };
}

// 测试数据生成并立即调试
function testAndDebug() {
  console.log('=== 🧪 测试数据生成并调试 ===');
  
  // 1. 清除现有数据
  localStorage.removeItem('haigoo_recommendation_history');
  console.log('1. 已清除现有历史数据');
  
  // 2. 查找并点击生成按钮
  const generateButton = Array.from(document.querySelectorAll('button')).find(btn => 
    btn.textContent.includes('生成测试历史数据')
  );
  
  if (generateButton) {
    console.log('2. 找到生成按钮，准备点击...');
    generateButton.click();
    
    // 3. 等待一下再检查
    setTimeout(() => {
      console.log('3. 生成后检查结果:');
      comprehensiveDebug();
    }, 1000);
  } else {
    console.log('❌ 未找到生成测试数据按钮');
  }
}

// 手动生成测试数据（不依赖按钮）
function manualGenerateTestData() {
  console.log('=== 🔧 手动生成测试数据 ===');
  
  const testJobs = [
    {
      id: 'manual-test-1',
      title: 'Senior React Developer',
      company: 'TechCorp',
      location: 'San Francisco, CA',
      type: 'full-time',
      description: 'We are looking for a senior React developer...',
      requirements: ['React', 'TypeScript', '5+ years experience'],
      responsibilities: ['Build user interfaces', 'Code reviews', 'Mentoring'],
      salary: { min: 120000, max: 150000, currency: 'USD' },
      postedAt: new Date().toISOString(),
      skills: ['React', 'TypeScript', 'Frontend'],
      source: 'Manual Test Data',
      category: 'Engineering',
      isRemote: true,
      experienceLevel: 'Senior',
      recommendationScore: 95
    },
    {
      id: 'manual-test-2',
      title: 'Product Manager',
      company: 'StartupXYZ',
      location: 'New York, NY',
      type: 'full-time',
      description: 'Join our product team...',
      requirements: ['Product Management', 'Analytics', '3+ years experience'],
      responsibilities: ['Product strategy', 'User research', 'Team coordination'],
      salary: { min: 100000, max: 130000, currency: 'USD' },
      postedAt: new Date().toISOString(),
      skills: ['Product', 'Management', 'Analytics'],
      source: 'Manual Test Data',
      category: 'Product',
      isRemote: false,
      experienceLevel: 'Mid',
      recommendationScore: 88
    }
  ];
  
  // 生成历史数据
  const historyData = [];
  
  // 昨天
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  historyData.push({
    date: yesterday.toISOString().split('T')[0],
    jobs: testJobs.map(job => ({...job, id: job.id + '-yesterday', title: job.title + ' (昨天)'})),
    timestamp: yesterday.getTime()
  });
  
  // 前天
  const dayBeforeYesterday = new Date();
  dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
  historyData.push({
    date: dayBeforeYesterday.toISOString().split('T')[0],
    jobs: testJobs.map(job => ({...job, id: job.id + '-daybeforeyesterday', title: job.title + ' (前天)'})),
    timestamp: dayBeforeYesterday.getTime()
  });
  
  // 大前天
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  historyData.push({
    date: threeDaysAgo.toISOString().split('T')[0],
    jobs: testJobs.map(job => ({...job, id: job.id + '-threedaysago', title: job.title + ' (大前天)'})),
    timestamp: threeDaysAgo.getTime()
  });
  
  // 保存到 localStorage
  localStorage.setItem('haigoo_recommendation_history', JSON.stringify(historyData));
  
  console.log('✅ 手动生成的测试数据已保存');
  console.log(`📊 生成了 ${historyData.length} 天的数据，每天 ${testJobs.length} 个职位`);
  
  // 立即调试
  setTimeout(() => {
    comprehensiveDebug();
  }, 500);
}

// 导出到全局
window.comprehensiveDebug = comprehensiveDebug;
window.testAndDebug = testAndDebug;
window.manualGenerateTestData = manualGenerateTestData;

console.log('🛠️ 全面调试工具已加载！');
console.log('使用方法:');
console.log('1. comprehensiveDebug() - 全面检查当前状态');
console.log('2. testAndDebug() - 测试数据生成并调试');
console.log('3. manualGenerateTestData() - 手动生成测试数据');