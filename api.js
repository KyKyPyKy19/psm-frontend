/* ============================================
   PsychMonitor — API layer
   Все запросы идут на тот же origin (прокси server.py),
   который подставляет токен и форвардит в бэкенд.
   ============================================ */

const API = (() => {
  async function get(path) {
    const resp = await fetch(path, { headers: { accept: 'application/json' } });
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`HTTP ${resp.status} ${path}: ${text.slice(0, 200)}`);
    }
    return resp.json();
  }

  return {
    dashboard: () => get('/api/dashboard'),
    clients: () => get('/api/clients'),
    clientSummary: (id) => get(`/api/clients/${encodeURIComponent(id)}/summary`),
    dailyAnalytics: (id, days) => {
      const path = `/api/clients/${encodeURIComponent(id)}/daily-analytics`;
      return get(days ? `${path}?days=${days}` : path);
    },
    timeline: (id) => get(`/api/clients/${encodeURIComponent(id)}/timeline`),
    episodes: (id) => get(`/api/stress-episodes/${encodeURIComponent(id)}`),
  };
})();

/* ===== Trigger groups (NLP categories from the model) ===== */
const TRIGGER_GROUPS = {
  work:    { label: 'Работа',          color: '#D4654A', colorLight: 'rgba(212, 101, 74, 0.15)' },
  family:  { label: 'Семья',           color: '#E8B84D', colorLight: 'rgba(232, 184, 77, 0.15)' },
  health:  { label: 'Здоровье',        color: '#5D8EC2', colorLight: 'rgba(93, 142, 194, 0.15)' },
  friends: { label: 'Друзья/Общение',  color: '#7FB895', colorLight: 'rgba(127, 184, 149, 0.15)' },
  social:  { label: 'Друзья/Общение',  color: '#7FB895', colorLight: 'rgba(127, 184, 149, 0.15)' },
  finance:   { label: 'Финансы',         color: '#9B7EC2', colorLight: 'rgba(155, 126, 194, 0.15)' },
  financial: { label: 'Финансы',         color: '#9B7EC2', colorLight: 'rgba(155, 126, 194, 0.15)' },
  unknown: { label: 'Не распознано',   color: '#9B978E', colorLight: 'rgba(155, 151, 142, 0.15)' },
  null:    { label: 'Нет ответа',      color: '#C8C5BD', colorLight: 'rgba(200, 197, 189, 0.15)' },
};

/* label -> канонический ключ (первый встреченный с этим label).
   Нужно, чтобы friends/social и любые другие синонимы из переобученной модели
   считались как одна группа в "Топ триггерах". */
const TRIGGER_LABEL_TO_KEY = (() => {
  const map = {};
  for (const [key, info] of Object.entries(TRIGGER_GROUPS)) {
    if (!map[info.label]) map[info.label] = key;
  }
  return map;
})();

// Приводит сырое значение stress_category из API к каноническому ключу TRIGGER_GROUPS.
// - null/'' -> null  (нет ответа клиента)
// - известный ключ -> канонический ключ для его label
// - незнакомый ключ -> 'unknown'  (модель вернула класс, которого нет во фронте)
function canonicalTriggerKey(rawKey) {
  if (rawKey === null || rawKey === undefined || rawKey === '') return null;
  const info = TRIGGER_GROUPS[rawKey];
  if (!info) return 'unknown';
  return TRIGGER_LABEL_TO_KEY[info.label] || rawKey;
}

/* ===== Formatting / helpers ===== */

// Значение или прочерк, если null/undefined.
function val(v, suffix = '') {
  if (v === null || v === undefined || v === '') return '—';
  return `${v}${suffix}`;
}

function num(v) {
  if (v === null || v === undefined) return '—';
  return Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function round1(v) {
  if (v === null || v === undefined) return '—';
  return (Math.round(v * 10) / 10).toString();
}

// Минуты -> "Xч Yм"
function minutesToHM(mins) {
  if (mins === null || mins === undefined) return '—';
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h === 0) return `${m}м`;
  return `${h}ч ${String(m).padStart(2, '0')}м`;
}

// ISO -> "HH:MM"
function isoToTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ISO -> "D мес"
const RU_MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
function isoToDateShort(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()} ${RU_MONTHS[d.getMonth()]}`;
}

// "2026-05-23" -> "23 мая"
function dateStrShort(s) {
  if (!s) return '';
  const [y, m, day] = s.split('-').map(Number);
  return `${day} ${RU_MONTHS[(m || 1) - 1]}`;
}

function isoToRelative(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}ч назад`;
  const d = Math.floor(h / 24);
  return `${d}д назад`;
}

function getStressColor(value) {
  if (value === null || value === undefined) return 'var(--text-tertiary)';
  if (value <= 25) return '#7FB895';
  if (value <= 50) return '#A8C97F';
  if (value <= 75) return '#E8B84D';
  return '#D4654A';
}

// stress_status бэкенда -> цвет индикатора
function statusToColor(status) {
  if (status === 'high' || status === 'critical' || status === 'alert') return 'red';
  if (status === 'elevated' || status === 'warning' || status === 'medium') return 'yellow';
  return 'green';
}

// Инициалы из client_id (имени в API нет)
function clientInitials(id) {
  const s = String(id || '?');
  const parts = s.split(/[-_\s]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

// Уровень эпизода по пиковому стрессу
function episodeLevel(peakStress) {
  if (peakStress === null || peakStress === undefined) return 'low';
  if (peakStress > 75) return 'high';
  if (peakStress > 50) return 'med';
  return 'low';
}
