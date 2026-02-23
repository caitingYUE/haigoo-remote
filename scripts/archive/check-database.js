import dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

// Must load env first, then import neonHelper
const { default: neonHelper } = await import('../server-utils/dal/neon-helper.js');

async function checkDatabaseState() {
    console.log('=== 数据库状态检查 ===\n');

    if (!neonHelper.isConfigured) {
        console.error('❌ Neon 数据库未配置');
        process.exit(1);
    }

    console.log('✅ Neon 数据库已配置\n');

    try {
        // 1. 检查 jobs 表
        console.log('1. 检查 jobs 表:');
        const jobsCount = await neonHelper.query('SELECT COUNT(*) as count FROM jobs');
        console.log(`   总记录数: ${jobsCount[0].count}`);

        if (jobsCount[0].count > 0) {
            const sampleJobs = await neonHelper.query('SELECT job_id, title, company, is_translated, created_at FROM jobs LIMIT 5');
            console.log('   样本数据:');
            sampleJobs.forEach(job => {
                console.log(`   - ${job.title} @ ${job.company} (翻译: ${job.is_translated ? '是' : '否'})`);
            });
        }
        console.log('');

        // 2. 检查 trusted_companies 表
        console.log('2. 检查 trusted_companies 表:');
        const companiesCount = await neonHelper.query('SELECT COUNT(*) as count FROM trusted_companies');
        console.log(`   总记录数: ${companiesCount[0].count}`);

        if (companiesCount[0].count > 0) {
            const sampleCompanies = await neonHelper.query('SELECT company_id, name FROM trusted_companies LIMIT 5');
            console.log('   样本数据:');
            sampleCompanies.forEach(c => console.log(`   - ${c.name}`));
        }
        console.log('');

        // 3. 检查 extracted_companies 表
        console.log('3. 检查 extracted_companies 表:');
        const extractedCount = await neonHelper.query('SELECT COUNT(*) as count FROM extracted_companies');
        console.log(`   总记录数: ${extractedCount[0].count}`);

        if (extractedCount[0].count > 0) {
            const sampleExtracted = await neonHelper.query('SELECT company_id, name, job_count FROM extracted_companies LIMIT 5');
            console.log('   样本数据:');
            sampleExtracted.forEach(c => console.log(`   - ${c.name} (${c.job_count} 个岗位)`));
        }
        console.log('');

        // 4. 检查翻译状态
        console.log('4. 翻译状态统计:');
        const translationStats = await neonHelper.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_translated = true THEN 1 ELSE 0 END) as translated,
                SUM(CASE WHEN is_translated = false OR is_translated IS NULL THEN 1 ELSE 0 END) as untranslated
            FROM jobs
        `);
        console.log(`   总岗位: ${translationStats[0].total}`);
        console.log(`   已翻译: ${translationStats[0].translated}`);
        console.log(`   未翻译: ${translationStats[0].untranslated}`);
        console.log('');

        // 5. 诊断建议
        console.log('=== 诊断结果 ===');
        if (jobsCount[0].count === 0) {
            console.log('⚠️  jobs 表为空 - RSS 数据可能没有同步到数据库');
        }
        if (extractedCount[0].count === 0) {
            console.log('⚠️  extracted_companies 表为空 - 需要运行企业提取');
        }
        if (translationStats[0].untranslated > 0) {
            console.log(`ℹ️  有 ${translationStats[0].untranslated} 个岗位待翻译`);
        }

    } catch (error) {
        console.error('❌ 检查失败:', error);
        process.exit(1);
    }
}

checkDatabaseState();
