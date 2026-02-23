
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
// Dynamic import to ensure env is loaded first
const neonHelper = (await import('../server-utils/dal/neon-helper.js')).default;

async function checkKrakenCompany() {
  try {
    console.log('Checking Kraken in trusted_companies...');
    const companies = await neonHelper.query("SELECT * FROM trusted_companies WHERE name ILIKE '%Kraken%'");
    console.log('Found:', companies.length);
    if (companies.length > 0) {
        console.log(companies[0]);
    }
  } catch (e) {
    console.error(e);
  }
}

checkKrakenCompany();
