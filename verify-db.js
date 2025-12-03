
import neonHelper from './server-utils/dal/neon-helper.js';

async function verifySchema() {
  try {
    console.log('Checking if extracted_companies table exists and is usable...');
    const extractedResult = await neonHelper.query('SELECT count(*) FROM extracted_companies');
    if (extractedResult && extractedResult.length > 0) {
        console.log('✅ extracted_companies count:', extractedResult[0].count);
    } else {
        console.log('❌ extracted_companies query returned empty result (but no error)');
    }

    console.log('Checking if trusted_companies table exists...');
    const trustedResult = await neonHelper.query('SELECT count(*) FROM trusted_companies');
    if (trustedResult && trustedResult.length > 0) {
        console.log('✅ trusted_companies count:', trustedResult[0].count);
    } else {
        console.log('❌ trusted_companies query returned empty result (but no error)');
    }
    
  } catch (e) {
    console.error('Verification failed:', e);
  }
}

verifySchema();
