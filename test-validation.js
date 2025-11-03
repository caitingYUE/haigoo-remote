// 过往推荐功能验证脚本
// 在浏览器控制台中运行此脚本来验证功能

console.log('🚀 开始验证过往推荐功能...');

// 1. 验证localStorage数据结构
function validateLocalStorageData() {
  console.log('\n📊 验证localStorage数据结构...');
  
  const historyData = localStorage.getItem('haigoo_recommendation_history');
  if (!historyData) {
    console.log('❌ 未找到历史数据，请先生成测试数据');
    return false;
  }
  
  try {
    const parsed = JSON.parse(historyData);
    console.log('✅ 历史数据解析成功');
    console.log(`📈 共有 ${parsed.length} 天的数据`);
    
    // 验证数据结构
    parsed.forEach((item, index) => {
      if (!item.date || !item.jobs || !item.timestamp) {
        console.log(`❌ 第${index + 1}天数据结构不完整`);
        return false;
      }
      console.log(`✅ ${item.date}: ${item.jobs.length} 个职位`);
    });
    
    // 验证数据限制（最多3天）
    if (parsed.length > 3) {
      console.log(`❌ 数据超过3天限制: ${parsed.length} 天`);
      return false;
    }
    
    console.log('✅ 数据结构验证通过');
    return true;
  } catch (error) {
    console.log('❌ 数据解析失败:', error);
    return false;
  }
}

// 2. 验证UI元素存在性
function validateUIElements() {
  console.log('\n🎨 验证UI元素...');
  
  // 检查测试按钮
  const testButton = document.querySelector('button:contains("生成测试历史数据")') || 
                    Array.from(document.querySelectorAll('button')).find(btn => 
                      btn.textContent.includes('生成测试历史数据'));
  
  if (testButton) {
    console.log('✅ 找到测试数据生成按钮');
  } else {
    console.log('⚠️ 未找到测试数据生成按钮（可能不在开发环境）');
  }
  
  // 检查过往推荐区域
  const historySection = document.querySelector('[class*="history"]') ||
                        document.querySelector('h3:contains("过往推荐")') ||
                        Array.from(document.querySelectorAll('h3, h2')).find(h => 
                          h.textContent.includes('昨天') || h.textContent.includes('推荐'));
  
  if (historySection) {
    console.log('✅ 找到过往推荐区域');
  } else {
    console.log('❌ 未找到过往推荐区域');
  }
  
  // 检查展开/收起按钮
  const expandButton = Array.from(document.querySelectorAll('button')).find(btn => 
    btn.textContent.includes('查看') || btn.textContent.includes('收起'));
  
  if (expandButton) {
    console.log(`✅ 找到控制按钮: "${expandButton.textContent}"`);
  } else {
    console.log('❌ 未找到展开/收起按钮');
  }
}

// 3. 验证渐进式展开逻辑
function validateProgressiveExpansion() {
  console.log('\n🔄 验证渐进式展开逻辑...');
  
  const expandButton = Array.from(document.querySelectorAll('button')).find(btn => 
    btn.textContent.includes('查看') || btn.textContent.includes('收起'));
  
  if (!expandButton) {
    console.log('❌ 未找到控制按钮，无法测试展开逻辑');
    return;
  }
  
  console.log('🎯 请手动测试以下步骤:');
  console.log('1. 点击按钮，应显示"昨天推荐"');
  console.log('2. 再次点击，应显示"前天推荐"');
  console.log('3. 第三次点击，应显示"大前天推荐"');
  console.log('4. 第四次点击，应收起所有历史推荐');
  
  // 模拟点击测试（如果可能）
  console.log(`当前按钮文字: "${expandButton.textContent}"`);
}

// 4. 验证数据清理功能
function validateDataCleanup() {
  console.log('\n🧹 验证数据清理功能...');
  
  // 创建超过3天的测试数据
  const testData = [];
  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i - 1);
    testData.push({
      date: date.toISOString().split('T')[0],
      jobs: [{
        id: `test-${i}`,
        title: `Test Job ${i}`,
        company: 'Test Company',
        location: 'Test Location',
        type: 'full-time',
        requirements: ['Test'],
        responsibilities: ['Test'],
        skills: ['Test'],
        postedAt: new Date().toISOString(),
        source: 'Test'
      }],
      timestamp: date.getTime()
    });
  }
  
  // 保存测试数据
  localStorage.setItem('haigoo_recommendation_history', JSON.stringify(testData));
  console.log(`📝 创建了 ${testData.length} 天的测试数据`);
  
  // 刷新页面来触发数据清理
  console.log('🔄 请刷新页面来触发数据清理，然后重新运行验证');
}

// 5. 性能检查
function validatePerformance() {
  console.log('\n⚡ 性能检查...');
  
  const startTime = performance.now();
  
  // 模拟数据加载
  const historyData = localStorage.getItem('haigoo_recommendation_history');
  if (historyData) {
    JSON.parse(historyData);
  }
  
  const endTime = performance.now();
  const loadTime = endTime - startTime;
  
  console.log(`📊 数据加载时间: ${loadTime.toFixed(2)}ms`);
  
  if (loadTime < 10) {
    console.log('✅ 性能良好');
  } else if (loadTime < 50) {
    console.log('⚠️ 性能一般');
  } else {
    console.log('❌ 性能较差');
  }
}

// 主验证函数
function runFullValidation() {
  console.log('🎯 运行完整功能验证...\n');
  
  validateLocalStorageData();
  validateUIElements();
  validateProgressiveExpansion();
  validatePerformance();
  
  console.log('\n✨ 验证完成！');
  console.log('💡 提示: 运行 validateDataCleanup() 来测试数据清理功能');
}

// 导出函数供控制台使用
window.testFunctions = {
  validateLocalStorageData,
  validateUIElements,
  validateProgressiveExpansion,
  validateDataCleanup,
  validatePerformance,
  runFullValidation
};

console.log('📋 可用的测试函数:');
console.log('- runFullValidation() - 运行完整验证');
console.log('- validateLocalStorageData() - 验证数据结构');
console.log('- validateUIElements() - 验证UI元素');
console.log('- validateProgressiveExpansion() - 验证展开逻辑');
console.log('- validateDataCleanup() - 验证数据清理');
console.log('- validatePerformance() - 性能检查');

// 自动运行基础验证
runFullValidation();