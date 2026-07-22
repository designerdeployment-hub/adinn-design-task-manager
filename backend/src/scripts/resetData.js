require('dotenv').config();
const { seedDb, writeDb, storageInfo } = require('../lib/store');

async function main() {
  await writeDb(seedDb());
  console.log(`Data reset using ${storageInfo().driver} storage.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
