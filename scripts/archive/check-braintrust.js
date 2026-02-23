
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
// Dynamic import to ensure env is loaded first
const neonHelper = (await import('../server-utils/dal/neon-helper.js')).default;

async function checkBraintrust() {
  try {
    console.log('Checking Braintrust in trusted_companies...');
    const companies = await neonHelper.query("SELECT * FROM trusted_companies WHERE name ILIKE '%Braintrust%'");
    if (companies.length > 0) {
        const c = companies[0];
        console.log('Braintrust URL:', c.careers_page);
        console.log('Website:', c.website);
        console.log('Source:', c.source);
    } else {
        console.log('Braintrust not found');
    }
  } catch (e) {
    console.error(e);
  }
}

checkBraintrust();
