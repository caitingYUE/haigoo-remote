
import neonHelper from './server-utils/dal/neon-helper.js';

async function checkStats() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  console.log('Checking stats...');
  
  try {
    const total = await neonHelper.query('SELECT COUNT(*) FROM jobs');
    const domestic = await neonHelper.query("SELECT COUNT(*) FROM jobs WHERE region IN ('domestic', 'both')");
    const daily = await neonHelper.query('SELECT COUNT(*) FROM jobs WHERE published_at >= $1', [oneDayAgo]);
    const dailyDomestic = await neonHelper.query("SELECT COUNT(*) FROM jobs WHERE region IN ('domestic', 'both') AND published_at >= $1", [oneDayAgo]);
    
    console.log('Total Jobs:', total[0].count);
    console.log('Domestic Jobs:', domestic[0].count);
    console.log('Daily Jobs (Global):', daily[0].count);
    console.log('Daily Jobs (Domestic):', dailyDomestic[0].count);
  } catch (e) {
    console.error(e);
  }
}

checkStats();
