import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Edit3,
  FileUp,
  Filter,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Trash2,
  Database,
  Save,
  ShieldCheck,
  UserCog,
  Users,
  Star,
  XCircle,
  Bell,
  CheckCheck
} from 'lucide-react';
import { api } from './api';

const statusLabels = {
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

const fallbackVerticals = [
  'RoadShow',
  'Signage and Fixtures',
  'Outdoor',
  'Events and Activations',
  'Media',
  'Digital Marketing',
  'Print Services',
  'Wall Painting'
];

const roleLabels = {
  admin: 'Admin',
  bd: 'Business Developer (BD)',
  manager: 'Business Developer (BD)',
  designer: 'Designer'
};

const statusFlowForDesigner = [
  { value: 'in_progress', label: 'Start / In Progress' },
  { value: 'on_hold', label: 'Put On Hold' },
  { value: 'submitted_for_review', label: 'Submit for Review' },
  { value: 'completed', label: 'Mark Completed' }
];

const actionFieldOptions = [
  '1st Modification Started',
  '2nd Modification Started',
  'Preparing for Print File',
  'Print File Shared',
  'Project Completed'
];

const statusFlowForBD = [
  { value: 'changes_requested', label: 'Request Changes' },
  { value: 'completed', label: 'Approve / Complete' },
  { value: 'on_hold', label: 'Put On Hold' }
];


function StarsDisplay({ value, showNumber = true }) {
  const score = Math.max(0, Math.min(5, Number(value) || 0));
  if (!score) return <span className="muted">-</span>;
  return (
    <span className="starsDisplay" title={`${score}/5`}>
      {[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= Math.round(score) ? 'star filled' : 'star'}>★</span>)}
      {showNumber && <small>{score}/5</small>}
    </span>
  );
}

function StarRatingInput({ value, onChange }) {
  const numericValue = Number(value) || 0;
  return (
    <div className="starRatingInput" role="radiogroup" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={n <= numericValue ? 'selected' : ''}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(String(n))}
        >
          ★
        </button>
      ))}
      <span>{numericValue ? `${numericValue}/5` : 'Select rating'}</span>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

function formatDate(value, time) {
  if (!value) return '-';
  return `${value}${time ? `, ${time}` : ''}`;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatTaskWindow(task) {
  const start = task?.started_working_date ? `Started: ${formatDate(task.started_working_date, task.started_working_time)}` : (task?.planned_start_date ? `Planned: ${formatDate(task.planned_start_date, task.planned_start_time)}` : 'Start: Not fixed');
  const due = task?.deadline_date ? `Due: ${formatDate(task.deadline_date, task.deadline_time)}` : 'Due: -';
  const hours = task?.estimated_hours ? ` • ${task.estimated_hours} hrs est.` : '';
  return `${start} • ${due}${hours}`;
}

function verticalText(verticals) {
  const list = Array.isArray(verticals) ? verticals : [];
  return list.length ? list.join(', ') : 'No vertical assigned';
}

function App() {
  const [user, setUser] = useState(api.getStoredUser());
  const [page, setPage] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const [booting, setBooting] = useState(true);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    async function boot() {
      if (!api.getToken()) {
        setBooting(false);
        return;
      }
      try {
        const data = await api.me();
        setUser(data.user);
        localStorage.setItem('dtm_user', JSON.stringify(data.user));
      } catch {
        api.clearSession();
        setUser(null);
      } finally {
        setBooting(false);
      }
    }
    boot();
  }, []);

  function logout() {
    api.clearSession();
    setUser(null);
    setPage('dashboard');
  }

  if (booting) return <div className="boot">Loading Adinn Design Workflow...</div>;
  if (!user) return <LoginScreen onLogin={setUser} notify={notify} toast={toast} />;

  return (
    <Shell user={user} page={page} setPage={setPage} logout={logout} toast={toast} notify={notify}>
      {page === 'dashboard' && <Dashboard user={user} setPage={setPage} notify={notify} />}
      {page === 'tasks' && <TasksPage user={user} notify={notify} />}
      {page === 'create' && <CreateTaskPage user={user} notify={notify} setPage={setPage} />}
      {page === 'users' && <UsersPage user={user} notify={notify} />}
      {page === 'reports' && <ReportsPage user={user} notify={notify} />}
      {page === 'settings' && <SettingsPage user={user} notify={notify} />}
    </Shell>
  );
}

function LoginScreen({ onLogin, notify, toast }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const data = await api.login(email, password);
      notify(`Welcome ${data.user.name}`);
      onLogin(data.user);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="loginPage">
      <div className="loginBrand">
        <div className="heroLogoCard">
          <img src="/adinn-logo.png" alt="Adinn Advertising Services Ltd." className="heroLogo" />
        </div>
        <div className="brandKicker">Creative Operations System</div>
        <h1>Design Work Allocation</h1>
        <p>Assign design requests, review designer workload by timing, filter designers by vertical, and maintain a professional approval trail for every creative task inside Adinn.</p>
        <div className="loginHighlights">
          <span>Role-based access</span>
          <span>Designer workload visibility</span>
          <span>Clean task audit trail</span>
        </div>
      </div>
      <form className="loginCard" onSubmit={submit}>
        <img src="/adinn-logo.png" alt="Adinn" className="cardLogo" />
        <ShieldCheck size={34} />
        <h2>Sign in</h2>
        <label>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your company email" autoComplete="email" required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" required />
        <button className="primaryBtn" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
      </form>
      {toast && <Toast toast={toast} />}
    </div>
  );
}

function Shell({ user, page, setPage, logout, children, toast, notify }) {
  const nav = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { key: 'tasks', label: 'Tasks', icon: CheckCircle2 },
    { key: 'create', label: 'Create Task', icon: Plus, hide: user.role === 'designer' },
    { key: 'users', label: 'Users', icon: Users, hide: user.role !== 'admin' },
    { key: 'reports', label: 'Reports', icon: BarChart3 },
    { key: 'settings', label: 'Settings', icon: Settings2, hide: user.role !== 'admin' }
  ].filter((item) => !item.hide);

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="sideBrand">
          <div className="sideLogoPlate">
            <img src="/adinn-logo.png" alt="Adinn" className="sideLogo" />
          </div>
          <div>
            <strong>Design Tracker</strong>
            <span>Adinn workflow</span>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.key} className={page === item.key ? 'active' : ''} onClick={() => setPage(item.key)}>
                <Icon size={18} /> {item.label}
              </button>
            );
          })}
        </nav>
        <div className="userCard">
          <div className="avatar">{user.name.slice(0, 1)}</div>
          <div>
            <strong>{user.name}</strong>
            <span>{roleLabels[user.role] || user.role}</span>
          </div>
        </div>
        <button className="ghostBtn logout" onClick={logout}><LogOut size={16} /> Logout</button>
      </aside>
      <main className="mainArea">
        <div className="topUtilityBar">
          <NotificationBell notify={notify} />
        </div>
        {children}
      </main>
      {toast && <Toast toast={toast} />}
    </div>
  );
}


function NotificationBell({ notify }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [permission, setPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [seenIds, setSeenIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dtm_seen_notification_ids') || '[]');
    } catch {
      return [];
    }
  });

  const loadNotifications = useCallback(async () => {
    try {
      const data = await api.getNotifications({ limit: 50 });
      const list = data.notifications || [];
      setItems(list);
      setUnread(data.unread_count || 0);

      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        const seen = new Set(seenIds);
        const newUnread = list
          .filter((item) => !item.read && !seen.has(item.id))
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        newUnread.slice(-3).forEach((item) => {
          try {
            const desktopNotification = new Notification(item.title || 'Task notification', {
              body: item.message || '',
              icon: '/adinn-logo.png',
              tag: item.id
            });
            desktopNotification.onclick = () => window.focus();
          } catch {
            // Browser notification permission can change at runtime.
          }
          seen.add(item.id);
        });
        const updated = [...seen].slice(-200);
        setSeenIds(updated);
        localStorage.setItem('dtm_seen_notification_ids', JSON.stringify(updated));
      }
    } catch {
      // Keep notification checks silent so the main app never crashes.
    }
  }, [seenIds]);

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 30000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  async function requestDesktopPermission() {
    if (typeof Notification === 'undefined') {
      notify('Browser desktop notifications are not supported in this browser.', 'error');
      return;
    }
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === 'granted') {
      notify('Desktop notifications enabled.');
      await loadNotifications();
    } else {
      notify('Notification permission was not enabled.', 'error');
    }
  }

  async function markRead(id) {
    try {
      await api.markNotificationRead(id);
      await loadNotifications();
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function markAllRead() {
    try {
      await api.markAllNotificationsRead();
      await loadNotifications();
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  return (
    <div className="notificationWrap">
      <button className={`notificationButton ${open ? 'active' : 'inactive'}`} onClick={() => setOpen((value) => !value)} title="Notifications">
        <Bell size={18} />
        {unread > 0 && <span>{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="notificationPanel">
          <div className="notificationHead">
            <div>
              <strong>Notifications</strong>
              <small>{unread} unread</small>
            </div>
            <button className="ghostMini" onClick={markAllRead}><CheckCheck size={14} /> Mark all read</button>
          </div>
          {permission !== 'granted' && permission !== 'unsupported' && (
            <button className="enableNotifyBtn" onClick={requestDesktopPermission}>
              Enable notifications
            </button>
          )}
          <div className="notificationList">
            {items.map((item) => (
              <button key={item.id} className={`notificationItem ${item.read ? '' : 'unread'}`} onClick={() => markRead(item.id)}>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <small>{formatDateTime(item.created_at)}</small>
              </button>
            ))}
            {!items.length && <div className="emptyNotifications">No notifications yet.</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function Toast({ toast }) {
  return <div className={`toast ${toast.type}`}>{toast.message}</div>;
}

function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="pageHeader">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="headerActions">{actions}</div>
    </div>
  );
}

function Dashboard({ user, setPage, notify }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.summary();
      setData(response);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loader label="Loading dashboard..." />;
  if (!data) return <EmptyState title="No dashboard data" />;

  const cards = [
    { label: 'Total Tasks', value: data.summary.total, icon: CheckCircle2 },
    { label: 'Pending Acceptance', value: data.summary.pending_acceptance, icon: Clock3 },
    { label: 'In Progress', value: data.summary.in_progress, icon: RefreshCw },
    { label: 'For Review', value: data.summary.submitted_for_review, icon: Send },
    { label: 'Completed', value: data.summary.completed, icon: CheckCircle2 },
    { label: 'Overdue', value: data.summary.overdue, icon: AlertCircle }
  ];

  return (
    <>
      <PageHeader
        title={`Good day, ${user.name}`}
        subtitle="A clean view of task movement, designer workload, verticals, deadlines, and pending approvals."
        actions={user.role !== 'designer' && <button className="primaryBtn" onClick={() => setPage('create')}><Plus size={16} /> New Task</button>}
      />
      <div className="metricGrid">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div className="metricCard" key={card.label}>
              <Icon size={22} />
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          );
        })}
      </div>
      <div className="twoColumn">
        <section className="panel">
          <h2>Latest Task Activity</h2>
          <div className="compactList">
            {data.latestTasks.map((task) => (
              <div className="compactItem" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <span>{task.client || 'No client'} • {task.designer_name || 'No designer'}</span>
                  <small className="microText">{verticalText(task.designer_verticals)}</small>
                </div>
                <StatusBadge status={task.status} />
              </div>
            ))}
            {!data.latestTasks.length && <EmptyState title="No tasks yet" compact />}
          </div>
        </section>
        <section className="panel">
          <h2>Designer Workload</h2>
          <div className="designerBars">
            {data.byDesigner.map((row) => (
              <div className="barRow" key={row.designer_name}>
                <div className="barInfo">
                  <strong>{row.designer_name}</strong>
                  <span>{row.active} active • {row.completed} completed • {row.overdue} overdue</span>
                  <small className="microText">{verticalText(row.verticals)}</small>
                </div>
                <div className="barTrack"><div style={{ width: `${Math.min(100, row.active * 16)}%` }} /></div>
                <b>{row.active}</b>
              </div>
            ))}
            {!data.byDesigner.length && <EmptyState title="No designer workload yet" compact />}
          </div>
        </section>
      </div>
    </>
  );
}

function TasksPage({ user, notify }) {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ q: '', status: '', action_field: '', priority: '', category: '', assigned_to: '', vertical: '', project: '', from: '', to: '', date_field: 'assignment_date' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [taskResponse, userResponse, metaResponse] = await Promise.all([
        api.getTasks(filters),
        api.getUsers({ role: 'designer', status: 'active', vertical: filters.vertical }),
        api.getTaskMeta()
      ]);
      setTasks(taskResponse.tasks);
      setUsers(userResponse.users);
      setMeta(metaResponse.settings);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, notify]);

  useEffect(() => { load(); }, [load]);

  async function openTask(id) {
    try {
      const data = await api.getTask(id);
      setSelected(data.task);
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function exportCsv() {
    try {
      const blob = await api.exportCsv(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'design-tasks-export.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  const verticals = meta?.verticals || fallbackVerticals;

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Track assignment, acceptance, progress, revisions, files, approvals, and designer vertical workload."
        actions={<><button className="secondaryBtn" onClick={load}><RefreshCw size={16} /> Refresh</button><button className="secondaryBtn" onClick={exportCsv}><Download size={16} /> Export CSV</button></>}
      />
      <section className="panel filterPanel">
        <div className="filterTitle"><Filter size={16} /> Filters</div>
        <div className="filters taskFilters">
          <div className="searchBox"><Search size={16} /><input placeholder="Search task, Zoho project, client, category..." value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} /></div>
          <input placeholder="Project / Zoho No." value={filters.project} onChange={(e) => setFilters((f) => ({ ...f, project: e.target.value }))} />
          <select value={filters.date_field} onChange={(e) => setFilters((f) => ({ ...f, date_field: e.target.value }))}>
            <option value="assignment_date">Assignment Date</option>
            <option value="deadline_date">Deadline Date</option>
            <option value="started_working_date">Started Working Date</option>
            <option value="completed_at">Completed Date</option>
          </select>
          <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} />
          <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} />
          <select value={filters.vertical} onChange={(e) => setFilters((f) => ({ ...f, vertical: e.target.value, assigned_to: '' }))}>
            <option value="">All verticals</option>
            {verticals.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
            <option value="">All status</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={filters.action_field} onChange={(e) => setFilters((f) => ({ ...f, action_field: e.target.value }))}>
            <option value="">All actions</option>
            {actionFieldOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={filters.priority} onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value }))}>
            <option value="">All priority</option>
            {(meta?.priorities || ['Low', 'Medium', 'High', 'Urgent']).map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
            <option value="">All categories</option>
            {(meta?.categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {user.role !== 'designer' && (
            <select value={filters.assigned_to} onChange={(e) => setFilters((f) => ({ ...f, assigned_to: e.target.value }))}>
              <option value="">All designers</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name} - {verticalText(u.verticals)}</option>)}
            </select>
          )}
        </div>
      </section>
      <section className="panel tablePanel">
        {loading ? <Loader label="Loading tasks..." /> : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Date of Assignment</th>
                  <th>Task</th>
                  <th>Zoho Project No.</th>
                  <th>Designer</th>
                  <th>Vertical</th>
                  <th>Priority</th>
                  <th>Deadline</th>
                  <th>Started Working</th>
                  <th>End Time</th>
                  <th>Status of the Day</th>
                  <th>Action Field</th>
                  <th>System Status</th>
                  <th>Attachments</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} onClick={() => openTask(task.id)}>
                    <td>{task.assignment_date || String(task.created_at || '').slice(0, 10)}</td>
                    <td>
                      <strong>{task.task_title}</strong>
                      <span>{task.client_name || 'No client'} • {task.category}</span>
                    </td>
                    <td>{task.zoho_project_no || '-'}</td>
                    <td>{task.designer?.name || '-'}</td>
                    <td>{task.vertical || verticalText(task.designer?.verticals || [])}</td>
                    <td><PriorityBadge priority={task.priority} /></td>
                    <td>{formatDate(task.deadline_date, task.deadline_time)}</td>
                    <td><span className="timingText">{task.started_working_date ? formatDate(task.started_working_date, task.started_working_time) : '-'}</span></td>
                    <td>{task.end_time || '-'}</td>
                    <td>{task.status_of_day || '-'}</td>
                    <td>{task.action_field || '-'}</td>
                    <td><StatusBadge status={task.computed_status || task.status} /></td>
                    <td>{task.files?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!tasks.length && <EmptyState title="No tasks found" />}
          </div>
        )}
      </section>
      {selected && <TaskDetail task={selected} setTask={setSelected} close={() => setSelected(null)} reload={load} users={users} user={user} notify={notify} />}
    </>
  );
}

function CreateTaskPage({ user, notify, setPage }) {
  const [designers, setDesigners] = useState([]);
  const [workload, setWorkload] = useState([]);
  const [meta, setMeta] = useState(null);
  const [verticalFilter, setVerticalFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    assignment_date: todayDate(),
    task_title: '',
    zoho_project_no: '',
    client_name: '',
    category: 'Poster',
    description: '',
    assigned_to: '',
    vertical: '',
    priority: 'Medium',
    planned_start_date: '',
    planned_start_time: '',
    estimated_hours: '',
    started_working_date: '',
    started_working_time: '',
    end_time: '',
    status_of_day: 'Assigned',
    action_field: '',
    deadline_date: '',
    deadline_time: '18:00',
    output_required: ''
  });
  const [files, setFiles] = useState([]);

  const load = useCallback(async () => {
    try {
      const [workloadResponse, metaResponse] = await Promise.all([
        api.getDesignerWorkload({ vertical: verticalFilter, status: 'active' }),
        api.getTaskMeta()
      ]);
      setWorkload(workloadResponse.workload);
      setDesigners(workloadResponse.workload);
      setMeta(metaResponse.settings);
      setForm((f) => {
        const stillValid = workloadResponse.workload.some((designer) => designer.id === f.assigned_to);
        const nextDesigner = stillValid ? workloadResponse.workload.find((designer) => designer.id === f.assigned_to) : workloadResponse.workload[0];
        return {
          ...f,
          assigned_to: nextDesigner?.id || '',
          vertical: f.vertical || nextDesigner?.verticals?.[0] || '',
          category: f.category || metaResponse.settings.categories[0] || 'Poster'
        };
      });
    } catch (error) {
      notify(error.message, 'error');
    }
  }, [verticalFilter, notify]);

  useEffect(() => { load(); }, [load]);

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([key, value]) => fd.append(key, value));
      Array.from(files).forEach((file) => fd.append('files', file));
      await api.createTask(fd);
      notify('Task created and assigned successfully.');
      setPage('tasks');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const verticals = meta?.verticals || fallbackVerticals;
  const selectedDesigner = designers.find((designer) => designer.id === form.assigned_to);

  return (
    <>
      <PageHeader
        title="Create Task"
        subtitle="Filter designers by vertical and check their live task timings before assigning new work."
        actions={<button type="button" className="secondaryBtn" onClick={load}><RefreshCw size={16} /> Refresh Workload</button>}
      />

      <section className="panel">
        <div className="sectionTitleRow">
          <div>
            <h2>Designer Availability</h2>
            <p>Use this board before assigning. Submitted-for-review tasks are not counted as current tasks.</p>
          </div>
          <select className="verticalFilterSelect" value={verticalFilter} onChange={(e) => setVerticalFilter(e.target.value)}>
            <option value="">All verticals</option>
            {verticals.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <DesignerWorkloadGrid workload={workload} selectedDesignerId={form.assigned_to} onSelect={(id) => { const designer = designers.find((item) => item.id === id); setForm((current) => ({ ...current, assigned_to: id, vertical: designer?.verticals?.[0] || current.vertical })); }} />
      </section>

      <form className="panel formGrid" onSubmit={submit}>
        <Field label="Date of Assignment" required><input type="date" value={form.assignment_date} onChange={(e) => setField('assignment_date', e.target.value)} /></Field>
        <Field label="TASK" required><input value={form.task_title} onChange={(e) => setField('task_title', e.target.value)} placeholder="Example: Premium real estate hoarding design" /></Field>
        <Field label="Zoho Project No."><input value={form.zoho_project_no} onChange={(e) => setField('zoho_project_no', e.target.value)} placeholder="Example: ZP-1045" /></Field>
        <Field label="Client / Brand Name"><input value={form.client_name} onChange={(e) => setField('client_name', e.target.value)} placeholder="Client or brand" /></Field>
        <Field label="Task Category" required><select value={form.category} onChange={(e) => setField('category', e.target.value)}>{(meta?.categories || ['Poster']).map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
        <Field label="Designers" required><select value={form.assigned_to} onChange={(e) => { const designer = designers.find((item) => item.id === e.target.value); setForm((current) => ({ ...current, assigned_to: e.target.value, vertical: designer?.verticals?.[0] || current.vertical })); }}>{designers.map((u) => <option key={u.id} value={u.id}>{u.name} - {u.active_count} current - {verticalText(u.verticals)}</option>)}</select></Field>
        {selectedDesigner && <Field label="Designer Vertical Mapping"><div className="readonlyBox"><VerticalPills verticals={selectedDesigner.verticals} /></div></Field>}
        <Field label="Vertical" required><select value={form.vertical} onChange={(e) => setField('vertical', e.target.value)}>{verticals.map((v) => <option key={v} value={v}>{v}</option>)}</select></Field>
        <Field label="Priority" required><select value={form.priority} onChange={(e) => setField('priority', e.target.value)}>{(meta?.priorities || ['Low', 'Medium', 'High', 'Urgent']).map((p) => <option key={p} value={p}>{p}</option>)}</select></Field>
        <Field label="Planned Start Date"><input type="date" value={form.planned_start_date} onChange={(e) => setField('planned_start_date', e.target.value)} /></Field>
        <Field label="Planned Start Time"><input type="time" value={form.planned_start_time} onChange={(e) => setField('planned_start_time', e.target.value)} /></Field>
        <Field label="Estimated Hours"><input type="number" min="0" step="0.5" value={form.estimated_hours} onChange={(e) => setField('estimated_hours', e.target.value)} placeholder="Example: 4" /></Field>
        <Field label="Started Working Date"><input type="date" value={form.started_working_date} onChange={(e) => setField('started_working_date', e.target.value)} /></Field>
        <Field label="Started Working Time"><input type="time" value={form.started_working_time} onChange={(e) => setField('started_working_time', e.target.value)} /></Field>
        <Field label="End Time"><input type="time" value={form.end_time} onChange={(e) => setField('end_time', e.target.value)} /></Field>
        <Field label="Status of the Day"><input value={form.status_of_day} onChange={(e) => setField('status_of_day', e.target.value)} placeholder="Assigned / Working / Completed / Hold" /></Field>
        <Field label="Action Field"><select value={form.action_field} onChange={(e) => setField('action_field', e.target.value)}><option value="">No action selected</option>{actionFieldOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></Field>
        <Field label="Deadline Date" required><input type="date" value={form.deadline_date} onChange={(e) => setField('deadline_date', e.target.value)} /></Field>
        <Field label="Deadline Time"><input type="time" value={form.deadline_time} onChange={(e) => setField('deadline_time', e.target.value)} /></Field>
        <Field label="Output Required"><input value={form.output_required} onChange={(e) => setField('output_required', e.target.value)} placeholder="JPEG, PDF, PSD, AI, CDR, PPT..." /></Field>
        <Field label="Description" wide><textarea value={form.description} onChange={(e) => setField('description', e.target.value)} rows="6" placeholder="Explain creative direction, sizes, references, content, mandatory logo usage, etc." /></Field>
        <Field label="Attachments" wide><input type="file" multiple onChange={(e) => setFiles(e.target.files)} /></Field>
        <div className="formActions">
          <button type="button" className="secondaryBtn" onClick={() => setPage('tasks')}>Cancel</button>
          <button className="primaryBtn" disabled={loading || !designers.length}><Plus size={16} /> {loading ? 'Creating...' : 'Create & Assign Task'}</button>
        </div>
      </form>
    </>
  );
}

function DesignerWorkloadGrid({ workload, selectedDesignerId, onSelect }) {
  if (!workload.length) return <EmptyState title="No designers found for this vertical" compact />;

  return (
    <div className="workloadGrid availabilityGrid">
      {workload.map((designer) => (
        <button type="button" className={`workloadCard availabilityCard ${selectedDesignerId === designer.id ? 'selected' : ''}`} key={designer.id} onClick={() => onSelect(designer.id)}>
          <div className="workloadHead">
            <div>
              <strong>{designer.name}</strong>
              <span>{designer.designation || 'Designer'}</span>
            </div>
            <div className="currentTaskBadge">
              <b>{designer.active_count}</b>
              <small>Current tasks</small>
            </div>
          </div>
          <VerticalPills verticals={designer.verticals} compact />
        </button>
      ))}
    </div>
  );
}

function TaskDetail({ task, setTask, close, reload, users, user, notify }) {
  const [comment, setComment] = useState('');
  const [remarks, setRemarks] = useState('');
  const [newDesigner, setNewDesigner] = useState(task.assigned_to);
  const [files, setFiles] = useState([]);
  const [rating, setRating] = useState({
    rating_quality: task.rating_quality || '',
    rating_timeliness: task.rating_timeliness || '',
    rating_understanding: task.rating_understanding || '',
    rating_revision_handling: task.rating_revision_handling || '',
    rating_overall: task.rating_overall || '',
    rating_remarks: task.rating_remarks || ''
  });
  const [busy, setBusy] = useState(false);

  const isDesigner = user.role === 'designer' && task.assigned_to === user.id;
  const isAssigner = user.role === 'admin' || task.assigned_by === user.id;
  const canReassign = ['admin', 'bd', 'manager'].includes(user.role) || task.assigned_by === user.id;

  async function refreshTask(updated) {
    setTask(updated);
    setRating({
      rating_quality: updated.rating_quality || '',
      rating_timeliness: updated.rating_timeliness || '',
      rating_understanding: updated.rating_understanding || '',
      rating_revision_handling: updated.rating_revision_handling || '',
      rating_overall: updated.rating_overall || '',
      rating_remarks: updated.rating_remarks || ''
    });
    await reload();
  }

  async function runAction(label, action) {
    setBusy(true);
    try {
      const data = await action();
      await refreshTask(data.task);
      notify(label);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function decline() {
    const reason = window.prompt('Reason for declining this task:');
    if (!reason) return;
    await runAction('Task declined with reason.', () => api.declineTask(task.id, reason));
  }

  async function addComment(event) {
    event.preventDefault();
    if (!comment.trim()) return;
    await runAction('Comment added.', () => api.addComment(task.id, comment));
    setComment('');
  }

  async function uploadTaskFiles(event) {
    event.preventDefault();
    if (!files.length) return;
    const fd = new FormData();
    Array.from(files).forEach((file) => fd.append('files', file));
    await runAction('Files uploaded.', () => api.uploadFiles(task.id, fd));
    setFiles([]);
  }

  async function updateActionField(actionField) {
    await runAction('Action field updated.', () => api.updateActionField(task.id, actionField, remarks));
  }

  async function saveRating(event) {
    event.preventDefault();
    if (!rating.rating_quality || !rating.rating_timeliness || !rating.rating_understanding || !rating.rating_revision_handling || !rating.rating_overall) {
      notify('Please select all star ratings before saving.', 'error');
      return;
    }
    await runAction('Designer rating saved.', () => api.rateTask(task.id, rating));
  }

  function setRatingField(field, value) {
    setRating((current) => ({ ...current, [field]: value }));
  }

  async function deleteTask() {
    const confirmed = window.confirm(`Delete task \"${task.task_title}\" permanently? This action cannot be undone.`);
    if (!confirmed) return;
    setBusy(true);
    try {
      await api.deleteTask(task.id);
      notify('Task deleted successfully.');
      close();
      await reload();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="drawerBackdrop" onClick={close}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawerHead">
          <div>
            <h2>{task.task_title}</h2>
            <p>{task.client_name || 'No client'} • {task.category}</p>
          </div>
          <button className="iconBtn" onClick={close}>×</button>
        </div>
        <div className="detailMeta">
          <StatusBadge status={task.computed_status || task.status} />
          <PriorityBadge priority={task.priority} />
          <span><CalendarClock size={14} /> {formatDate(task.deadline_date, task.deadline_time)}</span>
        </div>
        <div className="detailGrid">
          <Info label="Date of Assignment" value={task.assignment_date || String(task.created_at || '').slice(0, 10)} />
          <Info label="Zoho Project No." value={task.zoho_project_no || '-'} />
          <Info label="Assigned by" value={task.assigner?.name || '-'} />
          <Info label="Designers" value={task.designer?.name || '-'} />
          <Info label="Vertical" value={task.vertical || verticalText(task.designer?.verticals)} />
          <Info label="Planned Start" value={task.planned_start_date ? formatDate(task.planned_start_date, task.planned_start_time) : '-'} />
          <Info label="Estimated Hours" value={task.estimated_hours || '-'} />
          <Info label="Started Working Dt/Time" value={task.started_working_date ? formatDate(task.started_working_date, task.started_working_time) : '-'} />
          <Info label="End Time" value={task.end_time || '-'} />
          <Info label="Status of the Day" value={task.status_of_day || '-'} />
          <Info label="Action Field" value={task.action_field || '-'} />
          <div className="infoBox"><span>Overall Rating</span><strong><StarsDisplay value={task.rating_overall} /></strong></div>
          <Info label="Output" value={task.output_required || '-'} />
          <Info label="Created" value={formatDateTime(task.created_at)} />
        </div>
        {task.description && <section className="detailSection"><h3>Description</h3><p>{task.description}</p></section>}
        {task.decline_reason && <section className="detailSection dangerBox"><h3>Decline Reason</h3><p>{task.decline_reason}</p></section>}

        <section className="detailSection actionsBox">
          <h3>Actions</h3>
          <div className="actionRows">
            {isDesigner && ['pending_acceptance', 'declined'].includes(task.status) && (
              <div className="inlineActions">
                <button disabled={busy} className="primaryBtn" onClick={() => runAction('Task accepted.', () => api.acceptTask(task.id))}><CheckCircle2 size={16} /> Accept</button>
                <button disabled={busy} className="dangerBtn" onClick={decline}><XCircle size={16} /> Decline</button>
              </div>
            )}
            {(isDesigner || isAssigner) && !['completed'].includes(task.status) && (
              <ActionFieldSelect options={actionFieldOptions} value={task.action_field || ''} busy={busy} onSubmit={updateActionField} />
            )}
            {isDesigner && !['pending_acceptance', 'declined', 'completed'].includes(task.status) && (
              <StatusActionSelect options={statusFlowForDesigner} busy={busy} onSubmit={(status) => runAction('Status updated.', () => api.changeStatus(task.id, status, remarks))} remarks={remarks} setRemarks={setRemarks} />
            )}
            {isAssigner && !['completed'].includes(task.status) && (
              <StatusActionSelect options={statusFlowForBD} busy={busy} onSubmit={(status) => runAction('Task updated.', () => api.changeStatus(task.id, status, remarks))} remarks={remarks} setRemarks={setRemarks} />
            )}
            {canReassign && !['completed'].includes(task.status) && (
              <div className="reassignBox">
                <div className="reassignHeader">Reassign designer</div>
                <select value={newDesigner} onChange={(e) => setNewDesigner(e.target.value)}>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name} - {verticalText(u.verticals)}</option>)}
                </select>
                <button disabled={busy || newDesigner === task.assigned_to} className="secondaryBtn" onClick={() => runAction('Task reassigned.', () => api.reassignTask(task.id, newDesigner, remarks))}>Reassign</button>
              </div>
            )}
            {user.role === 'admin' && (
              <div className="adminDangerZone">
                <div>
                  <strong>Admin only</strong>
                  <span>Delete this task permanently from the tracker.</span>
                </div>
                <button disabled={busy} className="dangerBtn" onClick={deleteTask}><Trash2 size={16} /> Delete Task</button>
              </div>
            )}
          </div>
        </section>

        {(isAssigner || user.role === 'admin' || user.role === 'bd') && (task.status === 'submitted_for_review' || task.status === 'completed' || task.action_field === 'Project Completed') && (
          <section className="detailSection ratingBox">
            <h3><Star size={16} /> Designer Rating</h3>
            <form className="ratingGrid" onSubmit={saveRating}>
              <Field label="Quality of Design"><StarRatingInput value={rating.rating_quality} onChange={(value) => setRatingField('rating_quality', value)} /></Field>
              <Field label="Timely Delivery"><StarRatingInput value={rating.rating_timeliness} onChange={(value) => setRatingField('rating_timeliness', value)} /></Field>
              <Field label="Understanding of Brief"><StarRatingInput value={rating.rating_understanding} onChange={(value) => setRatingField('rating_understanding', value)} /></Field>
              <Field label="Revision Handling"><StarRatingInput value={rating.rating_revision_handling} onChange={(value) => setRatingField('rating_revision_handling', value)} /></Field>
              <Field label="Overall Rating"><StarRatingInput value={rating.rating_overall} onChange={(value) => setRatingField('rating_overall', value)} /></Field>
              <Field label="Rating Remarks" wide><textarea rows="3" value={rating.rating_remarks} onChange={(e) => setRatingField('rating_remarks', e.target.value)} placeholder="BD feedback about project execution, quality, speed, or revisions" /></Field>
              <div className="formActions wide"><button className="primaryBtn" disabled={busy}><Star size={16} /> Save Rating</button></div>
            </form>
            {task.rater && task.rated_at && <p className="microText">Last rated by {task.rater.name} on {formatDateTime(task.rated_at)}</p>}
          </section>
        )}

        <section className="detailSection">
          <h3><Paperclip size={16} /> Attachments</h3>
          <div className="fileList">
            {task.files.map((file) => (
              <a key={file.id} href={file.file_url?.startsWith('http') ? file.file_url : `${api.API_URL}${file.file_url}`} target="_blank" rel="noreferrer">
                <Paperclip size={14} /> {file.file_name}
              </a>
            ))}
            {!task.files.length && <span className="muted">No files uploaded.</span>}
          </div>
          <form className="uploadRow" onSubmit={uploadTaskFiles}>
            <input type="file" multiple onChange={(e) => setFiles(e.target.files)} />
            <button className="secondaryBtn" disabled={busy || !files.length}><FileUp size={16} /> Upload</button>
          </form>
        </section>

        <section className="detailSection">
          <h3><MessageSquare size={16} /> Comments</h3>
          <div className="comments">
            {task.comments.map((item) => (
              <div className="comment" key={item.id}>
                <strong>{item.user?.name || 'User'} <span>{formatDateTime(item.created_at)}</span></strong>
                <p>{item.comment}</p>
              </div>
            ))}
            {!task.comments.length && <span className="muted">No comments yet.</span>}
          </div>
          <form className="commentForm" onSubmit={addComment}>
            <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add progress note, clarification, or revision comment..." />
            <button className="primaryBtn" disabled={busy || !comment.trim()}><Send size={16} /> Send</button>
          </form>
        </section>

        <section className="detailSection">
          <h3>Timeline</h3>
          <div className="timeline">
            {task.history.map((item) => (
              <div className="timelineItem" key={item.id}>
                <span />
                <div>
                  <strong>{item.action.replaceAll('_', ' ')}</strong>
                  <p>{item.remarks || `${statusLabels[item.old_status] || item.old_status} to ${statusLabels[item.new_status] || item.new_status}`}</p>
                  <small>{item.user?.name || 'User'} • {formatDateTime(item.created_at)}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}

function ActionFieldSelect({ options, value, onSubmit, busy }) {
  const [actionField, setActionField] = useState(value || '');
  useEffect(() => setActionField(value || ''), [value]);
  return (
    <div className="statusAction">
      <select value={actionField} onChange={(e) => setActionField(e.target.value)}>
        <option value="">Select action field</option>
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
      <button disabled={busy || !actionField || actionField === value} className="secondaryBtn" onClick={() => onSubmit(actionField)}>Update Action</button>
    </div>
  );
}

function StatusActionSelect({ options, onSubmit, busy, remarks, setRemarks }) {
  const [status, setStatus] = useState(options[0]?.value || '');
  return (
    <div className="statusAction">
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional remarks" />
      <button disabled={busy} className="secondaryBtn" onClick={() => onSubmit(status)}>Update</button>
    </div>
  );
}

function UsersPage({ user, notify }) {
  const emptyForm = { name: '', email: '', password: '', role: 'designer', department: 'Design', designation: '', phone: '', verticals: [] };
  const [users, setUsers] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [filters, setFilters] = useState({ q: '', role: '', vertical: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [userData, metaData] = await Promise.all([
        api.getUsers(filters),
        api.getTaskMeta()
      ]);
      setUsers(userData.users);
      setMeta(metaData.settings);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, notify]);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId('');
  }

  function toggleVertical(vertical) {
    setForm((current) => {
      const currentVerticals = Array.isArray(current.verticals) ? current.verticals : [];
      const exists = currentVerticals.includes(vertical);
      return {
        ...current,
        verticals: exists ? currentVerticals.filter((item) => item !== vertical) : [...currentVerticals, vertical]
      };
    });
  }

  function editUser(record) {
    setEditingId(record.id);
    setForm({
      name: record.name || '',
      email: record.email || '',
      password: '',
      role: record.role === 'manager' ? 'bd' : record.role,
      department: record.department || '',
      designation: record.designation || '',
      phone: record.phone || '',
      verticals: Array.isArray(record.verticals) ? record.verticals : []
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function save(event) {
    event.preventDefault();
    try {
      const payload = { ...form, verticals: form.role === 'designer' ? form.verticals : [] };
      if (editingId && !payload.password) delete payload.password;
      if (editingId) {
        await api.updateUser(editingId, payload);
        notify('User updated successfully.');
      } else {
        await api.createUser(payload);
        notify('User created successfully.');
      }
      resetForm();
      await load();
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function toggleStatus(record) {
    try {
      await api.updateUser(record.id, { status: record.status === 'active' ? 'inactive' : 'active' });
      notify('User status updated.');
      await load();
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  async function deleteUser(record) {
    if (record.id === user.id) {
      notify('You cannot delete your own logged-in admin account.', 'error');
      return;
    }
    const confirmed = window.confirm(`Delete ${record.name}? This will remove the user account permanently. Existing task history will remain for audit reference.`);
    if (!confirmed) return;
    try {
      await api.deleteUser(record.id);
      notify('User deleted successfully.');
      if (editingId === record.id) resetForm();
      await load();
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  if (user.role !== 'admin') return <EmptyState title="Admin access required" />;

  const verticals = meta?.verticals || fallbackVerticals;

  return (
    <>
      <PageHeader title="Users" subtitle="Create and edit Admins, Business Developers, and Designers. Designers can be mapped to Adinn verticals." />
      <form className="panel formGrid compactForm" onSubmit={save}>
        <Field label="Name" required><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
        <Field label="Email" required><input type="email" value={form.email} disabled={Boolean(editingId)} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
        <Field label={editingId ? 'New Password (optional)' : 'Password'} required={!editingId}><input value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} /></Field>
        <Field label="Role" required>
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value, verticals: e.target.value === 'designer' ? f.verticals : [] }))}>
            <option value="designer">Designer</option>
            <option value="bd">Business Developer (BD)</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <Field label="Department"><input value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} /></Field>
        <Field label="Designation"><input value={form.designation} onChange={(e) => setForm((f) => ({ ...f, designation: e.target.value }))} /></Field>
        {form.role === 'designer' && (
          <Field label="Designer Verticals" wide>
            <div className="checkboxGrid">
              {verticals.map((vertical) => (
                <label key={vertical} className="checkPill">
                  <input type="checkbox" checked={form.verticals.includes(vertical)} onChange={() => toggleVertical(vertical)} />
                  <span>{vertical}</span>
                </label>
              ))}
            </div>
          </Field>
        )}
        <div className="formActions">
          {editingId && <button type="button" className="secondaryBtn" onClick={resetForm}>Cancel Edit</button>}
          <button className="primaryBtn"><UserCog size={16} /> {editingId ? 'Update User' : 'Add User'}</button>
        </div>
      </form>

      <section className="panel filterPanel">
        <div className="filterTitle"><Filter size={16} /> User Filters</div>
        <div className="filters userFilters">
          <div className="searchBox"><Search size={16} /><input placeholder="Search name, email, department, vertical..." value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} /></div>
          <select value={filters.role} onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}>
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="bd">Business Developer (BD)</option>
            <option value="designer">Designer</option>
          </select>
          <select value={filters.vertical} onChange={(e) => setFilters((f) => ({ ...f, vertical: e.target.value }))}>
            <option value="">All verticals</option>
            {verticals.map((vertical) => <option key={vertical} value={vertical}>{vertical}</option>)}
          </select>
        </div>
      </section>

      <section className="panel tablePanel">
        {loading ? <Loader label="Loading users..." /> : (
          <div className="tableWrap">
            <table>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Designation</th><th>Verticals</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {users.map((record) => (
                  <tr key={record.id}>
                    <td><strong>{record.name}</strong><span>{record.department}</span></td>
                    <td>{record.email}</td>
                    <td>{roleLabels[record.role] || record.role}</td>
                    <td>{record.designation || '-'}</td>
                    <td><VerticalPills verticals={record.verticals || []} compact /></td>
                    <td><span className={`statusBadge ${record.status}`}>{record.status}</span></td>
                    <td className="tableActions">
                      <button className="secondaryBtn" onClick={() => editUser(record)}><Edit3 size={14} /> Edit</button>
                      <button className="secondaryBtn" onClick={() => toggleStatus(record)}>{record.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                      <button className="dangerBtn compactDanger" disabled={record.id === user.id} onClick={() => deleteUser(record)}><Trash2 size={14} /> Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!users.length && <EmptyState title="No users found" />}
          </div>
        )}
      </section>
    </>
  );
}


function SettingsPage({ user, notify }) {
  const [settings, setSettings] = useState(null);
  const [system, setSystem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsResponse, systemResponse] = await Promise.all([
        api.getSettings(),
        api.systemInfo()
      ]);
      setSettings({
        categories: (settingsResponse.settings.categories || []).join('\n'),
        priorities: (settingsResponse.settings.priorities || []).join('\n'),
        verticals: (settingsResponse.settings.verticals || []).join('\n')
      });
      setSystem(systemResponse.system);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => { load(); }, [load]);

  function lines(value) {
    return String(value || '').split('\n').map((item) => item.trim()).filter(Boolean);
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings({
        categories: lines(settings.categories),
        priorities: lines(settings.priorities),
        verticals: lines(settings.verticals)
      });
      notify('Settings updated successfully.');
      load();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function downloadBackup() {
    try {
      const blob = await api.downloadBackup();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'adinn-design-workflow-backup.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  if (user.role !== 'admin') return <EmptyState title="Only admins can access settings" />;
  if (loading) return <Loader label="Loading settings..." />;

  return (
    <>
      <PageHeader
        title="System Settings"
        subtitle="Manage master data, deployment readiness, backup, and production health checks."
        actions={<><button className="secondaryBtn" onClick={load}><RefreshCw size={16} /> Refresh</button><button className="primaryBtn" onClick={downloadBackup}><Download size={16} /> Backup Data</button></>}
      />
      <div className="twoColumn settingsGrid">
        <form className="panel settingsForm" onSubmit={save}>
          <h2><Settings2 size={19} /> Workflow Master Data</h2>
          <p className="mutedBlock">Enter one item per line. These values appear in task creation, filters, reports, and designer vertical mapping.</p>
          <Field label="Designer Verticals" wide>
            <textarea rows="8" value={settings.verticals} onChange={(e) => setSettings((s) => ({ ...s, verticals: e.target.value }))} />
          </Field>
          <Field label="Task Categories" wide>
            <textarea rows="8" value={settings.categories} onChange={(e) => setSettings((s) => ({ ...s, categories: e.target.value }))} />
          </Field>
          <Field label="Task Priorities" wide>
            <textarea rows="4" value={settings.priorities} onChange={(e) => setSettings((s) => ({ ...s, priorities: e.target.value }))} />
          </Field>
          <div className="formActions">
            <button className="primaryBtn" disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}</button>
          </div>
        </form>
        <section className="panel systemPanel">
          <h2><Database size={19} /> Production Health</h2>
          <div className="systemGrid">
            <Info label="Environment" value={system?.environment || '-'} />
            <Info label="API Version" value={system?.version || '-'} />
            <Info label="Node Version" value={system?.node || '-'} />
            <Info label="Uptime" value={`${system?.uptime_seconds || 0}s`} />
            <Info label="Users" value={system?.user_count ?? '-'} />
            <Info label="Tasks" value={system?.task_count ?? '-'} />
            <Info label="Uploads" value={system?.upload_file_count ?? '-'} />
            <Info label="DB Size" value={`${Math.round((system?.data_file_size_bytes || 0) / 1024)} KB`} />
          </div>
          <div className="deployNote">
            <strong>Deployment readiness</strong>
            <span>Before going live, set a strong JWT_SECRET, configure FRONTEND_ORIGIN with the deployed Vercel URL, and keep DATA_FILE and UPLOAD_DIR on persistent storage.</span>
          </div>
        </section>
      </div>
    </>
  );
}


function emptyReportData() {
  return {
    summary: {
      total: 0,
      completed: 0,
      in_progress: 0,
      pending_acceptance: 0,
      submitted_for_review: 0,
      overdue: 0,
      declined: 0
    },
    byStatus: {},
    byPriority: {},
    byCategory: {},
    byVertical: {},
    byProject: [],
    byPeriod: [],
    byDesigner: [],
    latestTasks: []
  };
}


function StatCard({ label, value, icon }) {
  return (
    <div className="metricCard">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReportsPage({ notify }) {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [designers, setDesigners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    range: 'weekly',
    date_field: 'assignment_date',
    from: '',
    to: '',
    project: '',
    vertical: '',
    assigned_to: '',
    status: '',
    action_field: '',
    priority: ''
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [response, metaResponse, designerResponse] = await Promise.all([
        api.summary(filters),
        api.getTaskMeta(),
        api.getUsers({ role: 'designer', status: 'active' })
      ]);
      setData(response);
      setMeta(metaResponse.settings);
      setDesigners(designerResponse.users);
    } catch (error) {
      setData(emptyReportData());
      notify(error.message || 'Unable to load reports.', 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, notify]);

  useEffect(() => { load(); }, [load]);

  function setFilter(field, value) {
    setFilters((current) => ({ ...current, [field]: value }));
  }

  async function exportCsv() {
    try {
      const blob = await api.exportCsv(filters);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `design-tasks-${filters.range}-report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      notify(error.message, 'error');
    }
  }

  const verticals = Array.isArray(meta?.verticals) ? meta.verticals : fallbackVerticals;
  const priorities = Array.isArray(meta?.priorities) ? meta.priorities : ['Low', 'Medium', 'High', 'Urgent'];
  const safeData = data || emptyReportData();
  const summary = safeData.summary || emptyReportData().summary;
  const byPeriod = Array.isArray(safeData.byPeriod) ? safeData.byPeriod : [];
  const byProject = Array.isArray(safeData.byProject) ? safeData.byProject : [];
  const byDesigner = Array.isArray(safeData.byDesigner) ? safeData.byDesigner : [];
  const byStatus = safeData.byStatus && typeof safeData.byStatus === 'object' ? safeData.byStatus : {};
  const byVertical = safeData.byVertical && typeof safeData.byVertical === 'object' ? safeData.byVertical : {};
  const byAction = safeData.byAction && typeof safeData.byAction === 'object' ? safeData.byAction : {};
  const byCategory = safeData.byCategory && typeof safeData.byCategory === 'object' ? safeData.byCategory : {};

  if (loading && !data) return <Loader label="Loading reports..." />;
  if (!data) return <EmptyState title="No reports yet" />;

  return (
    <>
      <PageHeader title="Reports" subtitle="Weekly, monthly and yearly task reports with project-wise and date-wise filters." actions={<><button className="secondaryBtn" onClick={load}><RefreshCw size={16} /> Refresh</button><button className="primaryBtn" onClick={exportCsv}><Download size={16} /> Export CSV</button></>} />
      <section className="panel filterPanel">
        <div className="filterTitle"><Filter size={16} /> Report Filters</div>
        <div className="filters taskFilters">
          <select value={filters.range} onChange={(e) => setFilter('range', e.target.value)}>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <select value={filters.date_field} onChange={(e) => setFilter('date_field', e.target.value)}>
            <option value="assignment_date">Date of Assignment</option>
            <option value="deadline_date">Deadline</option>
            <option value="started_working_date">Started Working Date</option>
            <option value="completed_at">Completed Date</option>
          </select>
          <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          <input placeholder="Project-wise filter / Zoho No." value={filters.project} onChange={(e) => setFilter('project', e.target.value)} />
          <select value={filters.vertical} onChange={(e) => setFilter('vertical', e.target.value)}>
            <option value="">All verticals</option>
            {verticals.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <select value={filters.assigned_to} onChange={(e) => setFilter('assigned_to', e.target.value)}>
            <option value="">All designers</option>
            {designers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">All status</option>
            {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={filters.action_field} onChange={(e) => setFilter('action_field', e.target.value)}>
            <option value="">All action fields</option>
            {actionFieldOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
          <select value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
            <option value="">All priority</option>
            {priorities.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </section>

      <div className="statsGrid reportStats">
        <StatCard label="Total Tasks" value={summary.total || 0} icon={<BriefcaseBusiness />} />
        <StatCard label="Completed" value={summary.completed || 0} icon={<CheckCircle2 />} />
        <StatCard label="Current" value={(summary.in_progress || 0) + (summary.pending_acceptance || 0) + (summary.accepted || 0) + (summary.on_hold || 0) + (summary.changes_requested || 0) + (summary.overdue || 0)} icon={<Clock3 />} />
        <StatCard label="Overdue" value={summary.overdue || 0} icon={<AlertCircle />} />
      </div>

      <section className="panel tablePanel">
        <h2>{filters.range.charAt(0).toUpperCase() + filters.range.slice(1)} Report</h2>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Period</th><th>Total</th><th>Active</th><th>Completed</th><th>Declined</th><th>Overdue</th><th>Avg Rating</th><th>Completion</th></tr></thead>
            <tbody>
              {byPeriod.map((row) => {
                const completion = row.total ? Math.round((row.completed / row.total) * 100) : 0;
                return <tr key={row.period}><td><strong>{row.period}</strong></td><td>{row.total}</td><td>{row.active}</td><td>{row.completed}</td><td>{row.declined}</td><td>{row.overdue}</td><td><StarsDisplay value={row.avg_rating} /></td><td><div className="completion"><span style={{ width: `${completion}%` }} />{completion}%</div></td></tr>;
              })}
            </tbody>
          </table>
          {!byPeriod.length && <EmptyState title="No period data for selected filters" compact />}
        </div>
      </section>

      <section className="panel tablePanel">
        <h2>Project-wise Report</h2>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Project / Zoho No.</th><th>Total</th><th>Active</th><th>Completed</th><th>Overdue</th><th>Latest Date</th><th>Avg Rating</th><th>Completion</th></tr></thead>
            <tbody>
              {byProject.map((row) => {
                const completion = row.total ? Math.round((row.completed / row.total) * 100) : 0;
                return <tr key={row.project}><td><strong>{row.project}</strong></td><td>{row.total}</td><td>{row.active}</td><td>{row.completed}</td><td>{row.overdue}</td><td>{row.latest_date || '-'}</td><td><StarsDisplay value={row.avg_rating} /></td><td><div className="completion"><span style={{ width: `${completion}%` }} />{completion}%</div></td></tr>;
              })}
            </tbody>
          </table>
          {!byProject.length && <EmptyState title="No project data for selected filters" compact />}
        </div>
      </section>

      <section className="panel tablePanel">
        <h2>Designer Performance Snapshot</h2>
        <div className="tableWrap">
          <table>
            <thead><tr><th>Designer</th><th>Verticals</th><th>Total</th><th>Active</th><th>Completed</th><th>Pending</th><th>Declined</th><th>Overdue</th><th>Avg Rating</th><th>Completion</th></tr></thead>
            <tbody>
              {byDesigner.map((row) => {
                const completion = row.total ? Math.round((row.completed / row.total) * 100) : 0;
                return (
                  <tr key={row.designer_name}>
                    <td><strong>{row.designer_name}</strong></td>
                    <td><VerticalPills verticals={row.verticals || []} compact /></td>
                    <td>{row.total}</td>
                    <td>{row.active}</td>
                    <td>{row.completed}</td>
                    <td>{row.pending}</td>
                    <td>{row.declined}</td>
                    <td>{row.overdue}</td>
                    <td><StarsDisplay value={row.avg_rating} /></td>
                    <td><div className="completion"><span style={{ width: `${completion}%` }} />{completion}%</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Active Task Timing by Designer</h2>
        <div className="reportWorkloadGrid">
          {byDesigner.map((row) => (
            <div className="reportDesignerCard" key={row.designer_name}>
              <div className="workloadHead">
                <div>
                  <strong>{row.designer_name}</strong>
                  <span>{row.active} active tasks</span>
                </div>
                <BriefcaseBusiness size={20} />
              </div>
              <VerticalPills verticals={row.verticals || []} compact />
              <div className="workloadTasks reportTasks">
                {(row.current_tasks || []).map((task) => (
                  <div key={task.id}>
                    <strong>{task.title}</strong>
                    <span>{task.zoho_project_no || task.client || 'No project'} • {task.action_field || task.status_of_day || task.status_label}</span>
                    <small><CalendarClock size={12} /> Assigned {task.assignment_date || '-'} • Deadline {formatDate(task.deadline_date, task.deadline_time)}</small>
                  </div>
                ))}
                {!(row.current_tasks || []).length && <em>No active tasks</em>}
              </div>
            </div>
          ))}
        </div>
      </section>
      <div className="twoColumn">
        <section className="panel"><h2>Status Summary</h2><KeyValueList data={byStatus} labels={statusLabels} /></section>
        <section className="panel"><h2>Vertical Summary</h2><KeyValueList data={byVertical} /></section>
        <section className="panel"><h2>Action Field Summary</h2><KeyValueList data={byAction} /></section>
      </div>
      <section className="panel"><h2>Category Summary</h2><KeyValueList data={byCategory} /></section>
    </>
  );
}

function KeyValueList({ data, labels = {} }) {
  const rows = Object.entries(data || {});
  if (!rows.length) return <EmptyState title="No data" compact />;
  return <div className="keyValueList">{rows.map(([key, value]) => <div key={key}><span>{labels[key] || key}</span><strong>{value}</strong></div>)}</div>;
}

function Field({ label, children, wide, required }) {
  return <label className={`field ${wide ? 'wide' : ''}`}><span>{label}{required && <b>*</b>}</span>{children}</label>;
}

function Info({ label, value }) {
  return <div className="info"><span>{label}</span><strong>{value}</strong></div>;
}

function StatusBadge({ status }) {
  return <span className={`statusBadge ${status}`}>{statusLabels[status] || status}</span>;
}

function PriorityBadge({ priority }) {
  return <span className={`priorityBadge ${String(priority || '').toLowerCase()}`}>{priority || '-'}</span>;
}

function VerticalPills({ verticals, compact }) {
  const list = Array.isArray(verticals) ? verticals : [];
  if (!list.length) return <span className="muted">-</span>;
  return (
    <div className={`verticalPills ${compact ? 'compact' : ''}`}>
      {list.map((vertical) => <span key={vertical}>{vertical}</span>)}
    </div>
  );
}

function Loader({ label }) {
  return <div className="loader"><RefreshCw size={18} /> {label}</div>;
}

function EmptyState({ title, compact }) {
  return <div className={`emptyState ${compact ? 'compact' : ''}`}>{title}</div>;
}

export default App;
