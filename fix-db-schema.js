
import neonHelper from './server-utils/dal/neon-helper.js';

async function fixSchema() {
  console.log('Checking database schema...');
  
  try {
    // 1. Check if trusted_companies has data
    try {
        const trustedResult = await neonHelper.query('SELECT count(*) FROM trusted_companies');
        if (trustedResult && trustedResult.length > 0) {
            console.log('trusted_companies count:', trustedResult[0].count);
        } else {
            console.log('trusted_companies query returned empty result');
        }
    } catch (e) {
        console.error('Error checking trusted_companies:', e.message);
    }

    // 2. Check if extracted_companies exists
    try {
        const extractedResult = await neonHelper.query('SELECT count(*) FROM extracted_companies');
         if (extractedResult && extractedResult.length > 0) {
            console.log('extracted_companies count:', extractedResult[0].count);
        } else {
            console.log('extracted_companies query returned empty result');
            throw new Error('Table likely missing or empty result');
        }
    } catch (e) {
        console.log('extracted_companies table check failed:', e.message);
        
        console.log('Creating extracted_companies table...');
        await neonHelper.query(`
            CREATE TABLE IF NOT EXISTS extracted_companies (
              id SERIAL PRIMARY KEY,
              company_id VARCHAR(255) UNIQUE NOT NULL,
              name VARCHAR(500) NOT NULL,
              url VARCHAR(2000),
              description TEXT,
              logo VARCHAR(2000),
              cover_image TEXT,
              industry VARCHAR(100) DEFAULT '其他',
              tags JSONB DEFAULT '[]',
              source VARCHAR(50) DEFAULT 'extracted',
              job_count INTEGER DEFAULT 0,
              created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('extracted_companies table created.');
    }

  } catch (e) {
    console.error('Schema fix failed:', e);
  }
}

fixSchema();
