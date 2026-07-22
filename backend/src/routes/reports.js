const express = require('express');
const { readDb, normalizeVerticals } = require('../lib/store');
const { authenticate } = require('../middleware/auth');
const { canSeeTask, applyComputedStatus, statusLabel } = require('../utils/tasks');
const { asyncRoute } = require('../utils/asyncRoute');

const router = express.Router();
router.use(authenticate);

function visibleTasks(db, user) {
  return db.tasks.map(applyComputedStatus).filter((task) => canSeeTask(user, task));
}

function taskDate(task, dateField = 'assignment_date') {
  if (dateField === 'deadline_date') return task.deadline_date || '';
  if (dateField === 'started_working_date') return task.started_working_date || task.planned_start_date || '';
  if (dateField === 'completed_at') return task.completed_at ? String(task.completed_at).slice(0, 10) : '';
  if (dateField === 'created_at') return task.created_at ? String(task.created_at).slice(0, 10) : '';
  return task.assignment_date || (task.created_at ? String(task.created_at).slice(0, 10) : '');
}

function taskVertical(task, db) {
  if (task.vertical) return task.vertical;
  const designer = db.users.find((u) => u.id === task.assigned_to);
  return normalizeVerticals(designer?.verticals)[0] || '';
}

function isCurrentTaskStatus(status) {
  return ['pending_acceptance', 'accepted', 'in_progress', 'on_hold', 'changes_requested', 'overdue'].includes(status);
}

function startOfWeek(date) {
  const d = new Date(`${date}T00:00:00`);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function endOfWeek(date) {
  const d = new Date(`${startOfWeek(date)}T00:00:00`);
  d.setDate(d.getDate() + 6);
  return d.toISOString().slice(0, 10);
}

function periodKey(date, range = 'weekly') {
  if (!date) return 'No date';
  if (range === 'yearly') return date.slice(0, 4);
  if (range === 'monthly') return date.slice(0, 7);
  const start = startOfWeek(date);
  return `${start} to ${endOfWeek(start)}`;
}

function filterTasks(tasks, query, db) {
  const dateField = query.date_field || 'assignment_date';
  let result = tasks;
  if (query.from) result = result.filter((task) => taskDate(task, dateField) >= query.from);
  if (query.to) result = result.filter((task) => taskDate(task, dateField) <= query.to);
  if (query.project) {
    const needle = String(query.project).toLowerCase();
    result = result.filter((task) => `${task.zoho_project_no || ''} ${task.client_name || ''} ${task.task_title || ''}`.toLowerCase().includes(needle));
  }
  if (query.zoho_project_no) {
    const needle = String(query.zoho_project_no).toLowerCase();
    result = result.filter((task) => String(task.zoho_project_no || '').toLowerCase().includes(needle));
  }
  if (query.vertical) result = result.filter((task) => taskVertical(task, db) === query.vertical);
  if (query.assigned_to) result = result.filter((task) => task.assigned_to === query.assigned_to);
  if (query.priority) result = result.filter((task) => task.priority === query.priority);
  if (query.action_field) result = result.filter((task) => task.action_field === query.action_field);
  if (query.status) result = result.filter((task) => (task.computed_status || task.status) === query.status);
  return result;
}

router.get('/summary', asyncRoute(async (req, res) => {
  const db = await readDb();
  const tasks = filterTasks(visibleTasks(db, req.user), req.query, db);
  const range = req.query.range || 'weekly';
  const dateField = req.query.date_field || 'assignment_date';

  const byStatus = {};
  const byPriority = {};
  const byCategory = {};
  const byVertical = {};
  const byAction = {};
  const byDesigner = {};
  const byProject = {};
  const byPeriod = {};

  tasks.forEach((task) => {
    const status = task.computed_status || task.status;
    const vertical = taskVertical(task, db) || 'Unmapped';
    const project = task.zoho_project_no || task.client_name || 'No project no.';
    const date = taskDate(task, dateField);
    const period = periodKey(date, range);

    byStatus[status] = (byStatus[status] || 0) + 1;
    byPriority[task.priority] = (byPriority[task.priority] || 0) + 1;
    byCategory[task.category] = (byCategory[task.category] || 0) + 1;
    byVertical[vertical] = (byVertical[vertical] || 0) + 1;
    if (task.action_field) byAction[task.action_field] = (byAction[task.action_field] || 0) + 1;

    if (!byProject[project]) byProject[project] = { project, total: 0, completed: 0, active: 0, overdue: 0, latest_date: '', rating_total: 0, rating_count: 0, avg_rating: 0 };
    byProject[project].total += 1;
    if (status === 'completed') byProject[project].completed += 1;
    if (status === 'overdue') byProject[project].overdue += 1;
    if (isCurrentTaskStatus(status)) byProject[project].active += 1;
    if (date && date > byProject[project].latest_date) byProject[project].latest_date = date;
    if (Number(task.rating_overall)) {
      byProject[project].rating_total += Number(task.rating_overall);
      byProject[project].rating_count += 1;
      byProject[project].avg_rating = Number((byProject[project].rating_total / byProject[project].rating_count).toFixed(2));
    }

    if (!byPeriod[period]) byPeriod[period] = { period, total: 0, completed: 0, active: 0, overdue: 0, declined: 0 };
    byPeriod[period].total += 1;
    if (status === 'completed') byPeriod[period].completed += 1;
    if (status === 'overdue') byPeriod[period].overdue += 1;
    if (status === 'declined') byPeriod[period].declined += 1;
    if (isCurrentTaskStatus(status)) byPeriod[period].active += 1;

    const designer = db.users.find((u) => u.id === task.assigned_to);
    const verticals = normalizeVerticals(designer?.verticals);
    const designerName = designer?.name || 'Unassigned';
    if (!byDesigner[designerName]) {
      byDesigner[designerName] = {
        designer_id: designer?.id || '',
        designer_name: designerName,
        verticals,
        total: 0,
        active: 0,
        completed: 0,
        overdue: 0,
        declined: 0,
        pending: 0,
        for_review: 0,
        current_tasks: [],
        rating_total: 0,
        rating_count: 0,
        avg_rating: 0
      };
    }

    byDesigner[designerName].total += 1;
    if (isCurrentTaskStatus(status)) byDesigner[designerName].active += 1;
    if (status === 'completed') byDesigner[designerName].completed += 1;
    if (status === 'overdue') byDesigner[designerName].overdue += 1;
    if (status === 'declined') byDesigner[designerName].declined += 1;
    if (status === 'pending_acceptance') byDesigner[designerName].pending += 1;
    if (status === 'submitted_for_review') byDesigner[designerName].for_review += 1;
    if (Number(task.rating_overall)) {
      byDesigner[designerName].rating_total += Number(task.rating_overall);
      byDesigner[designerName].rating_count += 1;
      byDesigner[designerName].avg_rating = Number((byDesigner[designerName].rating_total / byDesigner[designerName].rating_count).toFixed(2));
    }
    if (isCurrentTaskStatus(status)) {
      byDesigner[designerName].current_tasks.push({
        id: task.id,
        title: task.task_title,
        zoho_project_no: task.zoho_project_no || '',
        client: task.client_name,
        category: task.category,
        priority: task.priority,
        assignment_date: task.assignment_date || '',
        vertical,
        planned_start_date: task.planned_start_date || '',
        planned_start_time: task.planned_start_time || '',
        started_working_date: task.started_working_date || '',
        started_working_time: task.started_working_time || '',
        estimated_hours: task.estimated_hours || '',
        end_time: task.end_time || '',
        status_of_day: task.status_of_day || '',
        action_field: task.action_field || '',
        rating_overall: task.rating_overall || '',
        action_field: task.action_field || '',
        rating_overall: task.rating_overall || '',
        status,
        status_label: statusLabel(status),
        deadline_date: task.deadline_date,
        deadline_time: task.deadline_time
      });
    }
  });

  Object.values(byDesigner).forEach((row) => {
    row.current_tasks.sort((a, b) => `${a.deadline_date || '9999-12-31'}T${a.deadline_time || '23:59'}`.localeCompare(`${b.deadline_date || '9999-12-31'}T${b.deadline_time || '23:59'}`));
    row.current_tasks = row.current_tasks.slice(0, 6);
  });

  const latestTasks = [...tasks]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 8)
    .map((task) => {
      const designer = db.users.find((u) => u.id === task.assigned_to);
      return {
        id: task.id,
        title: task.task_title,
        zoho_project_no: task.zoho_project_no || '',
        client: task.client_name,
        status: task.computed_status,
        status_label: statusLabel(task.computed_status),
        priority: task.priority,
        assignment_date: task.assignment_date || '',
        vertical: taskVertical(task, db),
        started_working_date: task.started_working_date || '',
        started_working_time: task.started_working_time || '',
        end_time: task.end_time || '',
        status_of_day: task.status_of_day || '',
        action_field: task.action_field || '',
        rating_overall: task.rating_overall || '',
        designer_name: designer?.name || '',
        designer_verticals: normalizeVerticals(designer?.verticals),
        updated_at: task.updated_at,
        deadline_date: task.deadline_date,
        deadline_time: task.deadline_time
      };
    });

  res.json({
    filters: { ...req.query, range, date_field: dateField },
    summary: {
      total: tasks.length,
      completed: tasks.filter((t) => (t.computed_status || t.status) === 'completed').length,
      in_progress: tasks.filter((t) => (t.computed_status || t.status) === 'in_progress').length,
      pending_acceptance: tasks.filter((t) => (t.computed_status || t.status) === 'pending_acceptance').length,
      submitted_for_review: tasks.filter((t) => (t.computed_status || t.status) === 'submitted_for_review').length,
      overdue: tasks.filter((t) => (t.computed_status || t.status) === 'overdue').length,
      declined: tasks.filter((t) => (t.computed_status || t.status) === 'declined').length
    },
    byStatus,
    byPriority,
    byCategory,
    byVertical,
    byAction,
    byProject: Object.values(byProject).sort((a, b) => b.total - a.total || a.project.localeCompare(b.project)),
    byPeriod: Object.values(byPeriod).sort((a, b) => a.period.localeCompare(b.period)),
    byDesigner: Object.values(byDesigner).sort((a, b) => b.active - a.active || b.total - a.total),
    latestTasks
  });
}));

module.exports = router;
