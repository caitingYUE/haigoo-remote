// 数据清理功能测试脚本
// 在浏览器控制台中运行此脚本来测试数据清理功能

console.log('🧹 开始测试数据清理功能...');

// 创建超过3天的测试数据
function createExtendedTestData() {
  console.log('📝 创建7天的测试数据...');
  
  const testData = [];
  const testJobs = [
    {
      id: 'cleanup-test-1',
      title: 'Frontend Developer',
      company: 'Tech Corp',
      location: 'Remote',
      type: 'full-time',
      requirements: ['React', 'TypeScript'],
      responsibilities: ['Build UI', 'Code review'],
      skills: ['React', 'TypeScript'],
      postedAt: new Date().toISOString(),
      source: 'Cleanup Test'
    },
    {
      id: 'cleanup-test-2',
      title: 'Backend Developer',
      company: 'Data Corp',
      location: 'San Francisco',
      type: 'full-time',
      requirements: ['Node.js', 'MongoDB'],
      responsibilities: ['API development', 'Database design'],
      skills: ['Node.js', 'MongoDB'],
      postedAt: new Date().toISOString(),
      source: 'Cleanup Test'
    }
  ];
  
  // 创建7天的数据（超过3天限制）
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i - 1); // 从昨天开始往前推
    
    testData.push({
      date: date.toISOString().split('T')[0],
      jobs: testJobs.map(job => ({
        ...job,
        id: `${job.id}-day${i + 1}`,
        title: `${job.title} (第${i + 1}天)`
      })),
      timestamp: date.getTime()
    });
  }
  
  // 保存到localStorage
  localStorage.setItem('haigoo_recommendation_history', JSON.stringify(testData));
  
  console.log(`✅ 已创建 ${testData.length} 天的测试数据`);
  testData.forEach((item, index) => {
    console.log(`   ${index + 1}. ${item.date} - ${item.jobs.length} 个职位`);
  });
  
  return testData;
}

// 验证数据清理前的状态
function validateBeforeCleanup() {
  console.log('\n📊 清理前数据状态:');
  
  const historyData = localStorage.getItem('haigoo_recommendation_history');
  if (!historyData) {
    console.log('❌ 未找到历史数据');
    return null;
  }
  
  const parsed = JSON.parse(historyData);
  console.log(`📈 当前数据天数: ${parsed.length}`);
  
  if (parsed.length > 3) {
    console.log('✅ 数据超过3天，需要清理');
  } else {
    console.log('⚠️ 数据未超过3天，清理功能可能不会触发');
  }
  
  return parsed;
}

// 触发数据清理（通过调用服务方法）
function triggerDataCleanup() {
  console.log('\n🔄 触发数据清理...');
  
  // 模拟保存新数据来触发清理
  const newJobs = [{
    id: 'trigger-cleanup',
    title: 'Cleanup Trigger Job',
    company: 'Test Company',
    location: 'Test Location',
    type: 'full-time',
    requirements: ['Test'],
    responsibilities: ['Test'],
    skills: ['Test'],
    postedAt: new Date().toISOString(),
    source: 'Cleanup Trigger'
  }];
  
  // 这里需要调用实际的服务方法
  // 由于我们在控制台中，需要访问全局的服务实例
  if (window.recommendationHistoryService) {
    window.recommendationHistoryService.saveDailyRecommendation(newJobs);
    console.log('✅ 通过服务方法触发了数据清理');
  } else {
    console.log('⚠️ 无法访问recommendationHistoryService，请手动刷新页面');
  }
}

// 验证数据清理后的状态
function validateAfterCleanup() {
  console.log('\n📊 清理后数据状态:');
  
  const historyData = localStorage.getItem('haigoo_recommendation_history');
  if (!historyData) {
    console.log('❌ 清理后未找到历史数据');
    return null;
  }
  
  const parsed = JSON.parse(historyData);
  console.log(`📈 清理后数据天数: ${parsed.length}`);
  
  if (parsed.length <= 3) {
    console.log('✅ 数据清理成功，保持在3天以内');
  } else {
    console.log('❌ 数据清理失败，仍超过3天');
  }
  
  // 验证保留的是最新的数据
  const today = new Date().toISOString().split('T')[0];
  const sortedData = parsed.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  console.log('📅 保留的数据日期:');
  sortedData.forEach((item, index) => {
    const daysAgo = Math.floor((new Date(today).getTime() - new Date(item.date).getTime()) / (1000 * 60 * 60 * 24));
    console.log(`   ${index + 1}. ${item.date} (${daysAgo}天前) - ${item.jobs.length} 个职位`);
  });
  
  return parsed;
}

// 完整的数据清理测试流程
function runDataCleanupTest() {
  console.log('🎯 开始完整的数据清理测试...\n');
  
  // 1. 创建测试数据
  const originalData = createExtendedTestData();
  
  // 2. 验证清理前状态
  const beforeCleanup = validateBeforeCleanup();
  
  // 3. 触发数据清理
  triggerDataCleanup();
  
  // 4. 验证清理后状态
  setTimeout(() => {
    const afterCleanup = validateAfterCleanup();
    
    // 5. 总结测试结果
    console.log('\n📋 测试结果总结:');
    if (beforeCleanup && afterCleanup) {
      const beforeCount = beforeCleanup.length;
      const afterCount = afterCleanup.length;
      
      if (beforeCount > 3 && afterCount <= 3) {
        console.log('✅ 数据清理功能正常工作');
      } else if (beforeCount <= 3) {
        console.log('⚠️ 原始数据未超过限制，无法验证清理功能');
      } else {
        console.log('❌ 数据清理功能可能存在问题');
      }
    }
    
    console.log('\n✨ 数据清理测试完成！');
  }, 1000);
}

// 清理测试数据
function cleanupTestData() {
  console.log('🗑️ 清理所有测试数据...');
  localStorage.removeItem('haigoo_recommendation_history');
  console.log('✅ 测试数据已清理');
}

// 导出函数
window.dataCleanupTest = {
  createExtendedTestData,
  validateBeforeCleanup,
  triggerDataCleanup,
  validateAfterCleanup,
  runDataCleanupTest,
  cleanupTestData
};

console.log('📋 数据清理测试函数:');
console.log('- runDataCleanupTest() - 运行完整测试');
console.log('- createExtendedTestData() - 创建7天测试数据');
console.log('- validateBeforeCleanup() - 验证清理前状态');
console.log('- triggerDataCleanup() - 触发数据清理');
console.log('- validateAfterCleanup() - 验证清理后状态');
console.log('- cleanupTestData() - 清理测试数据');

console.log('\n💡 使用说明:');
console.log('1. 运行 runDataCleanupTest() 进行完整测试');
console.log('2. 如果服务方法无法访问，请刷新页面后重试');
console.log('3. 测试完成后运行 cleanupTestData() 清理数据');