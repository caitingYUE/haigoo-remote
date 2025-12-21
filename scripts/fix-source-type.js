
import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

// Load env
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || process.env.HAIGOO_DATABASE_URL;

if (!DATABASE_URL) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
}

const sql = neon(DATABASE_URL);

async function migrate() {
    try {
        console.log('Force migrating source_type to official for ALL linked jobs...');
        
        // Update all jobs that are linked to a company (company_id IS NOT NULL)
        // Set them to 'official' and ensure is_trusted is true
        const result = await sql`
            UPDATE jobs 
            SET source_type = 'official', is_trusted = true
            WHERE company_id IS NOT NULL 
            AND (source_type != 'official' OR source_type IS NULL OR is_trusted IS NOT TRUE)
        `;
        
        console.log('Update executed.');
        
        console.log('Checking AlphaSights jobs source_type...');
        const check = await sql`SELECT count(*) as count, source_type FROM jobs WHERE company ILIKE 'AlphaSights' GROUP BY source_type`;
        console.log('AlphaSights jobs distribution:', check);
        
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    }
}

migrate();
