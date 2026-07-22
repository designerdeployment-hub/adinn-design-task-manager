require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { readDb, dataFile, storageInfo } = require('../lib/store');

async function main() {
  const backupDir = path.resolve(process.cwd(), process.env.BACKUP_DIR || './backups');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `adinn-design-workflow-backup-${stamp}.json`);
  fs.writeFileSync(backupFile, JSON.stringify({ exported_at: new Date().toISOString(), source: storageInfo().driver === 'file' ? dataFile : storageInfo(), data: await readDb() }, null, 2));
  console.log(`Backup created: ${backupFile}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
