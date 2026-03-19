import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
pool.query(`
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'jobs';
`).then(res => {
  console.log("Columns:", res.rows.map(r => r.column_name));
  process.exit();
}).catch(console.error);
