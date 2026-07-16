/* ============================================================
   RANGE CLOUD — Master Application Script
   Vanilla JS. No dependencies.

   Tickets and purchases are now backed by a real Cloudflare Worker
   API (see worker.js) instead of localStorage, so a customer and
   an admin on two different devices see the same data. Edit
   API_BASE below to point at your deployed Worker.
   ============================================================ */

'use strict';

/* Point this at your deployed Worker. If you set up a Worker Route
   like yourdomain.com/api/* on the same zone as your Pages site,
   leave this as '/api' — same-origin, no CORS to worry about.
   Otherwise use your workers.dev URL, e.g.
   'https://rangecloud-api.yoursubdomain.workers.dev/api' */
const API_BASE = '/api';

/* ============================================================
   0. PAGE TRANSITIONS + LOADING BAR
   ============================================================ */
(function pageTransitions() {
  const bar = document.getElementById('loadingBar');

  function finishBar() {
    if (!bar) return;
    bar.style.width = '100%';
    setTimeout(() => bar.classList.add('done'), 220);
  }

  if (bar) {
    requestAnimationFrame(() => { bar.style.width = '65%'; });
    if (document.readyState === 'complete') finishBar();
    else window.addEventListener('load', finishBar);
  }

  requestAnimationFrame(() => {
    document.body.classList.remove('page-enter');
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('mailto:') || a.target === '_blank') return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;

    e.preventDefault();
    document.body.classList.add('page-exit');
    if (bar) { bar.classList.remove('done'); bar.style.width = '30%'; }
    setTimeout(() => { window.location.href = href; }, 200);
  });
})();

/* ============================================================
   1. STARFIELD / NETWORK CANVAS
   ============================================================ */
(function starfield() {
  const canvasHost = document.getElementById('starfield');
  if (!canvasHost) return;

  const canvas = document.createElement('canvas');
  canvasHost.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let layers = [];
  let comets = [];
  let pointerX = 0, pointerY = 0;
  let driftX = 0, driftY = 0;
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const LINK_DIST = 120;

  const LAYER_CONFIG = [
    { divisor: 16000, sizeMin: 0.3, sizeMax: 0.9, speed: 0.012, parallax: 6,  alpha: 0.55 },
    { divisor: 26000, sizeMin: 0.6, sizeMax: 1.4, speed: 0.028, parallax: 14, alpha: 0.75 },
    { divisor: 60000, sizeMin: 1.0, sizeMax: 2.1, speed: 0.05,  parallax: 26, alpha: 0.95 }
  ];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedLayers();
  }

  function seedLayers() {
    layers = LAYER_CONFIG.map(cfg => {
      const count = Math.max(18, Math.floor((width * height) / cfg.divisor));
      const stars = new Array(count).fill(0).map(() => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: cfg.sizeMin + Math.random() * (cfg.sizeMax - cfg.sizeMin),
        vx: (Math.random() - 0.5) * cfg.speed,
        vy: (Math.random() - 0.5) * cfg.speed + cfg.speed * 0.3,
        tw: Math.random() * Math.PI * 2,
        twSpeed: 0.006 + Math.random() * 0.014
      }));
      return { cfg, stars };
    });
  }

  function spawnComet() {
    const fromLeft = Math.random() > 0.5;
    const y = Math.random() * height * 0.5;
    comets.push({
      x: fromLeft ? -60 : width + 60,
      y: y,
      vx: (fromLeft ? 1 : -1) * (3.6 + Math.random() * 2.4),
      vy: 1.4 + Math.random() * 1.2,
      life: 0,
      maxLife: 90 + Math.random() * 30,
      len: 90 + Math.random() * 60
    });
  }

  function maybeSpawnComet() {
    if (reduced) return;
    if (Math.random() < 0.0035 && comets.length < 2) spawnComet();
  }

  function drawComets() {
    for (let i = comets.length - 1; i >= 0; i--) {
      const c = comets[i];
      c.x += c.vx;
      c.y += c.vy;
      c.life++;

      const tailX = c.x - c.vx * (c.len / Math.hypot(c.vx, c.vy));
      const tailY = c.y - c.vy * (c.len / Math.hypot(c.vx, c.vy));
      const fadeIn = Math.min(1, c.life / 12);
      const fadeOut = Math.min(1, (c.maxLife - c.life) / 20);
      const alpha = Math.max(0, Math.min(fadeIn, fadeOut));

      const grad = ctx.createLinearGradient(tailX, tailY, c.x, c.y);
      grad.addColorStop(0, 'rgba(0, 224, 255, 0)');
      grad.addColorStop(1, `rgba(233, 245, 255, ${0.85 * alpha})`);
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(c.x, c.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(c.x, c.y, 1.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();

      if (c.life > c.maxLife || c.x < -120 || c.x > width + 120 || c.y > height + 120) {
        comets.splice(i, 1);
      }
    }
  }

  function step() {
    ctx.clearRect(0, 0, width, height);

    driftX += (pointerX - driftX) * 0.04;
    driftY += (pointerY - driftY) * 0.04;

    layers.forEach(layer => {
      const { cfg, stars } = layer;
      const offX = driftX * cfg.parallax;
      const offY = driftY * cfg.parallax;

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        if (!reduced) {
          s.x += s.vx;
          s.y += s.vy;
          s.tw += s.twSpeed;
          if (s.x < -10) s.x = width + 10;
          if (s.x > width + 10) s.x = -10;
          if (s.y < -10) s.y = height + 10;
          if (s.y > height + 10) s.y = -10;
        }
        const twinkle = 0.5 + Math.sin(s.tw) * 0.5;
        ctx.beginPath();
        ctx.arc(s.x + offX, s.y + offY, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(233, 237, 247, ${cfg.alpha * (0.3 + twinkle * 0.6)})`;
        ctx.fill();
      }
    });

    const front = layers[layers.length - 1];
    if (front) {
      const offX = driftX * front.cfg.parallax;
      const offY = driftY * front.cfg.parallax;
      const stars = front.stars;
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const a = stars[i], b = stars[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < LINK_DIST) {
            const alpha = (1 - dist / LINK_DIST) * 0.16;
            ctx.beginPath();
            ctx.moveTo(a.x + offX, a.y + offY);
            ctx.lineTo(b.x + offX, b.y + offY);
            const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
            grad.addColorStop(0, `rgba(47, 91, 255, ${alpha})`);
            grad.addColorStop(1, `rgba(0, 224, 255, ${alpha})`);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }

    maybeSpawnComet();
    drawComets();

    if (!reduced) requestAnimationFrame(step);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  resize();
  requestAnimationFrame(step);
  if (reduced) step();
})();

/* ============================================================
   2. CORE STATE

   Two separate systems, on purpose:

   1. LOCAL PROFILE (still localStorage) — username/email/password
      for personalizing the site (dashboard greeting, "my purchases"
      shortcuts). This is a convenience layer, not a security
      boundary. It was never meant to gate access to real data.

   2. LIVE DATA (Cloudflare Worker + KV, see worker.js) — tickets
      and purchases now live on the server, which is what actually
      makes cross-device sync and real admin access control
      possible. Two access mechanisms:
        - Purchase owners authenticate with a random per-order
          token issued at creation time (like a magic link).
        - Staff authenticate with a real password, verified
          server-side, which returns a signed session token. This
          cannot be forged from the browser — unlike the old
          "username === admin" check, the server is the one
          deciding who's staff now.
   ============================================================ */
const RC = (function core() {
  const USERS_KEY = 'rc_users';
  const SESSION_KEY = 'rc_session';
  const ADMIN_KEY = 'rc_admin';
  const MY_PURCHASES_KEY = 'rc_my_purchases';

  /* ---------- Local profile storage ---------- */
  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch (e) { return null; }
  }
  function setSession(sess) { localStorage.setItem(SESSION_KEY, JSON.stringify(sess)); }
  function clearSession() { localStorage.removeItem(SESSION_KEY); }

  function hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return 'h_' + Math.abs(h).toString(36) + '_' + str.length;
  }

  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function emailValid(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()); }
  function discordTagValid(tag) {
    tag = (tag || '').trim();
    return /^[a-z0-9_.]{2,32}$/.test(tag) || /^.{2,32}#[0-9]{4}$/.test(tag);
  }

  function signUp({ username, email, password }) {
    username = (username || '').trim();
    email = (email || '').trim().toLowerCase();

    if (username.length < 3 || username.length > 24 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return { ok: false, error: 'Username must be 3-24 characters (letters, numbers, underscore only).' };
    }
    if (!emailValid(email)) {
      return { ok: false, error: 'Enter a valid email address.' };
    }
    if (!passwordMeetsPolicy(password)) {
      return { ok: false, error: 'Password does not meet the requirements below.' };
    }

    const users = getUsers();
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
      return { ok: false, error: 'That username is already taken.' };
    }
    if (users.some(u => u.email === email)) {
      return { ok: false, error: 'An account with that email already exists.' };
    }

    const user = {
      id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      username,
      email,
      passwordHash: hash(password),
      createdAt: new Date().toISOString(),
      status: 'active'
    };
    users.push(user);
    saveUsers(users);
    setSession({ id: user.id, username: user.username, loggedInAt: Date.now() });
    return { ok: true, user };
  }

  function signIn({ username, password }) {
    username = (username || '').trim();
    if (!username || !password) return { ok: false, error: 'Enter your username and password.' };
    const users = getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user || user.passwordHash !== hash(password)) {
      return { ok: false, error: 'Incorrect username or password.' };
    }
    if (user.status === 'deleted') return { ok: false, error: 'This account has been closed.' };
    setSession({ id: user.id, username: user.username, loggedInAt: Date.now() });
    return { ok: true, user };
  }

  function signOut() { clearSession(); }

  function currentUser() {
    const sess = getSession();
    if (!sess) return null;
    const users = getUsers();
    const stored = users.find(u => u.id === sess.id);
    if (!stored || stored.status === 'deleted') { clearSession(); return null; }
    return { id: stored.id, username: stored.username, email: stored.email, createdAt: stored.createdAt };
  }

  function deleteAccount(id) {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === id);
    if (idx === -1) return { ok: false, error: 'Account not found.' };
    users[idx].status = 'deleted';
    users[idx].deletedAt = new Date().toISOString();
    saveUsers(users);
    clearSession();
    return { ok: true };
  }

  function passwordMeetsPolicy(pw) {
    if (!pw || pw.length < 8) return false;
    if (!/[A-Z]/.test(pw)) return false;
    if (!/[a-z]/.test(pw)) return false;
    if (!/[0-9]/.test(pw)) return false;
    return true;
  }

  function passwordStrength(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return Math.min(score, 5);
  }

  /* ---------- API helper ---------- */
  async function api(path, opts = {}) {
    let res, data;
    try {
      res = await fetch(API_BASE + path, {
        method: opts.method || 'GET',
        headers: { 'Content-Type': 'application/json', ...adminHeaders(), ...(opts.headers || {}) },
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
    } catch (e) {
      return { ok: false, error: 'Could not reach the server. Check your connection and try again.' };
    }
    try { data = await res.json(); }
    catch (e) { return { ok: false, error: 'Unexpected server response.' }; }
    if (!res.ok && data.ok === undefined) return { ok: false, error: data.error || 'Request failed.' };
    return data;
  }

  /* ---------- Admin (staff) session ---------- */
  function getAdmin() {
    try {
      const a = JSON.parse(localStorage.getItem(ADMIN_KEY));
      if (a && a.expiresAt > Date.now()) return a;
      return null;
    } catch (e) { return null; }
  }
  function isAdminSession() { return !!getAdmin(); }
  function getStaffName() { const a = getAdmin(); return a ? a.staffName : null; }
  function adminHeaders() {
    const a = getAdmin();
    return a ? { Authorization: 'Bearer ' + a.token } : {};
  }
  async function adminLogin(password, staffName) {
    const res = await api('/admin/login', { method: 'POST', body: { password, staffName } });
    if (res.ok) {
      localStorage.setItem(ADMIN_KEY, JSON.stringify({
        token: res.token,
        staffName: res.staffName,
        expiresAt: Date.now() + res.expiresInMs
      }));
    }
    return res;
  }
  function adminLogout() { localStorage.removeItem(ADMIN_KEY); }

  /* ---------- Tickets ---------- */
  function createTicket({ message, contactEmail }) {
    const user = currentUser();
    return api('/tickets', {
      method: 'POST',
      body: { message, contactEmail, username: user ? user.username : 'Guest' }
    });
  }
  function listTickets() { return api('/tickets'); }
  function claimTicket(id) { return api(`/tickets/${id}/claim`, { method: 'POST' }); }
  function resolveTicket(id) { return api(`/tickets/${id}/resolve`, { method: 'POST' }); }
  function deleteTicket(id) { return api(`/tickets/${id}`, { method: 'DELETE' }); }

  /* ---------- Purchases ---------- */
  function rememberMyPurchase(id, token, planName) {
    try {
      const list = JSON.parse(localStorage.getItem(MY_PURCHASES_KEY)) || [];
      list.unshift({ id, token, planName, savedAt: Date.now() });
      localStorage.setItem(MY_PURCHASES_KEY, JSON.stringify(list.slice(0, 30)));
    } catch (e) { /* ignore */ }
  }
  function getMyPurchaseRefs() {
    try { return JSON.parse(localStorage.getItem(MY_PURCHASES_KEY)) || []; }
    catch (e) { return []; }
  }
  function forgetMyPurchase(id) {
    const list = getMyPurchaseRefs().filter(p => p.id !== id);
    localStorage.setItem(MY_PURCHASES_KEY, JSON.stringify(list));
  }

  async function createPurchase({ discordTag, email, notes, plan }) {
    const user = currentUser();
    const res = await api('/purchases', {
      method: 'POST',
      body: { discordTag, email, notes, plan, username: user ? user.username : 'Guest' }
    });
    if (res.ok) rememberMyPurchase(res.id, res.token, plan.planName);
    return res;
  }
  function getPurchase(id, token) {
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    return api(`/purchases/${id}${qs}`);
  }
  function addPurchaseMessage(id, token, text) {
    return api(`/purchases/${id}/messages`, { method: 'POST', body: { token, text } });
  }
  function listPurchases() { return api('/purchases'); }
  function claimPurchase(id) { return api(`/purchases/${id}/claim`, { method: 'POST', body: {} }); }
  function cancelPurchase(id, token) { return api(`/purchases/${id}/cancel`, { method: 'POST', body: { token } }); }
  function deletePurchase(id) { return api(`/purchases/${id}`, { method: 'DELETE' }); }

  async function getMyPurchases() {
    const refs = getMyPurchaseRefs();
    const results = await Promise.all(refs.map(async (r) => {
      const res = await getPurchase(r.id, r.token);
      return res.ok ? { ...res.order, _token: r.token } : null;
    }));
    return results.filter(Boolean);
  }

  return {
    signUp, signIn, signOut, currentUser, deleteAccount,
    passwordMeetsPolicy, passwordStrength, discordTagValid, emailValid,
    isAdminSession, getStaffName, adminLogin, adminLogout,
    createTicket, listTickets, claimTicket, resolveTicket, deleteTicket,
    createPurchase, getPurchase, addPurchaseMessage, listPurchases,
    claimPurchase, cancelPurchase, deletePurchase,
    getMyPurchaseRefs, getMyPurchases, forgetMyPurchase,
    sanitize
  };
})();

/* ============================================================
   3. NAVBAR
   ============================================================ */
(function navbar() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('open');
      links.classList.toggle('open');
    });
    links.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      toggle.classList.remove('open');
      links.classList.remove('open');
    }));
  }

  const path = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[data-page]').forEach(a => {
    if (a.dataset.page === path) a.classList.add('active');
  });

  const accountSlot = document.querySelector('.nav-account');
  if (accountSlot) {
    const user = RC.currentUser();
    if (user) {
      accountSlot.innerHTML = `
        <a href="auth.html#dashboard" class="btn btn-ghost btn-sm">${escapeHtml(user.username)}</a>
        <button class="btn btn-primary btn-sm" id="navSignOut">Sign out</button>
      `;
      document.getElementById('navSignOut').addEventListener('click', () => {
        RC.signOut();
        location.href = 'index.html';
      });
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();

/* ============================================================
   4. SUPPORT WIDGET — Ticket / Support Queue / Purchases
   The latter two require staff sign-in (real, server-verified).
   ============================================================ */
(function supportWidget() {
  const launcher = document.getElementById('supportLauncher');
  const panel = document.getElementById('supportPanel');
  if (!launcher || !panel) return;

  const closeBtn = document.getElementById('supportClose');
  const modeTicket = document.getElementById('modeTicket');
  const modeAdmin = document.getElementById('modeAdmin');
  const modePurchases = document.getElementById('modePurchases');
  const bodyTicket = document.getElementById('bodyTicket');
  const bodyAdmin = document.getElementById('bodyAdmin');
  const bodyPurchases = document.getElementById('bodyPurchases');
  const ticketForm = document.getElementById('ticketForm');
  const ticketMsg = document.getElementById('ticketMessage');
  const ticketEmail = document.getElementById('ticketEmail');
  const ticketFeedback = document.getElementById('ticketFeedback');
  const queueList = document.getElementById('adminQueueList');
  const purchasesQueueList = document.getElementById('adminPurchasesList');
  const pingBadge = launcher.querySelector('.ping');

  function loginFormHtml(context) {
    return `
      <div class="staff-login">
        <h5>Staff sign-in</h5>
        <p class="field-hint" style="margin-bottom:14px;">Server-verified — this is not the same as a customer account.</p>
        <div class="form-msg" id="staffLoginMsg-${context}"></div>
        <div class="field">
          <label>Staff name</label>
          <input type="text" id="staffName-${context}" placeholder="Shown to customers in chat">
        </div>
        <div class="field">
          <label>Password</label>
          <input type="password" id="staffPassword-${context}">
        </div>
        <button class="btn btn-primary btn-block btn-sm" id="staffLoginBtn-${context}">Sign In</button>
      </div>
    `;
  }

  function wireLoginForm(context, onSuccess) {
    const btn = document.getElementById(`staffLoginBtn-${context}`);
    const msg = document.getElementById(`staffLoginMsg-${context}`);
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const password = document.getElementById(`staffPassword-${context}`).value;
      const staffName = document.getElementById(`staffName-${context}`).value;
      btn.disabled = true;
      btn.textContent = 'Signing in...';
      const res = await RC.adminLogin(password, staffName);
      btn.disabled = false;
      btn.textContent = 'Sign In';
      msg.classList.remove('success', 'error');
      if (res.ok) {
        onSuccess();
        refreshAccess();
      } else {
        msg.textContent = res.error;
        msg.classList.add('error', 'show');
      }
    });
  }

  function refreshAccess() {
    // Both admin tabs are always visible — access is gated by a
    // real staff sign-in prompt inside, not by hiding the tab.
  }

  async function refreshPing() {
    if (!RC.isAdminSession()) { pingBadge.classList.remove('show'); return; }
    const [t, p] = await Promise.all([RC.listTickets(), RC.listPurchases()]);
    let total = 0;
    if (t.ok) total += t.tickets.filter(x => x.status === 'open').length;
    if (p.ok) total += p.purchases.filter(x => x.status === 'pending').length;
    if (total > 0) {
      pingBadge.classList.add('show');
      pingBadge.textContent = total > 9 ? '9+' : String(total);
    } else {
      pingBadge.classList.remove('show');
    }
  }

  function switchMode(mode) {
    modeTicket.classList.toggle('active', mode === 'ticket');
    if (modeAdmin) modeAdmin.classList.toggle('active', mode === 'admin');
    if (modePurchases) modePurchases.classList.toggle('active', mode === 'purchases');

    bodyTicket.style.display = mode === 'ticket' ? 'block' : 'none';
    if (bodyAdmin) bodyAdmin.style.display = mode === 'admin' ? 'block' : 'none';
    if (bodyPurchases) bodyPurchases.style.display = mode === 'purchases' ? 'block' : 'none';

    if (mode === 'admin') renderQueue();
    if (mode === 'purchases') renderPurchasesQueue();
  }

  async function renderQueue() {
    if (!queueList) return;
    if (!RC.isAdminSession()) {
      queueList.innerHTML = loginFormHtml('tickets');
      wireLoginForm('tickets', renderQueue);
      return;
    }
    queueList.innerHTML = '<div class="empty-state">Loading...</div>';
    const res = await RC.listTickets();
    if (!res.ok) {
      queueList.innerHTML = `<div class="empty-state">${res.error}</div>`;
      if (res.error && res.error.includes('sign-in')) { RC.adminLogout(); renderQueue(); }
      return;
    }
    const tickets = res.tickets;
    if (tickets.length === 0) {
      queueList.innerHTML = '<div class="empty-state">No tickets yet. New leads will appear here in real time.</div>';
      return;
    }
    queueList.innerHTML = tickets.map(t => `
      <div class="ticket-item" data-id="${t.id}">
        <div class="meta">
          <span>${t.username} · ${new Date(t.createdAt).toLocaleString()}</span>
          <span class="tag">${t.status}${t.claimedBy ? ' · ' + t.claimedBy : ''}</span>
        </div>
        <div class="body">${t.message}</div>
        ${t.contactEmail ? `<div class="field-hint">Contact: ${t.contactEmail}</div>` : ''}
        <div class="ticket-actions">
          ${t.status === 'open' && !t.claimedBy ? '<button class="btn btn-ghost btn-sm claim-btn">Claim</button>' : ''}
          ${t.status !== 'resolved' ? '<button class="btn btn-ghost btn-sm resolve-btn">Mark resolved</button>' : ''}
          <button class="btn btn-danger btn-sm delete-btn">Delete</button>
        </div>
      </div>
    `).join('');

    queueList.querySelectorAll('.claim-btn').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.target.closest('.ticket-item').dataset.id;
      await RC.claimTicket(id);
      renderQueue(); refreshPing();
    }));
    queueList.querySelectorAll('.resolve-btn').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.target.closest('.ticket-item').dataset.id;
      await RC.resolveTicket(id);
      renderQueue(); refreshPing();
    }));
    queueList.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.target.closest('.ticket-item').dataset.id;
      if (!confirm('Delete this ticket permanently?')) return;
      await RC.deleteTicket(id);
      renderQueue(); refreshPing();
    }));
  }

  async function renderPurchasesQueue() {
    if (!purchasesQueueList) return;
    if (!RC.isAdminSession()) {
      purchasesQueueList.innerHTML = loginFormHtml('purchases');
      wireLoginForm('purchases', renderPurchasesQueue);
      return;
    }
    purchasesQueueList.innerHTML = '<div class="empty-state">Loading...</div>';
    const res = await RC.listPurchases();
    if (!res.ok) {
      purchasesQueueList.innerHTML = `<div class="empty-state">${res.error}</div>`;
      if (res.error && res.error.includes('sign-in')) { RC.adminLogout(); renderPurchasesQueue(); }
      return;
    }
    const purchases = res.purchases;
    if (purchases.length === 0) {
      purchasesQueueList.innerHTML = '<div class="empty-state">No purchase requests yet.</div>';
      return;
    }
    purchasesQueueList.innerHTML = purchases.map(p => `
      <div class="ticket-item" data-id="${p.id}">
        <div class="meta">
          <span>${p.username} · ${new Date(p.createdAt).toLocaleString()}</span>
          <span class="tag">${p.status}${p.claimedBy ? ' · ' + p.claimedBy : ''}</span>
        </div>
        <div class="body"><strong>${p.plan.planName}</strong> — ${p.plan.category} — ₹${p.plan.price}/mo</div>
        <div class="field-hint">Discord: ${p.discordTag} · Email: ${p.email}</div>
        <div class="ticket-actions">
          ${!p.claimedBy ? '<button class="btn btn-ghost btn-sm claim-btn">Claim</button>' : ''}
          <a class="btn btn-ghost btn-sm" href="purchase.html?id=${encodeURIComponent(p.id)}">Open chat</a>
          <button class="btn btn-danger btn-sm delete-btn">Delete</button>
        </div>
      </div>
    `).join('');

    purchasesQueueList.querySelectorAll('.claim-btn').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.target.closest('.ticket-item').dataset.id;
      await RC.claimPurchase(id);
      renderPurchasesQueue(); refreshPing();
    }));
    purchasesQueueList.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', async (e) => {
      const id = e.target.closest('.ticket-item').dataset.id;
      if (!confirm('Delete this purchase request permanently?')) return;
      await RC.deletePurchase(id);
      renderPurchasesQueue(); refreshPing();
    }));
  }

  launcher.addEventListener('click', () => {
    panel.classList.add('show');
    refreshPing();
  });
  closeBtn.addEventListener('click', () => panel.classList.remove('show'));
  document.addEventListener('click', (e) => {
    if (panel.classList.contains('show') && !panel.contains(e.target) && !launcher.contains(e.target)) {
      panel.classList.remove('show');
    }
  });

  modeTicket.addEventListener('click', () => switchMode('ticket'));
  if (modeAdmin) modeAdmin.addEventListener('click', () => switchMode('admin'));
  if (modePurchases) modePurchases.addEventListener('click', () => switchMode('purchases'));

  if (ticketForm) {
    ticketForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = ticketForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      const res = await RC.createTicket({ message: ticketMsg.value, contactEmail: ticketEmail.value });
      submitBtn.disabled = false;
      ticketFeedback.classList.remove('success', 'error');
      if (res.ok) {
        ticketFeedback.textContent = 'Ticket submitted — our team will follow up shortly.';
        ticketFeedback.classList.add('success', 'show');
        ticketForm.reset();
        refreshPing();
      } else {
        ticketFeedback.textContent = res.error;
        ticketFeedback.classList.add('error', 'show');
      }
    });
  }

  refreshPing();
  switchMode('ticket');
})();

/* ============================================================
   5. PLANS PAGE — tab filtering
   ============================================================ */
(function plansTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  if (!tabs.length) return;

  const params = new URLSearchParams(location.search);
  const type = params.get('type');

  if (type === 'minecraft' || type === 'other') {
    tabs.forEach(tab => {
      const isDiscord = tab.dataset.target === 'discord-bots';
      const show = type === 'minecraft' ? !isDiscord : isDiscord;
      tab.style.display = show ? '' : 'none';
    });
    panels.forEach(panelEl => {
      const isDiscord = panelEl.id === 'discord-bots';
      const show = type === 'minecraft' ? !isDiscord : isDiscord;
      if (!show) panelEl.classList.remove('active');
    });
    const firstVisible = Array.from(tabs).find(t => t.style.display !== 'none');
    if (firstVisible && !document.getElementById(firstVisible.dataset.target).classList.contains('active')) {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      firstVisible.classList.add('active');
      document.getElementById(firstVisible.dataset.target).classList.add('active');
    }
  } else if (location.hash) {
    const target = location.hash.slice(1);
    const targetTab = Array.from(tabs).find(t => t.dataset.target === target);
    if (targetTab) {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      targetTab.classList.add('active');
      document.getElementById(target).classList.add('active');
    }
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
    });
  });
})();

/* ============================================================
   6. AUTH PAGE — sign in / sign up / dashboard
   ============================================================ */
(function authPage() {
  const authRoot = document.getElementById('authRoot');
  if (!authRoot) return;

  const tabSignIn = document.getElementById('tabSignIn');
  const tabSignUp = document.getElementById('tabSignUp');
  const viewSignIn = document.getElementById('viewSignIn');
  const viewSignUp = document.getElementById('viewSignUp');
  const viewDashboard = document.getElementById('viewDashboard');
  const authTabs = document.getElementById('authTabs');

  function showView(view) {
    [viewSignIn, viewSignUp, viewDashboard].forEach(v => v.classList.remove('active'));
    view.classList.add('active');
  }

  function renderForUser() {
    const user = RC.currentUser();
    if (user) {
      authTabs.style.display = 'none';
      showView(viewDashboard);
      renderDashboard(user);
    } else {
      authTabs.style.display = 'flex';
      showView(location.hash === '#signup' ? viewSignUp : viewSignIn);
      updateAuthTabs();
    }
  }

  function updateAuthTabs() {
    const onSignUp = viewSignUp.classList.contains('active');
    tabSignIn.classList.toggle('active', !onSignUp);
    tabSignUp.classList.toggle('active', onSignUp);
  }

  tabSignIn.addEventListener('click', () => { showView(viewSignIn); updateAuthTabs(); });
  tabSignUp.addEventListener('click', () => { showView(viewSignUp); updateAuthTabs(); });
  document.querySelectorAll('[data-switch]').forEach(btn => {
    btn.addEventListener('click', () => {
      showView(btn.dataset.switch === 'signup' ? viewSignUp : viewSignIn);
      updateAuthTabs();
    });
  });

  const signInForm = document.getElementById('signInForm');
  const signInMsg = document.getElementById('signInMsg');
  signInForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('siUsername').value;
    const password = document.getElementById('siPassword').value;
    const res = RC.signIn({ username, password });
    signInMsg.classList.remove('success', 'error');
    if (res.ok) {
      signInMsg.textContent = 'Signed in successfully.';
      signInMsg.classList.add('success', 'show');
      setTimeout(renderForUser, 350);
    } else {
      signInMsg.textContent = res.error;
      signInMsg.classList.add('error', 'show');
    }
  });

  const signUpForm = document.getElementById('signUpForm');
  const signUpMsg = document.getElementById('signUpMsg');
  const suPassword = document.getElementById('suPassword');
  const strengthFill = document.getElementById('pwStrengthFill');

  suPassword.addEventListener('input', () => {
    const score = RC.passwordStrength(suPassword.value);
    const pct = (score / 5) * 100;
    strengthFill.style.width = pct + '%';
    const colors = ['#ff4d5e', '#ff4d5e', '#ffb238', '#ffb238', '#2fe0a8', '#2fe0a8'];
    strengthFill.style.background = colors[score];
  });

  signUpForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('suUsername').value;
    const email = document.getElementById('suEmail').value;
    const password = suPassword.value;
    const confirm = document.getElementById('suConfirm').value;

    signUpMsg.classList.remove('success', 'error');

    if (password !== confirm) {
      signUpMsg.textContent = 'Passwords do not match.';
      signUpMsg.classList.add('error', 'show');
      return;
    }

    const res = RC.signUp({ username, email, password });
    if (res.ok) {
      signUpMsg.textContent = 'Account created. Welcome to Range Cloud.';
      signUpMsg.classList.add('success', 'show');
      setTimeout(renderForUser, 350);
    } else {
      signUpMsg.textContent = res.error;
      signUpMsg.classList.add('error', 'show');
    }
  });

  function renderDashboard(user) {
    document.getElementById('dashInitial').textContent = user.username.charAt(0).toUpperCase();
    document.getElementById('dashUsername').textContent = user.username;
    document.getElementById('dashEmail').textContent = user.email;
    document.getElementById('dashJoined').textContent = new Date(user.createdAt).toLocaleDateString();

    const roleBadge = document.getElementById('dashRoleBadge');
    const staff = RC.isAdminSession();
    roleBadge.textContent = staff ? `Staff (${RC.getStaffName()})` : 'Standard user';
    roleBadge.className = 'role-badge ' + (staff ? 'supporter' : 'user');

    const staffTools = document.getElementById('dashStaffTools');
    if (staffTools) staffTools.style.display = staff ? 'block' : 'none';
    const openWidgetBtn = document.getElementById('openSupportWidgetBtn');
    if (openWidgetBtn) {
      openWidgetBtn.onclick = () => {
        document.getElementById('supportLauncher')?.click();
        document.getElementById('modeAdmin')?.click();
      };
    }

    renderMyPurchases();

    document.getElementById('signOutBtn').onclick = () => {
      RC.signOut();
      renderForUser();
    };

    const deleteBtn = document.getElementById('deleteAccountBtn');
    const modal = document.getElementById('deleteModal');
    const confirmDelete = document.getElementById('confirmDelete');
    const cancelDelete = document.getElementById('cancelDelete');

    deleteBtn.onclick = () => modal.classList.add('show');
    cancelDelete.onclick = () => modal.classList.remove('show');
    confirmDelete.onclick = () => {
      RC.deleteAccount(user.id);
      modal.classList.remove('show');
      renderForUser();
    };
  }

  async function renderMyPurchases() {
    const list = document.getElementById('dashPurchasesList');
    if (!list) return;
    list.innerHTML = '<div class="empty-state">Loading...</div>';
    const mine = await RC.getMyPurchases();
    if (mine.length === 0) {
      list.innerHTML = '<div class="empty-state">No purchases yet — browse the plans page to get started.</div>';
      return;
    }
    list.innerHTML = mine.map(p => `
      <div class="ticket-item">
        <div class="meta">
          <span>${p.plan.planName} · ${new Date(p.createdAt).toLocaleDateString()}</span>
          <span class="tag">${p.status}</span>
        </div>
        <div class="body">${p.plan.category} — ₹${p.plan.price}/mo</div>
        <a class="btn btn-ghost btn-sm" style="margin-top:8px;" href="purchase.html?id=${encodeURIComponent(p.id)}&token=${encodeURIComponent(p._token)}">Open chat</a>
      </div>
    `).join('');
  }

  renderForUser();
})();

/* ============================================================
   7. PURCHASE PAGE — plan summary, Discord + email capture, chat
   ============================================================ */
(function purchasePage() {
  const root = document.getElementById('purchaseRoot');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const existingId = params.get('id');
  const urlToken = params.get('token');

  const gate = document.getElementById('purchaseGate');
  const summaryCard = document.getElementById('purchaseSummary');
  const formSection = document.getElementById('purchaseFormSection');
  const chatSection = document.getElementById('purchaseChatSection');
  const linkBox = document.getElementById('trackingLinkBox');

  function renderPlanSummary(plan) {
    summaryCard.innerHTML = `
      <div class="plan-name">${plan.category}</div>
      <div class="plan-price">₹${plan.price}<span>/month</span></div>
      <div class="plan-location">${plan.location || 'Global availability'}</div>
      <ul class="plan-specs">
        ${plan.ram ? `<li>${plan.ram} RAM</li>` : ''}
        ${plan.storage ? `<li>${plan.storage} NVMe SSD</li>` : ''}
        ${plan.cpu ? `<li>CPU: ${plan.cpu}</li>` : ''}
        <li>DDoS Protection Included</li>
      </ul>
      <div class="plan-name" style="margin-top:6px;">${plan.planName}</div>
    `;
  }

  function renderChat(order, token) {
    chatSection.style.display = 'block';
    const thread = document.getElementById('chatThread');
    if (order.messages.length === 0) {
      thread.innerHTML = '<div class="empty-state">No messages yet. Say hello — our team will reply here.</div>';
    } else {
      thread.innerHTML = order.messages.map(m => `
        <div class="chat-bubble ${m.sender === 'admin' ? 'admin' : 'user'}">
          <div class="chat-meta">${m.sender === 'admin' ? m.authorName + ' (Support)' : m.authorName} · ${new Date(m.at).toLocaleString()}</div>
          <div class="chat-text">${m.text}</div>
        </div>
      `).join('');
      thread.scrollTop = thread.scrollHeight;
    }

    const statusEl = document.getElementById('chatOrderStatus');
    if (statusEl) statusEl.textContent = order.status;

    const isAdmin = RC.isAdminSession();
    const isOwner = !!token;
    const actionsEl = document.getElementById('chatActions');
    const actions = [];
    if (isAdmin && !order.claimedBy) actions.push('<button class="btn btn-ghost btn-sm" id="claimOrderBtn">Claim</button>');
    if ((isAdmin || isOwner) && order.status !== 'cancelled' && order.status !== 'completed') {
      actions.push('<button class="btn btn-danger btn-sm" id="cancelOrderBtn">Cancel Order</button>');
    }
    if (isAdmin) actions.push('<button class="btn btn-danger btn-sm" id="deleteOrderBtn">Delete</button>');
    actionsEl.innerHTML = actions.join('');

    const claimBtn = document.getElementById('claimOrderBtn');
    if (claimBtn) claimBtn.addEventListener('click', async () => {
      claimBtn.disabled = true;
      const res = await RC.claimPurchase(order.id);
      if (res.ok) renderChat(res.order, token);
    });
    const cancelBtn = document.getElementById('cancelOrderBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', async () => {
      if (!confirm('Cancel this order?')) return;
      cancelBtn.disabled = true;
      const res = await RC.cancelPurchase(order.id, token);
      if (res.ok) renderChat(res.order, token);
    });
    const deleteBtn = document.getElementById('deleteOrderBtn');
    if (deleteBtn) deleteBtn.addEventListener('click', async () => {
      if (!confirm('Delete this order permanently? This cannot be undone.')) return;
      const res = await RC.deletePurchase(order.id);
      if (res.ok) {
        RC.forgetMyPurchase(order.id);
        chatSection.innerHTML = '<div class="empty-state">This order was deleted.</div>';
      }
    });
  }

  function wireChatForm(orderId, token) {
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMsg = document.getElementById('chatFormMsg');
    chatForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = chatForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      const res = await RC.addPurchaseMessage(orderId, token, chatInput.value);
      btn.disabled = false;
      chatMsg.classList.remove('success', 'error');
      if (res.ok) {
        chatInput.value = '';
        renderChat(res.order, token);
      } else {
        chatMsg.textContent = res.error;
        chatMsg.classList.add('error', 'show');
      }
    });
  }

  async function bootExisting(id, token) {
    gate.innerHTML = '<div class="form-msg show" style="display:block;">Loading order...</div>';
    const res = await RC.getPurchase(id, token);
    if (!res.ok) {
      if (RC.isAdminSession()) {
        // retry implicitly happens via admin header in RC.api; if still failing, surface error
      }
      gate.innerHTML = `<div class="form-msg error show">${res.error}</div>`;
      formSection.style.display = 'none';
      return;
    }
    gate.style.display = 'none';
    formSection.style.display = 'none';
    renderPlanSummary(res.order.plan);
    renderChat(res.order, token);
    wireChatForm(id, token);
  }

  if (existingId) {
    const effectiveToken = urlToken || (RC.getMyPurchaseRefs().find(r => r.id === existingId) || {}).token || null;
    bootExisting(existingId, effectiveToken);
    return;
  }

  // New purchase flow
  const plan = {
    category: params.get('category') || 'Range Cloud Hosting',
    planName: params.get('plan') || 'Custom Plan',
    price: params.get('price') || '0',
    ram: params.get('ram') || '',
    storage: params.get('storage') || '',
    cpu: params.get('cpu') || '',
    location: params.get('location') || ''
  };
  renderPlanSummary(plan);
  gate.style.display = 'none';
  formSection.style.display = 'block';

  const user = RC.currentUser();
  const purchaseForm = document.getElementById('purchaseForm');
  const discordInput = document.getElementById('purchaseDiscord');
  const emailInput = document.getElementById('purchaseEmail');
  const notesInput = document.getElementById('purchaseNotes');
  const purchaseMsg = document.getElementById('purchaseFormMsg');

  if (user && emailInput && !emailInput.value) emailInput.value = user.email;

  purchaseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    purchaseMsg.classList.remove('success', 'error');

    if (!RC.discordTagValid(discordInput.value)) {
      purchaseMsg.textContent = 'Enter a valid Discord username (e.g. yourname or yourname#1234).';
      purchaseMsg.classList.add('error', 'show');
      return;
    }
    if (!RC.emailValid(emailInput.value)) {
      purchaseMsg.textContent = 'Enter a valid email address.';
      purchaseMsg.classList.add('error', 'show');
      return;
    }

    const submitBtn = purchaseForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    const res = await RC.createPurchase({
      discordTag: discordInput.value,
      email: emailInput.value,
      notes: notesInput.value,
      plan
    });
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit Order Request';

    if (!res.ok) {
      purchaseMsg.textContent = res.error;
      purchaseMsg.classList.add('error', 'show');
      return;
    }

    formSection.style.display = 'none';
    const trackingUrl = `${location.origin}${location.pathname}?id=${encodeURIComponent(res.id)}&token=${encodeURIComponent(res.token)}`;
    if (linkBox) {
      linkBox.style.display = 'block';
      linkBox.innerHTML = `
        <div class="field-hint" style="margin-bottom:8px;">Save this link — it's the only way to reopen this conversation from another device or browser:</div>
        <div style="display:flex;gap:8px;">
          <input type="text" readonly value="${trackingUrl}" id="trackingLinkInput" style="flex:1;padding:10px 12px;background:var(--panel-2);border:1px solid var(--card-border);border-radius:var(--radius-sm);color:var(--text);font-size:0.8rem;font-family:var(--font-mono);">
          <button class="btn btn-ghost btn-sm" id="copyTrackingLink">Copy</button>
        </div>
      `;
      document.getElementById('copyTrackingLink').addEventListener('click', () => {
        const input = document.getElementById('trackingLinkInput');
        input.select();
        navigator.clipboard?.writeText(input.value);
      });
    }
    renderChat(res.order, res.token);
    wireChatForm(res.id, res.token);
    history.replaceState(null, '', `purchase.html?id=${encodeURIComponent(res.id)}&token=${encodeURIComponent(res.token)}`);
  });
})();
