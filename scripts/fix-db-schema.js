import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config();

// Use the same logic as neon-helper.js
const DATABASE_URL = 
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL ||
    process.env.NEON_DATABASE_DATABASE_URL ||
    process.env.HAIGOO_DATABASE_URL ||
    process.env.haigoo_DATABASE_URL ||
    process.env.pre_haigoo_DATABASE_URL ||
    process.env.PRE_HAIGOO_DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is not defined in .env (checked multiple variants)');
  process.exit(1);
}

console.log('Using Database URL:', DATABASE_URL.substring(0, 20) + '...');

const sql = neon(DATABASE_URL);

async function main() {
  console.log('Checking database schema...');
  
  try {
    // 1. Add hiring_email to trusted_companies
    console.log('Adding hiring_email column to trusted_companies if not exists...');
    await sql`ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS hiring_email VARCHAR(255)`;
    
    // 2. Add email_type to trusted_companies
    console.log('Adding email_type column to trusted_companies if not exists...');
    await sql`ALTER TABLE trusted_companies ADD COLUMN IF NOT EXISTS email_type VARCHAR(50) DEFAULT '通用邮箱'`;
    
    console.log('Schema update completed successfully.');
  } catch (e) {
    console.error('Migration failed:', e);
    process.exit(1);
  }
}

main();
