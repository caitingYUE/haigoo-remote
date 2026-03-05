import 'dotenv/config';
import neonHelper from './server-utils/dal/neon-helper.js';

async function test() {
    try {
        const result = await neonHelper.query(
            `SELECT job_id, title, company FROM jobs WHERE job_id LIKE '%,%' LIMIT 10`
        );
        console.log("Jobs with commas in job_id:", result.length);
        if (result.length > 0) {
            console.log(result.map(r => r.job_id));
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

test();
