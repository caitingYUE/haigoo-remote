
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function inspectTags() {
    try {
        const companyName = '无界方舟';
        console.log(`Querying jobs for: ${companyName}...`);
        
        // Remove 'company_industry' as it might be 'industry' or joined from another table
        // Actually the previous error said 'company_industry' doesn't exist, likely it's 'industry' in jobs table?
        // Let's query only known columns
        const jobs = await sql`
            SELECT title, tags, category
            FROM jobs 
            WHERE company = ${companyName}
            AND (
                title LIKE '%产品经理%' 
                OR title LIKE '%HR%'
            )
        `;
        
        jobs.forEach(j => {
            console.log(`Job: ${j.title}`);
            console.log(`Tags:`, j.tags);
            console.log(`Category:`, j.category);
            console.log('---');
        });

    } catch (error) {
        console.error('Error:', error);
    }
}

inspectTags();
