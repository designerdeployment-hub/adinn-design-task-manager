const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/$/, '');

function getToken() {
  return localStorage.getItem('dtm_token');
}

function setSession(token, user) {
  localStorage.setItem('dtm_token', token);
  localStorage.setItem('dtm_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('dtm_token');
  localStorage.removeItem('dtm_user');
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('dtm_user') || 'null');
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const headers = options.headers ? { ...options.headers } : {};
  const token = getToken();

  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers
    });
  } catch (error) {
    throw new Error('Unable to connect to the server. Check whether the backend is running and VITE_API_URL is correct.');
  }

  if (options.raw) return response;

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text || 'Invalid server response.' };
  }

  if (!response.ok) {
    if (response.status === 401) clearSession();
    throw new Error(data.message || 'Request failed.');
  }

  return data;
}

function toQuery(params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const q = query.toString();
  return q ? `?${q}` : '';
}

export const api = {
  API_URL,
  getToken,
  setSession,
  clearSession,
  getStoredUser,
  async login(email, password) {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setSession(data.token, data.user);
    return data;
  },
  async me() {
    return request('/api/auth/me');
  },
  async getUsers(params = {}) {
    return request(`/api/users${toQuery(params)}`);
  },
  async createUser(payload) {
    return request('/api/users', { method: 'POST', body: JSON.stringify(payload) });
  },
  async getDesignerWorkload(params = {}) {
    return request(`/api/users/designer-workload${toQuery(params)}`);
  },
  async updateUser(id, payload) {
    return request(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  },
  async deleteUser(id) {
    return request(`/api/users/${id}`, { method: 'DELETE' });
  },
  async getTaskMeta() {
    return request('/api/tasks/meta');
  },
  async getSettings() {
    return request('/api/settings');
  },
  async updateSettings(payload) {
    return request('/api/settings', { method: 'PATCH', body: JSON.stringify(payload) });
  },
  async systemInfo() {
    return request('/api/admin/system');
  },
  async downloadBackup() {
    const response = await request('/api/admin/backup.json', { raw: true });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Backup failed.');
    }
    return response.blob();
  },
  async getTasks(params = {}) {
    return request(`/api/tasks${toQuery(params)}`);
  },
  async getTask(id) {
    return request(`/api/tasks/${id}`);
  },
  async deleteTask(id) {
    return request(`/api/tasks/${id}`, { method: 'DELETE' });
  },
  async createTask(formData) {
    return request('/api/tasks', { method: 'POST', body: formData });
  },
  async acceptTask(id) {
    return request(`/api/tasks/${id}/accept`, { method: 'PATCH', body: JSON.stringify({}) });
  },
  async declineTask(id, reason) {
    return request(`/api/tasks/${id}/decline`, { method: 'PATCH', body: JSON.stringify({ reason }) });
  },
  async changeStatus(id, status, remarks = '') {
    return request(`/api/tasks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, remarks }) });
  },
  async updateActionField(id, action_field, remarks = '') {
    return request(`/api/tasks/${id}/action`, { method: 'PATCH', body: JSON.stringify({ action_field, remarks }) });
  },
  async rateTask(id, rating) {
    return request(`/api/tasks/${id}/rating`, { method: 'PATCH', body: JSON.stringify(rating) });
  },
  async reassignTask(id, assigned_to, remarks = '') {
    return request(`/api/tasks/${id}/reassign`, { method: 'PATCH', body: JSON.stringify({ assigned_to, remarks }) });
  },
  async addComment(id, comment) {
    return request(`/api/tasks/${id}/comments`, { method: 'POST', body: JSON.stringify({ comment }) });
  },
  async uploadFiles(id, formData) {
    return request(`/api/tasks/${id}/files`, { method: 'POST', body: formData });
  },
  async getNotifications(params = {}) {
    return request(`/api/notifications${toQuery(params)}`);
  },
  async markNotificationRead(id) {
    return request(`/api/notifications/${id}/read`, { method: 'PATCH', body: JSON.stringify({}) });
  },
  async markAllNotificationsRead() {
    return request('/api/notifications/read-all', { method: 'PATCH', body: JSON.stringify({}) });
  },
  async summary(params = {}) {
    return request(`/api/reports/summary${toQuery(params)}`);
  },
  async exportCsv(params = {}) {
    const response = await request(`/api/tasks/export.csv${toQuery(params)}`, { raw: true });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Export failed.');
    }
    return response.blob();
  }
};
