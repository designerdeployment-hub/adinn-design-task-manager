require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const { ensureDb, storageInfo } = require('./lib/store');
const { uploadDir } = require('./utils/upload');
const { env, validateEnv } = require('./config/env');
const { generalLimiter } = require('./middleware/rateLimit');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const taskRoutes = require('./routes/tasks');
const reportRoutes = require('./routes/reports');
const settingsRoutes = require('./routes/settings');
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');
const { notFound, errorHandler } = require('./middleware/errorHandler');

async function start() {
  validateEnv();
  await ensureDb();

  const app = express();

  if (env.trustProxy) app.set('trust proxy', 1);

  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(compression());
  app.use(generalLimiter);
  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      const normalized = origin.replace(/\/$/, '');
      if (env.frontendOrigins.includes(normalized)) return callback(null, true);
      return callback(new Error(`CORS blocked origin: ${origin}`));
    },
    credentials: true
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));
  app.use('/uploads', express.static(uploadDir, {
    maxAge: env.nodeEnv === 'production' ? '7d' : 0,
    immutable: env.nodeEnv === 'production'
  }));

  app.get('/', (req, res) => {
    res.json({
      ok: true,
      service: 'Adinn Design Work Allocation API',
      version: env.appVersion,
      storage_driver: storageInfo().driver,
      docs: 'Use /api/health to verify the service.'
    });
  });

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      service: 'Adinn Design Work Allocation API',
      version: env.appVersion,
      environment: env.nodeEnv,
      storage_driver: storageInfo().driver,
      uptime_seconds: Math.round(process.uptime()),
      time: new Date().toISOString()
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/notifications', notificationRoutes);

  app.use(notFound);
  app.use(errorHandler);

  const server = app.listen(env.port, () => {
    console.log(`Adinn Design Work Allocation API running on port ${env.port}`);
    console.log(`Allowed frontend origins: ${env.frontendOrigins.join(', ')}`);
    console.log(`Storage driver: ${storageInfo().driver}`);
  });

  function shutdown(signal) {
    console.log(`${signal} received. Closing server...`);
    server.close(() => process.exit(0));
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return app;
}

if (require.main === module) {
  start().catch((error) => {
    console.error('API startup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = start;
