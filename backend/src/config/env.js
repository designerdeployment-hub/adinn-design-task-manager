const crypto = require('crypto');

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseOrigins(value) {
  if (!value) return ['http://localhost:5173'];
  return String(value)
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function resolvedDataDriver() {
  const explicit = String(process.env.DATA_DRIVER || '').trim().toLowerCase();
  if (explicit) return explicit;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return 'supabase';
  return 'file';
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseNumber(process.env.PORT, 5001),
  frontendOrigins: parseOrigins(process.env.FRONTEND_ORIGIN),
  jwtSecret: process.env.JWT_SECRET || 'dev_secret_change_me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  trustProxy: parseBoolean(process.env.TRUST_PROXY, process.env.NODE_ENV === 'production'),
  maxFileSizeMb: parseNumber(process.env.MAX_FILE_SIZE_MB, 50),
  maxFilesPerRequest: parseNumber(process.env.MAX_FILES_PER_REQUEST, 20),
  appVersion: process.env.npm_package_version || '2.0.0',
  dataDriver: resolvedDataDriver(),
  fileStorageDriver: String(process.env.FILE_STORAGE_DRIVER || '').trim().toLowerCase() || ((process.env.DATA_DRIVER === 'supabase' && process.env.SUPABASE_STORAGE_BUCKET) ? 'supabase' : 'local')
};

function validateEnv() {
  const warnings = [];

  if (!['file', 'supabase'].includes(env.dataDriver)) {
    throw new Error('DATA_DRIVER must be either file or supabase.');
  }

  if (env.dataDriver === 'supabase') {
    if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL is required when DATA_DRIVER=supabase.');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required when DATA_DRIVER=supabase.');
  }

  if (!['local', 'supabase'].includes(env.fileStorageDriver)) {
    throw new Error('FILE_STORAGE_DRIVER must be either local or supabase.');
  }

  if (env.fileStorageDriver === 'supabase') {
    if (!process.env.SUPABASE_URL) throw new Error('SUPABASE_URL is required when FILE_STORAGE_DRIVER=supabase.');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required when FILE_STORAGE_DRIVER=supabase.');
    if (!process.env.SUPABASE_STORAGE_BUCKET) throw new Error('SUPABASE_STORAGE_BUCKET is required when FILE_STORAGE_DRIVER=supabase.');
  }

  if (env.nodeEnv === 'production') {
    if (!process.env.JWT_SECRET || env.jwtSecret === 'dev_secret_change_me') {
      throw new Error('JWT_SECRET must be set to a strong random value in production.');
    }
    if (env.jwtSecret.length < 32) {
      warnings.push('JWT_SECRET is set, but a 32+ character secret is recommended.');
    }
  }

  if (env.nodeEnv !== 'production' && (!process.env.JWT_SECRET || env.jwtSecret === 'dev_secret_change_me')) {
    const suggested = crypto.randomBytes(24).toString('hex');
    warnings.push(`Using development JWT secret. Before deployment, set JWT_SECRET, for example: ${suggested}`);
  }

  warnings.forEach((message) => console.warn(`[config] ${message}`));
}

module.exports = { env, validateEnv };
