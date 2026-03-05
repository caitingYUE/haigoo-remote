import neonHelper from './server-utils/dal/neon-helper.js';

async function test() {
  const result = await neonHelper.query('SELECT * FROM job_bundles ORDER BY id DESC LIMIT 1');
  console.log(result[0]);
  process.exit(0);
}

test();
