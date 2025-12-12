
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkJobQuery() {
    try {
        const { default: neonHelper } = await import('../server-utils/dal/neon-helper.js');

        console.log('Running query from processed-jobs.js logic...');
        const query = `
          SELECT *, 
            (SELECT website FROM trusted_companies tc WHERE tc.company_id = jobs.company_id) as trusted_website,
            (SELECT logo FROM trusted_companies tc WHERE tc.company_id = jobs.company_id) as trusted_logo
          FROM jobs
          WHERE company ILIKE '%Bluente%'
          LIMIT 1
        `;
        
        const result = await neonHelper.query(query);
        if (result && result.length > 0) {
            const row = result[0];
            console.log('Row data:');
            console.log('company_id:', row.company_id);
            console.log('company_logo:', row.company_logo);
            console.log('trusted_logo:', row.trusted_logo);
            console.log('trusted_website:', row.trusted_website);
        } else {
            console.log('No job found.');
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkJobQuery();
