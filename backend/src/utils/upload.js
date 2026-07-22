const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const { uuid } = require('../lib/store');
const { env } = require('../config/env');

const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

let supabaseClient = null;
let bucketReady = false;

function sanitizeFilename(filename) {
  const ext = path.extname(filename || '').slice(0, 16);
  const base = path.basename(filename || 'file', ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'file';
  return `${base}${ext}`;
}

function fileStorageDriver() {
  const explicit = String(process.env.FILE_STORAGE_DRIVER || '').trim().toLowerCase();
  if (explicit) return explicit;
  if (process.env.DATA_DRIVER === 'supabase' && process.env.SUPABASE_STORAGE_BUCKET) return 'supabase';
  return 'local';
}

function usingSupabaseFiles() {
  return fileStorageDriver() === 'supabase';
}

function getSupabaseClient() {
  if (!usingSupabaseFiles()) return null;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('FILE_STORAGE_DRIVER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (!supabaseClient) {
    supabaseClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }
  return supabaseClient;
}

async function ensureBucket() {
  if (!usingSupabaseFiles() || bucketReady) return;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'adinn-design-files';
  const client = getSupabaseClient();
  const { data: buckets, error: listError } = await client.storage.listBuckets();
  if (listError) throw new Error(`Unable to list Supabase buckets: ${listError.message}`);
  const exists = (buckets || []).some((item) => item.name === bucket);
  if (!exists) {
    const { error: createError } = await client.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: `${env.maxFileSizeMb}MB`
    });
    if (createError) throw new Error(`Unable to create Supabase bucket "${bucket}": ${createError.message}`);
  }
  bucketReady = true;
}

const storage = multer.memoryStorage();

const allowedMime = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/postscript',
  'application/illustrator',
  'application/octet-stream',
  'text/plain',
  'text/csv'
]);

const allowedExtensions = /\.(psd|ai|cdr|indd|eps|jpg|jpeg|png|webp|gif|pdf|ppt|pptx|xls|xlsx|doc|docx|txt|csv)$/i;

const upload = multer({
  storage,
  limits: {
    fileSize: env.maxFileSizeMb * 1024 * 1024,
    files: env.maxFilesPerRequest
  },
  fileFilter: (req, file, cb) => {
    if (allowedMime.has(file.mimetype) || allowedExtensions.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.originalname}`));
    }
  }
});

async function fileToRecord(file, taskId, uploadedBy) {
  const safeName = sanitizeFilename(file.originalname);
  const storedName = `${Date.now()}-${uuid()}-${safeName}`;

  if (usingSupabaseFiles()) {
    await ensureBucket();
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'adinn-design-files';
    const objectPath = `${taskId}/${storedName}`;
    const client = getSupabaseClient();
    const { error } = await client.storage
      .from(bucket)
      .upload(objectPath, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        cacheControl: '3600',
        upsert: false
      });
    if (error) throw new Error(`Supabase file upload failed for ${file.originalname}: ${error.message}`);
    const { data } = client.storage.from(bucket).getPublicUrl(objectPath);
    return {
      id: uuid(),
      task_id: taskId,
      file_name: file.originalname,
      stored_name: objectPath,
      storage_provider: 'supabase',
      storage_bucket: bucket,
      file_url: data.publicUrl,
      file_type: file.mimetype,
      size_bytes: file.size,
      uploaded_by: uploadedBy,
      created_at: new Date().toISOString()
    };
  }

  const absolutePath = path.join(uploadDir, storedName);
  await fs.promises.writeFile(absolutePath, file.buffer);
  return {
    id: uuid(),
    task_id: taskId,
    file_name: file.originalname,
    stored_name: storedName,
    storage_provider: 'local',
    storage_bucket: '',
    file_url: `/uploads/${storedName}`,
    file_type: file.mimetype,
    size_bytes: file.size,
    uploaded_by: uploadedBy,
    created_at: new Date().toISOString()
  };
}

async function deleteStoredFile(file) {
  if (!file) return;
  if (file.storage_provider === 'supabase') {
    const bucket = file.storage_bucket || process.env.SUPABASE_STORAGE_BUCKET || 'adinn-design-files';
    const client = getSupabaseClient();
    const { error } = await client.storage.from(bucket).remove([file.stored_name]);
    if (error) console.warn(`Unable to delete Supabase file ${file.stored_name}: ${error.message}`);
    return;
  }
  if (!file.stored_name) return;
  const absolutePath = path.join(uploadDir, file.stored_name);
  if (!absolutePath.startsWith(uploadDir)) return;
  try {
    if (fs.existsSync(absolutePath)) fs.unlinkSync(absolutePath);
  } catch (error) {
    console.warn(`Unable to delete task file ${file.stored_name}: ${error.message}`);
  }
}

function storageInfo() {
  return {
    driver: fileStorageDriver(),
    bucket: usingSupabaseFiles() ? (process.env.SUPABASE_STORAGE_BUCKET || 'adinn-design-files') : '',
    upload_dir: usingSupabaseFiles() ? '' : uploadDir
  };
}

module.exports = { upload, fileToRecord, deleteStoredFile, uploadDir, usingSupabaseFiles, ensureBucket, storageInfo };
