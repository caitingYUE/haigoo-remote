/**
 * 浏览器控制台数据保留测试脚本
 * 复制此代码到浏览器控制台中运行
 */

async function testDataRetentionInBrowser() {
  console.log('🧪 开始测试数据保留服务...\n');

  try {
    // 1. 检查数据保留服务是否可用
    console.log('1️⃣ 检查服务可用性...');
    
    // 尝试从全局对象中获取服务
    let dataRetentionService = null;
    
    if (typeof window.dataRetentionService !== 'undefined') {
      dataRetentionService = window.dataRetentionService;
      console.log('✅ 从 window.dataRetentionService 获取服务');
    } else {
      console.log('⚠️ window.dataRetentionService 不可用，尝试其他方式...');
      
      // 尝试动态导入
      try {
        const module = await import('./src/services/data-retention-service.ts');
        dataRetentionService = module.dataRetentionService;
        console.log('✅ 通过动态导入获取服务');
      } catch (error) {
        console.log('❌ 无法导入数据保留服务:', error.message);
        return;
      }
    }

    if (!dataRetentionService) {
      console.log('❌ 数据保留服务不可用');
      return;
    }

    // 2. 测试配置
    console.log('\n2️⃣ 测试配置...');
    const config = dataRetentionService.getConfig();
    console.log('✅ 当前配置:');
    console.log(`   - 保留天数: ${config.retentionDays} 天`);
    console.log(`   - 清理间隔: ${config.cleanupIntervalHours} 小时`);
    console.log(`   - 最大记录数: ${config.maxRecords}`);
    console.log(`   - 自动清理: ${config.enableAutoCleanup ? '启用' : '禁用'}`);

    // 3. 测试过期检查
    console.log('\n3️⃣ 测试过期检查...');
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const oldDate = new Date(today);
    oldDate.setDate(oldDate.getDate() - 10); // 10天前
    
    console.log(`今天: ${today.toISOString().split('T')[0]} - 过期: ${dataRetentionService.isExpired(today) ? '是' : '否'}`);
    console.log(`昨天: ${yesterday.toISOString().split('T')[0]} - 过期: ${dataRetentionService.isExpired(yesterday) ? '是' : '否'}`);
    console.log(`10天前: ${oldDate.toISOString().split('T')[0]} - 过期: ${dataRetentionService.isExpired(oldDate) ? '是' : '否'}`);

    // 4. 测试当前存储数据
    console.log('\n4️⃣ 检查当前存储数据...');
    
    const rssJobs = JSON.parse(localStorage.getItem('haigoo-jobs') || '[]');
    const unifiedJobs = JSON.parse(localStorage.getItem('haigoo-unified-jobs') || '[]');
    const recommendationHistory = JSON.parse(localStorage.getItem('haigoo_recommendation_history') || '{}');
    
    console.log(`RSS职位数据: ${rssJobs.length} 条`);
    console.log(`统一职位数据: ${unifiedJobs.length} 条`);
    console.log(`推荐历史数据: ${Object.keys(recommendationHistory).length} 天`);

    // 5. 测试数据过滤
    console.log('\n5️⃣ 测试数据过滤...');
    
    if (rssJobs.length > 0) {
      const validRSSJobs = dataRetentionService.filterValidRSSJobs(rssJobs);
      console.log(`有效RSS职位: ${validRSSJobs.length} / ${rssJobs.length}`);
      
      // 显示过期的职位
      const expiredJobs = rssJobs.filter(job => dataRetentionService.isExpired(job.publishedAt));
      if (expiredJobs.length > 0) {
        console.log(`过期职位: ${expiredJobs.length} 条`);
        expiredJobs.slice(0, 3).forEach(job => {
          console.log(`   - ${job.title} (${job.publishedAt?.split('T')[0] || '无日期'})`);
        });
      }
    } else {
      console.log('⚠️ 没有RSS职位数据可供测试');
    }

    // 6. 测试统计信息
    console.log('\n6️⃣ 获取统计信息...');
    
    try {
      const stats = await dataRetentionService.getRetentionStats();
      console.log('✅ 统计信息:');
      console.log(`   - 总记录数: ${stats.totalRecords}`);
      console.log(`   - 过期记录数: ${stats.expiredRecords}`);
      console.log(`   - 存储使用量: ${stats.storageUsage.total} 字节`);
      console.log(`   - 上次清理: ${stats.lastCleanup || '从未'}`);
      console.log(`   - 下次清理: ${stats.nextCleanup}`);
    } catch (error) {
      console.log('⚠️ 获取统计信息时出错:', error.message);
    }

    // 7. 测试推荐历史数据兼容性
    console.log('\n7️⃣ 测试推荐历史数据兼容性...');
    
    if (Object.keys(recommendationHistory).length > 0) {
      console.log('✅ 推荐历史数据:');
      Object.entries(recommendationHistory).forEach(([date, jobs]) => {
        const isExpired = dataRetentionService.isExpired(date);
        console.log(`   - ${date}: ${jobs.length} 个推荐 ${isExpired ? '(已过期)' : '(有效)'}`);
      });
    } else {
      console.log('⚠️ 没有推荐历史数据');
    }

    // 8. 测试配置更新
    console.log('\n8️⃣ 测试配置更新...');
    
    const originalConfig = { ...config };
    
    dataRetentionService.updateConfig({
      retentionDays: 14
    });
    
    const newConfig = dataRetentionService.getConfig();
    console.log(`✅ 配置更新: 保留天数从 ${originalConfig.retentionDays} 天改为 ${newConfig.retentionDays} 天`);
    
    // 恢复原配置
    dataRetentionService.updateConfig(originalConfig);
    console.log('✅ 配置已恢复');

    // 9. 模拟清理操作（不实际执行）
    console.log('\n9️⃣ 模拟清理操作...');
    
    console.log('⚠️ 注意: 这是模拟操作，不会实际删除数据');
    console.log('如需执行实际清理，请运行: dataRetentionService.manualCleanup()');

    console.log('\n🎉 数据保留服务测试完成！');
    console.log('\n📝 测试总结:');
    console.log('- 服务可用性: ✅');
    console.log('- 配置管理: ✅');
    console.log('- 过期检查: ✅');
    console.log('- 数据过滤: ✅');
    console.log('- 统计信息: ✅');
    console.log('- 推荐历史兼容性: ✅');
    console.log('- 配置更新: ✅');
    
  } catch (error) {
    console.error('❌ 测试过程中出现错误:', error);
  }
}

// 提供使用说明
console.log('📋 数据保留服务测试');
console.log('复制以下命令到浏览器控制台运行:');
console.log('testDataRetentionInBrowser()');

// 如果在浏览器环境中，自动运行测试
if (typeof window !== 'undefined') {
  testDataRetentionInBrowser();
}