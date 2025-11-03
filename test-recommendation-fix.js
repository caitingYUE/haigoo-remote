/**
 * 测试推荐历史数据修复效果
 * 验证job-aggregator中的推荐历史保存逻辑是否正常工作
 */

// 模拟浏览器环境
global.window = {};
global.localStorage = {
  getItem: (key) => {
    const data = {
      'haigoo-jobs': JSON.stringify([
        {
          id: 'test-job-1',
          title: 'Senior Software Engineer',
          company: 'Tech Corp',
          location: 'Remote',
          description: 'Great remote opportunity with competitive salary',
          tags: ['javascript', 'react', 'remote'],
          salary: '$100k-150k',
          type: 'full-time',
          postedDate: new Date().toISOString(),
          link: 'https://example.com/job1'
        },
        {
          id: 'test-job-2', 
          title: 'Frontend Developer',
          company: 'StartupXYZ',
          location: 'San Francisco',
          description: 'Join our innovative team',
          tags: ['vue', 'typescript'],
          salary: '$80k-120k',
          type: 'full-time',
          postedDate: new Date().toISOString(),
          link: 'https://example.com/job2'
        }
      ]),
      'haigoo-recommendation-history': JSON.stringify({})
    };
    return data[key] || null;
  },
  setItem: (key, value) => {
    console.log(`✅ localStorage.setItem called:`, key, JSON.parse(value));
  }
};

// 导入相关服务
import { jobAggregator } from './src/services/job-aggregator.js';

async function testRecommendationFix() {
  console.log('🧪 开始测试推荐历史数据修复...\n');

  try {
    // 1. 检查job-aggregator是否正确导入了recommendationHistoryService
    console.log('1️⃣ 检查服务导入...');
    if (jobAggregator.recommendationHistoryService) {
      console.log('✅ recommendationHistoryService 已正确导入');
    } else {
      console.log('❌ recommendationHistoryService 未找到');
      return;
    }

    // 2. 模拟RSS数据同步
    console.log('\n2️⃣ 模拟RSS数据同步...');
    const mockRSSJobs = [
      {
        title: 'Remote React Developer',
        company: 'TechCorp Inc.',
        location: 'Remote',
        description: 'Join our remote team building cutting-edge React applications with competitive salary and benefits',
        link: 'https://example.com/job1',
        pubDate: new Date().toISOString(),
        guid: 'job-1-' + Date.now(),
        category: 'Software Development',
        tags: ['react', 'javascript', 'remote']
      },
      {
        title: 'Senior Full Stack Engineer',
        company: 'Innovation Labs',
        location: 'San Francisco, CA',
        description: 'Lead development of scalable web applications using modern technologies',
        link: 'https://example.com/job2', 
        pubDate: new Date().toISOString(),
        guid: 'job-2-' + Date.now(),
        category: 'Engineering',
        tags: ['fullstack', 'node', 'react']
      },
      {
        title: 'Frontend Developer',
        company: 'StartupXYZ',
        location: 'New York, NY',
        description: 'Build beautiful user interfaces with Vue.js and TypeScript',
        link: 'https://example.com/job3',
        pubDate: new Date().toISOString(), 
        guid: 'job-3-' + Date.now(),
        category: 'Frontend',
        tags: ['vue', 'typescript', 'frontend']
      }
    ];

    // 3. 测试convertRSSJobToPageJob方法
    console.log('\n3️⃣ 测试RSS Job转换...');
    const convertedJobs = mockRSSJobs.map(job => jobAggregator.convertRSSJobToPageJob(job));
    console.log(`✅ 成功转换 ${convertedJobs.length} 个职位`);
    
    // 显示转换后的职位信息
    convertedJobs.forEach((job, index) => {
      console.log(`   职位 ${index + 1}: ${job.title} - 推荐分数: ${job.recommendationScore}`);
    });

    // 4. 测试推荐历史保存逻辑
    console.log('\n4️⃣ 测试推荐历史保存...');
    
    // 按推荐分数排序并取前6个
    const sortedJobs = convertedJobs.sort((a, b) => b.recommendationScore - a.recommendationScore);
    const topRecommendations = sortedJobs.slice(0, 6);
    
    console.log(`📊 排序后的推荐职位 (前${Math.min(6, topRecommendations.length)}个):`);
    topRecommendations.forEach((job, index) => {
      console.log(`   ${index + 1}. ${job.title} (分数: ${job.recommendationScore})`);
    });

    // 5. 调用推荐历史服务保存数据
    console.log('\n5️⃣ 保存推荐历史...');
    const today = new Date().toISOString().split('T')[0];
    
    try {
      await jobAggregator.recommendationHistoryService.saveDailyRecommendation(today, topRecommendations);
      console.log('✅ 推荐历史保存成功');
      
      // 6. 验证保存的数据
      console.log('\n6️⃣ 验证保存的数据...');
      const savedRecommendations = await jobAggregator.recommendationHistoryService.getDailyRecommendation(today);
      
      if (savedRecommendations && savedRecommendations.length > 0) {
        console.log(`✅ 成功获取到 ${savedRecommendations.length} 条推荐记录`);
        console.log('📋 保存的推荐数据:');
        savedRecommendations.forEach((job, index) => {
          console.log(`   ${index + 1}. ${job.title} - ${job.company}`);
        });
      } else {
        console.log('❌ 未找到保存的推荐数据');
      }
      
    } catch (error) {
      console.log('❌ 保存推荐历史时出错:', error.message);
    }

    console.log('\n🎉 测试完成！');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 运行测试
testRecommendationFix().catch(console.error);