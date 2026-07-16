/**
 * Range Cloud API — Cloudflare Worker
 * Backed by Workers KV. This is the real source of truth for tickets
 * and purchases — the previous localStorage version could never sync
 * between a customer's browser and an admin's browser; this can,
 * because the data now lives on Cloudflare's edge, not in either
 * browser.
 *
 * Bindings required (see wrangler.toml):
 *   KV namespace : RC_KV
 *   Secret       : ADMIN_PASSWORD    (wrangler secret put ADMIN_PASSWORD)
 *   Secret       : ADMIN_JWT_SECRET  (wrangler secret put ADMIN_JWT_SECRET)
 *   Var (opt.)   : ALLOWED_ORIGIN    (defaults to "*")
 */

const json = (data, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });

function corsHeaders(env) {
  const origin = env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + crypto.randomUUID().slice(0, 8);
}

function sanitize(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function emailValid(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim()); }
function discordValid(v) {
  const t = String(v || '').trim();
  return /^[a-z0-9_.]{2,32}$/.test(t) || /^.{2,32}#[0-9]{4}$/.test(t);
}

/* ---------- Admin token: HMAC-signed, stateless, short-lived ---------- */
async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signAdminToken(env, staffName) {
  const payload = JSON.stringify({ staffName, exp: Date.now() + 12 * 60 * 60 * 1000 });
  const b64 = btoa(payload);
  const sig = await hmac(env.ADMIN_JWT_SECRET, b64);
  return `${b64}.${sig}`;
}

async function verifyAdmin(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return null;
  const expected = await hmac(env.ADMIN_JWT_SECRET, b64);
  if (expected !== sig) return null;
  try {
    const payload = JSON.parse(atob(b64));
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (e) { return null; }
}

/* ---------- KV helpers ---------- */
async function listByPrefix(env, prefix) {
  const out = [];
  let cursor;
  do {
    const page = await env.RC_KV.list({ prefix, cursor });
    for (const key of page.keys) {
      const val = await env.RC_KV.get(key.name, 'json');
      if (val) out.push(val);
    }
    cursor = page.cursor;
    if (page.list_complete) break;
  } while (cursor);
  out.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return out;
}

function stripToken(obj) {
  if (!obj) return obj;
  const { token, ...rest } = obj;
  return rest;
}

/* ============================================================
   ROUTES
   ============================================================ */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/api/, '') || '/';
    const method = request.method;
    const cors = corsHeaders(env);

    if (method === 'OPTIONS') return new Response(null, { headers: cors });

    try {
      /* ---------- Admin login ---------- */
      if (path === '/admin/login' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        if (!env.ADMIN_PASSWORD || body.password !== env.ADMIN_PASSWORD) {
          return json({ ok: false, error: 'Incorrect staff password.' }, 401, cors);
        }
        const staffName = sanitize((body.staffName || 'Support').trim().slice(0, 40)) || 'Support';
        const token = await signAdminToken(env, staffName);
        return json({ ok: true, token, staffName, expiresInMs: 12 * 60 * 60 * 1000 }, 200, cors);
      }

      /* ---------- Tickets ---------- */
      if (path === '/tickets' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const message = String(body.message || '').trim();
        if (message.length < 10 || message.length > 1500) {
          return json({ ok: false, error: 'Message must be 10-1500 characters.' }, 400, cors);
        }
        if (body.contactEmail && !emailValid(body.contactEmail)) {
          return json({ ok: false, error: 'Enter a valid contact email.' }, 400, cors);
        }
        const ticket = {
          id: uid('t'),
          message: sanitize(message),
          contactEmail: body.contactEmail ? sanitize(body.contactEmail) : null,
          username: sanitize(body.username || 'Guest'),
          createdAt: new Date().toISOString(),
          status: 'open',
          claimedBy: null
        };
        await env.RC_KV.put('ticket:' + ticket.id, JSON.stringify(ticket));
        return json({ ok: true, ticket }, 201, cors);
      }

      if (path === '/tickets' && method === 'GET') {
        const admin = await verifyAdmin(request, env);
        if (!admin) return json({ ok: false, error: 'Staff sign-in required.' }, 401, cors);
        const tickets = await listByPrefix(env, 'ticket:');
        return json({ ok: true, tickets }, 200, cors);
      }

      const ticketMatch = path.match(/^\/tickets\/([^/]+)\/(claim|resolve)$/);
      if (ticketMatch && method === 'POST') {
        const admin = await verifyAdmin(request, env);
        if (!admin) return json({ ok: false, error: 'Staff sign-in required.' }, 401, cors);
        const [, id, action] = ticketMatch;
        const key = 'ticket:' + id;
        const ticket = await env.RC_KV.get(key, 'json');
        if (!ticket) return json({ ok: false, error: 'Ticket not found.' }, 404, cors);
        if (action === 'claim') ticket.claimedBy = admin.staffName;
        if (action === 'resolve') ticket.status = 'resolved';
        await env.RC_KV.put(key, JSON.stringify(ticket));
        return json({ ok: true, ticket }, 200, cors);
      }

      const ticketDelete = path.match(/^\/tickets\/([^/]+)$/);
      if (ticketDelete && method === 'DELETE') {
        const admin = await verifyAdmin(request, env);
        if (!admin) return json({ ok: false, error: 'Staff sign-in required.' }, 401, cors);
        await env.RC_KV.delete('ticket:' + ticketDelete[1]);
        return json({ ok: true }, 200, cors);
      }

      /* ---------- Purchases ---------- */
      if (path === '/purchases' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const plan = body.plan || {};
        if (!plan.planName || !plan.price) {
          return json({ ok: false, error: 'Missing plan details.' }, 400, cors);
        }
        if (!discordValid(body.discordTag)) {
          return json({ ok: false, error: 'Enter a valid Discord username.' }, 400, cors);
        }
        if (!emailValid(body.email)) {
          return json({ ok: false, error: 'Enter a valid email address.' }, 400, cors);
        }
        const id = uid('p');
        const token = crypto.randomUUID();
        const order = {
          id,
          token,
          username: sanitize(body.username || 'Guest'),
          email: sanitize(body.email),
          discordTag: sanitize(body.discordTag),
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
          claimedBy: null,
          createdAt: new Date().toISOString(),
          messages: body.notes ? [{
            id: uid('m'),
            sender: 'user',
            authorName: sanitize(body.username || 'Guest'),
            text: sanitize(String(body.notes).trim()),
            at: new Date().toISOString()
          }] : []
        };
        await env.RC_KV.put('purchase:' + id, JSON.stringify(order));
        return json({ ok: true, id, token, order: stripToken(order) }, 201, cors);
      }

      if (path === '/purchases' && method === 'GET') {
        const admin = await verifyAdmin(request, env);
        if (!admin) return json({ ok: false, error: 'Staff sign-in required.' }, 401, cors);
        const purchases = (await listByPrefix(env, 'purchase:')).map(stripToken);
        return json({ ok: true, purchases }, 200, cors);
      }

      const purchaseSingle = path.match(/^\/purchases\/([^/]+)$/);
      if (purchaseSingle && method === 'GET') {
        const id = purchaseSingle[1];
        const order = await env.RC_KV.get('purchase:' + id, 'json');
        if (!order) return json({ ok: false, error: 'Order not found.' }, 404, cors);
        const admin = await verifyAdmin(request, env);
        const suppliedToken = url.searchParams.get('token');
        if (!admin && suppliedToken !== order.token) {
          return json({ ok: false, error: 'Not authorized to view this order.' }, 403, cors);
        }
        return json({ ok: true, order: stripToken(order) }, 200, cors);
      }

      if (purchaseSingle && method === 'DELETE') {
        const admin = await verifyAdmin(request, env);
        if (!admin) return json({ ok: false, error: 'Staff sign-in required.' }, 401, cors);
        await env.RC_KV.delete('purchase:' + purchaseSingle[1]);
        return json({ ok: true }, 200, cors);
      }

      const purchaseMessages = path.match(/^\/purchases\/([^/]+)\/messages$/);
      if (purchaseMessages && method === 'POST') {
        const id = purchaseMessages[1];
        const key = 'purchase:' + id;
        const order = await env.RC_KV.get(key, 'json');
        if (!order) return json({ ok: false, error: 'Order not found.' }, 404, cors);

        const body = await request.json().catch(() => ({}));
        const text = String(body.text || '').trim();
        if (!text || text.length > 1000) {
          return json({ ok: false, error: 'Message must be 1-1000 characters.' }, 400, cors);
        }

        const admin = await verifyAdmin(request, env);
        const isOwner = body.token && body.token === order.token;
        if (!admin && !isOwner) {
          return json({ ok: false, error: 'Not authorized to message this order.' }, 403, cors);
        }

        order.messages.push({
          id: uid('m'),
          sender: admin ? 'admin' : 'user',
          authorName: admin ? admin.staffName : (order.username || 'Customer'),
          text: sanitize(text),
          at: new Date().toISOString()
        });
        if (admin && order.status === 'pending') order.status = 'in_progress';
        await env.RC_KV.put(key, JSON.stringify(order));
        return json({ ok: true, order: stripToken(order) }, 200, cors);
      }

      const purchaseAction = path.match(/^\/purchases\/([^/]+)\/(claim|cancel)$/);
      if (purchaseAction && method === 'POST') {
        const [, id, action] = purchaseAction;
        const key = 'purchase:' + id;
        const order = await env.RC_KV.get(key, 'json');
        if (!order) return json({ ok: false, error: 'Order not found.' }, 404, cors);

        const admin = await verifyAdmin(request, env);
        const body = await request.json().catch(() => ({}));
        const isOwner = body.token && body.token === order.token;

        if (action === 'claim') {
          if (!admin) return json({ ok: false, error: 'Staff sign-in required.' }, 401, cors);
          order.claimedBy = admin.staffName;
          order.status = order.status === 'pending' ? 'in_progress' : order.status;
        }
        if (action === 'cancel') {
          if (!admin && !isOwner) return json({ ok: false, error: 'Not authorized.' }, 403, cors);
          order.status = 'cancelled';
        }
        await env.RC_KV.put(key, JSON.stringify(order));
        return json({ ok: true, order: stripToken(order) }, 200, cors);
      }

      return json({ ok: false, error: 'Not found.' }, 404, cors);
    } catch (err) {
      return json({ ok: false, error: 'Server error: ' + err.message }, 500, cors);
    }
  }
};
