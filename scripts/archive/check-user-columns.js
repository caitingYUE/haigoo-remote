import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { default: neonHelper } = await import('../server-utils/dal/neon-helper.js');

async function checkUserColumns() {
    console.log('Checking users table columns...');
    try {
        // Query to get column names for 'users' table
        const result = await neonHelper.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users';
        `);
        console.log('Columns in users table:', result);
    } catch (e) {
        console.error('Error:', e);
    }
}

checkUserColumns();
