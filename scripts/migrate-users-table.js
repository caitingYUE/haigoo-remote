
import neonHelper from '../server-utils/dal/neon-helper.js';

async function migrate() {
  console.log('Starting migration...');
  
  const columns = [
    "ADD COLUMN IF NOT EXISTS member_status VARCHAR(50) DEFAULT 'free'",
    "ADD COLUMN IF NOT EXISTS member_expire_at TIMESTAMP",
    "ADD COLUMN IF NOT EXISTS member_since TIMESTAMP",
    "ADD COLUMN IF NOT EXISTS membership_level VARCHAR(50) DEFAULT 'none'",
    "ADD COLUMN IF NOT EXISTS membership_start_at TIMESTAMP",
    "ADD COLUMN IF NOT EXISTS membership_expire_at TIMESTAMP"
  ];

  // Also create payment_records table if not exists
  const createPaymentTable = `
    CREATE TABLE IF NOT EXISTS payment_records (
      id SERIAL PRIMARY KEY,
      payment_id VARCHAR(255) UNIQUE NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      amount DECIMAL(10, 2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'CNY',
      payment_method VARCHAR(50),
      status VARCHAR(50) DEFAULT 'pending',
      plan_id VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    console.log('Creating payment_records table...');
    await neonHelper.query(createPaymentTable);
    console.log('payment_records table check/create done.');
  } catch (e) {
    console.error('Failed to create payment_records:', e);
  }

  for (const col of columns) {
    const query = `ALTER TABLE users ${col};`;
    console.log(`Executing: ${query}`);
    try {
        const res = await neonHelper.query(query);
        console.log('Success.');
    } catch (e) {
        console.error('Failed:', e.message);
    }
  }
  
  console.log('Migration complete.');
}

migrate();
