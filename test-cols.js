import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'jobs';
`).then(res => {
  console.log("COLUMNS:", res.rows.map(r => r.column_name).join(', '));
  process.exit();
}).catch(console.error);
