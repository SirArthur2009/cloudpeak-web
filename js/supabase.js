/* ─────────────────────────────────────────
   Cloud Peak Silver Labradors
   Shared Supabase client + utilities
   ───────────────────────────────────────── */

const SUPABASE_URL = 'https://bvnurkvvhlmdapvhvcje.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2bnVya3Z2aGxtZGFwdmh2Y2plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMDQ3MDgsImV4cCI6MjA5MzY4MDcwOH0.ddHJhA-pktWJdkMqsUpgr_N11xG0z5yxm1XWqKZrT9Y';

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
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) newsletterForm.addEventListener('submit', handleNewsletterSignup);
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
    yellow: '#f5c842', blue: '#3b82f6', pink: '#ec4899',
    purple: '#a855f7', red: '#ef4444', green: '#22c55e',
    orange: '#f97316', white: '#e5e7eb', black: '#374151',
    teal: '#14b8a6', brown: '#92400e', silver: '#9ca3af',
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
    const isOpen = mobileNav.classList.toggle('open');
    hamburger.classList.toggle('open', isOpen);
    hamburger.setAttribute('aria-expanded', isOpen);
  });
  // Close menu when a link is clicked
  mobileNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      hamburger.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
    });
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
});
