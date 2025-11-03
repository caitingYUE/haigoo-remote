// 调试历史推荐数据的脚本
// 在浏览器控制台中运行此脚本

function debugHistoryData() {
  console.log('=== 调试历史推荐数据 ===');
  
  // 1. 检查 localStorage 中的数据
  const historyData = localStorage.getItem('haigoo_recommendation_history');
  console.log('1. localStorage 原始数据:', historyData);
  
  if (historyData) {
    try {
      const parsedData = JSON.parse(historyData);
      console.log('2. 解析后的数据:', parsedData);
      console.log('3. 数据条目数量:', parsedData.length);
      
      // 检查每个日期的数据
      parsedData.forEach((item, index) => {
        console.log(`4.${index + 1} 日期: ${item.date}, 职位数量: ${item.jobs?.length || 0}`);
        if (item.jobs && item.jobs.length > 0) {
          console.log(`   - 第一个职位标题: ${item.jobs[0].title}`);
        }
      });
      
      // 检查日期格式
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dayBeforeYesterday = new Date();
      dayBeforeYesterday.setDate(dayBeforeYesterday.getDate() - 2);
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      console.log('5. 预期的日期格式:');
      console.log(`   - 昨天: ${yesterday.toISOString().split('T')[0]}`);
      console.log(`   - 前天: ${dayBeforeYesterday.toISOString().split('T')[0]}`);
      console.log(`   - 大前天: ${threeDaysAgo.toISOString().split('T')[0]}`);
      
      // 检查是否有匹配的日期
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      const dayBeforeYesterdayStr = dayBeforeYesterday.toISOString().split('T')[0];
      const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
      
      const hasYesterday = parsedData.some(item => item.date === yesterdayStr);
      const hasDayBeforeYesterday = parsedData.some(item => item.date === dayBeforeYesterdayStr);
      const hasThreeDaysAgo = parsedData.some(item => item.date === threeDaysAgoStr);
      
      console.log('6. 日期匹配检查:');
      console.log(`   - 有昨天数据: ${hasYesterday}`);
      console.log(`   - 有前天数据: ${hasDayBeforeYesterday}`);
      console.log(`   - 有大前天数据: ${hasThreeDaysAgo}`);
      
    } catch (error) {
      console.error('解析数据时出错:', error);
    }
  } else {
    console.log('2. localStorage 中没有历史数据');
  }
  
  // 7. 检查当前页面状态
  console.log('7. 当前页面状态检查:');
  
  // 检查 React 组件状态（如果可以访问）
  const reactFiberKey = Object.keys(document.querySelector('#root')).find(key => key.startsWith('__reactFiber'));
  if (reactFiberKey) {
    console.log('   - 找到 React Fiber，可以检查组件状态');
  } else {
    console.log('   - 无法直接访问 React 组件状态');
  }
  
  // 检查页面上的按钮
  const expandButton = document.querySelector('button:has(span:contains("查看昨天推荐"))') || 
                     Array.from(document.querySelectorAll('button')).find(btn => 
                       btn.textContent.includes('查看昨天推荐')
                     );
  console.log('   - 找到展开按钮:', !!expandButton);
  
  // 检查是否有过往推荐区域
  const historySection = Array.from(document.querySelectorAll('h3')).find(h3 => 
    h3.textContent.includes('昨天推荐') || 
    h3.textContent.includes('前天推荐') || 
    h3.textContent.includes('大前天推荐')
  );
  console.log('   - 找到历史推荐区域:', !!historySection);
  
  return {
    hasData: !!historyData,
    dataCount: historyData ? JSON.parse(historyData).length : 0,
    hasExpandButton: !!expandButton,
    hasHistorySection: !!historySection
  };
}

// 测试数据生成函数
function testDataGeneration() {
  console.log('=== 测试数据生成 ===');
  
  // 查找生成测试数据按钮
  const testButton = Array.from(document.querySelectorAll('button')).find(btn => 
    btn.textContent.includes('生成测试历史数据')
  );
  
  if (testButton) {
    console.log('找到测试按钮，准备点击...');
    
    // 记录点击前的数据
    const beforeData = localStorage.getItem('haigoo_recommendation_history');
    console.log('点击前的数据:', beforeData ? JSON.parse(beforeData).length : 0, '条');
    
    // 点击按钮
    testButton.click();
    
    // 等待一下再检查数据
    setTimeout(() => {
      const afterData = localStorage.getItem('haigoo_recommendation_history');
      console.log('点击后的数据:', afterData ? JSON.parse(afterData).length : 0, '条');
      
      if (afterData) {
        const parsed = JSON.parse(afterData);
        console.log('新生成的数据详情:');
        parsed.forEach((item, index) => {
          console.log(`  ${index + 1}. ${item.date}: ${item.jobs?.length || 0} 个职位`);
        });
      }
    }, 1000);
  } else {
    console.log('未找到测试按钮');
  }
}

// 导出到全局
window.debugHistoryData = debugHistoryData;
window.testDataGeneration = testDataGeneration;

console.log('调试工具已加载！');
console.log('使用方法:');
console.log('1. debugHistoryData() - 检查历史数据');
console.log('2. testDataGeneration() - 测试数据生成');