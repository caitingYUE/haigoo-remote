
import neonHelper from './server-utils/dal/neon-helper.js';

async function diagnose() {
  try {
    console.log('--- Starting Database Diagnosis ---');

    // 1. Total Count
    const totalResult = await neonHelper.query('SELECT COUNT(*) FROM jobs');
    if (!totalResult || totalResult.length === 0) {
        console.log('No result from COUNT query');
        return;
    }
    const total = totalResult[0].count;
    console.log(`Total Jobs: ${total}`);

    // 2. Region Distribution
    const regionResult = await neonHelper.query(`
      SELECT region, COUNT(*) 
      FROM jobs 
      GROUP BY region
    `);
    console.log('\n--- Region Distribution ---');
    console.table(regionResult);

    // 3. Can Refer Distribution
    const referralResult = await neonHelper.query(`
      SELECT can_refer, COUNT(*) 
      FROM jobs 
      GROUP BY can_refer
    `);
    console.log('\n--- Referral Distribution ---');
    console.table(referralResult);

    // 4. Source Type Distribution
    const sourceResult = await neonHelper.query(`
      SELECT source_type, COUNT(*) 
      FROM jobs 
      GROUP BY source_type
    `);
    console.log('\n--- Source Type Distribution ---');
    console.table(sourceResult);

    // 5. Cross Check: Domestic + Referral
    const crossResult = await neonHelper.query(`
      SELECT COUNT(*) 
      FROM jobs 
      WHERE can_refer = true AND region IN ('domestic', 'both')
    `);
    console.log(`\nJobs matching 'Club Referral' AND 'Domestic': ${crossResult[0].count}`);

    // 6. Sample Jobs (Domestic)
    const sampleResult = await neonHelper.query(`
      SELECT job_id, title, company, location, region 
      FROM jobs 
      WHERE region IN ('domestic', 'both') 
      LIMIT 5
    `);
    console.log('\n--- Sample Domestic Jobs ---');
    console.table(sampleResult);

  } catch (error) {
    console.error('Diagnosis failed:', error);
  } finally {
    process.exit();
  }
}

diagnose();
