/* ─────────────────────────────────────────
   Cloud Peak Silver Labradors
   Shared Supabase client + utilities
   ───────────────────────────────────────── */

const SUPABASE_URL = 'https://bvnurkvvhlmdapvhvcje.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bnVya3Z2aGxtZGFwdmh2Y2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDQ3MDgsImV4cCI6MjA5MzY4MDcwOH0.ddHJhA-pktWJdkMqsUpgr_N11xG0z5yxm1XWqKZrT9Y';
const ANALYTICS_TABLE = 'analytics_events';
let analyticsSessionId = null;
let pageStartTime = null;

// ── HTML escape helper ──
function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Database-backed analytics helpers ──
function getAnalyticsSessionId() {
  if (analyticsSessionId) return analyticsSessionId;
  const key = 'cloudpeak_analytics_session_id';
  try {
    analyticsSessionId = sessionStorage.getItem(key);
    if (!analyticsSessionId) {
      analyticsSessionId = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
      sessionStorage.setItem(key, analyticsSessionId);
    }
  } catch (_) {
    analyticsSessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  return analyticsSessionId;
}

function getSessionStorageJson(key, fallback) {
  try {
    const value = sessionStorage.getItem(key);
    if (!value) return fallback;
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function setSessionStorageJson(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (_) {}
}

function getSessionPath() {
  return getSessionStorageJson('cloudpeak_analytics_path', []);
}

function setSessionPath(path) {
  setSessionStorageJson('cloudpeak_analytics_path', path);
}

function getPageStartTime() {
  if (pageStartTime) return pageStartTime;
  try {
    const stored = sessionStorage.getItem('cloudpeak_analytics_page_start');
    pageStartTime = stored ? Number(stored) : Date.now();
    sessionStorage.setItem('cloudpeak_analytics_page_start', String(pageStartTime));
  } catch (_) {
    pageStartTime = Date.now();
  }
  return pageStartTime;
}

function recordPagePath() {
  const path = window.location.pathname + (window.location.search || '');
  const sessionPath = getSessionPath();
  const lastPath = sessionPath[sessionPath.length - 1];
  if (lastPath !== path) {
    sessionPath.push(path);
    setSessionPath(sessionPath);
  }
  return sessionPath;
}

function trackAnalytics(eventName, properties = {}) {
  void db.insert(ANALYTICS_TABLE, {
    event_name: eventName,
    page_path: window.location.pathname,
    page_title: document.title,
    referrer: document.referrer || null,
    session_id: getAnalyticsSessionId(),
    properties,
  }).catch(() => {});
}

function trackAnalyticsBeacon(eventName, properties = {}) {
  const payload = JSON.stringify({
    event_name: eventName,
    page_path: window.location.pathname,
    page_title: document.title,
    referrer: document.referrer || null,
    session_id: getAnalyticsSessionId(),
    properties,
  });
  const url = `${SUPABASE_URL}/rest/v1/${ANALYTICS_TABLE}`;
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    const ok = navigator.sendBeacon(url, blob);
    if (ok) return;
  }
  void fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

function getAnalyticsLabel(element) {
  return (element.getAttribute('aria-label') || element.textContent || element.href || element.id || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function handleAnalyticsClick(event) {
  const target = event.target.closest('a, button');
  if (!target) return;

  const isLink = target.tagName === 'A';
  const href = isLink ? target.getAttribute('href') || '' : '';
  const label = getAnalyticsLabel(target);
  const isExternal = isLink && /^https?:\/\//i.test(href) && new URL(href, window.location.href).host !== window.location.host;
  const isContact = isLink && /^(mailto:|tel:)/i.test(href);

  if (isLink && !href) return;

  trackAnalytics('site_click', {
    link_text: label,
    link_url: href || window.location.href,
    link_type: isExternal ? 'external' : isContact ? 'contact' : isLink ? 'internal' : 'button',
  });
}

function handleAnalyticsSubmit(event) {
  const form = event.target;
  const id = form.getAttribute('id') || '';
  const action = form.getAttribute('action') || '';
  const label = form.getAttribute('aria-label') || id || action || 'form';
  trackAnalytics('site_form_submit', {
    form_id: id || undefined,
    form_action: action || undefined,
    form_label: label,
  });
}

function trackPageView() {
  const sessionPath = recordPagePath();
  trackAnalytics('page_view', {
    path: window.location.pathname,
    search: window.location.search || '',
    title: document.title,
    session_path: sessionPath,
    session_page_count: sessionPath.length,
  });
}

function trackPageDuration() {
  const durationMs = Math.max(0, Date.now() - getPageStartTime());
  trackAnalyticsBeacon('page_exit', {
    duration_ms: durationMs,
    path: window.location.pathname,
    search: window.location.search || '',
  });
}

// ── Load shared header ──
async function loadHeader() {
  const placeholder = document.getElementById('site-header');
  if (!placeholder) return;
  try {
    const res = await fetch('header.html');
    if (!res.ok) return;
    const html = await res.text();
    placeholder.outerHTML = html;
    initMobileNav();
    setActiveNav();
  } catch (_) {}
}

// ── Load shared footer ──
async function loadFooter() {
  const placeholder = document.getElementById('site-footer');
  if (!placeholder) return;
  try {
    const res = await fetch('footer.html');
    if (!res.ok) return;
    const html = await res.text();
    placeholder.outerHTML = html;
    const form = document.getElementById('newsletter-form');
    if (form) form.addEventListener('submit', handleNewsletterSignup);
  } catch (_) {}
}

// ── Core fetch wrapper ──
async function sbFetch(path, options = {}) {
  const method = options.method || 'GET';
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': options.prefer || (method === 'POST' ? 'return=representation' : ''),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    let msg = err;
    try { const p = JSON.parse(err); msg = p.message || p.hint || err; } catch (_) {}
    throw new Error(msg);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// ── Convenience methods ──
const db = {
  select: (table, query = '') => sbFetch(`${table}?${query}`),
  insert: (table, data) => sbFetch(table, { method: 'POST', body: data }),
  update: (table, match, data) => sbFetch(`${table}?${match}`, { method: 'PATCH', body: data }),
  delete: (table, match) => sbFetch(`${table}?${match}`, { method: 'DELETE' }),
};

// ── Litter status helper ──
function getLitterStatus(puppies) {
  if (!puppies || puppies.length === 0) return 'upcoming';
  const available = puppies.filter(p => p.status === 'available').length;
  const total = puppies.length;
  if (available === 0) return 'placed';
  if (available === total) return 'available';
  return 'limited';
}

// ── Collar color to hex ──
function collarHex(color) {
  const map = {
    yellow: '#f5c842', blue: '#3b82f6', 'dark blue': '#1e3a8a', pink: '#ec4899',
    purple: '#a855f7', red: '#ef4444', green: '#22c55e',
    'light green': '#86efac', 'dark green': '#166534',
    orange: '#f97316', white: '#e5e7eb', black: '#374151',
    teal: '#14b8a6', brown: '#92400e', grey: '#9ca3af', silver: '#9ca3af',
    lime: '#84cc16', cyan: '#06b6d4'
  };
  return map[(color || '').toLowerCase()] || '#aaa';
}

// ── Badge HTML ──
function badgeHtml(status) {
  const labels = { available: 'Puppies available', limited: 'Limited availability', placed: 'Fully placed', upcoming: 'Upcoming' };
  return `<span class="badge badge-${status}">${labels[status] || status}</span>`;
}

// ── Toast notification ──
function showToast(msg, type = 'ok') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.background = type === 'err' ? '#991B1B' : '#1a1a1a';
  toast.style.display = 'block';
  setTimeout(() => toast.style.display = 'none', 3000);
}

// ── Mobile nav toggle ──
function initMobileNav() {
  const hamburger = document.querySelector('.nav-hamburger');
  const mobileNav = document.querySelector('.nav-mobile');
  if (!hamburger || !mobileNav) return;
  hamburger.addEventListener('click', () => {
    mobileNav.classList.toggle('open');
    const spans = hamburger.querySelectorAll('span');
    const isOpen = mobileNav.classList.contains('open');
    if (spans[0]) spans[0].style.transform = isOpen ? 'rotate(45deg) translate(5px, 5px)' : '';
    if (spans[1]) spans[1].style.opacity = isOpen ? '0' : '1';
    if (spans[2]) spans[2].style.transform = isOpen ? 'rotate(-45deg) translate(5px, -5px)' : '';
  });
}

// ── Newsletter signup ──
async function handleNewsletterSignup(e) {
  e.preventDefault();
  const input = document.getElementById('newsletter-email');
  const btn = document.getElementById('newsletter-btn');
  if (!input || !input.value) return;
  btn.textContent = 'Subscribing...';
  btn.disabled = true;
  try {
    await db.insert('newsletter_signups', { email: input.value.trim() });
    input.value = '';
    btn.textContent = 'Subscribed!';
    trackAnalytics('newsletter_signup', { method: 'email' });
    showToast('You\'re on the list!');
    setTimeout(() => { btn.textContent = 'Subscribe'; btn.disabled = false; }, 3000);
  } catch (err) {
    if (err.message.includes('unique')) {
      showToast('You\'re already signed up!');
    } else {
      showToast('Something went wrong. Try again.', 'err');
    }
    btn.textContent = 'Subscribe';
    btn.disabled = false;
  }
}

// ── Set active nav link ──
function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(a => {
    const href = a.getAttribute('href') || '';
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

// ── Init on DOM ready ──
document.addEventListener('DOMContentLoaded', () => {
  loadHeader();
  loadFooter();
  initMobileNav();
  setActiveNav();
  getPageStartTime();
  trackPageView();
  document.addEventListener('click', handleAnalyticsClick, true);
  document.addEventListener('submit', handleAnalyticsSubmit, true);
});

window.addEventListener('pagehide', trackPageDuration);
