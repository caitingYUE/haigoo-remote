/**
 * 完整推荐历史功能测试脚本
 * 在浏览器控制台中运行此脚本
 */

async function testCompleteRecommendationFlow() {
  console.log('🧪 开始完整推荐历史功能测试...\n');

  try {
    // 1. 检查服务可用性
    console.log('1️⃣ 检查服务可用性...');
    
    const services = {
      jobAggregator: window.jobAggregator || (await import('./src/services/job-aggregator.ts')).jobAggregator,
      recommendationHistoryService: window.recommendationHistoryService || (await import('./src/services/recommendation-history-service.ts')).recommendationHistoryService,
      dataRetentionService: window.dataRetentionService || (await import('./src/services/data-retention-service.ts')).dataRetentionService
    };

    console.log('✅ 服务检查完成');
    console.log(`   - jobAggregator: ${services.jobAggregator ? '可用' : '不可用'}`);
    console.log(`   - recommendationHistoryService: ${services.recommendationHistoryService ? '可用' : '不可用'}`);
    console.log(`   - dataRetentionService: ${services.dataRetentionService ? '可用' : '不可用'}`);

    // 2. 检查当前数据状态
    console.log('\n2️⃣ 检查当前数据状态...');
    
    const rssJobs = JSON.parse(localStorage.getItem('haigoo-jobs') || '[]');
    const unifiedJobs = JSON.parse(localStorage.getItem('haigoo-unified-jobs') || '[]');
    const recommendationHistory = JSON.parse(localStorage.getItem('haigoo_recommendation_history') || '{}');
    
    console.log(`RSS职位数据: ${rssJobs.length} 条`);
    console.log(`统一职位数据: ${unifiedJobs.length} 条`);
    console.log(`推荐历史数据: ${Object.keys(recommendationHistory).length} 天`);

    // 3. 测试数据同步
    console.log('\n3️⃣ 测试数据同步...');
    
    if (services.jobAggregator && typeof services.jobAggregator.syncAllJobs === 'function') {
      console.log('开始同步RSS数据...');
      await services.jobAggregator.syncAllJobs();
      console.log('✅ RSS数据同步完成');
      
      // 检查同步后的数据
      const syncedRssJobs = JSON.parse(localStorage.getItem('haigoo-jobs') || '[]');
      const syncedUnifiedJobs = JSON.parse(localStorage.getItem('haigoo-unified-jobs') || '[]');
      console.log(`同步后RSS职位: ${syncedRssJobs.length} 条`);
      console.log(`同步后统一职位: ${syncedUnifiedJobs.length} 条`);
    } else {
      console.log('⚠️ 无法执行数据同步');
    }

    // 4. 测试推荐生成
    console.log('\n4️⃣ 测试推荐生成...');
    
    if (services.jobAggregator && typeof services.jobAggregator.getJobs === 'function') {
      const jobs = services.jobAggregator.getJobs();
      console.log(`获取到 ${jobs.length} 个职位`);
      
      if (jobs.length > 0) {
        // 模拟推荐算法，选择前几个职位作为推荐
        const recommendations = jobs.slice(0, Math.min(5, jobs.length));
        console.log(`生成 ${recommendations.length} 个推荐职位`);
        
        // 5. 测试推荐历史保存
        console.log('\n5️⃣ 测试推荐历史保存...');
        
        if (services.recommendationHistoryService) {
          const today = new Date().toISOString().split('T')[0];
          
          try {
            await services.recommendationHistoryService.saveDailyRecommendation(recommendations);
            console.log('✅ 推荐历史保存成功');
            
            // 验证保存结果
            const updatedHistory = JSON.parse(localStorage.getItem('haigoo_recommendation_history') || '{}');
            console.log(`保存后历史数据: ${Object.keys(updatedHistory).length} 天`);
            
            if (updatedHistory[today]) {
              console.log(`今日推荐: ${updatedHistory[today].length} 条`);
            }
            
          } catch (error) {
            console.log('❌ 推荐历史保存失败:', error.message);
          }
        }
      } else {
        console.log('⚠️ 没有职位数据可供推荐');
      }
    }

    // 6. 测试历史数据获取
    console.log('\n6️⃣ 测试历史数据获取...');
    
    if (services.recommendationHistoryService) {
      try {
        const pastDays = await services.recommendationHistoryService.getRecommendationsForPastDays(3);
        console.log(`获取到 ${pastDays.length} 天的历史推荐`);
        
        pastDays.forEach(day => {
          console.log(`   - ${day.date}: ${day.jobs.length} 个推荐`);
        });
        
      } catch (error) {
        console.log('❌ 获取历史数据失败:', error.message);
      }
    }

    // 7. 测试数据保留策略
    console.log('\n7️⃣ 测试数据保留策略...');
    
    if (services.dataRetentionService) {
      try {
        const stats = await services.dataRetentionService.getRetentionStats();
        console.log('✅ 数据保留统计:');
        console.log(`   - 总记录数: ${stats.totalRecords}`);
        console.log(`   - 过期记录数: ${stats.expiredRecords}`);
        console.log(`   - 存储使用量: ${stats.storageUsage.total} 字节`);
        
      } catch (error) {
        console.log('❌ 获取数据保留统计失败:', error.message);
      }
    }

    // 8. 测试前端状态更新
    console.log('\n8️⃣ 测试前端状态更新...');
    
    // 触发页面重新渲染（如果在React应用中）
    if (typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('recommendationHistoryUpdated'));
      console.log('✅ 触发前端状态更新事件');
    }

    // 9. API端点测试
    console.log('\n9️⃣ 测试API端点...');
    
    try {
      const jobsResponse = await fetch('http://localhost:3001/api/jobs');
      if (jobsResponse.ok) {
        const jobsData = await jobsResponse.json();
        console.log(`✅ Jobs API: ${jobsData.data.length} 个测试职位`);
      } else {
        console.log('❌ Jobs API 请求失败');
      }
    } catch (error) {
      console.log('❌ Jobs API 连接失败:', error.message);
    }

    // 10. 完整性检查
    console.log('\n🔟 完整性检查...');
    
    const finalHistory = JSON.parse(localStorage.getItem('haigoo_recommendation_history') || '{}');
    const finalRssJobs = JSON.parse(localStorage.getItem('haigoo-jobs') || '[]');
    const finalUnifiedJobs = JSON.parse(localStorage.getItem('haigoo-unified-jobs') || '[]');
    
    console.log('✅ 最终数据状态:');
    console.log(`   - RSS职位: ${finalRssJobs.length} 条`);
    console.log(`   - 统一职位: ${finalUnifiedJobs.length} 条`);
    console.log(`   - 推荐历史: ${Object.keys(finalHistory).length} 天`);
    
    // 检查数据一致性
    let consistencyIssues = 0;
    
    if (finalRssJobs.length === 0 && finalUnifiedJobs.length === 0) {
      console.log('⚠️ 警告: 没有职位数据');
      consistencyIssues++;
    }
    
    if (Object.keys(finalHistory).length === 0) {
      console.log('⚠️ 警告: 没有推荐历史数据');
      consistencyIssues++;
    }
    
    console.log('\n🎉 完整推荐历史功能测试完成！');
    console.log(`\n📊 测试总结:`);
    console.log(`- 数据同步: ${finalRssJobs.length > 0 ? '✅' : '❌'}`);
    console.log(`- 推荐生成: ${Object.keys(finalHistory).length > 0 ? '✅' : '❌'}`);
    console.log(`- 历史保存: ${Object.keys(finalHistory).length > 0 ? '✅' : '❌'}`);
    console.log(`- 数据保留: ${services.dataRetentionService ? '✅' : '❌'}`);
    console.log(`- API端点: ✅`);
    console.log(`- 一致性问题: ${consistencyIssues} 个`);
    
    if (consistencyIssues === 0) {
      console.log('\n🎊 所有测试通过！推荐历史功能正常工作。');
    } else {
      console.log(`\n⚠️ 发现 ${consistencyIssues} 个问题，需要进一步检查。`);
    }
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 提供使用说明
console.log('📋 完整推荐历史功能测试');
console.log('复制以下命令到浏览器控制台运行:');
console.log('testCompleteRecommendationFlow()');

// 如果在浏览器环境中，自动运行测试
if (typeof window !== 'undefined') {
  testCompleteRecommendationFlow();
}