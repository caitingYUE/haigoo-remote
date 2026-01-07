/**
 * Diagnostic Script: Check Translation Data Integrity
 * 
 * This script checks the actual state of translations in the database
 * to identify why the UI shows untranslated jobs despite successful translation reports.
 */

import neonHelper from '../server-utils/dal/neon-helper.js';

async function diagnoseTranslations() {
    console.log('='.repeat(80));
    console.log('📊 Translation Data Integrity Diagnostic');
    console.log('='.repeat(80));

    if (!neonHelper.isConfigured) {
        console.error('❌ Neon database is not configured');
        process.exit(1);
    }

    try {
        // 1. Overall Statistics
        console.log('\n📈 OVERALL STATISTICS');
        console.log('-'.repeat(80));

        const overallStats = await neonHelper.query(`
      SELECT 
        COUNT(*) as total_jobs,
        COUNT(*) FILTER (WHERE is_translated IS TRUE) as marked_translated,
        COUNT(*) FILTER (WHERE is_translated IS NOT TRUE OR is_translated IS NULL) as marked_untranslated,
        COUNT(*) FILTER (WHERE translations IS NOT NULL) as has_translations_column,
        COUNT(*) FILTER (WHERE translations IS NULL) as no_translations_column,
        COUNT(*) FILTER (WHERE is_translated IS TRUE AND translations IS NULL) as flag_true_but_no_data,
        COUNT(*) FILTER (WHERE is_translated IS NOT TRUE AND translations IS NOT NULL) as flag_false_but_has_data
      FROM jobs
      WHERE status = 'active'
    `);

        const stats = overallStats[0];
        console.log(`Total Active Jobs: ${stats.total_jobs}`);
        console.log(`Marked as Translated (is_translated=true): ${stats.marked_translated}`);
        console.log(`Marked as Untranslated (is_translated=false/null): ${stats.marked_untranslated}`);
        console.log(`Has translations column data: ${stats.has_translations_column}`);
        console.log(`No translations column data: ${stats.no_translations_column}`);
        console.log(`⚠️  INCONSISTENT - Flag=TRUE but translations=NULL: ${stats.flag_true_but_no_data}`);
        console.log(`⚠️  INCONSISTENT - Flag=FALSE but translations NOT NULL: ${stats.flag_false_but_has_data}`);

        // 2. Sample Inconsistent Records
        if (parseInt(stats.flag_true_but_no_data) > 0) {
            console.log('\n⚠️  SAMPLE: Jobs marked translated but missing translation data');
            console.log('-'.repeat(80));

            const inconsistent = await neonHelper.query(`
        SELECT job_id, title, company, is_translated, translated_at, 
               LENGTH(description) as desc_len,
               translations
        FROM jobs
        WHERE is_translated IS TRUE AND translations IS NULL
        LIMIT 5
      `);

            inconsistent.forEach((job, idx) => {
                console.log(`\n${idx + 1}. Job ID: ${job.job_id}`);
                console.log(`   Title: ${job.title}`);
                console.log(`   Company: ${job.company}`);
                console.log(`   is_translated: ${job.is_translated}`);
                console.log(`   translated_at: ${job.translated_at}`);
                console.log(`   translations: ${job.translations}`);
                console.log(`   Description length: ${job.desc_len} chars`);
            });
        }

        // 3. Recent Translation Activity
        console.log('\n⏰ RECENT TRANSLATION ACTIVITY (Last 24 hours)');
        console.log('-'.repeat(80));

        const recentActivity = await neonHelper.query(`
      SELECT 
        DATE_TRUNC('hour', translated_at) as hour,
        COUNT(*) as translations_count
      FROM jobs
      WHERE translated_at >= NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', translated_at)
      ORDER BY hour DESC
      LIMIT 10
   `);

        if (recentActivity.length === 0) {
            console.log('❌ No translation activity in the last 24 hours!');
        } else {
            recentActivity.forEach(row => {
                console.log(`${row.hour}: ${row.translations_count} translations`);
            });
        }

        // 4. Sample Properly Translated Jobs
        console.log('\n✅ SAMPLE: Properly Translated Jobs');
        console.log('-'.repeat(80));

        const properlyTranslated = await neonHelper.query(`
      SELECT job_id, title, company, is_translated, translated_at,
             translations->>'title' as translated_title
      FROM jobs  
      WHERE is_translated IS TRUE 
        AND translations IS NOT NULL
        AND status = 'active'
      LIMIT 5
    `);

        if (properlyTranslated.length === 0) {
            console.log('❌ No properly translated jobs found!');
        } else {
            properlyTranslated.forEach((job, idx) => {
                console.log(`\n${idx + 1}. Job ID: ${job.job_id}`);
                console.log(`   Original Title: ${job.title}`);
                console.log(`   Translated Title: ${job.translated_title || 'NULL'}`);
                console.log(`   Translated At: ${job.translated_at}`);
            });
        }

        // 5. Check for Legacy Data Issues
        console.log('\n🔍 LEGACY DATA CHECK');
        console.log('-'.repeat(80));

        const legacyIssues = await neonHelper.query(`
      SELECT 
        COUNT(*) FILTER (WHERE translated_at IS NULL AND is_translated IS TRUE) as missing_timestamp,
        COUNT(*) FILTER (WHERE LENGTH(COALESCE(translations->>'description', '')) < 10 AND is_translated IS TRUE) as too_short,
        COUNT(*) FILTER (WHERE updated_at < NOW() - INTERVAL '7 days' AND is_translated IS NOT TRUE) as old_untranslated
      FROM jobs
      WHERE status = 'active'
    `);

        const legacy = legacyIssues[0];
        console.log(`Jobs marked translated but missing timestamp: ${legacy.missing_timestamp}`);
        console.log(`Jobs marked translated but translation too short: ${legacy.too_short}`);
        console.log(`Old untranslated jobs (>7 days): ${legacy.old_untranslated}`);

        console.log('\n' + '='.repeat(80));
        console.log('✅ Diagnostic Complete');
        console.log('='.repeat(80));

    } catch (error) {
        console.error('❌ Diagnostic failed:', error);
        throw error;
    }
}

// Run diagnostic
diagnoseTranslations()
    .then(() => {
        console.log('\n💡 Based on the results above:');
        console.log('   - If "Flag=TRUE but translations=NULL" > 0: Translation saving is failing');
        console.log('   - If "No translation activity": The cron task is not running or failing silently');
        console.log('   - If "missing_timestamp" > 0: Need to add translatedAt timestamps');
        process.exit(0);
    })
    .catch(err => {
        console.error('\n❌ Diagnostic error:', err);
        process.exit(1);
    });
