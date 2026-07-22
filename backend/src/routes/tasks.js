const express = require('express');
const { updateDb, readDb, uuid, now, normalizeVerticals } = require('../lib/store');
const { authenticate, permit } = require('../middleware/auth');
const { upload, fileToRecord, deleteStoredFile } = require('../utils/upload');
const { canSeeTask, enrichTask, applyComputedStatus, statusLabel } = require('../utils/tasks');
const { asyncRoute } = require('../utils/asyncRoute');
const { notifyUsers, notifyTaskStakeholders, adminAndBdIds } = require('../utils/notifications');

const router = express.Router();
const allowedStatuses = ['accepted', 'in_progress', 'on_hold', 'submitted_for_review', 'changes_requested', 'completed'];
const actionOptions = ['1st Modification Started', '2nd Modification Started', 'Preparing for Print File', 'Print File Shared', 'Project Completed'];

router.use(authenticate);

function createHistory(db, taskId, action, oldStatus, newStatus, performedBy, remarks = '') {
  db.task_history.push({
    id: uuid(),
    task_id: taskId,
    action,
    old_status: oldStatus || '',
    new_status: newStatus || '',
    performed_by: performedBy,
    remarks,
    created_at: now()
  });
}

function taskDateForFilter(task, dateField = 'assignment_date') {
  const field = String(dateField || 'assignment_date');
  if (field === 'deadline_date') return task.deadline_date || '';
  if (field === 'started_working_date') return task.started_working_date || task.planned_start_date || '';
  if (field === 'completed_at') return task.completed_at ? String(task.completed_at).slice(0, 10) : '';
  if (field === 'created_at') return task.created_at ? String(task.created_at).slice(0, 10) : '';
  return task.assignment_date || (task.created_at ? String(task.created_at).slice(0, 10) : '');
}

function taskVertical(task, db) {
  if (task.vertical) return task.vertical;
  const designer = db.users.find((u) => u.id === task.assigned_to);
  return normalizeVerticals(designer?.verticals)[0] || '';
}

function parseTaskFilters(tasks, query, db) {
  let result = tasks;
  if (query.status) result = result.filter((t) => t.status === query.status || t.computed_status === query.status);
  if (query.priority) result = result.filter((t) => t.priority === query.priority);
  if (query.action_field) result = result.filter((t) => t.action_field === query.action_field);
  if (query.category) result = result.filter((t) => t.category === query.category);
  if (query.assigned_to) result = result.filter((t) => t.assigned_to === query.assigned_to);
  if (query.assigned_by) result = result.filter((t) => t.assigned_by === query.assigned_by);
  if (query.zoho_project_no) result = result.filter((t) => String(t.zoho_project_no || '').toLowerCase().includes(String(query.zoho_project_no).toLowerCase()));
  if (query.project) result = result.filter((t) => String(t.zoho_project_no || t.client_name || '').toLowerCase().includes(String(query.project).toLowerCase()));
  if (query.vertical) {
    result = result.filter((t) => {
      const designer = db.users.find((u) => u.id === t.assigned_to);
      return t.vertical === query.vertical || normalizeVerticals(designer?.verticals).includes(query.vertical);
    });
  }
  if (query.from) result = result.filter((t) => taskDateForFilter(t, query.date_field) >= query.from);
  if (query.to) result = result.filter((t) => taskDateForFilter(t, query.date_field) <= query.to);
  if (query.q) {
    const needle = String(query.q).toLowerCase();
    result = result.filter((t) => `${t.task_title} ${t.client_name} ${t.category} ${t.description} ${t.zoho_project_no || ''} ${t.vertical || ''} ${t.status_of_day || ''} ${t.action_field || ''}`.toLowerCase().includes(needle));
  }
  return result;
}

router.get('/', asyncRoute(async (req, res) => {
  const db = await readDb();
  let tasks = db.tasks.map(applyComputedStatus).filter((task) => canSeeTask(req.user, task));
  tasks = parseTaskFilters(tasks, req.query, db);
  const enriched = tasks
    .map((task) => enrichTask(db, { ...task, vertical: taskVertical(task, db) }))
    .sort((a, b) => `${b.assignment_date || String(b.created_at || '').slice(0, 10)}T${b.deadline_time || '00:00'}`.localeCompare(`${a.assignment_date || String(a.created_at || '').slice(0, 10)}T${a.deadline_time || '00:00'}`));

  res.json({ tasks: enriched, total: enriched.length });
}));

router.get('/meta', asyncRoute(async (req, res) => {
  const db = await readDb();
  res.json({ settings: db.settings });
}));

router.get('/export.csv', asyncRoute(async (req, res) => {
  const db = await readDb();
  let tasks = db.tasks.map(applyComputedStatus).filter((task) => canSeeTask(req.user, task));
  tasks = parseTaskFilters(tasks, req.query, db);

  const header = [
    'Date of Assignment',
    'Task',
    'Zoho Project No.',
    'Designer',
    'Vertical',
    'Priority',
    'Deadline Date',
    'Deadline Time',
    'Started Working Date',
    'Started Working Time',
    'End Time',
    'Status of the Day',
    'Action Field',
    'System Status',
    'Category',
    'Client / Brand',
    'Assigner',
    'Attachments Count',
    'Rating Quality',
    'Rating Timeliness',
    'Rating Understanding',
    'Rating Revision Handling',
    'Overall Rating',
    'Rating Remarks',
    'Created At',
    'Completed At',
    'Decline Reason'
  ];

  const escapeCsv = (value) => {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
  };

  const rows = tasks.map((task) => {
    const designer = db.users.find((u) => u.id === task.assigned_to);
    const assigner = db.users.find((u) => u.id === task.assigned_by);
    const attachmentCount = db.task_files.filter((file) => file.task_id === task.id).length;
    return [
      task.assignment_date || String(task.created_at || '').slice(0, 10),
      task.task_title,
      task.zoho_project_no || '',
      designer?.name || '',
      taskVertical(task, db),
      task.priority,
      task.deadline_date,
      task.deadline_time,
      task.started_working_date || task.planned_start_date || '',
      task.started_working_time || task.planned_start_time || '',
      task.end_time || '',
      task.status_of_day || '',
      task.action_field || '',
      statusLabel(task.computed_status || task.status),
      task.category,
      task.client_name,
      assigner?.name || '',
      attachmentCount,
      task.rating_quality || '',
      task.rating_timeliness || '',
      task.rating_understanding || '',
      task.rating_revision_handling || '',
      task.rating_overall || '',
      task.rating_remarks || '',
      task.created_at,
      task.completed_at,
      task.decline_reason
    ].map(escapeCsv).join(',');
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="design-tasks-report.csv"');
  res.send([header.map(escapeCsv).join(','), ...rows].join('\n'));
}));

router.post('/', permit('admin', 'bd'), upload.array('files', 20), asyncRoute(async (req, res) => {
  const {
    assignment_date,
    task_title,
    zoho_project_no,
    client_name,
    category,
    description,
    assigned_to,
    vertical,
    priority,
    planned_start_date,
    planned_start_time,
    estimated_hours,
    started_working_date,
    started_working_time,
    end_time,
    status_of_day,
    action_field,
    deadline_date,
    deadline_time,
    output_required
  } = req.body;

  if (!task_title || !category || !assigned_to || !priority || !deadline_date) {
    return res.status(400).json({ message: 'Task, category, designer, priority and deadline date are required.' });
  }

  const task = await updateDb(async (db) => {
    const designer = db.users.find((u) => u.id === assigned_to && u.role === 'designer' && u.status === 'active');
    if (!designer) {
      const error = new Error('Selected designer not found or inactive.');
      error.status = 400;
      throw error;
    }

    const selectedVertical = vertical || normalizeVerticals(designer.verticals)[0] || '';
    const taskRecord = {
      id: uuid(),
      assignment_date: assignment_date || now().slice(0, 10),
      task_title,
      zoho_project_no: zoho_project_no || '',
      client_name: client_name || '',
      category,
      description: description || '',
      assigned_by: req.user.id,
      assigned_to,
      vertical: selectedVertical,
      priority,
      planned_start_date: planned_start_date || '',
      planned_start_time: planned_start_time || '',
      estimated_hours: estimated_hours || '',
      started_working_date: started_working_date || planned_start_date || '',
      started_working_time: started_working_time || planned_start_time || '',
      end_time: end_time || '',
      status_of_day: status_of_day || 'Assigned',
      action_field: action_field || '',
      rating_quality: '',
      rating_timeliness: '',
      rating_understanding: '',
      rating_revision_handling: '',
      rating_overall: '',
      rating_remarks: '',
      rated_by: '',
      rated_at: '',
      deadline_date,
      deadline_time: deadline_time || '18:00',
      output_required: output_required || '',
      status: 'pending_acceptance',
      decline_reason: '',
      created_at: now(),
      updated_at: now(),
      accepted_at: '',
      completed_at: ''
    };

    db.tasks.push(taskRecord);
    createHistory(db, taskRecord.id, 'task_created', '', 'pending_acceptance', req.user.id, `Task assigned to ${designer.name}.`);
    notifyUsers(db, [designer.id], {
      type: 'task_assigned',
      title: 'New task assigned',
      message: `${taskRecord.task_title} has been assigned to you.`,
      task_id: taskRecord.id,
      actor_id: req.user.id
    });

    const files = [];
    for (const file of (req.files || [])) files.push(await fileToRecord(file, taskRecord.id, req.user.id));
    db.task_files.push(...files);
    if (files.length) {
      createHistory(db, taskRecord.id, 'files_uploaded', '', 'pending_acceptance', req.user.id, `${files.length} file(s) uploaded.`);
    }

    return enrichTask(db, taskRecord);
  });

  res.status(201).json({ task });
}));

router.get('/:id', asyncRoute(async (req, res) => {
  const db = await readDb();
  const task = db.tasks.find((t) => t.id === req.params.id);
  if (!task || !canSeeTask(req.user, task)) {
    return res.status(404).json({ message: 'Task not found.' });
  }
  res.json({ task: enrichTask(db, applyComputedStatus({ ...task, vertical: taskVertical(task, db) })) });
}));

router.delete('/:id', permit('admin'), asyncRoute(async (req, res) => {
  const deleted = await updateDb(async (db) => {
    const record = db.tasks.find((t) => t.id === req.params.id);
    if (!record) {
      const error = new Error('Task not found.');
      error.status = 404;
      throw error;
    }

    const files = db.task_files.filter((file) => file.task_id === record.id);
    for (const file of files) await deleteStoredFile(file);

    db.tasks = db.tasks.filter((task) => task.id !== record.id);
    db.task_files = db.task_files.filter((file) => file.task_id !== record.id);
    db.task_comments = db.task_comments.filter((comment) => comment.task_id !== record.id);
    db.task_history = db.task_history.filter((history) => history.task_id !== record.id);

    return { id: record.id, title: record.task_title };
  });

  res.json({ deleted });
}));

router.patch('/:id/accept', permit('designer'), asyncRoute(async (req, res) => {
  const task = await updateDb((db) => {
    const record = db.tasks.find((t) => t.id === req.params.id);
    if (!record || !canSeeTask(req.user, record)) {
      const error = new Error('Task not found.');
      error.status = 404;
      throw error;
    }
    if (record.assigned_to !== req.user.id) {
      const error = new Error('Only the assigned designer can accept this task.');
      error.status = 403;
      throw error;
    }
    if (!['pending_acceptance', 'declined'].includes(record.status)) {
      const error = new Error('Only pending or reassigned tasks can be accepted.');
      error.status = 400;
      throw error;
    }

    const old = record.status;
    record.status = 'accepted';
    record.status_of_day = record.status_of_day || 'Accepted';
    record.accepted_at = now();
    record.updated_at = now();
    record.decline_reason = '';
    createHistory(db, record.id, 'task_accepted', old, 'accepted', req.user.id, 'Designer accepted the task.');
    notifyTaskStakeholders(db, record, req.user, {
      type: 'task_accepted',
      title: 'Task accepted',
      message: `${record.task_title} was accepted by ${req.user.name}.`
    });
    return enrichTask(db, record);
  });
  res.json({ task });
}));

router.patch('/:id/decline', permit('designer'), asyncRoute(async (req, res) => {
  const { reason } = req.body;
  if (!reason || reason.trim().length < 3) {
    return res.status(400).json({ message: 'Decline reason is required.' });
  }

  const task = await updateDb((db) => {
    const record = db.tasks.find((t) => t.id === req.params.id);
    if (!record || !canSeeTask(req.user, record)) {
      const error = new Error('Task not found.');
      error.status = 404;
      throw error;
    }
    if (record.assigned_to !== req.user.id) {
      const error = new Error('Only the assigned designer can decline this task.');
      error.status = 403;
      throw error;
    }
    if (!['pending_acceptance', 'accepted'].includes(record.status)) {
      const error = new Error('Only pending or accepted tasks can be declined.');
      error.status = 400;
      throw error;
    }

    const old = record.status;
    record.status = 'declined';
    record.status_of_day = 'Declined';
    record.decline_reason = reason.trim();
    record.updated_at = now();
    createHistory(db, record.id, 'task_declined', old, 'declined', req.user.id, reason.trim());
    notifyTaskStakeholders(db, record, req.user, {
      type: 'task_declined',
      title: 'Task declined',
      message: `${record.task_title} was declined by ${req.user.name}. Reason: ${reason.trim()}`
    });
    return enrichTask(db, record);
  });
  res.json({ task });
}));

router.patch('/:id/status', asyncRoute(async (req, res) => {
  const { status, remarks, status_of_day, started_working_date, started_working_time, end_time, action_field } = req.body;
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: `Status must be one of: ${allowedStatuses.join(', ')}` });
  }

  const task = await updateDb((db) => {
    const record = db.tasks.find((t) => t.id === req.params.id);
    if (!record || !canSeeTask(req.user, record)) {
      const error = new Error('Task not found.');
      error.status = 404;
      throw error;
    }

    const isAssigner = record.assigned_by === req.user.id || req.user.role === 'admin' || req.user.role === 'bd' || req.user.role === 'manager';
    const isDesigner = record.assigned_to === req.user.id;

    if (status === 'completed' && !isAssigner && !isDesigner) {
      const error = new Error('Only the assigned designer, BD, or admin can mark a task as completed.');
      error.status = 403;
      throw error;
    }
    if (status === 'changes_requested' && !isAssigner) {
      const error = new Error('Only assigner/admin can request changes.');
      error.status = 403;
      throw error;
    }
    if (['in_progress', 'on_hold', 'submitted_for_review'].includes(status) && !isDesigner && !isAssigner) {
      const error = new Error('Only the assigned designer or assigner can update this status.');
      error.status = 403;
      throw error;
    }

    const old = record.status;
    record.status = status;
    record.status_of_day = status_of_day || statusLabel(status);
    if (started_working_date !== undefined) record.started_working_date = started_working_date;
    if (started_working_time !== undefined) record.started_working_time = started_working_time;
    if (end_time !== undefined) record.end_time = end_time;
    if (action_field !== undefined) record.action_field = action_field;
    if (status === 'in_progress') {
      const current = new Date();
      if (!record.started_working_date) record.started_working_date = current.toISOString().slice(0, 10);
      if (!record.started_working_time) record.started_working_time = current.toTimeString().slice(0, 5);
    }
    record.updated_at = now();
    if (status === 'completed') {
      record.completed_at = now();
      if (!record.end_time) record.end_time = new Date().toTimeString().slice(0, 5);
    }
    createHistory(db, record.id, 'status_changed', old, status, req.user.id, remarks || `Status changed from ${statusLabel(old)} to ${statusLabel(status)}.`);
    notifyTaskStakeholders(db, record, req.user, {
      type: status === 'completed' ? 'task_completed' : 'status_changed',
      title: status === 'completed' ? 'Task completed' : 'Task status updated',
      message: `${record.task_title} is now ${statusLabel(status)}.`
    });
    return enrichTask(db, record);
  });
  res.json({ task });
}));


router.patch('/:id/action', asyncRoute(async (req, res) => {
  const { action_field, remarks } = req.body;
  if (!actionOptions.includes(action_field)) {
    return res.status(400).json({ message: `Action field must be one of: ${actionOptions.join(', ')}` });
  }

  const task = await updateDb((db) => {
    const record = db.tasks.find((t) => t.id === req.params.id);
    if (!record || !canSeeTask(req.user, record)) {
      const error = new Error('Task not found.');
      error.status = 404;
      throw error;
    }

    const isAssigner = record.assigned_by === req.user.id || req.user.role === 'admin' || req.user.role === 'bd';
    const isDesigner = record.assigned_to === req.user.id;
    if (!isAssigner && !isDesigner) {
      const error = new Error('Only the assigned designer, BD, or admin can update the action field.');
      error.status = 403;
      throw error;
    }
    if (action_field === 'Project Completed' && !isAssigner) {
      const error = new Error('Only BD/Admin can set Project Completed.');
      error.status = 403;
      throw error;
    }

    const oldAction = record.action_field || '';
    record.action_field = action_field;
    record.status_of_day = action_field;
    record.updated_at = now();
    if (action_field === 'Project Completed') {
      record.status = 'completed';
      record.completed_at = record.completed_at || now();
      if (!record.end_time) record.end_time = new Date().toTimeString().slice(0, 5);
    }
    createHistory(db, record.id, 'action_field_updated', oldAction, action_field, req.user.id, remarks || `Action updated from ${oldAction || 'none'} to ${action_field}.`);
    notifyTaskStakeholders(db, record, req.user, {
      type: action_field === 'Project Completed' ? 'project_completed' : 'action_field_updated',
      title: action_field === 'Project Completed' ? 'Project completed' : 'Action field updated',
      message: `${record.task_title}: ${action_field}.`
    });
    return enrichTask(db, record);
  });
  res.json({ task });
}));

router.patch('/:id/rating', permit('admin', 'bd'), asyncRoute(async (req, res) => {
  const ratingFields = ['rating_quality', 'rating_timeliness', 'rating_understanding', 'rating_revision_handling', 'rating_overall'];
  const parsed = {};
  for (const field of ratingFields) {
    const value = Number(req.body[field]);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      return res.status(400).json({ message: 'All rating fields must be numbers from 1 to 5.' });
    }
    parsed[field] = value;
  }

  const task = await updateDb((db) => {
    const record = db.tasks.find((t) => t.id === req.params.id);
    if (!record || !canSeeTask(req.user, record)) {
      const error = new Error('Task not found.');
      error.status = 404;
      throw error;
    }
    if (!['submitted_for_review', 'completed'].includes(record.status) && record.action_field !== 'Project Completed') {
      const error = new Error('Ratings can be added after work is submitted for review or completed.');
      error.status = 400;
      throw error;
    }

    Object.assign(record, parsed);
    record.rating_remarks = req.body.rating_remarks || '';
    record.rated_by = req.user.id;
    record.rated_at = now();
    record.updated_at = now();
    createHistory(db, record.id, 'designer_rating_updated', record.status, record.status, req.user.id, `Overall rating: ${record.rating_overall}/5. ${record.rating_remarks || ''}`.trim());
    notifyUsers(db, [record.assigned_to], {
      type: 'designer_rating_added',
      title: 'Designer rating added',
      message: `${record.task_title} received an overall rating of ${record.rating_overall}/5.`,
      task_id: record.id,
      actor_id: req.user.id
    });
    return enrichTask(db, record);
  });
  res.json({ task });
}));

router.patch('/:id/reassign', permit('admin', 'bd'), asyncRoute(async (req, res) => {
  const { assigned_to, remarks } = req.body;
  if (!assigned_to) return res.status(400).json({ message: 'New designer is required.' });

  const task = await updateDb((db) => {
    const record = db.tasks.find((t) => t.id === req.params.id);
    if (!record || !canSeeTask(req.user, record)) {
      const error = new Error('Task not found.');
      error.status = 404;
      throw error;
    }
    const designer = db.users.find((u) => u.id === assigned_to && u.role === 'designer' && u.status === 'active');
    if (!designer) {
      const error = new Error('Selected designer not found or inactive.');
      error.status = 400;
      throw error;
    }

    const oldDesigner = db.users.find((u) => u.id === record.assigned_to);
    const oldStatus = record.status;
    record.assigned_to = assigned_to;
    if (!record.vertical) record.vertical = normalizeVerticals(designer.verticals)[0] || '';
    record.status = 'pending_acceptance';
    record.status_of_day = 'Reassigned';
    record.decline_reason = '';
    record.accepted_at = '';
    record.updated_at = now();
    createHistory(db, record.id, 'task_reassigned', oldStatus, 'pending_acceptance', req.user.id, remarks || `Reassigned from ${oldDesigner?.name || 'old designer'} to ${designer.name}.`);
    notifyUsers(db, [designer.id, oldDesigner?.id, ...adminAndBdIds(db)], {
      type: 'task_reassigned',
      title: 'Task reassigned',
      message: `${record.task_title} was reassigned to ${designer.name}.`,
      task_id: record.id,
      actor_id: req.user.id
    });
    return enrichTask(db, record);
  });
  res.json({ task });
}));

router.post('/:id/comments', asyncRoute(async (req, res) => {
  const { comment } = req.body;
  if (!comment || comment.trim().length < 1) {
    return res.status(400).json({ message: 'Comment cannot be empty.' });
  }

  const result = await updateDb((db) => {
    const record = db.tasks.find((t) => t.id === req.params.id);
    if (!record || !canSeeTask(req.user, record)) {
      const error = new Error('Task not found.');
      error.status = 404;
      throw error;
    }
    const commentRecord = {
      id: uuid(),
      task_id: record.id,
      comment: comment.trim(),
      commented_by: req.user.id,
      created_at: now()
    };
    db.task_comments.push(commentRecord);
    createHistory(db, record.id, 'comment_added', record.status, record.status, req.user.id, comment.trim());
    notifyTaskStakeholders(db, record, req.user, {
      type: 'comment_added',
      title: 'New task comment',
      message: `${req.user.name} commented on ${record.task_title}.`
    });
    return enrichTask(db, record);
  });

  res.status(201).json({ task: result });
}));

router.post('/:id/files', upload.array('files', 20), asyncRoute(async (req, res) => {
  const task = await updateDb(async (db) => {
    const record = db.tasks.find((t) => t.id === req.params.id);
    if (!record || !canSeeTask(req.user, record)) {
      const error = new Error('Task not found.');
      error.status = 404;
      throw error;
    }
    const files = [];
    for (const file of (req.files || [])) files.push(await fileToRecord(file, record.id, req.user.id));
    db.task_files.push(...files);
    record.updated_at = now();
    createHistory(db, record.id, 'files_uploaded', record.status, record.status, req.user.id, `${files.length} file(s) uploaded.`);
    notifyTaskStakeholders(db, record, req.user, {
      type: 'files_uploaded',
      title: 'Design file uploaded',
      message: `${files.length} file(s) uploaded for ${record.task_title}.`
    });
    return enrichTask(db, record);
  });
  res.status(201).json({ task });
}));

module.exports = router;
