
import neonHelper from './server-utils/dal/neon-helper.js';

async function checkRaw() {
  try {
    const res = await neonHelper.query('SELECT count(*) as count FROM jobs');
    console.log('Jobs count result:', JSON.stringify(res));
  } catch (e) {
    console.error(e);
  }
}

checkRaw();
