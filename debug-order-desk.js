
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkOrderDeskJobs() {
    console.log('Checking jobs for Order Desk...');
    // Dynamic import to ensure env vars are loaded first
    const { default: neonHelper } = await import('./server-utils/dal/neon-helper.js');

    try {
        const query = `
            SELECT job_id, title, company, published_at, source, status, created_at, source_type, is_trusted, is_approved, is_manually_edited
            FROM jobs 
            WHERE company ILIKE '%Order Desk%'
            ORDER BY created_at DESC
        `;
        const jobs = await neonHelper.query(query);
        
        if (!jobs) {
             console.log('Query returned null.');
             return;
        }

        console.log(`Found ${jobs.length} jobs.`);
        jobs.forEach((job, index) => {
            console.log(`Job ${index + 1}:`);
            console.log(`  ID: ${job.job_id}`);
            console.log(`  Title: ${job.title}`);
            console.log(`  Company: ${job.company}`);
            console.log(`  Status: ${job.status}`);
            console.log(`  Source: ${job.source}`);
            console.log(`  Source Type: ${job.source_type}`);
            console.log(`  Is Trusted: ${job.is_trusted}`);
            console.log(`  Is Approved: ${job.is_approved}`);
            console.log(`  Is Manually Edited: ${job.is_manually_edited}`);
            console.log(`  Created At: ${job.created_at}`);
            console.log('-------------------');
        });
    } catch (error) {
        console.error('Error querying database:', error);
    }
}

checkOrderDeskJobs();
