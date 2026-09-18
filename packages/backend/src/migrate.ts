import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, closePool } from './db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, '..');
const migrationsFolder = join(__dirname, '../drizzle');
const MAX_ATTEMPTS = 5;

async function migrateWithRetry() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await migrate(db, { migrationsFolder });
      return;
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) throw error;

      const delay = attempt * 2000;
      console.warn(`Database migration attempt ${attempt} failed; retrying in ${delay}ms.`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function run() {
  console.log('Running database migrations...');
  try {
    await migrateWithRetry();
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