#!/usr/bin/env node

/**
 * 数据同步脚本 - 从生产环境复制数据到开发环境
 */

const https = require('https');
const http = require('http');

// 配置
const PROD_URL = 'https://haigoo.vercel.app/api/data/processed-jobs?limit=100';
const DEV_URL = 'https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/data/processed-jobs';
const DATA_LIMIT = 100;

console.log('=========================================');
console.log('🔄 开始从生产环境同步数据到开发环境');
console.log('=========================================\n');
console.log(`源（生产）: https://haigoo.vercel.app`);
console.log(`目标（开发）: https://haigoo-remote-git-develop-caitlinyct.vercel.app`);
console.log(`数据量: 最多 ${DATA_LIMIT} 条\n`);

// 测试数据（如果生产环境没有数据）
const TEST_DATA = [
  {
    id: 'sync-test-1',
    title: '高级前端工程师 (远程)',
    company: 'TechCorp',
    location: '远程 - 全球',
    category: '前端开发',
    experienceLevel: 'Senior',
    isRemote: true,
    salary: '40-60K RMB/月',
    jobType: '全职',
    description: '负责前端产品开发，使用 React、TypeScript 等现代技术栈。',
    requirements: ['5年以上前端开发经验', '精通 React 和 TypeScript'],
    benefits: ['远程办公', '弹性工作时间', '技术培训'],
    tags: ['React', 'TypeScript', '远程'],
    url: 'https://example.com/job1',
    source: '测试数据',
    publishedAt: new Date().toISOString(),
    status: 'active'
  },
  {
    id: 'sync-test-2',
    title: '全栈开发工程师',
    company: 'StartupXYZ',
    location: '远程 - 中国',
    category: '全栈开发',
    experienceLevel: 'Mid',
    isRemote: true,
    salary: '30-50K RMB/月',
    jobType: '全职',
    description: '参与产品全栈开发，使用 Node.js、React 技术栈。',
    requirements: ['3年以上全栈开发经验', '熟悉 Node.js 和前端框架'],
    benefits: ['弹性工作', '股票期权', '年度奖金'],
    tags: ['Node.js', 'React', 'MongoDB'],
    url: 'https://example.com/job2',
    source: '测试数据',
    publishedAt: new Date().toISOString(),
    status: 'active'
  }
];

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
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    }).on('error', (e) => {
      reject(e);
    });
  });
}

/**
 * 发送 POST 请求
 */
function postData(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });
    
    req.on('error', (e) => {
      reject(e);
    });
    
    req.write(postData);
    req.end();
  });
}

/**
 * 主函数
 */
async function main() {
  try {
    // 步骤 1: 从生产环境获取数据
    console.log('📥 步骤 1/3: 从生产环境获取数据...\n');
    
    let prodData;
    let jobsArray;
    let jobsCount = 0;
    
    try {
      prodData = await fetchData(PROD_URL);
      
      if (prodData && prodData.data && Array.isArray(prodData.data)) {
        jobsArray = prodData.data;
        jobsCount = jobsArray.length;
        console.log(`✅ 成功获取 ${jobsCount} 条职位数据\n`);
        
        // 显示前3条预览
        if (jobsCount > 0) {
          console.log('📊 数据预览（前3条）:');
          jobsArray.slice(0, 3).forEach(job => {
            console.log(`  - ${job.title} at ${job.company}`);
          });
          console.log('');
        }
      } else {
        throw new Error('Invalid data format');
      }
    } catch (e) {
      console.log(`⚠️  警告: 无法从生产环境获取数据`);
      console.log(`   原因: ${e.message}\n`);
      console.log('   将使用测试数据继续...\n');
      jobsArray = TEST_DATA;
      jobsCount = TEST_DATA.length;
    }
    
    // 步骤 2: 准备数据
    console.log('🔧 步骤 2/3: 准备数据...');
    console.log(`✅ 数据准备完成（${jobsCount} 条）\n`);
    
    // 步骤 3: 推送到开发环境
    console.log('📤 步骤 3/3: 推送数据到开发环境...\n');
    
    const response = await postData(DEV_URL, jobsArray);
    
    if (response.success || response.saved) {
      const savedCount = response.saved || response.total || jobsCount;
      console.log(`✅ 成功！已将 ${savedCount} 条数据同步到开发环境\n`);
      console.log('返回信息:');
      console.log(JSON.stringify(response, null, 2));
      console.log('');
    } else {
      throw new Error(`Push failed: ${JSON.stringify(response)}`);
    }
    
    // 验证数据
    console.log('🔍 验证开发环境数据...');
    const statsUrl = 'https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/storage/stats';
    const stats = await fetchData(statsUrl);
    console.log(`开发环境当前数据量: ${stats.total || 'unknown'}\n`);
    
    // 完成
    console.log('=========================================');
    console.log('🎉 数据同步完成！');
    console.log('=========================================\n');
    console.log('📍 现在可以访问以下链接测试：\n');
    console.log('开发环境:');
    console.log('  - 首页: https://haigoo-remote-git-develop-caitlinyct.vercel.app');
    console.log('  - 职位列表: https://haigoo-remote-git-develop-caitlinyct.vercel.app/jobs');
    console.log('  - 数据统计: https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/storage/stats\n');
    console.log('💡 提示:');
    console.log('  - 开发环境和生产环境的数据完全隔离');
    console.log('  - 在开发环境的任何操作都不会影响生产环境');
    console.log('  - 如需重新同步，再次运行此脚本即可\n');
    
  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error('\n可能的原因：');
    console.error('1. 网络连接问题');
    console.error('2. 开发环境 Redis 未配置');
    console.error('3. API 权限问题\n');
    console.error('调试建议：');
    console.error('1. 检查开发环境健康状态:');
    console.error('   curl https://haigoo-remote-git-develop-caitlinyct.vercel.app/api/health\n');
    console.error('2. 查看 Vercel 部署日志\n');
    console.error('3. 确认环境变量配置正确\n');
    process.exit(1);
  }
}

// 运行主函数
main();

