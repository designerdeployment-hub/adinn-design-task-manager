const express = require('express');
const { readDb, updateDb } = require('../lib/store');
const { authenticate } = require('../middleware/auth');
const { asyncRoute } = require('../utils/asyncRoute');

const router = express.Router();
router.use(authenticate);

function visibleNotification(user, notification) {
  return notification.user_id === user.id;
}

router.get('/', asyncRoute(async (req, res) => {
  const db = await readDb();
  const limit = Math.min(Number(req.query.limit || 50), 100);
  const notifications = (db.notifications || [])
    .filter((item) => visibleNotification(req.user, item))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, limit)
    .map((item) => ({
      ...item,
      task: item.task_id ? db.tasks.find((task) => task.id === item.task_id) || null : null,
      actor: item.actor_id ? db.users.find((user) => user.id === item.actor_id) || null : null
    }));
  const unread_count = (db.notifications || []).filter((item) => visibleNotification(req.user, item) && !item.read).length;
  res.json({ notifications, unread_count });
}));

router.patch('/:id/read', asyncRoute(async (req, res) => {
  const updated = await updateDb((db) => {
    const record = (db.notifications || []).find((item) => item.id === req.params.id && item.user_id === req.user.id);
    if (!record) {
      const error = new Error('Notification not found.');
      error.status = 404;
      throw error;
    }
    record.read = true;
    return record;
  });
  res.json({ notification: updated });
}));

router.patch('/read-all', asyncRoute(async (req, res) => {
  const result = await updateDb((db) => {
    let count = 0;
    (db.notifications || []).forEach((item) => {
      if (item.user_id === req.user.id && !item.read) {
        item.read = true;
        count += 1;
      }
    });
    return { count };
  });
  res.json(result);
}));

module.exports = router;
