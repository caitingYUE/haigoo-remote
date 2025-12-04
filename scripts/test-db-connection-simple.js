
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';

async function testConnection() {
    const url = process.env.DATABASE_URL;
    console.log('Testing connection to:', url ? url.replace(/:[^:@]+@/, ':****@') : 'undefined');

    if (!url) {
        console.error('❌ DATABASE_URL not found in environment');
        return;
    }

    try {
        const sql = neon(url);
        const result = await sql`SELECT version()`;
        console.log('✅ Connection successful!');
        console.log('Database version:', result[0].version);
        
        // Also check feedbacks table existence
        try {
            const tableCheck = await sql`SELECT count(*) FROM feedbacks`;
            console.log('✅ Feedbacks table accessible. Row count:', tableCheck[0].count);
        } catch (e) {
            console.warn('⚠️ Could not query feedbacks table:', e.message);
        }

    } catch (error) {
        console.error('❌ Connection failed:', error);
    }
}

testConnection();
