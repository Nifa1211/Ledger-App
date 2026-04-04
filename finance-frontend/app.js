

const API_BASE = 'http://localhost:3000/api/v1';


const state = {
  token: localStorage.getItem('ledger_token') || null,
  user: JSON.parse(localStorage.getItem('ledger_user') || 'null'),
  recordsPage: 1,
  recordsFilters: {},
  monthlyChart: null,
};

async function api(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API_BASE + path, opts);
  const json = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = json.error || `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    err.details = json.details;
    throw err;
  }
  return json.data ?? json;
}

const get  = (p)    => api('GET', p);
const post = (p, b) => api('POST', p, b);
const patch = (p, b) => api('PATCH', p, b);
const del  = (p)    => api('DELETE', p);


function saveAuth(token, user) {
  state.token = token;
  state.user = user;
  localStorage.setItem('ledger_token', token);
  localStorage.setItem('ledger_user', JSON.stringify(user));
}

function clearAuth() {
  state.token = null;
  state.user = null;
  localStorage.removeItem('ledger_token');
  localStorage.removeItem('ledger_user');
}


function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelector(`[data-view="${name}"]`)?.classList.add('active');

  if (name === 'dashboard') loadDashboard();
  if (name === 'records')   loadRecords();
  if (name === 'users')     loadUsers();
}

let toastTimer;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}


const fmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
function fmtCurrency(n) { return fmt.format(n); }

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}


document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');
  errEl.classList.add('hidden');
  btn.disabled = true;
  btn.querySelector('.btn-text').textContent = 'Signing in…';

  try {
    const { token, user } = await post('/auth/login', {
      email: document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-password').value,
    });
    saveAuth(token, user);
    bootApp();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'Sign in';
  }
});


function bootApp() {
  if (!state.token) { showPage('page-login'); return; }

  showPage('page-app');

  
  const u = state.user;
  document.getElementById('user-name').textContent = u.name;
  document.getElementById('user-role').textContent = u.role;
  document.getElementById('user-avatar').textContent = u.name[0].toUpperCase();

  
  if (u.role !== 'admin') {
    document.getElementById('nav-users').style.display = 'none';
  }

  
  if (u.role === 'analyst' || u.role === 'admin') {
    document.getElementById('btn-new-record').style.display = '';
  }

  document.getElementById('dash-date').textContent =
    new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  showView('dashboard');
}


document.getElementById('logout-btn').addEventListener('click', () => {
  clearAuth();
  showPage('page-login');
});


document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => showView(btn.dataset.view));
});


async function loadDashboard() {
  try {
    const [summary, categories, monthly, recent] = await Promise.all([
      get('/dashboard/summary'),
      get('/dashboard/categories'),
      get('/dashboard/trends/monthly'),
      get('/dashboard/recent-activity?limit=8'),
    ]);

    
    document.getElementById('kpi-income-val').textContent = fmtCurrency(summary.total_income);
    document.getElementById('kpi-expense-val').textContent = fmtCurrency(summary.total_expenses);
    document.getElementById('kpi-net-val').textContent = fmtCurrency(summary.net_balance);
    document.getElementById('kpi-records-val').textContent = summary.total_records;

    const netBadge = document.getElementById('kpi-net-badge');
    netBadge.className = 'kpi-badge ' + (summary.net_balance >= 0 ? 'income' : 'expense');
    netBadge.textContent = summary.net_balance >= 0 ? '↑ surplus' : '↓ deficit';

    
    renderMonthlyChart(monthly);

    
    renderCategories(categories);

    
    renderRecentTable(recent);

  } catch (err) {
    if (err.status === 401) { clearAuth(); showPage('page-login'); }
    else toast(err.message, 'error');
  }
}

function renderMonthlyChart(data) {
  const ctx = document.getElementById('chart-monthly').getContext('2d');
  if (state.monthlyChart) state.monthlyChart.destroy();

  const labels = data.map(d => {
    const [y, m] = d.month.split('-');
    return new Date(y, m - 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  });

  state.monthlyChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Income',
          data: data.map(d => d.income),
          backgroundColor: 'rgba(46,204,135,0.7)',
          borderRadius: 4,
        },
        {
          label: 'Expenses',
          data: data.map(d => d.expenses),
          backgroundColor: 'rgba(232,93,117,0.7)',
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          labels: { color: '#8b90a8', font: { family: 'DM Mono', size: 11 }, boxWidth: 10 },
        },
        tooltip: {
          backgroundColor: '#1a1e2a',
          borderColor: '#2e3347',
          borderWidth: 1,
          titleColor: '#e8eaf2',
          bodyColor: '#8b90a8',
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmtCurrency(ctx.raw)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#555c7a', font: { family: 'DM Mono', size: 10 } },
          grid: { color: '#232736' },
        },
        y: {
          ticks: {
            color: '#555c7a',
            font: { family: 'DM Mono', size: 10 },
            callback: v => fmtCurrency(v),
          },
          grid: { color: '#232736' },
        },
      },
    },
  });
}

function renderCategories(data) {
  const container = document.getElementById('category-list');
  if (!data.length) { container.innerHTML = '<p style="color:var(--text-3);font-size:0.8rem;font-family:var(--font-mono)">No data yet</p>'; return; }

  const maxTotal = Math.max(...data.map(d => d.total));

  container.innerHTML = data.slice(0, 10).map(d => `
    <div class="category-row">
      <div class="category-row-head">
        <span class="category-name">${d.category}</span>
        <span class="category-amount">${fmtCurrency(d.total)}</span>
      </div>
      <div class="category-bar-track">
        <div class="category-bar-fill ${d.type}" style="width: ${Math.round((d.total / maxTotal) * 100)}%"></div>
      </div>
    </div>
  `).join('');
}

function renderRecentTable(records) {
  const tbody = document.getElementById('recent-tbody');
  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="table-loading">No records yet</td></tr>';
    return;
  }
  tbody.innerHTML = records.map(r => `
    <tr>
      <td style="font-family:var(--font-mono);color:var(--text-3)">${fmtDate(r.date)}</td>
      <td>${r.category}</td>
      <td><span class="badge badge-${r.type}">${r.type}</span></td>
      <td class="amount-${r.type}">${r.type === 'income' ? '+' : '-'}${fmtCurrency(r.amount)}</td>
      <td style="color:var(--text-3)">${r.notes || '—'}</td>
    </tr>
  `).join('');
}

document.getElementById('dash-view-all').addEventListener('click', () => showView('records'));


async function loadRecords(page = 1) {
  state.recordsPage = page;
  const f = state.recordsFilters;
  const params = new URLSearchParams({ page, limit: 15 });
  if (f.type)      params.set('type', f.type);
  if (f.category)  params.set('category', f.category);
  if (f.date_from) params.set('date_from', f.date_from);
  if (f.date_to)   params.set('date_to', f.date_to);

  const tbody = document.getElementById('records-tbody');
  tbody.innerHTML = '<tr><td colspan="7" class="table-loading">Loading…</td></tr>';

  try {
    const { records, total, totalPages } = await get(`/records?${params}`);
    renderRecordsTable(records);
    renderPagination(page, totalPages, loadRecords);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="table-loading">${err.message}</td></tr>`;
  }
}

function renderRecordsTable(records) {
  const tbody = document.getElementById('records-tbody');
  const canEdit = state.user?.role === 'analyst' || state.user?.role === 'admin';
  const canDelete = state.user?.role === 'admin';

  if (!records.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="table-loading">No records found</td></tr>';
    return;
  }

  tbody.innerHTML = records.map(r => `
    <tr>
      <td style="font-family:var(--font-mono);color:var(--text-3)">${fmtDate(r.date)}</td>
      <td>${r.category}</td>
      <td><span class="badge badge-${r.type}">${r.type}</span></td>
      <td class="amount-${r.type}">${r.type === 'income' ? '+' : '-'}${fmtCurrency(r.amount)}</td>
      <td style="color:var(--text-3)">${r.notes || '—'}</td>
      <td style="color:var(--text-3);font-size:0.78rem">${r.created_by_name}</td>
      <td>
        <div style="display:flex;gap:0.25rem">
          ${canEdit ? `<button class="btn btn-ghost btn-sm" onclick="openEditRecord(${r.id})">Edit</button>` : ''}
          ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="confirmDelete('record',${r.id})">Del</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function renderPagination(current, total, loadFn) {
  const el = document.getElementById('records-pagination');
  if (total <= 1) { el.innerHTML = ''; return; }

  let html = `<button class="page-btn" ${current === 1 ? 'disabled' : ''} onclick="(${loadFn.name})(${current - 1})">‹ Prev</button>`;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) {
      html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="(${loadFn.name})(${i})">${i}</button>`;
    } else if (Math.abs(i - current) === 2) {
      html += `<span style="color:var(--text-3);padding:0 0.25rem">…</span>`;
    }
  }
  html += `<button class="page-btn" ${current === total ? 'disabled' : ''} onclick="(${loadFn.name})(${current + 1})">Next ›</button>`;
  el.innerHTML = html;
}


document.getElementById('btn-filter').addEventListener('click', () => {
  state.recordsFilters = {
    type: document.getElementById('filter-type').value,
    category: document.getElementById('filter-category').value.trim(),
    date_from: document.getElementById('filter-from').value,
    date_to: document.getElementById('filter-to').value,
  };
  loadRecords(1);
});

document.getElementById('btn-clear-filter').addEventListener('click', () => {
  document.getElementById('filter-type').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-from').value = '';
  document.getElementById('filter-to').value = '';
  state.recordsFilters = {};
  loadRecords(1);
});

document.getElementById('btn-new-record').addEventListener('click', () => openNewRecord());

function openNewRecord() {
  document.getElementById('modal-record-title').textContent = 'New Record';
  document.getElementById('record-submit-btn').textContent = 'Create Record';
  document.getElementById('record-id').value = '';
  document.getElementById('record-form').reset();
  document.getElementById('rec-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('modal-record-error').classList.add('hidden');
  document.getElementById('modal-record').classList.remove('hidden');
}

function openEditRecord(id) {
  get(`/records/${id}`).then(r => {
    document.getElementById('modal-record-title').textContent = 'Edit Record';
    document.getElementById('record-submit-btn').textContent = 'Save Changes';
    document.getElementById('record-id').value = r.id;
    document.getElementById('rec-amount').value = r.amount;
    document.getElementById('rec-type').value = r.type;
    document.getElementById('rec-category').value = r.category;
    document.getElementById('rec-date').value = r.date;
    document.getElementById('rec-notes').value = r.notes || '';
    document.getElementById('modal-record-error').classList.add('hidden');
    document.getElementById('modal-record').classList.remove('hidden');
  }).catch(err => toast(err.message, 'error'));
}

document.getElementById('record-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('modal-record-error');
  errEl.classList.add('hidden');

  const id = document.getElementById('record-id').value;
  const payload = {
    amount: parseFloat(document.getElementById('rec-amount').value),
    type: document.getElementById('rec-type').value,
    category: document.getElementById('rec-category').value.trim(),
    date: document.getElementById('rec-date').value,
    notes: document.getElementById('rec-notes').value.trim() || undefined,
  };

  try {
    if (id) {
      await patch(`/records/${id}`, payload);
      toast('Record updated');
    } else {
      await post('/records', payload);
      toast('Record created');
    }
    document.getElementById('modal-record').classList.add('hidden');
    loadRecords(state.recordsPage);
  } catch (err) {
    const msg = err.details ? err.details.map(d => `${d.field}: ${d.message}`).join(', ') : err.message;
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }
});


async function loadUsers() {
  const tbody = document.getElementById('users-tbody');
  try {
    const { users } = await get('/users');
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.name}</td>
        <td style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-2)">${u.email}</td>
        <td><span class="badge badge-${u.role}">${u.role}</span></td>
        <td><span class="badge badge-${u.status}">${u.status}</span></td>
        <td style="font-family:var(--font-mono);color:var(--text-3);font-size:0.78rem">${fmtDate(u.created_at)}</td>
        <td>
          <div style="display:flex;gap:0.25rem">
            <button class="btn btn-ghost btn-sm" onclick="openEditUser(${u.id})">Edit</button>
            ${u.id !== state.user?.id ? `<button class="btn btn-danger btn-sm" onclick="confirmDelete('user',${u.id})">Del</button>` : ''}
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-loading">${err.message}</td></tr>`;
  }
}

document.getElementById('btn-new-user').addEventListener('click', () => {
  document.getElementById('modal-user-title').textContent = 'New User';
  document.getElementById('user-submit-btn').textContent = 'Create User';
  document.getElementById('user-edit-id').value = '';
  document.getElementById('user-form').reset();
  document.getElementById('user-email-field').style.display = '';
  document.getElementById('user-password-field').style.display = '';
  document.getElementById('user-status-field').style.display = 'none';
  document.getElementById('modal-user-error').classList.add('hidden');
  document.getElementById('modal-user').classList.remove('hidden');
});

function openEditUser(id) {
  get(`/users/${id}`).then(u => {
    document.getElementById('modal-user-title').textContent = 'Edit User';
    document.getElementById('user-submit-btn').textContent = 'Save Changes';
    document.getElementById('user-edit-id').value = u.id;
    document.getElementById('user-name-input').value = u.name;
    document.getElementById('user-role-input').value = u.role;
    document.getElementById('user-status-input').value = u.status;
    document.getElementById('user-email-field').style.display = 'none';
    document.getElementById('user-password-field').style.display = 'none';
    document.getElementById('user-status-field').style.display = '';
    document.getElementById('modal-user-error').classList.add('hidden');
    document.getElementById('modal-user').classList.remove('hidden');
  }).catch(err => toast(err.message, 'error'));
}

document.getElementById('user-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('modal-user-error');
  errEl.classList.add('hidden');

  const editId = document.getElementById('user-edit-id').value;

  try {
    if (editId) {
      const payload = {
        name: document.getElementById('user-name-input').value.trim(),
        role: document.getElementById('user-role-input').value,
        status: document.getElementById('user-status-input').value,
      };
      await patch(`/users/${editId}`, payload);
      toast('User updated');
    } else {
      const payload = {
        name: document.getElementById('user-name-input').value.trim(),
        email: document.getElementById('user-email-input').value.trim(),
        password: document.getElementById('user-password-input').value,
        role: document.getElementById('user-role-input').value,
      };
      await post('/auth/register', payload);
      toast('User created');
    }
    document.getElementById('modal-user').classList.add('hidden');
    loadUsers();
  } catch (err) {
    const msg = err.details ? err.details.map(d => `${d.field}: ${d.message}`).join(', ') : err.message;
    errEl.textContent = msg;
    errEl.classList.remove('hidden');
  }
});


let _confirmAction = null;

function confirmDelete(type, id) {
  document.getElementById('confirm-message').textContent =
    `Delete this ${type}? This cannot be undone.`;
  _confirmAction = async () => {
    try {
      if (type === 'record') { await del(`/records/${id}`); loadRecords(state.recordsPage); }
      if (type === 'user')   { await del(`/users/${id}`); loadUsers(); }
      toast(`${type[0].toUpperCase() + type.slice(1)} deleted`);
    } catch (err) { toast(err.message, 'error'); }
  };
  document.getElementById('modal-confirm').classList.remove('hidden');
}

document.getElementById('confirm-ok-btn').addEventListener('click', async () => {
  document.getElementById('modal-confirm').classList.add('hidden');
  if (_confirmAction) { await _confirmAction(); _confirmAction = null; }
});


document.querySelectorAll('[data-modal]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.getElementById(btn.dataset.modal).classList.add('hidden');
  });
});


document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});


bootApp();
