import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import 'dotenv/config';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

try {
  const result = await db.execute('SELECT 1 as test');
  console.log('Connection successful:', result);
} catch (err) {
  console.error('Connection failed:', err);
} finally {
  await pool.end();
}
