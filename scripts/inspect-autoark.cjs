
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function inspectCompany() {
    try {
        const companyName = '无界方舟';
        const companies = await sql`
            SELECT id, name, email_type, hiring_email, industry
            FROM trusted_companies 
            WHERE name = ${companyName}
        `;
        
        if (companies.length > 0) {
            const companyId = companies[0].id;
            console.log(`Company ID: ${companyId}`);
            
            // Check jobs without invalid columns
            const jobs = await sql`
                SELECT id, title, industry, category, tags, skills
                FROM jobs 
                WHERE company_id = ${companyId}
                LIMIT 5
            `;
            console.log('Jobs Data (Raw):');
            jobs.forEach(j => {
                console.log(`Title: ${j.title}`);
                console.log(`Industry: ${j.industry}`); // This is job-level industry
                console.log(`Category: ${j.category}`);
                console.log(`Tags: ${JSON.stringify(j.tags)}`);
                console.log(`Skills: ${JSON.stringify(j.skills)}`);
                console.log('---');
            });
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

inspectCompany();
