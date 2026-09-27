import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[!] Missing DATABASE_URL in backend/.env');
  process.exit(1);
}

const sqlFiles = process.argv.slice(2);
const defaults = [
  path.join(root, 'database', '0001_init.sql'),
  path.join(root, 'database', 'seed.sql'),
];
const files = sqlFiles.length
  ? sqlFiles.map((file) => path.resolve(file))
  : defaults;

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log('Connecting to Supabase Postgres…');
  await client.connect();
  const who = await client.query('select current_database() as db, current_user as user, version() as version');
  console.log(`Connected: db=${who.rows[0].db} user=${who.rows[0].user}`);
  console.log(`Version: ${String(who.rows[0].version).split('\n')[0]}`);

  for (const file of files) {
    if (!fs.existsSync(file)) {
      throw new Error(`SQL file not found: ${file}`);
    }
    const sql = fs.readFileSync(file, 'utf8');
    console.log(`\nApplying ${path.relative(root, file)}…`);
    await client.query(sql);
    console.log('OK');
  }

  const counts = await client.query(`
    select
      (select count(*)::int from properties) as properties,
      (select count(*)::int from leases) as leases,
      (select count(*)::int from transactions) as transactions
  `);
  console.log('\nRow counts:', counts.rows[0]);
  console.log('\nDatabase setup complete.');
}

run()
  .catch((error) => {
    console.error('\n[!] Migration failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
