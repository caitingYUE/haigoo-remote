
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

async function testExtract() {
  // Mock request and response
  const req = {
    method: 'GET',
    query: {
      resource: 'companies',
      action: 'extract'
    }
  };

  const res = {
    setHeader: (k, v) => {},
    status: (code) => {
      return {
        json: (data) => {
          console.log(`Response Status: ${code}`);
          console.log('Response Data:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
          if (data.companies && data.companies.length > 0) {
             console.log('First company:', data.companies[0]);
          }
        }
      }
    }
  };

  try {
    const handler = (await import('./lib/api-handlers/trusted-companies.js')).default;
    await handler(req, res);
  } catch (e) {
    console.error('Handler error:', e);
  }
}

testExtract();
