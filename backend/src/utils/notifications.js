const { uuid, now } = require('../lib/store');

function normalizeRecipientIds(db, recipients = [], actorId = '') {
  const activeIds = new Set((db.users || []).filter((u) => u.status !== 'inactive').map((u) => u.id));
  return [...new Set((recipients || []).filter(Boolean))]
    .filter((id) => activeIds.has(id) && id !== actorId);
}

function adminAndBdIds(db) {
  return (db.users || [])
    .filter((u) => u.status === 'active' && ['admin', 'bd', 'manager'].includes(u.role))
    .map((u) => u.id);
}

function notifyUsers(db, recipients, payload) {
  if (!Array.isArray(db.notifications)) db.notifications = [];
  const ids = normalizeRecipientIds(db, recipients, payload.actor_id || payload.actorId || '');
  const records = ids.map((userId) => ({
    id: uuid(),
    user_id: userId,
    type: payload.type || 'task_update',
    title: payload.title || 'Task update',
    message: payload.message || '',
    task_id: payload.task_id || payload.taskId || '',
    actor_id: payload.actor_id || payload.actorId || '',
    read: false,
    created_at: now()
  }));
  db.notifications.push(...records);
  return records;
}

function notifyTaskStakeholders(db, task, actor, payload, options = {}) {
  const recipients = [];
  if (task.assigned_by) recipients.push(task.assigned_by);
  if (task.assigned_to) recipients.push(task.assigned_to);
  if (options.includeAdminsAndBds !== false) recipients.push(...adminAndBdIds(db));
  return notifyUsers(db, recipients, {
    ...payload,
    task_id: task.id,
    actor_id: actor?.id || actor || ''
  });
}

module.exports = {
  adminAndBdIds,
  notifyUsers,
  notifyTaskStakeholders
};
