
import neonHelper from '../server-utils/dal/neon-helper.js';

async function diagnose() {
    console.log('Starting RSS Diagnosis...');

    if (!neonHelper.isConfigured) {
        console.error('Neon DB is not configured!');
        return;
    }

    try {
        // 1. Check RSS Sources
        const sources = await neonHelper.query('SELECT COUNT(*) as count FROM rss_sources WHERE is_active = true');
        console.log(`Active RSS Sources: ${sources[0].count}`);

        // 2. Check Raw RSS Items fetched in last 24h
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const rawRecent = await neonHelper.query(`
            SELECT count(*) as count, status 
            FROM raw_rss 
            WHERE fetched_at > $1 
            GROUP BY status
        `, [oneDayAgo]);
        
        console.log('Raw RSS Items (Last 24h):');
        if (rawRecent.length === 0) {
            console.log('  No items found.');
        } else {
            rawRecent.forEach(r => console.log(`  ${r.status}: ${r.count}`));
        }

        // 3. Check Jobs created in last 24h
        const jobsRecent = await neonHelper.query(`
            SELECT count(*) as count 
            FROM jobs 
            WHERE created_at > $1 AND source_type = 'rss'
        `, [oneDayAgo]);
        console.log(`Jobs Created (Last 24h, RSS): ${jobsRecent[0].count}`);

        // 4. Check Pending Raw Items (Total)
        const pendingRaw = await neonHelper.query(`
            SELECT count(*) as count 
            FROM raw_rss 
            WHERE status = 'raw'
        `);
        console.log(`Total Pending Raw Items: ${pendingRaw[0].count}`);

        // 5. Check specific recent raw items to see if they are being ignored
        const sampleRaw = await neonHelper.query(`
            SELECT raw_id, title, source, fetched_at, status, processing_error 
            FROM raw_rss 
            WHERE status = 'error'
            ORDER BY fetched_at DESC 
            LIMIT 5
        `);
        console.log('Latest 5 Failed Raw Items:');
        sampleRaw.forEach(r => console.log(`  [${r.fetched_at}] ${r.source}: ${r.title}\n    Error: ${r.processing_error}`));

    } catch (e) {
        console.error('Diagnosis failed:', e);
    }
}

diagnose();
