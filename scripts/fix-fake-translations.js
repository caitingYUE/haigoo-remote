
import neonHelper from '../server-utils/dal/neon-helper.js';
import { translateJob } from '../lib/services/translation-service.cjs';

// Configuration
const BATCH_SIZE = 500;
const MIN_CHINESE_CHARS = 20; // At least 20 Chinese characters to be considered "Translated"

async function fixFakeTranslations() {
  console.log('🚀 Starting Fake Translation Fixer...');
  
  if (!neonHelper.isConfigured) {
    console.error('❌ Database not configured. Check environment variables.');
    process.exit(1);
  }

  try {
    // 1. Get Total Count of "Translated" jobs
    const countResult = await neonHelper.query(`SELECT count(*) FROM jobs WHERE is_translated = true`);
    const totalTranslated = parseInt(countResult[0].count, 10);
    console.log(`📊 Total 'Translated' jobs in DB: ${totalTranslated}`);

    let processed = 0;
    let fixed = 0;
    let page = 0;

    while (true) {
      // Fetch batch
      console.log(`\n📥 Fetching batch ${page + 1} (Offset ${page * BATCH_SIZE})...`);
      const jobs = await neonHelper.query(`
        SELECT job_id, title, translations 
        FROM jobs 
        WHERE is_translated = true 
        ORDER BY job_id DESC
        LIMIT ${BATCH_SIZE} OFFSET ${page * BATCH_SIZE}
      `);

      if (!jobs || jobs.length === 0) {
        console.log('✅ No more jobs to check.');
        break;
      }

      const toFix = [];

      for (const job of jobs) {
        const trans = job.translations || {};
        const tTitle = trans.title || '';
        const tDesc = trans.description || '';

        // Check for Chinese characters
        // We use a stricter check: Description must have significant Chinese content
        const chineseMatches = tDesc.match(/[\u4e00-\u9fa5]/g) || [];
        const chineseCount = chineseMatches.length;

        // Condition for "Fake":
        // 1. Translations object is empty/null (should be caught by SQL but double check)
        // 2. OR Chinese char count is below threshold
        if (!trans || chineseCount < MIN_CHINESE_CHARS) {
           // Double check: if original title was purely English, and translation failed, it might be English.
           // But we WANT to force re-translation if it's English.
           toFix.push(job.job_id);
           // console.log(`   Found Fake: [${job.job_id}] Chinese Chars: ${chineseCount} | Title: ${tTitle.substring(0, 20)}...`);
        }
      }

      console.log(`   Batch analysis: ${jobs.length} items, ${toFix.length} need fixing.`);

      // Update DB
      if (toFix.length > 0) {
        // Construct WHERE IN clause
        const ids = toFix.map(id => `'${id}'`).join(',');
        const updateQuery = `
          UPDATE jobs 
          SET is_translated = false, translations = null 
          WHERE job_id IN (${ids})
        `;
        
        await neonHelper.query(updateQuery);
        console.log(`   🛠️  Fixed (Unmarked) ${toFix.length} jobs.`);
        fixed += toFix.length;
      }

      processed += jobs.length;
      page++;
      
      // Safety break
      if (processed >= totalTranslated) break;
    }

    console.log('\n==========================================');
    console.log(`🎉 Operation Complete`);
    console.log(`Total Checked: ${processed}`);
    console.log(`Total Fixed: ${fixed}`);
    console.log('Now run the Translation Cron Job to re-process these jobs.');
    console.log('==========================================');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixFakeTranslations();
