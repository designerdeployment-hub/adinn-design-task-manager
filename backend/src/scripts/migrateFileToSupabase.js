require('dotenv').config();
const fs = require('fs');
const path = require('path');

async function main() {
  process.env.DATA_DRIVER = 'supabase';
  const { writeDb, migrateDb, dataFile, storageInfo } = require('../lib/store');

  const sourceFile = path.resolve(process.cwd(), process.argv[2] || process.env.DATA_FILE || './data/db.json');
  if (!fs.existsSync(sourceFile)) {
    throw new Error(`Source JSON database not found: ${sourceFile}`);
  }

  const raw = JSON.parse(fs.readFileSync(sourceFile, 'utf8'));
  const { db } = migrateDb(raw);
  await writeDb(db);
  console.log(`Migrated ${db.users.length} users and ${db.tasks.length} tasks from ${sourceFile} to Supabase table ${storageInfo().table}.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
