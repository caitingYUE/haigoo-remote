import('dotenv/config').then(async () => {
  const neon = (await import('./server-utils/dal/neon-helper.js')).default;
  const res = await neon.query('SELECT * FROM job_bundles');
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
});
