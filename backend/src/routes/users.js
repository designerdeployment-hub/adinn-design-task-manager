const express = require('express');
const bcrypt = require('bcryptjs');
const { readDb, updateDb, publicUser, uuid, now, normalizeVerticals } = require('../lib/store');
const { authenticate, permit } = require('../middleware/auth');
const { applyComputedStatus, statusLabel } = require('../utils/tasks');
const { asyncRoute } = require('../utils/asyncRoute');

const router = express.Router();

router.use(authenticate);

function userMatchesVertical(user, vertical) {
  if (!vertical) return true;
  return normalizeVerticals(user.verticals).includes(vertical);
}

router.get('/', asyncRoute(async (req, res) => {
  const db = await readDb();
  const { role, status, q, vertical } = req.query;

  let users = db.users;

  if (req.user.role === 'designer') {
    users = users.filter((u) => u.id === req.user.id);
  }

  if (role) users = users.filter((u) => u.role === role || (role === 'bd' && u.role === 'manager'));
  if (status) users = users.filter((u) => u.status === status);
  if (vertical) users = users.filter((u) => userMatchesVertical(u, vertical));
  if (q) {
    const needle = String(q).toLowerCase();
    users = users.filter((u) => `${u.name} ${u.email} ${u.department} ${u.designation} ${normalizeVerticals(u.verticals).join(' ')}`.toLowerCase().includes(needle));
  }

  res.json({ users: users.map(publicUser).sort((a, b) => a.name.localeCompare(b.name)) });
}));

router.get('/designer-workload', permit('admin', 'bd'), asyncRoute(async (req, res) => {
  const db = await readDb();
  const { vertical = '', status = 'active' } = req.query;
  const designers = db.users
    .filter((u) => u.role === 'designer')
    .filter((u) => !status || u.status === status)
    .filter((u) => userMatchesVertical(u, vertical))
    .map(publicUser)
    .sort((a, b) => a.name.localeCompare(b.name));

  const currentTaskStatuses = ['pending_acceptance', 'accepted', 'in_progress', 'on_hold', 'changes_requested', 'overdue'];

  const workload = designers.map((designer) => {
    const currentTasks = db.tasks
      .filter((task) => task.assigned_to === designer.id)
      .map(applyComputedStatus)
      .filter((task) => currentTaskStatuses.includes(task.computed_status || task.status))
      .sort((a, b) => {
        const aTime = `${a.deadline_date || '9999-12-31'}T${a.deadline_time || '23:59'}`;
        const bTime = `${b.deadline_date || '9999-12-31'}T${b.deadline_time || '23:59'}`;
        return aTime.localeCompare(bTime);
      })
      .map((task) => {
        const assigner = db.users.find((u) => u.id === task.assigned_by);
        const computedStatus = task.computed_status || task.status;
        return {
          id: task.id,
          task_title: task.task_title,
          assignment_date: task.assignment_date || '',
          zoho_project_no: task.zoho_project_no || '',
          client_name: task.client_name,
          category: task.category,
          vertical: task.vertical || '',
          priority: task.priority,
          planned_start_date: task.planned_start_date || '',
          planned_start_time: task.planned_start_time || '',
          estimated_hours: task.estimated_hours || '',
          started_working_date: task.started_working_date || '',
          started_working_time: task.started_working_time || '',
          end_time: task.end_time || '',
          status_of_day: task.status_of_day || '',
          status: computedStatus,
          status_label: statusLabel(computedStatus),
          deadline_date: task.deadline_date,
          deadline_time: task.deadline_time,
          assigned_by_name: assigner?.name || '',
          created_at: task.created_at,
          updated_at: task.updated_at
        };
      });

    return {
      ...designer,
      active_count: currentTasks.length,
      overdue_count: currentTasks.filter((task) => task.status === 'overdue').length,
      pending_count: currentTasks.filter((task) => task.status === 'pending_acceptance').length,
      review_count: db.tasks.filter((task) => task.assigned_to === designer.id).map(applyComputedStatus).filter((task) => (task.computed_status || task.status) === 'submitted_for_review').length,
      tasks: currentTasks
    };
  });

  res.json({ workload });
}));

router.post('/', permit('admin'), asyncRoute(async (req, res) => {
  const { name, email, password, role, department, designation, phone, verticals } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: 'Name, email, password and role are required.' });
  }
  if (!['admin', 'bd', 'designer'].includes(role)) {
    return res.status(400).json({ message: 'Role must be admin, Business Developer (BD), or designer.' });
  }

  const result = await updateDb((db) => {
    const exists = db.users.find((u) => u.email === String(email).toLowerCase());
    if (exists) {
      const error = new Error('Email already exists.');
      error.status = 409;
      throw error;
    }
    const user = {
      id: uuid(),
      name,
      email: String(email).toLowerCase(),
      password_hash: bcrypt.hashSync(password, 10),
      role,
      department: department || (role === 'bd' ? 'Business Development' : 'Design'),
      designation: designation || (role === 'bd' ? 'Business Developer' : ''),
      phone: phone || '',
      verticals: role === 'designer' ? normalizeVerticals(verticals) : [],
      status: 'active',
      created_at: now(),
      updated_at: now()
    };
    db.users.push(user);
    return publicUser(user);
  });

  res.status(201).json({ user: result });
}));

router.patch('/:id', permit('admin'), asyncRoute(async (req, res) => {
  const { id } = req.params;
  const allowed = ['name', 'phone', 'department', 'designation', 'role', 'status'];

  const user = await updateDb((db) => {
    const record = db.users.find((u) => u.id === id);
    if (!record) {
      const error = new Error('User not found.');
      error.status = 404;
      throw error;
    }

    allowed.forEach((field) => {
      if (req.body[field] !== undefined) record[field] = req.body[field];
    });

    if (record.role === 'manager') record.role = 'bd';
    if (!['admin', 'bd', 'designer'].includes(record.role)) {
      const error = new Error('Role must be admin, Business Developer (BD), or designer.');
      error.status = 400;
      throw error;
    }

    if (req.body.verticals !== undefined || req.body.vertical !== undefined) {
      record.verticals = record.role === 'designer' ? normalizeVerticals(req.body.verticals ?? req.body.vertical) : [];
    } else if (record.role !== 'designer') {
      record.verticals = [];
    } else {
      record.verticals = normalizeVerticals(record.verticals);
    }

    if (req.body.password) {
      record.password_hash = bcrypt.hashSync(req.body.password, 10);
    }

    record.updated_at = now();
    return publicUser(record);
  });

  res.json({ user });
}));

router.delete('/:id', permit('admin'), asyncRoute(async (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    return res.status(400).json({ message: 'You cannot delete your own logged-in admin account.' });
  }

  const deletedUser = await updateDb((db) => {
    const index = db.users.findIndex((u) => u.id === id);
    if (index === -1) {
      const error = new Error('User not found.');
      error.status = 404;
      throw error;
    }

    const record = db.users[index];
    const adminCount = db.users.filter((u) => u.role === 'admin').length;
    if (record.role === 'admin' && adminCount <= 1) {
      const error = new Error('At least one admin account must remain in the system.');
      error.status = 400;
      throw error;
    }

    db.users.splice(index, 1);
    return publicUser(record);
  });

  res.json({ message: 'User deleted successfully.', user: deletedUser });
}));

module.exports = router;
