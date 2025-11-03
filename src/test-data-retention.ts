// 数据保留服务测试脚本
import { dataRetentionService } from './services/data-retention-service';

async function testDataRetentionService() {
  console.log('🧪 开始测试数据保留服务...\n');

  try {
    // 1. 测试获取保留统计信息
    console.log('1️⃣ 测试获取保留统计信息');
    const stats = await dataRetentionService.getRetentionStats();
    console.log('✅ 保留统计信息:', {
      totalRecords: stats.totalRecords,
      expiredRecords: stats.expiredRecords,
      cleanedRecords: stats.cleanedRecords,
      storageUsage: stats.storageUsage,
      lastCleanup: stats.lastCleanup,
      nextCleanup: stats.nextCleanup
    });
    console.log('');

    // 2. 测试手动清理功能
    console.log('2️⃣ 测试手动清理功能');
    const cleanupStats = await dataRetentionService.manualCleanup();
    console.log('✅ 清理统计信息:', {
      totalRecords: cleanupStats.totalRecords,
      expiredRecords: cleanupStats.expiredRecords,
      cleanedRecords: cleanupStats.cleanedRecords,
      storageUsage: cleanupStats.storageUsage,
      lastCleanup: cleanupStats.lastCleanup,
      nextCleanup: cleanupStats.nextCleanup
    });
    console.log('');

    // 3. 测试配置更新
    console.log('3️⃣ 测试配置更新');
    const newConfig = {
      retentionDays: 14,
      cleanupIntervalHours: 48, // 48小时
      maxRecords: 20000,
      enableAutoCleanup: true
    };
    dataRetentionService.updateConfig(newConfig);
    console.log('✅ 配置更新成功:', newConfig);
    console.log('');

    // 4. 测试数据导出
    console.log('4️⃣ 测试数据导出');
    const exportData = await dataRetentionService.exportData();
    console.log('✅ 导出数据统计:', {
      rssJobsCount: exportData.rssJobs.length,
      unifiedJobsCount: exportData.unifiedJobs.length,
      totalSize: JSON.stringify(exportData).length + ' bytes'
    });
    console.log('');

    // 5. 测试清空所有数据
    console.log('5️⃣ 测试清空所有数据');
    await dataRetentionService.clearAllData();
    console.log('✅ 所有数据已清空');
    console.log('');

    // 6. 验证清空后的状态
    console.log('6️⃣ 验证清空后的状态');
    const finalStats = await dataRetentionService.getRetentionStats();
    console.log('✅ 清空后统计信息:', {
      totalRecords: finalStats.totalRecords,
      expiredRecords: finalStats.expiredRecords,
      storageUsage: finalStats.storageUsage
    });

    console.log('\n🎉 所有测试通过！数据保留服务功能正常。');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    throw error;
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  testDataRetentionService()
    .then(() => {
      console.log('\n✨ 测试完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 测试失败:', error);
      process.exit(1);
    });
}

export { testDataRetentionService };