import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, closePool } from './db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const migrationsFolder = join(__dirname, '../drizzle');

async function run() {
  console.log('Running database migrations...');
  try {
    await migrate(db, { migrationsFolder });
    console.log('Database migrations completed.');
    await closePool();
    process.exit(0);
  } catch (err) {
    console.error('Database migration failed.', err);
    await closePool().catch(() => {});
    process.exit(1);
  }
}

run();