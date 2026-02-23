
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, '../.env.local');

console.log('Loading env from:', envPath);
if (fs.existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error('Error loading .env.local:', result.error);
  }
} else {
  console.warn('.env.local not found, trying default .env');
  dotenv.config();
}

async function main() {
    if (!process.env.DATABASE_URL) {
         console.error('DATABASE_URL is missing from environment variables.');
         process.exit(1);
    }

    // Dynamic import to ensure env vars are loaded first
    const { default: neonHelper } = await import('../server-utils/dal/neon-helper.js');

    if (!neonHelper.isConfigured) {
        console.error('Database not configured in neonHelper (even after loading env).');
        process.exit(1);
    }

    console.log('Starting schema update for Membership feature...');

  try {
    // 1. Add membership columns to users table
    console.log('Checking users table columns...');
    
    const addMembershipLevel = `
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='membership_level') THEN 
          ALTER TABLE users ADD COLUMN membership_level VARCHAR(50) DEFAULT 'none'; 
        END IF; 
      END $$;
    `;
    await neonHelper.query(addMembershipLevel);
    console.log('Checked/Added membership_level');

    const addMembershipStart = `
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='membership_start_at') THEN 
          ALTER TABLE users ADD COLUMN membership_start_at TIMESTAMP; 
        END IF; 
      END $$;
    `;
    await neonHelper.query(addMembershipStart);
    console.log('Checked/Added membership_start_at');

    const addMembershipExpire = `
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='membership_expire_at') THEN 
          ALTER TABLE users ADD COLUMN membership_expire_at TIMESTAMP; 
        END IF; 
      END $$;
    `;
    await neonHelper.query(addMembershipExpire);
    console.log('Checked/Added membership_expire_at');

    // 2. Create payment_records table
    console.log('Checking payment_records table...');
    const createPaymentRecords = `
      CREATE TABLE IF NOT EXISTS payment_records (
        id SERIAL PRIMARY KEY,
        payment_id VARCHAR(255) UNIQUE NOT NULL,
        user_id VARCHAR(255) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) DEFAULT 'CNY',
        payment_method VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        plan_id VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
    await neonHelper.query(createPaymentRecords);
    console.log('Checked/Created payment_records table');

    // 3. Create member_id_seq sequence
    console.log('Checking member_id_seq...');
    const createSequence = `CREATE SEQUENCE IF NOT EXISTS member_id_seq START WITH 100000;`;
    await neonHelper.query(createSequence);
    console.log('Checked/Created member_id_seq');

    console.log('Schema update completed successfully.');
  } catch (error) {
    console.error('Schema update failed:', error);
    process.exit(1);
  }
}

main();
