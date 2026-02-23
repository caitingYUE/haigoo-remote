
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function fixAutoArk() {
    try {
        const companyName = '无界方舟';
        console.log(`Updating company: ${companyName}...`);
        
        // Update email_type to '招聘邮箱' (Short form, valid in constraint)
        const result = await sql`
            UPDATE trusted_companies 
            SET email_type = '招聘邮箱'
            WHERE name = ${companyName}
            RETURNING id, name, email_type
        `;
        
        console.log('Update Result:', result);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

fixAutoArk();
