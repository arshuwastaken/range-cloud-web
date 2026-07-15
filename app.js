/* ============================================================
   RANGE CLOUD — Master Application Script
   Vanilla JS. No dependencies.
   ============================================================ */

'use strict';

/* ============================================================
   1. STARFIELD / NETWORK CANVAS
   Ambient background: stars drift slowly; when two stars pass
   near each other a thin connection pulses between them —
   a literal "network forming in the dark" signature.
   ============================================================ */
(function starfield() {
  const canvasHost = document.getElementById('starfield');
  if (!canvasHost) return;

  const canvas = document.createElement('canvas');
  canvasHost.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let width, height, dpr;
  let layers = [];       // parallax star layers, back to front
  let comets = [];       // occasional streaking comets
  let pointerX = 0, pointerY = 0;   // normalized -1..1
  let driftX = 0, driftY = 0;       // eased pointer parallax
  let reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const LINK_DIST = 120;

  // Three depth layers: far (small, slow, dense), mid, near (large, fast, sparse)
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

    // Ease pointer-driven parallax drift toward target
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

    // Network links only within the nearest (front) layer for legibility
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
  if (reduced) step(); // draw a single static frame
})();

/* ============================================================
   2. SESSION / AUTH STATE
   Mock authentication using localStorage. This is a front-end
   demo simulation only — a real deployment must verify sessions
   server-side (e.g. Cloudflare Workers + signed cookies).
   ============================================================ */
const RC = (function auth() {
  const USERS_KEY = 'rc_users';
  const SESSION_KEY = 'rc_session';
  const TICKETS_KEY = 'rc_tickets';
  const ADMIN_ID = 'lordkira146';

  function getUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch (e) { return null; }
  }
  function setSession(sess) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sess));
  }
  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function hash(str) {
    // Lightweight non-cryptographic obfuscation for this client-side demo.
    // A production system must hash + salt passwords server-side (e.g. bcrypt/argon2).
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return 'h_' + Math.abs(h).toString(36) + '_' + str.length;
  }

  function isElevated(idOrUsername, role) {
    return idOrUsername === ADMIN_ID || role === 'supporter';
  }

  function resolveRole(username, storedRole) {
    if (username === ADMIN_ID) return 'supporter';
    return storedRole || 'user';
  }

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

  function signOut() {
    clearSession();
  }

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

  /* ---------- Tickets ---------- */
  function getTickets() {
    try { return JSON.parse(localStorage.getItem(TICKETS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveTickets(tickets) {
    localStorage.setItem(TICKETS_KEY, JSON.stringify(tickets));
  }
  function submitTicket({ message, contactEmail }) {
    message = (message || '').trim();
    if (message.length < 10) {
      return { ok: false, error: 'Please describe your issue in at least 10 characters.' };
    }
    if (message.length > 1500) {
      return { ok: false, error: 'Message is too long (max 1500 characters).' };
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

  function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    ADMIN_ID,
    signUp, signIn, signOut, currentUser, deleteAccount,
    passwordMeetsPolicy, passwordStrength,
    isElevated,
    submitTicket, getTickets, closeTicket, saveTickets
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
   ============================================================ */
(function supportWidget() {
  const launcher = document.getElementById('supportLauncher');
  const panel = document.getElementById('supportPanel');
  if (!launcher || !panel) return;

  const closeBtn = document.getElementById('supportClose');
  const modeTicket = document.getElementById('modeTicket');
  const modeAdmin = document.getElementById('modeAdmin');
  const bodyTicket = document.getElementById('bodyTicket');
  const bodyAdmin = document.getElementById('bodyAdmin');
  const ticketForm = document.getElementById('ticketForm');
  const ticketMsg = document.getElementById('ticketMessage');
  const ticketEmail = document.getElementById('ticketEmail');
  const ticketFeedback = document.getElementById('ticketFeedback');
  const queueList = document.getElementById('adminQueueList');
  const pingBadge = launcher.querySelector('.ping');

  function refreshAccess() {
    const user = RC.currentUser();
    const elevated = user && RC.isElevated(user.username, user.role);
    if (modeAdmin) {
      modeAdmin.style.display = elevated ? 'block' : 'none';
    }
    if (!elevated && bodyAdmin && bodyAdmin.classList.contains('active')) {
      switchMode('ticket');
    }
    if (elevated) {
      const openCount = RC.getTickets().filter(t => t.status === 'open').length;
      if (openCount > 0) {
        pingBadge.classList.add('show');
        pingBadge.textContent = openCount > 9 ? '9+' : String(openCount);
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
    if (mode === 'admin' && !elevated) mode = 'ticket';
    modeTicket.classList.toggle('active', mode === 'ticket');
    if (modeAdmin) modeAdmin.classList.toggle('active', mode === 'admin');
    bodyTicket.classList.toggle('active', mode === 'ticket');
    if (bodyAdmin) bodyAdmin.classList.toggle('active', mode === 'admin');
    bodyTicket.style.display = mode === 'ticket' ? 'block' : 'none';
    if (bodyAdmin) bodyAdmin.style.display = mode === 'admin' ? 'block' : 'none';
    if (mode === 'admin') renderQueue();
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
   ============================================================ */
(function plansTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');
  if (!tabs.length) return;

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

  renderForUser();
})();
