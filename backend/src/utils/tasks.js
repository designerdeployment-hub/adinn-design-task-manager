const STATUS_LABELS = {
  pending_acceptance: 'Pending Acceptance',
  accepted: 'Accepted',
  declined: 'Declined',
  in_progress: 'In Progress',
  on_hold: 'On Hold',
  submitted_for_review: 'Submitted for Review',
  changes_requested: 'Changes Requested',
  completed: 'Completed',
  overdue: 'Overdue'
};

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function canSeeTask(user, task) {
  if (user.role === 'admin') return true;
  if (user.role === 'bd' || user.role === 'manager') return true;
  if (user.role === 'designer') return task.assigned_to === user.id;
  return false;
}

function enrichTask(db, task) {
  const assigner = db.users.find((u) => u.id === task.assigned_by);
  const designer = db.users.find((u) => u.id === task.assigned_to);
  const rater = db.users.find((u) => u.id === task.rated_by);
  const files = db.task_files.filter((f) => f.task_id === task.id);
  const comments = db.task_comments
    .filter((c) => c.task_id === task.id)
    .map((c) => ({ ...c, user: safePerson(db.users.find((u) => u.id === c.commented_by)) }))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const history = db.task_history
    .filter((h) => h.task_id === task.id)
    .map((h) => ({ ...h, user: safePerson(db.users.find((u) => u.id === h.performed_by)) }))
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return {
    ...task,
    status_label: statusLabel(task.status),
    assigner: safePerson(assigner),
    designer: safePerson(designer),
    rater: safePerson(rater),
    files,
    comments,
    history
  };
}

function safePerson(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    designation: user.designation,
    department: user.department,
    verticals: Array.isArray(user.verticals) ? user.verticals : []
  };
}

function isOverdue(task) {
  if (!task.deadline_date || ['completed', 'declined'].includes(task.status)) return false;
  const deadline = new Date(`${task.deadline_date}T${task.deadline_time || '23:59'}:00`);
  return deadline.getTime() < Date.now();
}

function applyComputedStatus(task) {
  if (isOverdue(task) && !['submitted_for_review', 'changes_requested'].includes(task.status)) {
    return { ...task, computed_status: 'overdue', computed_status_label: 'Overdue' };
  }
  return { ...task, computed_status: task.status, computed_status_label: statusLabel(task.status) };
}

module.exports = { STATUS_LABELS, statusLabel, canSeeTask, enrichTask, isOverdue, applyComputedStatus };
