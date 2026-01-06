
import { countJobsFromNeon, readJobsFromNeon } from './lib/api-handlers/processed-jobs.js';
import neonHelper from './server-utils/dal/neon-helper.js';

async function test() {
    try {
        console.log('Testing countJobsFromNeon with isTranslated: false...');
        const queryParams = { isAdmin: true, isTranslated: false };
        
        // 1. Check Count
        const count = await countJobsFromNeon(queryParams);
        console.log(`Count Result: ${count}`);

        // 2. Check Read (first 5)
        console.log('Reading first 5 jobs...');
        const jobs = await readJobsFromNeon(queryParams, { page: 1, limit: 5 });
        
        console.log(`Read ${jobs.length} jobs.`);
        jobs.forEach(j => {
            console.log(`[${j.id}] Title: ${j.title}`);
            console.log(`       Translated: ${j.isTranslated}`);
            console.log(`       Translations: ${JSON.stringify(j.translations)}`);
            // Check regex locally
            const tTitle = j.translations?.title || '';
            const tDesc = j.translations?.description || '';
            const hasChinese = /[\u4e00-\u9fa5]/.test(tTitle) || /[\u4e00-\u9fa5]/.test(tDesc);
            console.log(`       Has Chinese (JS check): ${hasChinese}`);
        });

    } catch (e) {
        console.error('Error:', e);
    }
}

test();
