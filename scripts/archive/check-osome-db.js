
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const { default: neonHelper } = await import('../server-utils/dal/neon-helper.js');

async function checkJobs() {
    const r = await neonHelper.query("SELECT count(*) FROM jobs WHERE company ILIKE 'Osome'");
    console.log('Osome jobs count:', r[0].count);

    const jobs = await neonHelper.query("SELECT title, location, is_approved FROM jobs WHERE company ILIKE 'Osome' ORDER BY created_at DESC");
    console.log('Osome jobs details:');
    jobs.forEach((j, i) => {
        console.log(`${i + 1}. ${j.title} | ${j.location} | Approved: ${j.is_approved}`);
    });

    process.exit(0);
}

checkJobs().catch(err => {
    console.error(err);
    process.exit(1);
});
