#!/usr/bin/env node

/**
 * 开发环境数据诊断脚本
 * 检查开发环境的数据状态
 */

const https = require('https');

const DEV_URL = 'https://haigoo-remote-git-develop-caitlinyct.vercel.app';

console.log('========================================');
console.log('🔍 开发环境数据诊断');
console.log('========================================\n');
console.log(`环境: ${DEV_URL}\n`);

/**
 * 发送 GET 请求
 */
function fetchData(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve({ raw: data, parseError: e.message });
        }
      });
    }).on('error', (e) => {
      reject(e);
    });
  });
}

/**
 * 主函数
 */
async function main() {
  try {
    // 1. 检查健康状态
    console.log('📋 步骤 1/4: 检查 API 健康状态...\n');
    const health = await fetchData(`${DEV_URL}/api/health`);
    
    console.log('健康状态:');
    console.log(`  状态: ${health.status || 'unknown'}`);
    console.log(`  环境: ${health.environment || 'unknown'}`);
    if (health.storage) {
      console.log(`  Redis 配置: ${health.storage.redis?.configured ? '✅ 是' : '❌ 否'}`);
      console.log(`  Redis 状态: ${health.storage.redis?.status || 'unknown'}`);
      console.log(`  KV 配置: ${health.storage.kv?.configured ? '✅ 是' : '❌ 否'}`);
    }
    console.log('');

    // 2. 检查数据统计
    console.log('📊 步骤 2/4: 检查数据统计...\n');
    const stats = await fetchData(`${DEV_URL}/api/storage/stats`);
    
    console.log('数据统计:');
    console.log(`  总职位数: ${stats.total || 0}`);
    console.log(`  存储提供商: ${stats.provider || 'unknown'}`);
    console.log(`  最后同步: ${stats.lastSync || 'unknown'}`);
    console.log('');

    // 3. 检查职位数据（分页）
    console.log('💼 步骤 3/4: 检查职位数据（前10条）...\n');
    const jobsResponse = await fetchData(`${DEV_URL}/api/data/processed-jobs?limit=10`);
    
    if (jobsResponse.success) {
      console.log(`✅ API 返回成功`);
      console.log(`  返回职位数: ${jobsResponse.jobs?.length || 0}`);
      console.log(`  总职位数: ${jobsResponse.total || 0}`);
      console.log(`  当前页: ${jobsResponse.page || 1}`);
      console.log(`  每页数量: ${jobsResponse.pageSize || 0}`);
      console.log(`  存储提供商: ${jobsResponse.provider || 'unknown'}`);
      console.log('');
      
      if (jobsResponse.jobs && jobsResponse.jobs.length > 0) {
        console.log('📋 前3条职位预览:');
        jobsResponse.jobs.slice(0, 3).forEach((job, index) => {
          console.log(`  ${index + 1}. ${job.title || '(无标题)'}`);
          console.log(`     公司: ${job.company || '(未知)'}`);
          console.log(`     地点: ${job.location || '(未知)'}`);
          console.log(`     分类: ${job.category || '(未分类)'}`);
          console.log(`     远程: ${job.isRemote ? '是' : '否'}`);
          console.log(`     类型: ${job.jobType || '(未知)'}`);
          console.log('');
        });
      } else {
        console.log('⚠️  API 返回成功，但职位列表为空');
        console.log('');
      }
    } else {
      console.log(`❌ API 返回失败`);
      console.log(`  错误信息: ${jobsResponse.error || jobsResponse.message || 'unknown'}`);
      console.log('');
    }

    // 4. 检查前端页面数据获取
    console.log('🌐 步骤 4/4: 测试前端 API 调用（限制1000条）...\n');
    const allJobsResponse = await fetchData(`${DEV_URL}/api/data/processed-jobs?limit=1000`);
    
    if (allJobsResponse.success) {
      console.log(`✅ 前端 API 调用成功`);
      console.log(`  返回职位数: ${allJobsResponse.jobs?.length || 0}`);
      console.log(`  总职位数: ${allJobsResponse.total || 0}`);
      console.log('');
      
      // 分析数据特征
      if (allJobsResponse.jobs && allJobsResponse.jobs.length > 0) {
        const jobs = allJobsResponse.jobs;
        const hasCategory = jobs.filter(j => j.category).length;
        const hasCompany = jobs.filter(j => j.company).length;
        const hasLocation = jobs.filter(j => j.location).length;
        const isRemote = jobs.filter(j => j.isRemote).length;
        
        console.log('📈 数据特征分析:');
        console.log(`  有分类: ${hasCategory}/${jobs.length}`);
        console.log(`  有公司: ${hasCompany}/${jobs.length}`);
        console.log(`  有地点: ${hasLocation}/${jobs.length}`);
        console.log(`  远程职位: ${isRemote}/${jobs.length}`);
        console.log('');
        
        // 统计分类
        const categories = {};
        jobs.forEach(job => {
          const cat = job.category || '未分类';
          categories[cat] = (categories[cat] || 0) + 1;
        });
        
        console.log('📊 分类统计:');
        Object.entries(categories)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .forEach(([cat, count]) => {
            console.log(`  ${cat}: ${count} 个`);
          });
        console.log('');
      }
    } else {
      console.log(`❌ 前端 API 调用失败`);
      console.log(`  错误信息: ${allJobsResponse.error || allJobsResponse.message || 'unknown'}`);
      console.log('');
    }

    // 5. 结论和建议
    console.log('========================================');
    console.log('📝 诊断结论');
    console.log('========================================\n');

    if (stats.total > 0) {
      console.log('✅ 开发环境数据状态良好');
      console.log(`   • 数据已存储: ${stats.total} 条`);
      console.log(`   • 存储位置: ${stats.provider}`);
      console.log('');
      
      if (jobsResponse.jobs && jobsResponse.jobs.length > 0) {
        console.log('✅ API 正常返回数据');
        console.log('');
        console.log('如果"全部职位"页面显示没有数据，可能的原因：');
        console.log('  1️⃣  页面需要刷新（硬刷新: Cmd/Ctrl + Shift + R）');
        console.log('  2️⃣  浏览器缓存问题');
        console.log('  3️⃣  筛选条件过滤掉了所有数据');
        console.log('  4️⃣  前端 JavaScript 错误（查看浏览器控制台）');
        console.log('');
        console.log('💡 建议操作：');
        console.log('  • 打开浏览器开发者工具（F12）');
        console.log('  • 切换到 Console 标签');
        console.log('  • 刷新"全部职位"页面');
        console.log('  • 查看是否有红色错误信息');
        console.log('  • 检查 Network 标签，看 API 调用是否成功');
      } else {
        console.log('⚠️  API 返回成功但数据为空');
        console.log('');
        console.log('可能的原因：');
        console.log('  1️⃣  数据存储和API读取不同步');
        console.log('  2️⃣  Redis key 不匹配');
        console.log('  3️⃣  数据被过滤掉了');
        console.log('');
        console.log('💡 建议操作：');
        console.log('  • 重新运行数据同步脚本');
        console.log('  • 检查 Vercel 部署日志');
      }
    } else {
      console.log('❌ 开发环境暂无数据');
      console.log('');
      console.log('💡 解决方案：');
      console.log('  1. 运行数据同步脚本:');
      console.log('     node scripts/sync-data.js');
      console.log('');
      console.log('  2. 或使用测试数据:');
      console.log('     参考 MANUAL_SYNC_STEPS.md');
    }

    console.log('');
    console.log('========================================');
    console.log('✅ 诊断完成');
    console.log('========================================\n');

  } catch (error) {
    console.error('\n❌ 诊断过程中发生错误:', error.message);
    console.error('\n可能的原因：');
    console.error('1. 网络连接问题');
    console.error('2. 开发环境未部署');
    console.error('3. API 端点错误\n');
    process.exit(1);
  }
}

// 运行主函数
main();

