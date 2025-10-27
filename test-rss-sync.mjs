// 测试RSS数据同步功能
import { JobAggregator } from './src/services/job-aggregator.js';

async function testRSSSync() {
  console.log('=== 开始测试RSS数据同步功能 ===');
  
  const aggregator = new JobAggregator();
  
  try {
    console.log('1. 初始化JobAggregator...');
    await aggregator.initializeStorage();
    console.log('✓ 初始化完成');
    
    console.log('2. 开始同步RSS数据...');
    await aggregator.syncAllJobs();
    console.log('✓ RSS数据同步完成');
    
    console.log('3. 获取同步后的岗位数据...');
    const jobs = await aggregator.getJobs();
    console.log(`✓ 总共获取到 ${jobs.length} 个岗位`);
    
    if (jobs.length > 0) {
      console.log('\n4. 前5个岗位示例:');
      jobs.slice(0, 5).forEach((job, index) => {
        console.log(`${index + 1}. ${job.title}`);
        console.log(`   公司: ${job.company}`);
        console.log(`   类型: ${job.jobType || 'N/A'}`);
        console.log(`   分类: ${job.category || 'N/A'}`);
        console.log(`   远程: ${job.isRemote ? 'Yes' : 'No'}`);
        console.log(`   地点: ${job.location || 'N/A'}`);
        console.log('   ---');
      });
      
      // 统计数据
      const remoteJobs = jobs.filter(job => job.isRemote).length;
      const categories = [...new Set(jobs.map(job => job.category).filter(Boolean))];
      const jobTypes = [...new Set(jobs.map(job => job.jobType).filter(Boolean))];
      
      console.log('\n5. 数据统计:');
      console.log(`   远程岗位: ${remoteJobs}/${jobs.length} (${Math.round(remoteJobs/jobs.length*100)}%)`);
      console.log(`   岗位分类: ${categories.join(', ')}`);
      console.log(`   岗位类型: ${jobTypes.join(', ')}`);
    }
    
    console.log('\n6. 同步状态:');
    const syncStatus = aggregator.getSyncStatus();
    console.log(`   同步状态: ${syncStatus.isRunning ? '进行中' : '已完成'}`);
    console.log(`   数据源总数: ${syncStatus.totalSources}`);
    console.log(`   成功数据源: ${syncStatus.successfulSources}`);
    console.log(`   失败数据源: ${syncStatus.failedSources}`);
    console.log(`   处理岗位总数: ${syncStatus.totalJobsProcessed}`);
    console.log(`   新增岗位: ${syncStatus.newJobsAdded}`);
    console.log(`   更新岗位: ${syncStatus.jobsUpdated}`);
    
    if (syncStatus.errors && syncStatus.errors.length > 0) {
      console.log('\n7. 错误信息:');
      syncStatus.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }
    
    console.log('\n=== RSS数据同步测试完成 ===');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
    console.error('错误详情:', error);
  }
}

// 运行测试
testRSSSync().catch(console.error);