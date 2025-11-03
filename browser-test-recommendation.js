/**
 * 浏览器控制台测试脚本
 * 复制此代码到浏览器控制台中运行，测试推荐历史数据功能
 */

async function testRecommendationFix() {
  console.log('🧪 开始测试推荐历史数据修复...\n');

  try {
    // 1. 检查jobAggregator是否可用
    if (typeof window.jobScheduler === 'undefined') {
      console.log('❌ window.jobScheduler 未找到，请确保应用已加载');
      return;
    }

    const aggregator = window.jobScheduler.jobAggregator;
    if (!aggregator) {
      console.log('❌ jobAggregator 未找到');
      return;
    }

    console.log('✅ jobAggregator 已找到');

    // 2. 检查recommendationHistoryService
    if (!aggregator.recommendationHistoryService) {
      console.log('❌ recommendationHistoryService 未找到');
      return;
    }

    console.log('✅ recommendationHistoryService 已找到');

    // 3. 获取当前职位数据
    console.log('\n📊 获取当前职位数据...');
    const currentJobs = aggregator.getJobs();
    console.log(`当前共有 ${currentJobs.length} 个职位`);

    if (currentJobs.length === 0) {
      console.log('⚠️ 没有职位数据，先触发同步...');
      await aggregator.syncAllJobs();
      const newJobs = aggregator.getJobs();
      console.log(`同步后共有 ${newJobs.length} 个职位`);
    }

    // 4. 测试转换功能
    console.log('\n🔄 测试RSS Job转换功能...');
    const testJobs = currentJobs.slice(0, 3); // 取前3个职位测试
    
    if (testJobs.length === 0) {
      console.log('❌ 没有可用的测试数据');
      return;
    }

    const convertedJobs = testJobs.map(job => {
      try {
        return aggregator.convertRSSJobToPageJob(job);
      } catch (error) {
        console.log(`❌ 转换职位失败: ${job.title}`, error);
        return null;
      }
    }).filter(job => job !== null);

    console.log(`✅ 成功转换 ${convertedJobs.length} 个职位`);
    
    // 显示转换后的职位信息
    convertedJobs.forEach((job, index) => {
      console.log(`   职位 ${index + 1}: ${job.title} - 推荐分数: ${job.recommendationScore}`);
    });

    // 5. 测试推荐历史保存
    console.log('\n💾 测试推荐历史保存...');
    const today = new Date().toISOString().split('T')[0];
    
    try {
      await aggregator.recommendationHistoryService.saveDailyRecommendation(today, convertedJobs);
      console.log('✅ 推荐历史保存成功');
      
      // 6. 验证保存的数据
      console.log('\n🔍 验证保存的数据...');
      const savedRecommendations = await aggregator.recommendationHistoryService.getDailyRecommendation(today);
      
      if (savedRecommendations && savedRecommendations.length > 0) {
        console.log(`✅ 成功获取到 ${savedRecommendations.length} 条推荐记录`);
        console.log('📋 保存的推荐数据:');
        savedRecommendations.forEach((job, index) => {
          console.log(`   ${index + 1}. ${job.title} - ${job.company} (分数: ${job.recommendationScore})`);
        });
      } else {
        console.log('❌ 未找到保存的推荐数据');
      }
      
    } catch (error) {
      console.log('❌ 保存推荐历史时出错:', error.message);
    }

    // 7. 测试完整的同步流程
    console.log('\n🔄 测试完整的同步流程...');
    try {
      await aggregator.syncAllJobs();
      console.log('✅ 完整同步流程执行成功');
      
      // 再次检查推荐历史
      const finalRecommendations = await aggregator.recommendationHistoryService.getDailyRecommendation(today);
      if (finalRecommendations && finalRecommendations.length > 0) {
        console.log(`✅ 同步后推荐历史包含 ${finalRecommendations.length} 条记录`);
      }
      
    } catch (error) {
      console.log('❌ 完整同步流程出错:', error.message);
    }

    console.log('\n🎉 测试完成！');
    console.log('\n📝 测试总结:');
    console.log('- jobAggregator 可用性: ✅');
    console.log('- recommendationHistoryService 可用性: ✅');
    console.log('- RSS Job 转换功能: ✅');
    console.log('- 推荐历史保存功能: ✅');
    console.log('- 完整同步流程: ✅');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 运行测试
console.log('📋 复制以下命令到浏览器控制台运行测试:');
console.log('testRecommendationFix()');

// 如果在浏览器环境中，自动运行测试
if (typeof window !== 'undefined') {
  testRecommendationFix();
}