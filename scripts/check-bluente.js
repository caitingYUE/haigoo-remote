
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function checkData() {
    try {
        // Dynamic import to ensure env vars are loaded first
        const { default: neonHelper } = await import('../server-utils/dal/neon-helper.js');

        console.log('Checking DB connection...');
        const companies = await neonHelper.query(`SELECT * FROM trusted_companies LIMIT 5`);
        if (!companies) {
            console.log('Connection failed or no data.');
            return;
        }
        console.log('Top 5 companies:', companies.map(c => c.name));

        console.log('Checking trusted_companies for "Bluente"...');
        const bluente = await neonHelper.query(`
            SELECT company_id, name, logo, website 
            FROM trusted_companies 
            WHERE name ILIKE '%Bluente%'
        `);
        console.log('Bluente in trusted:', bluente);

        if (bluente && bluente.length > 0) {
            const companyId = bluente[0].company_id;
            console.log(`Checking jobs for company_id ${companyId}...`);
            const jobsById = await neonHelper.query(`
                SELECT job_id, title, company, company_id, company_logo 
                FROM jobs 
                WHERE company_id = $1
            `, [companyId]);
            console.log('Jobs by ID match:', jobsById ? jobsById.length : 0);
            if (jobsById && jobsById.length > 0) {
                 console.log('Sample job:', jobsById[0]);
            }
        }

        console.log('Checking jobs for "Bluente" by name...');
        const jobsByName = await neonHelper.query(`
            SELECT job_id, title, company, company_id, company_logo 
            FROM jobs 
            WHERE company ILIKE '%Bluente%'
        `);
        console.log('Jobs by Name match:', jobsByName ? jobsByName.length : 0);
        if (jobsByName && jobsByName.length > 0) {
             console.log('Sample job by name:', jobsByName[0]);
        }

    } catch (error) {
        console.error('Error:', error);
    }
}

checkData();
