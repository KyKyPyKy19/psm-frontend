/* ============================================
   PsychMonitor — Application Logic (real API)
   ============================================ */

let currentClientId = null;
let clientsCache = [];
let episodesCache = [];
let analyticsCache = [];
let chartInstances = {};
let currentAnalyticsDays = 30;

// =========================================
// NAVIGATION
// =========================================

function navigateTo(page, clientId) {
  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('page-section--active'));
  document.querySelectorAll('.sidebar__nav-item').forEach(n => n.classList.remove('sidebar__nav-item--active'));

  const navMap = {
    dashboard: 'nav-dashboard',
    clients: 'nav-clients',
    'client-detail': 'nav-clients',
    analytics: 'nav-analytics',
    settings: 'nav-settings',
  };

  const targetSection = document.getElementById(`page-${page}`);
  if (targetSection) targetSection.classList.add('page-section--active');
  const navItem = document.getElementById(navMap[page]);
  if (navItem) navItem.classList.add('sidebar__nav-item--active');

  if (page === 'clients') {
    renderClientsGrid();
  } else if (page === 'client-detail') {
    if (clientId !== undefined && clientId !== null) currentClientId = clientId;
    renderClientDetail();
  } else if (page === 'analytics') {
    renderAnalytics();
  } else if (page === 'dashboard') {
    renderDashboard();
  }

  closeMobileMenu();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.querySelectorAll('.sidebar__nav-item').forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page));
});

// =========================================
// MOBILE MENU
// =========================================

function toggleMobileMenu() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const isOpen = sidebar.classList.toggle('sidebar--open');
  overlay.classList.toggle('sidebar-overlay--visible', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeMobileMenu() {
  document.getElementById('sidebar').classList.remove('sidebar--open');
  document.getElementById('sidebar-overlay').classList.remove('sidebar-overlay--visible');
  document.body.style.overflow = '';
}

// =========================================
// ERROR HELPER
// =========================================

function showError(containerId, err) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="error-banner">Ошибка загрузки данных: ${err.message}</div>`;
  console.error(err);
}

function clearError(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = '';
}

function emptyState(text) {
  return `<div class="empty-state"><p class="empty-state__text">${text}</p></div>`;
}

// =========================================
// DASHBOARD
// =========================================

async function renderDashboard() {
  clearError('dashboard-error');
  try {
    const data = await API.dashboard();
    clientsCache = data.clients || [];

    document.getElementById('dash-active-clients').textContent = val(data.active_clients);
    document.getElementById('dash-avg-stress').textContent =
      data.avg_group_stress === null || data.avg_group_stress === undefined ? '—' : Math.round(data.avg_group_stress);
    document.getElementById('dash-episodes').textContent = val(data.total_episodes_24h);
    document.getElementById('dash-alerts').textContent = val(data.alerts_count);

    const badge = document.getElementById('nav-clients-badge');
    if (data.active_clients) {
      badge.textContent = data.active_clients;
      badge.classList.remove('hidden');
    }

    renderDashboardAlerts(data.clients || []);
    renderDashboardClients(data.clients || []);
  } catch (err) {
    showError('dashboard-error', err);
  }
}

function clientColor(c) {
  return statusToColor(c.stress_status);
}

function renderDashboardAlerts(clients) {
  const container = document.getElementById('dashboard-alerts-list');
  const attention = clients.filter(c => clientColor(c) !== 'green');

  if (attention.length === 0) {
    container.innerHTML = emptyState('Нет клиентов, требующих внимания');
    return;
  }

  container.innerHTML = attention.map(c => {
    const color = clientColor(c);
    const iconMod = color === 'red' ? 'danger' : 'warning';
    return `
    <div class="alert-item" style="cursor:pointer" onclick="navigateTo('client-detail', '${c.client_id}')">
      <div class="alert-item__icon alert-item__icon--${iconMod}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${color === 'red' ? '#721C24' : '#856404'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div class="alert-item__content">
        <div class="alert-item__title">${c.client_id}</div>
        <div class="alert-item__desc">Стресс: ${val(Math.round(c.last_stress))} · пульс: ${val(c.last_hr)} · эпизодов сегодня: ${val(c.episodes_today)}</div>
      </div>
      <div class="alert-item__time">${isoToRelative(c.last_seen)}</div>
    </div>`;
  }).join('');
}

function renderDashboardClients(clients) {
  const container = document.getElementById('dashboard-clients-list');
  if (clients.length === 0) {
    container.innerHTML = emptyState('Нет активных клиентов');
    return;
  }

  container.innerHTML = clients.slice(0, 6).map(c => {
    const color = clientColor(c);
    const bg = color === 'green' ? 'var(--accent-light)' : color === 'red' ? '#F8D7DA' : '#FEF3CD';
    const fg = color === 'green' ? 'var(--accent)' : color === 'red' ? '#721C24' : '#856404';
    return `
    <div class="alert-item" style="cursor:pointer" onclick="navigateTo('client-detail', '${c.client_id}')">
      <div class="avatar" style="background:${bg}; color:${fg};">${clientInitials(c.client_id)}</div>
      <div class="alert-item__content">
        <div class="alert-item__title">${c.client_id}</div>
        <div class="alert-item__desc">Стресс: ${val(Math.round(c.last_stress))} · Пульс: ${val(c.last_hr)} · BB: ${val(c.last_bb)}</div>
      </div>
      <div class="client-card__indicator client-card__indicator--${color}" style="position:static;"></div>
    </div>`;
  }).join('');
}

// =========================================
// CLIENTS LIST
// =========================================

async function renderClientsGrid() {
  clearError('clients-error');
  const grid = document.getElementById('clients-grid');
  try {
    const clients = await API.clients();
    clientsCache = clients;

    if (!clients.length) {
      grid.innerHTML = emptyState('Клиентов пока нет');
      return;
    }

    grid.innerHTML = clients.map(c => {
      const color = clientColor(c);
      return `
      <div class="client-card" onclick="navigateTo('client-detail', '${c.client_id}')" id="client-card-${c.client_id}" data-name="${String(c.client_id).toLowerCase()}">
        <div class="client-card__indicator client-card__indicator--${color}"></div>
        <div class="client-card__header">
          <div class="client-card__avatar">${clientInitials(c.client_id)}</div>
          <div>
            <div class="client-card__name">${c.client_id}</div>
            <div class="client-card__meta">Последние данные: ${isoToRelative(c.last_seen) || '—'}</div>
          </div>
        </div>
        <div class="client-card__stats">
          <div class="client-card__stat">
            <div class="client-card__stat-value" style="color:${getStressColor(c.last_stress)}">${val(Math.round(c.last_stress))}</div>
            <div class="client-card__stat-label">Стресс</div>
          </div>
          <div class="client-card__stat">
            <div class="client-card__stat-value text-hr">${val(c.last_hr)}</div>
            <div class="client-card__stat-label">Пульс</div>
          </div>
          <div class="client-card__stat">
            <div class="client-card__stat-value text-bb">${val(c.last_bb)}</div>
            <div class="client-card__stat-label">Body Battery</div>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    grid.innerHTML = '';
    showError('clients-error', err);
  }
}

function filterClients(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('#clients-grid .client-card').forEach(card => {
    card.style.display = (card.dataset.name || '').includes(q) ? '' : 'none';
  });
}

// =========================================
// CLIENT DETAIL
// =========================================

async function renderClientDetail() {
  if (!currentClientId && clientsCache[0]) currentClientId = clientsCache[0].client_id;
  if (!currentClientId) {
    showError('detail-error', new Error('Клиент не выбран'));
    return;
  }
  clearError('detail-error');

  const id = currentClientId;
  document.getElementById('detail-breadcrumb-name').textContent = id;
  document.getElementById('detail-avatar').textContent = clientInitials(id);
  document.getElementById('detail-name').textContent = id;
  document.getElementById('analytics-breadcrumb-name').textContent = id;

  // reset detail panel
  const panel = document.getElementById('detail-panel');
  const btn = document.getElementById('detail-toggle-btn');
  panel.classList.remove('detail-panel--expanded');
  btn.classList.remove('detail-toggle--active');
  document.getElementById('detail-toggle-text').textContent = 'Показать детализацию';

  try {
    const [summary, episodes, analytics] = await Promise.all([
      API.clientSummary(id),
      API.episodes(id),
      API.dailyAnalytics(id),
    ]);
    episodesCache = episodes || [];
    analyticsCache = (analytics || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));

    const lastSeen = (clientsCache.find(c => c.client_id === id) || {}).last_seen;
    document.getElementById('detail-meta').textContent = lastSeen
      ? `Последние данные: ${isoToRelative(lastSeen)}`
      : 'Данные Garmin';

    renderSummaryMetrics(summary);
    renderStressZones(summary.stress_zones);
    renderEpisodes(episodesCache);
    renderTriggerAnalysis(episodesCache);
    renderDetailPanel(summary);
    renderWeeklyTable(analyticsCache);
  } catch (err) {
    showError('detail-error', err);
  }
}

function renderSummaryMetrics(s) {
  document.getElementById('mc-stress').textContent =
    s.avg_stress === null || s.avg_stress === undefined ? '—' : Math.round(s.avg_stress);
  document.getElementById('mc-hr').textContent =
    s.avg_hr === null || s.avg_hr === undefined ? '—' : Math.round(s.avg_hr);
  document.getElementById('mc-bb').textContent = val(s.current_bb);

  setChange('mc-stress-change', s.stress_change, true);
  setChange('mc-hr-change', s.hr_change, true);
  setChange('mc-bb-change', s.bb_change, false);
}

function setChange(elId, value, invertColor) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (value === null || value === undefined) {
    el.textContent = '';
    el.className = 'metric-change metric-change--neutral';
    return;
  }
  const arrow = value > 0 ? '↑' : value < 0 ? '↓' : '';
  el.textContent = `${arrow} ${value > 0 ? '+' : ''}${Math.round(value)} к вчера`;
  const dir = invertColor
    ? (value > 0 ? 'up' : value < 0 ? 'down' : 'neutral')
    : (value > 0 ? 'down' : value < 0 ? 'up' : 'neutral');
  el.className = `metric-change metric-change--${dir}`;
}

function renderStressZones(zones) {
  const container = document.getElementById('stress-zones-container');
  if (!zones) { container.innerHTML = emptyState('Нет данных за сегодня'); return; }

  const rows = [
    { label: 'Покой',   cls: 'rest', mins: zones.rest_minutes },
    { label: 'Низкий',  cls: 'low',  mins: zones.low_minutes },
    { label: 'Средний', cls: 'med',  mins: zones.med_minutes },
    { label: 'Высокий', cls: 'high', mins: zones.high_minutes },
  ];
  const total = rows.reduce((acc, r) => acc + (r.mins || 0), 0);

  if (total === 0) { container.innerHTML = emptyState('Нет данных за сегодня'); return; }

  container.innerHTML = rows.map(r => {
    const pct = total > 0 ? Math.round(((r.mins || 0) / total) * 100) : 0;
    return `
    <div class="stress-zones__row">
      <div class="stress-zones__label">${r.label}</div>
      <div class="stress-zones__track">
        <div class="stress-zones__fill stress-zones__fill--${r.cls}" style="width:${pct}%"></div>
      </div>
      <div class="stress-zones__value">${minutesToHM(r.mins)}</div>
    </div>`;
  }).join('');
}

function renderEpisodes(episodes) {
  const container = document.getElementById('episodes-list');
  if (!episodes.length) {
    container.innerHTML = emptyState('Стресс-эпизодов нет');
    return;
  }

  container.innerHTML = episodes.map(ep => {
    const level = episodeLevel(ep.peak_stress);
    const canonical = canonicalTriggerKey(ep.stress_category);
    const triggerKey = canonical || 'null';
    const triggerInfo = TRIGGER_GROUPS[triggerKey];
    const hasComment = ep.user_description !== null && ep.user_description !== undefined && ep.user_description !== '';

    const timeStr = `${isoToTime(ep.started_at)}${ep.ended_at ? ' — ' + isoToTime(ep.ended_at) : ''}`;
    const dur = ep.duration_minutes ? ` (${Math.round(ep.duration_minutes)} мин)` : '';
    const desc = `Стресс ${val(Math.round(ep.avg_stress))}–${val(ep.peak_stress)} · пульс до ${val(ep.peak_hr)} уд/мин`;

    let triggerBadge = '';
    if (canonical && triggerInfo) {
      triggerBadge = `<div style="margin-top:4px;"><span class="trigger-badge" style="background:${triggerInfo.colorLight}; color:${triggerInfo.color};">${triggerInfo.label}</span></div>`;
    }

    let commentBtn;
    if (hasComment) {
      const safe = String(ep.user_description).replace(/'/g, "\\'").replace(/"/g, '&quot;');
      commentBtn = `<button class="comment-btn comment-btn--has-comment" onclick="event.stopPropagation(); showComment(this, '${safe}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      </button>`;
    } else {
      commentBtn = `<span class="comment-btn comment-btn--no-comment" title="Нет ответа клиента">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/></svg>
      </span>`;
    }

    return `
    <div class="episode">
      <div class="episode__dot episode__dot--${level}"></div>
      <div style="flex:1;">
        <div class="episode__time">${isoToDateShort(ep.started_at)} · ${timeStr}${dur}</div>
        <div class="episode__desc">${desc}</div>
        ${triggerBadge}
      </div>
      ${commentBtn}
    </div>`;
  }).join('');
}

function showComment(btn, text) {
  document.querySelectorAll('.comment-popover').forEach(p => p.remove());
  const popover = document.createElement('div');
  popover.className = 'comment-popover';
  popover.innerHTML = `
    <div class="comment-popover__header">
      <span class="comment-popover__title">Комментарий клиента</span>
      <button class="comment-popover__close" onclick="this.closest('.comment-popover').remove()">×</button>
    </div>
    <div class="comment-popover__text">${text}</div>`;
  btn.style.position = 'relative';
  btn.appendChild(popover);
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!popover.contains(e.target)) { popover.remove(); document.removeEventListener('click', handler); }
    });
  }, 10);
}

function renderTriggerAnalysis(episodes) {
  const container = document.getElementById('trigger-analysis-container');
  if (!episodes.length) {
    container.innerHTML = emptyState('Нет эпизодов для анализа');
    return;
  }

  const triggerTotals = {};
  let nullCount = 0;
  const total = episodes.length;

  episodes.forEach(ep => {
    const key = canonicalTriggerKey(ep.stress_category);
    if (!key) { nullCount++; return; }
    triggerTotals[key] = (triggerTotals[key] || 0) + 1;
  });

  const respondedCount = total - nullCount;
  const sorted = Object.entries(triggerTotals).sort((a, b) => b[1] - a[1]);

  let html = `
    <div class="trigger-stats-row">
      <div class="trigger-stat">
        <div class="trigger-stat__number">${total}</div>
        <div class="trigger-stat__label">Всего эпизодов</div>
      </div>
      <div class="trigger-stat">
        <div class="trigger-stat__number">${respondedCount}</div>
        <div class="trigger-stat__label">Классифицировано<br><span class="small">NLP-моделью</span></div>
      </div>
      <div class="trigger-stat trigger-stat--null">
        <div class="trigger-stat__number">${nullCount}</div>
        <div class="trigger-stat__label">Без категории<br><span class="small">нет ответа / в обработке</span></div>
      </div>
    </div>
    <div class="trigger-bars">`;

  sorted.forEach(([key, count]) => {
    const tg = TRIGGER_GROUPS[key] || TRIGGER_GROUPS.unknown;
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    html += `
      <div class="trigger-bar">
        <div class="trigger-bar__label" style="color:${tg.color};">${tg.label}</div>
        <div class="trigger-bar__track"><div class="trigger-bar__fill" style="width:${pct}%; background:${tg.color};"></div></div>
        <div class="trigger-bar__value">${count} <span class="small">(${pct}%)</span></div>
      </div>`;
  });

  if (nullCount > 0) {
    const nullPct = Math.round((nullCount / total) * 100);
    html += `
      <div class="trigger-bar">
        <div class="trigger-bar__label" style="color:${TRIGGER_GROUPS.null.color};">Нет ответа</div>
        <div class="trigger-bar__track"><div class="trigger-bar__fill" style="width:${nullPct}%; background:${TRIGGER_GROUPS.null.color};"></div></div>
        <div class="trigger-bar__value">${nullCount} <span class="small">(${nullPct}%)</span></div>
      </div>`;
  }
  html += '</div>';

  if (sorted.length > 0) {
    const medals = ['1', '2', '3', '4', '5'];
    html += `<div class="top-triggers"><div class="top-triggers__title">Топ триггеров</div><div class="top-triggers__list">`;
    sorted.slice(0, 5).forEach(([key, count], i) => {
      const tg = TRIGGER_GROUPS[key] || TRIGGER_GROUPS.unknown;
      html += `
        <div class="top-trigger">
          <div class="top-trigger__rank" style="background:${tg.color};">${medals[i]}</div>
          <div class="top-trigger__dot" style="background:${tg.color};"></div>
          <div class="top-trigger__name">${tg.label}</div>
          <div class="top-trigger__count">${count} эпизодов</div>
        </div>`;
    });
    html += '</div></div>';
  }

  container.innerHTML = html;
}

function renderDetailPanel(s) {
  document.getElementById('dm-hr-range').textContent =
    (s.hr_min == null && s.hr_max == null) ? '—' : `${val(s.hr_min)} / ${val(s.hr_max)}`;
  document.getElementById('dm-stress-range').textContent =
    (s.stress_min == null && s.stress_max == null) ? '—' : `${val(s.stress_min)} / ${val(s.stress_max)}`;
  document.getElementById('dm-anomalies').textContent = val(s.anomalies_count);
  document.getElementById('dm-episodes-today').textContent = val(s.episodes_today);
}

function renderWeeklyTable(rows) {
  const tbody = document.getElementById('weekly-table-body');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:var(--text-tertiary);">Нет данных</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.slice().reverse().map(r => `
    <tr>
      <td>${dateStrShort(r.date)}</td>
      <td style="color:${getStressColor(r.stress_avg)}">${round1(r.stress_avg)}</td>
      <td>${round1(r.hr_avg)}</td>
      <td>${round1(r.bb_avg)}</td>
      <td>${val(r.episodes_count)}</td>
      <td>${num(r.steps)}</td>
      <td>${num(r.calories)}</td>
      <td>${val(r.active_minutes)}</td>
    </tr>`).join('');
}

// =========================================
// DETAIL PANEL TOGGLE
// =========================================

function toggleDetailPanel() {
  const panel = document.getElementById('detail-panel');
  const btn = document.getElementById('detail-toggle-btn');
  const text = document.getElementById('detail-toggle-text');
  const isExpanded = panel.classList.toggle('detail-panel--expanded');
  btn.classList.toggle('detail-toggle--active', isExpanded);
  text.textContent = isExpanded ? 'Скрыть детализацию' : 'Показать детализацию';
}

// =========================================
// ANALYTICS PAGE
// =========================================

async function renderAnalytics() {
  if (!currentClientId && clientsCache[0]) currentClientId = clientsCache[0].client_id;
  if (!currentClientId) { showError('analytics-error', new Error('Клиент не выбран')); return; }
  clearError('analytics-error');

  const id = currentClientId;
  document.getElementById('analytics-title').textContent = `Аналитика — ${id}`;
  document.getElementById('analytics-breadcrumb-name').textContent = id;

  try {
    const analytics = (await API.dailyAnalytics(id, currentAnalyticsDays) || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
    analyticsCache = analytics;
    setTimeout(() => {
      renderLineChart('analytics-stress-chart', analytics, 'stress_avg', 'Средний стресс', '#E8B84D', 'rgba(232,184,77,0.12)', 'stress_max', 'Макс. стресс');
      renderLineChart('analytics-hr-chart', analytics, 'hr_avg', 'Средний HR', '#C25D5D', 'rgba(194,93,93,0.08)');
      renderLineChart('analytics-bb-chart', analytics, 'bb_avg', 'Body Battery', '#5D8EC2', 'rgba(93,142,194,0.08)');
      renderBarChart('analytics-episodes-chart', analytics, 'episodes_count', 'Стресс-эпизоды', 'rgba(212,101,74,0.6)', '#D4654A');
      renderBarChart('analytics-steps-chart', analytics, 'steps', 'Шаги', 'rgba(45,90,61,0.6)', '#2D5A3D');
      renderBarChart('analytics-calories-chart', analytics, 'calories', 'Калории', 'rgba(232,184,77,0.6)', '#E8B84D');
    }, 50);
  } catch (err) {
    showError('analytics-error', err);
  }
}

// Переключатель периода + сброс зума для всех графиков аналитики.
function setupAnalyticsToolbar() {
  const group = document.getElementById('analytics-period-group');
  if (group) {
    group.addEventListener('click', e => {
      const btn = e.target.closest('.period-btn');
      if (!btn || !btn.dataset.days) return;
      const days = parseInt(btn.dataset.days, 10);
      if (!days || days === currentAnalyticsDays) return;
      currentAnalyticsDays = days;
      group.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('period-btn--active', b === btn));
      renderAnalytics();
    });
  }
  const reset = document.getElementById('analytics-reset-zoom');
  if (reset) {
    reset.addEventListener('click', () => {
      Object.values(chartInstances).forEach(ch => {
        if (ch && typeof ch.resetZoom === 'function') ch.resetZoom();
      });
    });
  }
}

function renderLineChart(canvasId, rows, field, label, color, bg, field2, label2) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const labels = rows.map(r => dateStrShort(r.date));
  const datasets = [{
    label, data: rows.map(r => r[field]),
    borderColor: color, backgroundColor: bg, fill: true, tension: 0.4,
    pointRadius: 4, pointBackgroundColor: color, pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.2,
  }];
  if (field2) {
    datasets.push({
      label: label2, data: rows.map(r => r[field2]),
      borderColor: '#D4654A', borderDash: [5, 5], fill: false, tension: 0.4,
      pointRadius: 3, pointBackgroundColor: '#D4654A', pointBorderColor: '#fff', pointBorderWidth: 1.5, borderWidth: 1.5,
    });
  }
  chartInstances[canvasId] = new Chart(ctx, { type: 'line', data: { labels, datasets }, options: getChartOptions(label) });
}

function renderBarChart(canvasId, rows, field, label, bg, border) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const labels = rows.map(r => dateStrShort(r.date));
  chartInstances[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ label, data: rows.map(r => r[field]), backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: 6 }] },
    options: { ...getChartOptions(''), plugins: { ...getChartOptions('').plugins, legend: { display: false } } },
  });
}

// =========================================
// CHART HELPERS
// =========================================

function getChartOptions(yLabel) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: {
        position: 'top', align: 'start',
        labels: { font: { family: "'DM Sans', sans-serif", size: 12 }, color: '#6B6860', boxWidth: 10, boxHeight: 10, borderRadius: 5, useBorderRadius: true, padding: 16 },
      },
      tooltip: { backgroundColor: '#1A1A1A', titleFont: { family: "'DM Sans', sans-serif", size: 13 }, bodyFont: { family: "'DM Sans', sans-serif", size: 12 }, padding: 10, cornerRadius: 8, displayColors: true, boxWidth: 8, boxHeight: 8, boxPadding: 4 },
      // Зум/пан по горизонтали — для всех графиков аналитики.
      // Активируется только если плагин подгрузился (на странице дашборда он тоже разрешён, но без вреда).
      zoom: {
        pan: { enabled: true, mode: 'x', modifierKey: 'shift' },
        zoom: {
          wheel: { enabled: true, modifierKey: 'ctrl' },
          drag: { enabled: true, backgroundColor: 'rgba(212, 101, 74, 0.12)', borderColor: '#D4654A', borderWidth: 1, threshold: 6 },
          mode: 'x',
        },
        limits: { x: { minRange: 1 } },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: "'DM Sans', sans-serif", size: 11 }, color: '#9B978E' } },
      y: { grid: { color: '#E5E3DD', drawBorder: false }, ticks: { font: { family: "'DM Sans', sans-serif", size: 11 }, color: '#9B978E' },
        title: yLabel ? { display: true, text: yLabel, font: { family: "'DM Sans', sans-serif", size: 11 }, color: '#9B978E' } : undefined },
    },
  };
}

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

// =========================================
// INIT
// =========================================

document.addEventListener('DOMContentLoaded', () => {
  setupAnalyticsToolbar();
  renderDashboard();
});
