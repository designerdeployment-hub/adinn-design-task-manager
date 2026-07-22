require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { env, validateEnv } = require('../config/env');
const { ensureDb, readDb, dataFile, storageInfo, usingSupabase } = require('../lib/store');
const { uploadDir, usingSupabaseFiles, ensureBucket, storageInfo: fileStorageInfo } = require('../utils/upload');

function pass(label) { console.log(`PASS ${label}`); }
function warn(label) { console.warn(`WARN ${label}`); }
function fail(label) { console.error(`FAIL ${label}`); process.exitCode = 1; }

async function main() {
  try {
    validateEnv();
    pass('environment variables validated');
  } catch (error) {
    fail(error.message);
  }

  try {
    await ensureDb();
    const db = await readDb();
    if (!Array.isArray(db.users) || !Array.isArray(db.tasks)) fail('database structure is invalid');
    else pass(`database found with ${db.users.length} users and ${db.tasks.length} tasks`);
    pass(`storage driver: ${storageInfo().driver}`);
  } catch (error) {
    fail(`database read failed: ${error.message}`);
  }

  if (!usingSupabase()) {
    try {
      fs.accessSync(path.dirname(dataFile), fs.constants.R_OK | fs.constants.W_OK);
      pass(`data directory is writable: ${path.dirname(dataFile)}`);
    } catch (error) {
      fail(`data directory is not writable: ${path.dirname(dataFile)}`);
    }
  } else {
    pass(`Supabase state table ready: ${storageInfo().table}`);
  }

  if (usingSupabaseFiles()) {
    try {
      await ensureBucket();
      pass(`Supabase file bucket ready: ${fileStorageInfo().bucket}`);
    } catch (error) {
      fail(`Supabase file bucket failed: ${error.message}`);
    }
  } else {
    try {
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
      fs.accessSync(uploadDir, fs.constants.R_OK | fs.constants.W_OK);
      pass(`upload directory is writable: ${uploadDir}`);
    } catch (error) {
      fail(`upload directory is not writable: ${uploadDir}`);
    }
  }

  if (env.nodeEnv === 'production') {
    if (!process.env.FRONTEND_ORIGIN) warn('FRONTEND_ORIGIN is not set. CORS may block deployed frontend.');
    if ((process.env.JWT_SECRET || '').length < 32) warn('JWT_SECRET should be at least 32 characters.');
    if (!usingSupabase()) warn('Production is using file storage. Set DATA_DRIVER=supabase with Supabase env vars to avoid losing users/tasks on Render Free.');
    if (!usingSupabaseFiles()) warn('Production file uploads are local. Set FILE_STORAGE_DRIVER=supabase and SUPABASE_STORAGE_BUCKET to store design files permanently.');
  }

  if (process.exitCode) process.exit(process.exitCode);
  console.log('Preflight completed successfully.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
