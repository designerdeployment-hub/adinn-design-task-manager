const express = require('express');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { authenticate, permit } = require('../middleware/auth');
const { readDb, dataFile, storageInfo } = require('../lib/store');
const { uploadDir, storageInfo: fileStorageInfo } = require('../utils/upload');
const { env } = require('../config/env');
const { asyncRoute } = require('../utils/asyncRoute');

const router = express.Router();
router.use(authenticate, permit('admin'));

function safeSize(filePath) {
  try { return fs.statSync(filePath).size; } catch { return 0; }
}

router.get('/system', asyncRoute(async (req, res) => {
  const db = await readDb();
  const uploadCount = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir).filter((name) => name !== '.gitkeep').length : 0;
  const storage = storageInfo();
  res.json({
    system: {
      service: 'Adinn Design Work Allocation API',
      version: env.appVersion,
      environment: env.nodeEnv,
      storage_driver: storage.driver,
      supabase_table: storage.table,
      supabase_state_key: storage.state_key,
      node: process.version,
      uptime_seconds: Math.round(process.uptime()),
      platform: `${os.type()} ${os.release()}`,
      data_file: storage.driver === 'file' ? dataFile : 'Supabase PostgreSQL',
      data_file_size_bytes: storage.driver === 'file' ? safeSize(dataFile) : 0,
      file_storage_driver: fileStorageInfo().driver,
      supabase_storage_bucket: fileStorageInfo().bucket,
      upload_dir: fileStorageInfo().upload_dir || uploadDir,
      upload_file_count: uploadCount,
      user_count: db.users.length,
      task_count: db.tasks.length,
      comment_count: db.task_comments.length,
      file_record_count: db.task_files.length,
      history_count: db.task_history.length,
      checked_at: new Date().toISOString()
    }
  });
}));

router.get('/backup.json', asyncRoute(async (req, res) => {
  const db = await readDb();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="adinn-design-workflow-backup-${stamp}.json"`);
  res.send(JSON.stringify({ exported_at: new Date().toISOString(), app: 'Adinn Design Work Allocation', data: db }, null, 2));
}));

module.exports = router;
