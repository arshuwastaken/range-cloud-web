/* ============================================================
   RANGE CLOUD — Master Application Script
   Vanilla JS. No dependencies.
   ============================================================ */

'use strict';

/* ============================================================
   0. PAGE TRANSITIONS + LOADING BAR
   A thin gradient bar sweeps across the top on every navigation,
   and the page body cross-fades in/out. Purely cosmetic polish —
   internal links are intercepted just long enough to play the
   exit transition, then navigation proceeds normally.
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
   Layered parallax stars, a drifting nebula (handled in CSS),
   occasional comets, and pointer-driven depth drift — a literal
   "network forming in the dark" signature tying back to the
   "powerful network" positioning.
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
   2. CORE STATE — auth, tickets, purchases

   SECURITY NOTE (read this before deploying live):
   This entire layer runs on localStorage, which lives only in
   one visitor's own browser. There is no shared database and no
   server verifying anything, which means two things in practice:

   1. Nobody can see or tamper with ANOTHER person's account,
      tickets, or purchases — each browser only ever has its own
      local copy. A stranger opening dev tools on their own laptop
      cannot reach your real customer data, because that data was
      never sent anywhere; it doesn't exist outside the customer's
      own browser.
   2. However, ANY visitor can grant themselves the admin UI in
      THEIR OWN browser by signing up with the reserved admin
      username, or by editing their own localStorage directly.
      That unlocks the admin-only panels cosmetically on their
      screen, but — per point 1 — it does not expose real tickets
      or purchases belonging to other people, because those never
      left the other person's browser in the first place.

   The one real action item on your side: sign up using the
   reserved admin username yourself, on the live site, before
   anyone else does — usernames are first-come-first-served per
   browser/device the way this demo is built. Once an account with
   that username has your password on your own devices, nobody
   else can register the same username again on a shared backend
   (if/when you add one).

   For a real production deployment where staff need to manage
   real customer tickets and purchases from a different device
   than the customer used, you need an actual backend (e.g.
   Cloudflare Workers + D1/KV, with sessions verified server-side)
   — this file cannot provide that on its own, and no amount of
   client-side obfuscation changes that.
   ============================================================ */
const RC = (function core() {
  const USERS_KEY = 'rc_users';
  const SESSION_KEY = 'rc_session';
  const TICKETS_KEY = 'rc_tickets';
  const PURCHASES_KEY = 'rc_purchases';
  const RATE_KEY = 'rc_rate';
  const ADMIN_ID = 'lordkira146';

  /* ---------- Low-level storage ---------- */
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
    // Lightweight non-cryptographic obfuscation for this client-side demo.
    // A production system must hash + salt passwords server-side (bcrypt/argon2).
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

  /* ---------- Very simple client-side rate limiting ----------
     Not a substitute for real server-side rate limiting, but it
     stops naive spam-clicking of forms in this demo. ---------- */
  function rateLimited(key, cooldownMs) {
    try {
      const store = JSON.parse(localStorage.getItem(RATE_KEY)) || {};
      const last = store[key] || 0;
      const now = Date.now();
      if (now - last < cooldownMs) return true;
      store[key] = now;
      localStorage.setItem(RATE_KEY, JSON.stringify(store));
      return false;
    } catch (e) { return false; }
  }

  /* ---------- Roles ---------- */
  function isElevated(idOrUsername, role) {
    return idOrUsername === ADMIN_ID || role === 'supporter';
  }

  function resolveRole(username, storedRole) {
    if (username === ADMIN_ID) return 'supporter';
    return storedRole || 'user';
  }

  /* ---------- Auth ---------- */
  function signUp({ username, email, password }) {
    username = (username || '').trim();
    email = (email || '').trim().toLowerCase();

    if (username.length < 3 || username.length > 24 || !/^[a-zA-Z0-9_]+$/.test(username)) {
      return { ok: false, error: 'Username must be 3-24 characters (letters, numbers, underscore only).' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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

    const role = resolveRole(username, 'user');
    const user = {
      id: 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      username,
      email,
      passwordHash: hash(password),
      role,
      createdAt: new Date().toISOString(),
      serversActive: 0,
      status: 'active'
    };
    users.push(user);
    saveUsers(users);
    setSession({ id: user.id, username: user.username, role: user.role, loggedInAt: Date.now() });
    return { ok: true, user };
  }

  function signIn({ username, password }) {
    username = (username || '').trim();
    if (!username || !password) {
      return { ok: false, error: 'Enter your username and password.' };
    }
    if (rateLimited('signin:' + username.toLowerCase(), 800)) {
      return { ok: false, error: 'Too many attempts — wait a moment and try again.' };
    }
    const users = getUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user || user.passwordHash !== hash(password)) {
      return { ok: false, error: 'Incorrect username or password.' };
    }
    if (user.status === 'deleted') {
      return { ok: false, error: 'This account has been closed.' };
    }
    const role = resolveRole(user.username, user.role);
    setSession({ id: user.id, username: user.username, role, loggedInAt: Date.now() });
    return { ok: true, user };
  }

  function signOut() { clearSession(); }

  function currentUser() {
    const sess = getSession();
    if (!sess) return null;
    const users = getUsers();
    const stored = users.find(u => u.id === sess.id);
    if (!stored || stored.status === 'deleted') {
      clearSession();
      return null;
    }
    return {
      id: stored.id,
      username: stored.username,
      email: stored.email,
      role: resolveRole(stored.username, stored.role),
      createdAt: stored.createdAt,
      serversActive: stored.serversActive || 0
    };
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

  function discordTagValid(tag) {
    tag = (tag || '').trim();
    // Accepts modern unique usernames (2-32 chars, lowercase/digits/._) or legacy Name#1234
    return /^[a-z0-9_.]{2,32}$/.test(tag) || /^.{2,32}#[0-9]{4}$/.test(tag);
  }

  /* ---------- Tickets (general support) ---------- */
  function getTickets() {
    try { return JSON.parse(localStorage.getItem(TICKETS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveTickets(tickets) { localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets)); }

  function submitTicket({ message, contactEmail }) {
    message = (message || '').trim();
    if (message.length < 10) {
      return { ok: false, error: 'Please describe your issue in at least 10 characters.' };
    }
    if (message.length > 1500) {
      return { ok: false, error: 'Message is too long (max 1500 characters).' };
    }
    if (rateLimited('ticket', 4000)) {
      return { ok: false, error: 'Please wait a few seconds before sending another ticket.' };
    }
    const sess = getSession();
    const tickets = getTickets();
    const ticket = {
      id: 't_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      message: sanitize(message),
      contactEmail: contactEmail ? sanitize(contactEmail) : null,
      username: sess ? sess.username : 'Guest',
      createdAt: new Date().toISOString(),
      status: 'open'
    };
    tickets.unshift(ticket);
    saveTickets(tickets);
    return { ok: true, ticket };
  }
  function closeTicket(id) {
    const tickets = getTickets();
    const t = tickets.find(t => t.id === id);
    if (t) t.status = 'closed';
    saveTickets(tickets);
  }

  /* ---------- Purchases (plan orders + saved chat thread) ----------
     Chat persists in localStorage, which — per the note above —
     only exists inside the browser it was created in. Treat this
     as a working local demo of the flow, not a live cross-device
     support inbox, until a real backend is wired in. ---------- */
  function getPurchases() {
    try { return JSON.parse(localStorage.getItem(PURCHASES_KEY)) || []; }
    catch (e) { return []; }
  }
  function savePurchases(list) { localStorage.setItem(PURCHASES_KEY, JSON.stringify(list)); }

  function getPurchaseById(id) {
    return getPurchases().find(p => p.id === id) || null;
  }

  function submitPurchase({ discordTag, notes, plan }) {
    const user = currentUser();
    if (!user) {
      return { ok: false, error: 'Please sign in before starting a purchase.' };
    }
    discordTag = (discordTag || '').trim();
    if (!discordTagValid(discordTag)) {
      return { ok: false, error: 'Enter a valid Discord username (e.g. yourname or yourname#1234).' };
    }
    if (!plan || !plan.planName || !plan.price) {
      return { ok: false, error: 'Missing plan details — go back and choose a plan again.' };
    }
    if (rateLimited('purchase', 4000)) {
      return { ok: false, error: 'Please wait a few seconds before submitting again.' };
    }

    const purchases = getPurchases();
    const order = {
      id: 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      userId: user.id,
      username: user.username,
      discordTag: sanitize(discordTag),
      plan: {
        category: sanitize(plan.category || ''),
        planName: sanitize(plan.planName || ''),
        price: sanitize(String(plan.price || '')),
        ram: sanitize(plan.ram || ''),
        storage: sanitize(plan.storage || ''),
        cpu: sanitize(plan.cpu || ''),
        location: sanitize(plan.location || '')
      },
      status: 'pending',
      createdAt: new Date().toISOString(),
      messages: notes ? [{
        id: 'm_' + Date.now().toString(36),
        sender: 'user',
        authorName: user.username,
        text: sanitize(notes.trim()),
        at: new Date().toISOString()
      }] : []
    };
    purchases.unshift(order);
    savePurchases(purchases);
    return { ok: true, order };
  }

  function addPurchaseMessage(id, text) {
    text = (text || '').trim();
    if (!text) return { ok: false, error: 'Message cannot be empty.' };
    if (text.length > 1000) return { ok: false, error: 'Message is too long (max 1000 characters).' };

    const user = currentUser();
    if (!user) return { ok: false, error: 'Sign in required.' };

    const purchases = getPurchases();
    const order = purchases.find(p => p.id === id);
    if (!order) return { ok: false, error: 'Order not found.' };

    const elevated = isElevated(user.username, user.role);
    const isOwner = order.userId === user.id;
    if (!elevated && !isOwner) {
      return { ok: false, error: 'You do not have access to this conversation.' };
    }

    order.messages.push({
      id: 'm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      sender: elevated && !isOwner ? 'admin' : (elevated && isOwner ? 'admin' : 'user'),
      authorName: user.username,
      text: sanitize(text),
      at: new Date().toISOString()
    });
    savePurchases(purchases);
    return { ok: true, order };
  }

  function setPurchaseStatus(id, status) {
    const purchases = getPurchases();
    const order = purchases.find(p => p.id === id);
    if (!order) return { ok: false, error: 'Order not found.' };
    order.status = status;
    savePurchases(purchases);
    return { ok: true, order };
  }

  function canAccessPurchase(order) {
    const user = currentUser();
    if (!user) return false;
    return isElevated(user.username, user.role) || order.userId === user.id;
  }

  return {
    ADMIN_ID,
    signUp, signIn, signOut, currentUser, deleteAccount,
    passwordMeetsPolicy, passwordStrength, discordTagValid,
    isElevated,
    submitTicket, getTickets, closeTicket,
    getPurchases, getPurchaseById, submitPurchase, addPurchaseMessage,
    setPurchaseStatus, canAccessPurchase,
    sanitize
  };
})();

/* ============================================================
   3. NAVBAR — active link, mobile toggle, session-aware buttons
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
   4. SUPPORT WIDGET — visible on every page
   Three modes: Ticket (everyone), Support Queue (admin), and
   Purchases (admin) — the new section after Support, where staff
   reply into a purchase's saved chat thread.
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

  function refreshAccess() {
    const user = RC.currentUser();
    const elevated = user && RC.isElevated(user.username, user.role);
    if (modeAdmin) modeAdmin.style.display = elevated ? 'block' : 'none';
    if (modePurchases) modePurchases.style.display = elevated ? 'block' : 'none';

    if (!elevated) {
      if (bodyAdmin && bodyAdmin.classList.contains('active')) switchMode('ticket');
      if (bodyPurchases && bodyPurchases.classList.contains('active')) switchMode('ticket');
    }

    if (elevated) {
      const openTickets = RC.getTickets().filter(t => t.status === 'open').length;
      const openPurchases = RC.getPurchases().filter(p => p.status === 'pending').length;
      const total = openTickets + openPurchases;
      if (total > 0) {
        pingBadge.classList.add('show');
        pingBadge.textContent = total > 9 ? '9+' : String(total);
      } else {
        pingBadge.classList.remove('show');
      }
    } else {
      pingBadge.classList.remove('show');
    }
    return elevated;
  }

  function switchMode(mode) {
    const elevated = refreshAccess();
    if ((mode === 'admin' || mode === 'purchases') && !elevated) mode = 'ticket';

    modeTicket.classList.toggle('active', mode === 'ticket');
    if (modeAdmin) modeAdmin.classList.toggle('active', mode === 'admin');
    if (modePurchases) modePurchases.classList.toggle('active', mode === 'purchases');

    bodyTicket.style.display = mode === 'ticket' ? 'block' : 'none';
    if (bodyAdmin) bodyAdmin.style.display = mode === 'admin' ? 'block' : 'none';
    if (bodyPurchases) bodyPurchases.style.display = mode === 'purchases' ? 'block' : 'none';

    if (mode === 'admin') renderQueue();
    if (mode === 'purchases') renderPurchasesQueue();
  }

  function renderQueue() {
    if (!queueList) return;
    const tickets = RC.getTickets();
    if (tickets.length === 0) {
      queueList.innerHTML = '<div class="empty-state">No tickets yet. New leads will appear here in real time.</div>';
      return;
    }
    queueList.innerHTML = tickets.map(t => `
      <div class="ticket-item" data-id="${t.id}">
        <div class="meta">
          <span>${t.username} · ${new Date(t.createdAt).toLocaleString()}</span>
          <span class="tag">${t.status}</span>
        </div>
        <div class="body">${t.message}</div>
        ${t.contactEmail ? `<div class="field-hint">Contact: ${t.contactEmail}</div>` : ''}
        ${t.status === 'open' ? `<button class="btn btn-ghost btn-sm resolve-btn" style="margin-top:8px;">Mark resolved</button>` : ''}
      </div>
    `).join('');

    queueList.querySelectorAll('.resolve-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.closest('.ticket-item').dataset.id;
        RC.closeTicket(id);
        renderQueue();
        refreshAccess();
      });
    });
  }

  function renderPurchasesQueue() {
    if (!purchasesQueueList) return;
    const purchases = RC.getPurchases();
    if (purchases.length === 0) {
      purchasesQueueList.innerHTML = '<div class="empty-state">No purchase requests yet.</div>';
      return;
    }
    purchasesQueueList.innerHTML = purchases.map(p => `
      <div class="ticket-item" data-id="${p.id}">
        <div class="meta">
          <span>${p.username} · ${new Date(p.createdAt).toLocaleString()}</span>
          <span class="tag">${p.status}</span>
        </div>
        <div class="body"><strong>${p.plan.planName}</strong> — ${p.plan.category} — ₹${p.plan.price}/mo</div>
        <div class="field-hint">Discord: ${p.discordTag}</div>
        <a class="btn btn-ghost btn-sm" style="margin-top:8px;" href="purchase.html?id=${encodeURIComponent(p.id)}">Open chat</a>
      </div>
    `).join('');
  }

  launcher.addEventListener('click', () => {
    panel.classList.add('show');
    refreshAccess();
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
    ticketForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const res = RC.submitTicket({ message: ticketMsg.value, contactEmail: ticketEmail.value });
      ticketFeedback.classList.remove('success', 'error');
      if (res.ok) {
        ticketFeedback.textContent = 'Ticket submitted — our team will follow up shortly.';
        ticketFeedback.classList.add('success', 'show');
        ticketForm.reset();
        refreshAccess();
      } else {
        ticketFeedback.textContent = res.error;
        ticketFeedback.classList.add('error', 'show');
      }
    });
  }

  refreshAccess();
  switchMode('ticket');
})();

/* ============================================================
   5. PLANS PAGE — tab filtering
   Supports two entry modes via ?type= query param:
     ?type=minecraft -> only Intel / Epyc / Ryzen7 / Ryzen9 tabs
     ?type=other     -> only the Discord Bot Hosting tab
   No param (e.g. from the main "Plans" nav link) shows everything.
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
    panels.forEach(panel => {
      const isDiscord = panel.id === 'discord-bots';
      const show = type === 'minecraft' ? !isDiscord : isDiscord;
      if (!show) panel.classList.remove('active');
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

  /* ---------- Sign In ---------- */
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

  /* ---------- Sign Up ---------- */
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

  /* ---------- Dashboard ---------- */
  function renderDashboard(user) {
    const elevated = RC.isElevated(user.username, user.role);
    document.getElementById('dashInitial').textContent = user.username.charAt(0).toUpperCase();
    document.getElementById('dashUsername').textContent = user.username;
    document.getElementById('dashEmail').textContent = user.email;
    document.getElementById('dashJoined').textContent = new Date(user.createdAt).toLocaleDateString();

    const roleBadge = document.getElementById('dashRoleBadge');
    roleBadge.textContent = elevated ? 'Supporter' : 'Standard user';
    roleBadge.className = 'role-badge ' + (elevated ? 'supporter' : 'user');

    const adminPanel = document.getElementById('dashAdminPanel');
    if (elevated) {
      adminPanel.classList.add('show');
      renderDashQueue();
    } else {
      adminPanel.classList.remove('show');
    }

    renderMyPurchases(user, elevated);

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

  function renderDashQueue() {
    const list = document.getElementById('dashQueueList');
    const tickets = RC.getTickets();
    if (!list) return;
    if (tickets.length === 0) {
      list.innerHTML = '<div class="empty-state">Queue is empty.</div>';
      return;
    }
    list.innerHTML = tickets.slice(0, 5).map(t => `
      <div class="ticket-item">
        <div class="meta"><span>${t.username} · ${new Date(t.createdAt).toLocaleString()}</span><span class="tag">${t.status}</span></div>
        <div class="body">${t.message}</div>
      </div>
    `).join('');
  }

  function renderMyPurchases(user, elevated) {
    const wrap = document.getElementById('dashPurchases');
    const list = document.getElementById('dashPurchasesList');
    if (!wrap || !list) return;

    const all = RC.getPurchases();
    const mine = elevated ? all : all.filter(p => p.userId === user.id);

    if (mine.length === 0) {
      list.innerHTML = '<div class="empty-state">No purchases yet — browse the plans page to get started.</div>';
      return;
    }
    list.innerHTML = mine.slice(0, 6).map(p => `
      <div class="ticket-item">
        <div class="meta">
          <span>${p.plan.planName} · ${new Date(p.createdAt).toLocaleDateString()}</span>
          <span class="tag">${p.status}</span>
        </div>
        <div class="body">${p.plan.category} — ₹${p.plan.price}/mo</div>
        <a class="btn btn-ghost btn-sm" style="margin-top:8px;" href="purchase.html?id=${encodeURIComponent(p.id)}">Open chat</a>
      </div>
    `).join('');
  }

  renderForUser();
})();

/* ============================================================
   7. PURCHASE PAGE — plan summary, Discord tag capture, saved chat
   ============================================================ */
(function purchasePage() {
  const root = document.getElementById('purchaseRoot');
  if (!root) return;

  const params = new URLSearchParams(location.search);
  const existingId = params.get('id');

  const gate = document.getElementById('purchaseGate');
  const summaryCard = document.getElementById('purchaseSummary');
  const formSection = document.getElementById('purchaseFormSection');
  const chatSection = document.getElementById('purchaseChatSection');

  const user = RC.currentUser();

  function renderPlanSummary(plan) {
    summaryCard.innerHTML = `
      <div class="plan-name">${plan.category}</div>
      <div class="plan-price">₹${plan.price}<span>/month</span></div>
      <div class="plan-location">${plan.location || 'Global availability'}</div>
      <ul class="plan-specs">
        <li>${plan.ram ? plan.ram + ' RAM' : ''}</li>
        <li>${plan.storage ? plan.storage + ' NVMe SSD' : ''}</li>
        <li>${plan.cpu ? 'CPU: ' + plan.cpu : ''}</li>
        <li>DDoS Protection Included</li>
      </ul>
      <div class="plan-name" style="margin-top:6px;">${plan.planName}</div>
    `;
  }

  function renderChat(order) {
    chatSection.style.display = 'block';
    const thread = document.getElementById('chatThread');
    if (order.messages.length === 0) {
      thread.innerHTML = '<div class="empty-state">No messages yet. Say hello — our team will reply here.</div>';
    } else {
      thread.innerHTML = order.messages.map(m => `
        <div class="chat-bubble ${m.sender === 'admin' ? 'admin' : 'user'}">
          <div class="chat-meta">${m.sender === 'admin' ? 'Range Cloud Support' : m.authorName} · ${new Date(m.at).toLocaleString()}</div>
          <div class="chat-text">${m.text}</div>
        </div>
      `).join('');
      thread.scrollTop = thread.scrollHeight;
    }

    const statusEl = document.getElementById('chatOrderStatus');
    if (statusEl) statusEl.textContent = order.status;
  }

  function bootExisting(id) {
    const order = RC.getPurchaseById(id);
    if (!order) {
      gate.innerHTML = '<div class="form-msg error show">This purchase conversation could not be found in this browser. Saved chats only exist on the device/browser where the purchase was created.</div>';
      formSection.style.display = 'none';
      return;
    }
    if (!RC.canAccessPurchase(order)) {
      gate.innerHTML = '<div class="form-msg error show">You do not have access to this conversation. Sign in with the account that created it.</div>';
      formSection.style.display = 'none';
      return;
    }
    gate.style.display = 'none';
    formSection.style.display = 'none';
    renderPlanSummary(order.plan);
    renderChat(order);
    wireChatForm(order.id);
  }

  function wireChatForm(orderId) {
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const chatMsg = document.getElementById('chatFormMsg');
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const res = RC.addPurchaseMessage(orderId, chatInput.value);
      chatMsg.classList.remove('success', 'error');
      if (res.ok) {
        chatInput.value = '';
        renderChat(res.order);
      } else {
        chatMsg.textContent = res.error;
        chatMsg.classList.add('error', 'show');
      }
    });
  }

  if (existingId) {
    if (!user) {
      gate.innerHTML = '<div class="form-msg error show">Please sign in to view this purchase conversation.</div><a href="auth.html" class="btn btn-primary btn-block" style="margin-top:10px;">Sign In</a>';
      formSection.style.display = 'none';
      return;
    }
    bootExisting(existingId);
    return;
  }

  // New purchase flow — plan details arrive via query params from plans.html
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

  if (!user) {
    gate.style.display = 'block';
    gate.innerHTML = '<div class="form-msg error show">Please sign in to continue with this purchase.</div><a href="auth.html#signup" class="btn btn-primary btn-block" style="margin-top:10px;">Sign In / Sign Up</a>';
    formSection.style.display = 'none';
    return;
  }

  gate.style.display = 'none';
  formSection.style.display = 'block';

  const purchaseForm = document.getElementById('purchaseForm');
  const discordInput = document.getElementById('purchaseDiscord');
  const notesInput = document.getElementById('purchaseNotes');
  const purchaseMsg = document.getElementById('purchaseFormMsg');

  purchaseForm.addEventListener('submit', (e) => {
    e.preventDefault();
    purchaseMsg.classList.remove('success', 'error');

    if (!RC.discordTagValid(discordInput.value)) {
      purchaseMsg.textContent = 'Enter a valid Discord username (e.g. yourname or yourname#1234).';
      purchaseMsg.classList.add('error', 'show');
      return;
    }

    const res = RC.submitPurchase({ discordTag: discordInput.value, notes: notesInput.value, plan });
    if (!res.ok) {
      purchaseMsg.textContent = res.error;
      purchaseMsg.classList.add('error', 'show');
      return;
    }

    formSection.style.display = 'none';
    renderChat(res.order);
    wireChatForm(res.order.id);
    history.replaceState(null, '', 'purchase.html?id=' + encodeURIComponent(res.order.id));
  });
})();
