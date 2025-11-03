// 简单调试脚本 - 在浏览器控制台运行
// 复制粘贴以下代码到浏览器控制台

console.log('🔍 开始简单调试...');

// 1. 检查 localStorage
console.log('1. 检查 localStorage:');
const historyData = localStorage.getItem('haigoo_recommendation_history');
console.log('原始数据:', historyData);

if (historyData) {
  try {
    const parsed = JSON.parse(historyData);
    console.log('解析后数据:', parsed);
    console.log('数据条数:', parsed.length);
  } catch (e) {
    console.error('解析失败:', e);
  }
} else {
  console.log('❌ localStorage 中没有数据');
}

// 2. 检查生成按钮
console.log('\n2. 检查生成按钮:');
const buttons = Array.from(document.querySelectorAll('button'));
const generateButton = buttons.find(btn => btn.textContent.includes('生成测试历史数据'));
console.log('找到生成按钮:', !!generateButton);
if (generateButton) {
  console.log('按钮文本:', generateButton.textContent.trim());
}

// 3. 检查历史推荐区域
console.log('\n3. 检查历史推荐区域:');
const historyHeaders = Array.from(document.querySelectorAll('h3')).filter(h3 => 
  h3.textContent.includes('昨天推荐') || 
  h3.textContent.includes('前天推荐') || 
  h3.textContent.includes('大前天推荐')
);
console.log('历史推荐标题数量:', historyHeaders.length);
historyHeaders.forEach((header, i) => {
  console.log(`标题 ${i+1}:`, header.textContent.trim());
  
  // 检查标题下的内容
  const parent = header.closest('div');
  if (parent) {
    const grid = parent.querySelector('[class*="grid"]');
    if (grid) {
      console.log(`  网格子元素数量: ${grid.children.length}`);
    } else {
      console.log('  未找到网格容器');
    }
  }
});

// 4. 手动生成数据并测试
console.log('\n4. 手动生成测试数据:');

function manualTest() {
  // 清除现有数据
  localStorage.removeItem('haigoo_recommendation_history');
  
  // 生成测试数据
  const testData = [];
  
  // 昨天
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  testData.push({
    date: yesterday.toISOString().split('T')[0],
    jobs: [
      {
        id: 'manual-1',
        title: '前端开发工程师 (昨天)',
        company: '测试公司A',
        location: '北京',
        type: 'full-time',
        description: '测试职位描述',
        requirements: ['React', 'TypeScript'],
        responsibilities: ['开发前端页面'],
        salary: { min: 15000, max: 25000, currency: 'CNY' },
        postedAt: new Date().toISOString(),
        skills: ['React', 'TypeScript'],
        source: '手动测试',
        category: '前端开发',
        isRemote: true,
        experienceLevel: 'Mid',
        recommendationScore: 90
      },
      {
        id: 'manual-2',
        title: '产品经理 (昨天)',
        company: '测试公司B',
        location: '上海',
        type: 'full-time',
        description: '测试产品经理职位',
        requirements: ['产品设计', '用户研究'],
        responsibilities: ['产品规划'],
        salary: { min: 20000, max: 30000, currency: 'CNY' },
        postedAt: new Date().toISOString(),
        skills: ['产品设计', '用户研究'],
        source: '手动测试',
        category: '产品管理',
        isRemote: false,
        experienceLevel: 'Senior',
        recommendationScore: 85
      }
    ],
    timestamp: yesterday.getTime()
  });
  
  // 保存数据
  localStorage.setItem('haigoo_recommendation_history', JSON.stringify(testData));
  console.log('✅ 手动测试数据已保存');
  
  // 检查保存结果
  const saved = localStorage.getItem('haigoo_recommendation_history');
  console.log('保存验证:', !!saved);
  
  if (saved) {
    const parsed = JSON.parse(saved);
    console.log('保存的数据:', parsed);
  }
  
  // 刷新页面来触发重新渲染
  console.log('请刷新页面查看效果，或者点击"查看昨天推荐"按钮');
}

// 导出函数
window.manualTest = manualTest;

console.log('\n✅ 调试脚本加载完成');
console.log('运行 manualTest() 来手动生成测试数据');