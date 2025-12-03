
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

async function checkJobs() {
  // Dynamic import to ensure env vars are loaded first
  const neonHelper = (await import('./server-utils/dal/neon-helper.js')).default;

  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not Set');
  
  try {
      if (!process.env.DATABASE_URL) {
          console.log('No DATABASE_URL found');
          return;
      }

    const total = await neonHelper.query('SELECT count(*) FROM jobs');
    if (!total) {
        console.log('Query returned null/undefined');
        return;
    }
    console.log('Total jobs:', total[0].count);

    const statusDist = await neonHelper.query('SELECT status, count(*) FROM jobs GROUP BY status');
    console.log('Status distribution:', statusDist);
    
    const sample = await neonHelper.query('SELECT job_id, title, company, status FROM jobs LIMIT 5');
    console.log('Sample jobs:', sample);

  } catch (e) {
    console.error(e);
  }
}

checkJobs();
