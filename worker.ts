import { fetchIndiaStartupsNewsPreview, GoogleNewsRateLimitError, runIndiaStartupsNewsDelivery, sendIndiaStartupsNewsTest } from "./telegram-news";

/**
 * Standalone Cloudflare Worker Entry Point for MyDigitAsset
 * - Uses Cloudflare Workers Static Assets (env.ASSETS) to serve frontend SPA
 * - Routes /api/* requests to serverless backend handling Cloudflare D1 (env.DB)
 */

interface Env {
  DB: any;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  GEMINI_API_KEY?: string;
  NEWS_TEST_SECRET?: string;
  ADMIN_INITIAL_PASSWORD?: string;
  ALLOWED_REDIRECT_DOMAINS?: string;
}

type ExecutionContext = any;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Secure, idempotent one-time administrator bootstrap using ADMIN_INITIAL_PASSWORD secret
    await ensureAdminInitialized(env);

    // Route API requests under /api/*
    if (pathname.startsWith('/api/')) {
      return handleApiRequest(request, env);
    }

    // Serve static assets for frontend SPA
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status === 404 && !pathname.includes('.')) {
        const indexRequest = new Request(new URL('/', request.url), request);
        return await env.ASSETS.fetch(indexRequest);
      }
      return assetResponse;
    } catch (e) {
      const indexRequest = new Request(new URL('/', request.url), request);
      return await env.ASSETS.fetch(indexRequest);
    }
  },

  async scheduled(_controller: any, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runIndiaStartupsNewsDelivery(env));
  }
};

// Idempotent & safe first-admin initialization checked via settings table
async function ensureAdminInitialized(env: Env) {
  if (!env.ADMIN_INITIAL_PASSWORD) return;
  const initFlag = await env.DB.prepare("SELECT value FROM settings WHERE key = 'admin_initialized'").first();
  if (initFlag && initFlag.value === 'true') {
    return; // Already initialized securely; skip processing bootstrap secret on subsequent requests
  }

  const adminEmail = 'mihirkapuria@gmail.com';
  const existingAdmin = await env.DB.prepare('SELECT id, password_hash FROM users WHERE email = ?').bind(adminEmail).first();
  
  if (existingAdmin && existingAdmin.password_hash && existingAdmin.password_hash !== 'UNINITIALIZED') {
    // Admin already exists with password; do not reset password on subsequent requests
    await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_initialized', 'true')").run();
    return;
  }

  const passwordHash = await hashPassword(env.ADMIN_INITIAL_PASSWORD);
  const now = new Date().toISOString();
  const trialExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  if (existingAdmin) {
    await env.DB.prepare('UPDATE users SET password_hash = ?, role = ? WHERE email = ?').bind(passwordHash, 'admin', adminEmail).run();
  } else {
    // Created with minimum necessary account info (no fabricated mobile, payment status 'none', subscription 'trial')
    await env.DB.prepare(`
      INSERT INTO users (id, name, email, mobile, password_hash, role, category, categories, trial_start, trial_expiry, subscription_status, payment_status, access_override, telegram_connected, telegram_username, telegram_chat_id, created_at)
      VALUES ('admin-bootstrap-1', 'Mihir Kapuria', ?, '', ?, 'admin', 'startups', '["startups"]', ?, ?, 'trial', 'none', 0, 0, '', '', ?)
    `).bind(adminEmail, passwordHash, now, trialExpiry, now).run();
  }

  await env.DB.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('admin_initialized', 'true')").run();
}

function secretsMatch(supplied: string, expected: string): boolean {
  if (!supplied || supplied.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < supplied.length; index++) {
    difference |= supplied.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:100000:${saltHex}:${hashHex}`;
}

// Indian Standard Time (IST, UTC+5:30) Calendar Date Calculation Helper (supporting leap-year, month-end, and year-end cases)
function calculateIstSubscriptionDates(confirmationDate = new Date()): { startIso: string; expiryIso: string } {
  const utcMs = confirmationDate.getTime();
  const istOffsetMs = 330 * 60 * 1000;
  const istDate = new Date(utcMs + istOffsetMs);

  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth();
  const day = istDate.getUTCDate();

  // Next calendar day in IST
  const nextDayDate = new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0));
  const startUtcMs = nextDayDate.getTime() - istOffsetMs;

  // Corresponding calendar anniversary one year later (year + 1) with leap year check (Feb 29 -> Feb 28 if non-leap)
  const targetYear = nextDayDate.getUTCFullYear() + 1;
  const targetMonth = nextDayDate.getUTCMonth();
  const targetDay = nextDayDate.getUTCDate();

  let expiryDate: Date;
  if (targetMonth === 1 && targetDay === 29) {
    const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
    if (!isLeap) {
      expiryDate = new Date(Date.UTC(targetYear, 1, 28, 0, 0, 0, 0));
    } else {
      expiryDate = new Date(Date.UTC(targetYear, targetMonth, targetDay, 0, 0, 0, 0));
    }
  } else {
    expiryDate = new Date(Date.UTC(targetYear, targetMonth, targetDay, 0, 0, 0, 0));
  }

  const expiryUtcMs = expiryDate.getTime() - istOffsetMs;

  return {
    startIso: new Date(startUtcMs).toISOString(),
    expiryIso: new Date(expiryUtcMs).toISOString()
  };
}

async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathSegments = url.pathname.replace(/^\/api\//, '').split('/');
  const route = pathSegments.join('/');
  const method = request.method;

  const json = (data: any, status = 200, extraHeaders: Record<string, string> = {}) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        ...extraHeaders
      }
    });
  };

  async function verifyPassword(password: string, storedHash: string): Promise<{ valid: boolean; needsUpgrade: boolean }> {
    if (!storedHash || storedHash === 'UNINITIALIZED') return { valid: false, needsUpgrade: false };

    if (storedHash.startsWith('pbkdf2:')) {
      const parts = storedHash.split(':');
      if (parts.length !== 4) return { valid: false, needsUpgrade: false };
      const iterations = parseInt(parts[1], 10);
      const saltHex = parts[2];
      const originalHashHex = parts[3];

      const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));

      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );

      const derivedBits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: iterations,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );

      const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
      return { valid: hashHex === originalHashHex, needsUpgrade: false };
    } else {
      const msgUint8 = new TextEncoder().encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const legacyHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return { valid: legacyHex === storedHash, needsUpgrade: legacyHex === storedHash };
    }
  }

  async function getAuthUser(req: Request): Promise<any | null> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    
    const session = await env.DB.prepare('SELECT user_id, expires_at FROM sessions WHERE token = ?').bind(token).first();
    if (!session) return null;

    if (session.expires_at && new Date(session.expires_at) < new Date()) {
      await env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
      return null;
    }

    const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first();
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role,
      category: user.category,
      categories: JSON.parse(user.categories || '["' + user.category + '"]'),
      trialStart: user.trial_start,
      trialExpiry: user.trial_expiry,
      subscriptionStatus: user.subscription_status,
      paymentStatus: user.payment_status,
      accessOverride: user.access_override === 1,
      telegramConnected: user.telegram_connected === 1,
      telegramUsername: user.telegram_username,
      telegramChatId: user.telegram_chat_id || '',
      createdAt: user.created_at
    };
  }

  try {
    // 1. GET /api/categories
    if (route === 'categories' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT id, title, description, base_price, gst_rate, active FROM categories WHERE active = 1').all();
      return json(results.map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        basePrice: c.base_price,
        gstRate: c.gst_rate,
        active: c.active === 1
      })));
    }

    // 2. GET /api/settings
    if (route === 'settings' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
      const settingsMap: any = {};
      for (const row of results) {
        settingsMap[row.key] = row.value;
      }
      return json({
        bankName: settingsMap.bank_name || '',
        accountName: settingsMap.account_name || '',
        accountNumber: settingsMap.account_number || '',
        ifscCode: settingsMap.ifsc_code || '',
        upiId: settingsMap.upi_id || ''
      });
    }

    // 3. GET /api/telegram/status
    if (route === 'telegram/status' && method === 'GET') {
      const isConfigured = Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_BOT_TOKEN.length > 5);
      const user = await getAuthUser(request);
      return json({
        configured: isConfigured,
        connected: user ? user.telegramConnected : false,
        username: user ? user.telegramUsername : ''
      });
    }

    // GET /api/news/eligibility
    if (route === 'news/eligibility' && method === 'GET') {
      const user = await getAuthUser(request);
      if (!user) return json({ error: 'Unauthorized' }, 401);

      const categoryId = url.searchParams.get('categoryId') || user.category;

      if (user.accessOverride) {
        return json({ authorized: true, reason: 'access_override' });
      }

      const sub = await env.DB.prepare('SELECT * FROM user_subscriptions WHERE user_id = ? AND category_id = ?')
        .bind(user.id, categoryId).first();

      const now = new Date();
      let authorized = false;
      let reason = 'expired';

      if (sub) {
        if (sub.access_override === 1) {
          authorized = true;
          reason = 'access_override';
        } else if (sub.status === 'active_paid' && sub.subscription_expiry && now < new Date(sub.subscription_expiry)) {
          authorized = true;
          reason = 'annual_subscription';
        } else if (sub.status === 'trial' && sub.trial_expiry && now < new Date(sub.trial_expiry)) {
          authorized = true;
          reason = 'active_trial';
        }
      } else {
        if (categoryId === user.category) {
          if (user.subscriptionStatus === 'active_paid' || now < new Date(user.trialExpiry)) {
            authorized = true;
            reason = user.subscriptionStatus === 'active_paid' ? 'annual_subscription' : 'active_trial';
          }
        }
      }

      return json({ authorized, reason });
    }

    // 4. POST /api/auth/register
    if (route === 'auth/register' && method === 'POST') {
      const body = await request.json() as any;
      const { name, email, mobile, password, category } = body;
      if (!name || !email || !mobile || !password || !category) {
        return json({ error: 'Missing required registration fields or category selection' }, 400);
      }

      const normalizedEmail = email.toLowerCase().trim();
      if (normalizedEmail === 'mihirkapuria@gmail.com') {
        return json({ error: 'Registration using reserved administrator identity is not permitted.' }, 403);
      }

      const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(normalizedEmail).first();
      if (existing) {
        return json({ error: 'Email address is already registered.' }, 400);
      }

      const userId = 'user-' + crypto.randomUUID().slice(0, 8);
      const passwordHash = await hashPassword(password);
      const role = 'customer';
      const now = new Date().toISOString();
      const trialExpiry = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

      await env.DB.prepare(`
        INSERT INTO users (id, name, email, mobile, password_hash, role, category, categories, trial_start, trial_expiry, subscription_status, payment_status, access_override, telegram_connected, telegram_username, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'trial', 'none', 0, 0, '', ?)
      `).bind(userId, name, normalizedEmail, mobile, passwordHash, role, category, JSON.stringify([category]), now, trialExpiry, now).run();

      await env.DB.prepare(`
        INSERT OR IGNORE INTO user_subscriptions (id, user_id, category_id, status, trial_start, trial_expiry, access_override)
        VALUES (?, ?, ?, 'trial', ?, ?, 0)
      `).bind('sub-' + crypto.randomUUID().slice(0, 8), userId, category, now, trialExpiry).run();

      const token = crypto.randomUUID() + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, userId, expiresAt).run();

      const user = {
        id: userId,
        name,
        email: normalizedEmail,
        mobile,
        role,
        category,
        categories: [category],
        trialStart: now,
        trialExpiry,
        subscriptionStatus: 'trial',
        paymentStatus: 'none',
        accessOverride: false,
        telegramConnected: false,
        telegramUsername: '',
        createdAt: now
      };

      return json({ token, user });
    }

    // 5. POST /api/auth/login
    if (route === 'auth/login' && method === 'POST') {
      const body = await request.json() as any;
      const { email, password } = body;
      if (!email || !password) {
        return json({ error: 'Email and password are required' }, 400);
      }

      const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase().trim()).first();
      if (!user) {
        return json({ error: 'Invalid email or password' }, 401);
      }

      const verification = await verifyPassword(password, user.password_hash);
      if (!verification.valid) {
        return json({ error: 'Invalid email or password' }, 401);
      }

      if (verification.needsUpgrade) {
        const upgradedHash = await hashPassword(password);
        await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(upgradedHash, user.id).run();
      }

      const token = crypto.randomUUID() + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await env.DB.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').bind(token, user.id, expiresAt).run();

      const safeUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        category: user.category,
        categories: JSON.parse(user.categories || '["' + user.category + '"]'),
        trialStart: user.trial_start,
        trialExpiry: user.trial_expiry,
        subscriptionStatus: user.subscription_status,
        paymentStatus: user.payment_status,
        accessOverride: user.access_override === 1,
        telegramConnected: user.telegram_connected === 1,
        telegramUsername: user.telegram_username,
        createdAt: user.created_at
      };

      return json({ token, user: safeUser });
    }

    // 6. GET /api/auth/me
    if (route === 'auth/me' && method === 'GET') {
      const user = await getAuthUser(request);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      return json(user);
    }

    // 7. POST /api/auth/recover (Self-service recovery disabled)
    if (route === 'auth/recover' && method === 'POST') {
      return json({ error: 'Self-service password recovery is disabled for security. Please contact the administrator at mihirkapuria@gmail.com for manual account recovery.' }, 400);
    }

    // 8. PUT /api/profile
    if (route === 'profile' && method === 'PUT') {
      const user = await getAuthUser(request);
      if (!user) return json({ error: 'Unauthorized' }, 401);

      const body = await request.json() as any;
      const { mobile } = body;
      if (!mobile) return json({ error: 'Mobile number is required' }, 400);

      await env.DB.prepare('UPDATE users SET mobile = ? WHERE id = ?').bind(mobile, user.id).run();
      const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();

      return json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        mobile: updated.mobile,
        role: updated.role,
        category: updated.category,
        categories: JSON.parse(updated.categories || '["' + updated.category + '"]'),
        trialStart: updated.trial_start,
        trialExpiry: updated.trial_expiry,
        subscriptionStatus: updated.subscription_status,
        paymentStatus: updated.payment_status,
        accessOverride: updated.access_override === 1,
        telegramConnected: updated.telegram_connected === 1,
        telegramUsername: updated.telegram_username,
        createdAt: updated.created_at
      });
    }

    // 9a. POST /api/telegram/request-token
    if (route === 'telegram/request-token' && method === 'POST') {
      const user = await getAuthUser(request);
      if (!user) return json({ error: 'Unauthorized' }, 401);
      if (!env.TELEGRAM_BOT_TOKEN) {
        return json({ error: 'Telegram Bot verification is not configured by the administrator.' }, 400);
      }
      const token = 'tg-' + crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      await env.DB.prepare('INSERT INTO telegram_tokens (token, user_id, expires_at, used) VALUES (?, ?, ?, 0)')
        .bind(token, user.id, expiresAt).run();
      return json({ success: true, verificationToken: token, expiresInMinutes: 10 });
    }

    // 9b. POST /api/telegram/webhook (Received from Telegram Bot)
    if (route === 'telegram/webhook' && method === 'POST') {
      const secretHeader = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
      if (!env.TELEGRAM_WEBHOOK_SECRET || secretHeader !== env.TELEGRAM_WEBHOOK_SECRET) {
        return json({ error: 'Unauthorized webhook request: missing or incorrect secret token header.' }, 401);
      }
      if (!env.TELEGRAM_BOT_TOKEN) {
        return json({ error: 'Telegram bot token not configured' }, 400);
      }
      const update = await request.json() as any;
      if (update && update.message && update.message.text) {
        const text = update.message.text.trim();
        const chatId = String(update.message.chat.id);
        const username = update.message.from?.username ? '@' + update.message.from.username : (update.message.from?.first_name || 'user');

        const parts = text.split(/\s+/);
        if (parts.length >= 2 && parts[0].toLowerCase() === '/verify') {
          const verifyToken = parts[1];
          const tokenRecord = await env.DB.prepare('SELECT * FROM telegram_tokens WHERE token = ? AND used = 0').bind(verifyToken).first();
          if (tokenRecord && new Date(tokenRecord.expires_at) > new Date()) {
            await env.DB.prepare('UPDATE telegram_tokens SET used = 1 WHERE token = ?').bind(verifyToken).run();
            await env.DB.prepare('UPDATE users SET telegram_connected = 1, telegram_username = ?, telegram_chat_id = ? WHERE id = ?')
              .bind(username, chatId, tokenRecord.user_id).run();
          }
        }
      }
      return json({ ok: true });
    }

    // 9c. POST /api/telegram/connect (Confirms verification if token was redeemed by bot webhook)
    if (route === 'telegram/connect' && method === 'POST') {
      const user = await getAuthUser(request);
      if (!user) return json({ error: 'Unauthorized' }, 401);

      if (!env.TELEGRAM_BOT_TOKEN) {
        return json({ error: 'Telegram Bot verification is not configured by the administrator.' }, 400);
      }

      const body = await request.json() as any;
      const { verificationToken } = body;
      if (!verificationToken) {
        return json({ error: 'Verification token is required.' }, 400);
      }

      const tokenRecord = await env.DB.prepare('SELECT * FROM telegram_tokens WHERE token = ? AND user_id = ?').bind(verificationToken, user.id).first();
      if (!tokenRecord || tokenRecord.used !== 1) {
        return json({ error: 'Telegram verification pending or token already consumed.' }, 400);
      }

      await env.DB.prepare('UPDATE telegram_tokens SET used = 2 WHERE token = ?').bind(verificationToken).run();

      const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();

      return json({
        success: true,
        user: {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          mobile: updated.mobile,
          role: updated.role,
          category: updated.category,
          categories: JSON.parse(updated.categories || '["' + updated.category + '"]'),
          trialStart: updated.trial_start,
          trialExpiry: updated.trial_expiry,
          subscriptionStatus: updated.subscription_status,
          paymentStatus: updated.payment_status,
          accessOverride: updated.access_override === 1,
          telegramConnected: updated.telegram_connected === 1,
          telegramUsername: updated.telegram_username,
          telegramChatId: updated.telegram_chat_id || '',
          createdAt: updated.created_at
        },
        message: 'Telegram account successfully verified.'
      });
    }

    // 10. POST /api/payments/submit
    if (route === 'payments/submit' && method === 'POST') {
      const user = await getAuthUser(request);
      if (!user) return json({ error: 'Unauthorized' }, 401);

      const body = await request.json() as any;
      const { categoryId, utr, notes } = body;
      if (!utr || !categoryId) return json({ error: 'Category selection and payment UTR reference number are required' }, 400);

      const category = await env.DB.prepare('SELECT id, base_price, gst_rate FROM categories WHERE id = ? AND active = 1').bind(categoryId).first();
      if (!category) return json({ error: 'Selected category not found or inactive' }, 404);

      const amountBase = parseFloat(category.base_price);
      const gstRate = parseFloat(category.gst_rate);
      const gst = parseFloat((amountBase * (gstRate / 100)).toFixed(2));
      const totalAmount = parseFloat((amountBase + gst).toFixed(2));

      const paymentId = 'pay-' + crypto.randomUUID().slice(0, 8);
      const now = new Date().toISOString();

      await env.DB.prepare(`
        INSERT INTO payments (id, user_id, user_name, user_email, category_id, amount_base, gst, total_amount, utr, notes, status, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `).bind(paymentId, user.id, user.name, user.email, categoryId, amountBase, gst, totalAmount, utr, notes || 'UPI payment submission', now).run();

      await env.DB.prepare('UPDATE users SET payment_status = ? WHERE id = ?').bind('pending', user.id).run();

      const paymentRecord = {
        id: paymentId,
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        categoryId,
        amountBase,
        gst,
        totalAmount,
        utr,
        notes: notes || 'UPI payment submission',
        status: 'pending',
        submittedAt: now
      };

      return json({ success: true, payment: paymentRecord, message: 'Payment UTR submitted successfully. Awaiting manual administrator verification.' });
    }

    // 11. GET /api/payments
    if (route === 'payments' && method === 'GET') {
      const user = await getAuthUser(request);
      if (!user) return json({ error: 'Unauthorized' }, 401);

      const { results } = await env.DB.prepare('SELECT * FROM payments WHERE user_id = ?').bind(user.id).all();
      return json(results.map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        userName: p.user_name,
        userEmail: p.user_email,
        categoryId: p.category_id,
        amountBase: p.amount_base,
        gst: p.gst,
        totalAmount: p.total_amount,
        utr: p.utr,
        notes: p.notes,
        status: p.status,
        submittedAt: p.submitted_at,
        verifiedAt: p.verified_at,
        verifiedBy: p.verified_by
      })));
    }

    // Read-only Google News RSS preview; protected by the separate Cloudflare test secret.
    // This route never calls Gemini or Telegram.
    if (route === 'test/india-startups-rss' && method === 'GET') {
      const configuredSecret = env.NEWS_TEST_SECRET;
      const suppliedSecret = request.headers.get('x-news-test-secret') || '';
      if (!configuredSecret || !secretsMatch(suppliedSecret, configuredSecret)) {
        return json({ error: 'Unauthorized' }, 401);
      }

      try {
        const articles = await fetchIndiaStartupsNewsPreview(env);
        return json({
          success: true,
          source: 'Google News RSS',
          count: articles.length,
          articles
        });
      } catch (error: any) {
        if (error instanceof GoogleNewsRateLimitError) {
          return json(
            { error: error.message, retryAfterSeconds: error.retryAfterSeconds },
            429,
            { 'Retry-After': String(error.retryAfterSeconds) }
          );
        }
        return json({ error: error?.message || 'Google News RSS preview failed.' }, 500);
      }
    }

    // Temporary one-time India Startups digest test, protected by a separate Cloudflare secret.
    if (route === 'test/india-startups-news' && method === 'POST') {
      const configuredSecret = env.NEWS_TEST_SECRET;
      const suppliedSecret = request.headers.get('x-news-test-secret') || '';
      if (!configuredSecret || !secretsMatch(suppliedSecret, configuredSecret)) {
        return json({ error: 'Unauthorized' }, 401);
      }

      try {
        const messageId = await sendIndiaStartupsNewsTest(env);
        return json({ success: true, messageId, message: 'Test news digest sent to the India Startups Telegram channel.' });
      } catch (error: any) {
        if (error instanceof GoogleNewsRateLimitError) {
          return json(
            { error: error.message, retryAfterSeconds: error.retryAfterSeconds },
            429,
            { 'Retry-After': String(error.retryAfterSeconds) }
          );
        }
        return json({ error: error?.message || 'India Startups test delivery failed.' }, 500);
      }
    }

    // One-time India Startups digest test; restricted to the authorized administrator.
    if (route === 'admin/test-india-startups-news' && method === 'POST') {
      const user = await getAuthUser(request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required' }, 403);
      }

      try {
        const messageId = await sendIndiaStartupsNewsTest(env);
        return json({ success: true, messageId, message: 'Test news digest sent to the India Startups Telegram channel.' });
      } catch (error: any) {
        if (error instanceof GoogleNewsRateLimitError) {
          return json(
            { error: error.message, retryAfterSeconds: error.retryAfterSeconds },
            429,
            { 'Retry-After': String(error.retryAfterSeconds) }
          );
        }
        return json({ error: error?.message || 'India Startups test delivery failed.' }, 500);
      }
    }

    // --- Administrator Routes ---
    if (route === 'admin/customers' && method === 'GET') {
      const user = await getAuthUser(request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required for mihirkapuria@gmail.com' }, 403);
      }

      const { results } = await env.DB.prepare('SELECT * FROM users').all();
      return json(results.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        mobile: u.mobile,
        role: u.role,
        category: u.category,
        categories: JSON.parse(u.categories || '["' + u.category + '"]'),
        trialStart: u.trial_start,
        trialExpiry: u.trial_expiry,
        subscriptionStatus: u.subscription_status,
        paymentStatus: u.payment_status,
        accessOverride: u.access_override === 1,
        telegramConnected: u.telegram_connected === 1,
        telegramUsername: u.telegram_username,
        createdAt: u.created_at
      })));
    }

    // Manual access override (Changes ONLY access_override and its audit log; leaves payment_status, subscription_status, trial_start and trial_expiry untouched)
    if (pathSegments[0] === 'admin' && pathSegments[1] === 'customers' && pathSegments[2] && pathSegments[3] === 'access' && method === 'POST') {
      const user = await getAuthUser(request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required for mihirkapuria@gmail.com' }, 403);
      }

      const targetUserId = pathSegments[2];
      const body = await request.json() as any;
      const { grantAccess } = body;

      const targetUser = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(targetUserId).first();
      if (!targetUser) return json({ error: 'Customer not found' }, 404);

      const overrideVal = grantAccess ? 1 : 0;

      await env.DB.prepare('UPDATE users SET access_override = ? WHERE id = ?')
        .bind(overrideVal, targetUserId).run();

      const now = new Date().toISOString();
      const auditAction = grantAccess ? 'ACCESS_OVERRIDE_GRANTED' : 'ACCESS_OVERRIDE_REVOKED';
      await env.DB.prepare(`
        INSERT INTO audit_logs (id, timestamp, admin_email, action, details)
        VALUES (?, ?, ?, ?, ?)
      `).bind('log-' + crypto.randomUUID().slice(0, 8), now, user.email, auditAction, `Manual access override ${grantAccess ? 'granted' : 'revoked'} for user ${targetUser.email}`).run();

      const updated = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(targetUserId).first();
      return json({ success: true, user: updated });
    }

    if (pathSegments[0] === 'admin' && pathSegments[1] === 'customers' && pathSegments[2] && pathSegments[3] === 'reset-password' && method === 'POST') {
      const user = await getAuthUser(request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required' }, 403);
      }

      const targetUserId = pathSegments[2];
      const body = await request.json() as any;
      const { newPassword } = body;
      if (!newPassword) return json({ error: 'New password is required' }, 400);

      const targetUser = await env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(targetUserId).first();
      if (!targetUser) return json({ error: 'Customer not found' }, 404);

      const newHash = await hashPassword(newPassword);
      await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(newHash, targetUserId).run();

      const now = new Date().toISOString();
      await env.DB.prepare(`
        INSERT INTO audit_logs (id, timestamp, admin_email, action, details)
        VALUES (?, ?, ?, 'ADMIN_PASSWORD_RESET', ?)
      `).bind('log-' + crypto.randomUUID().slice(0, 8), now, user.email, `Administrator reset password for customer ${targetUser.email}`).run();

      return json({ success: true, message: 'Password successfully reset by administrator.' });
    }

    if (route === 'admin/payments' && method === 'GET') {
      const user = await getAuthUser(request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required for mihirkapuria@gmail.com' }, 403);
      }

      const { results } = await env.DB.prepare('SELECT * FROM payments').all();
      return json(results.map((p: any) => ({
        id: p.id,
        userId: p.user_id,
        userName: p.user_name,
        userEmail: p.user_email,
        categoryId: p.category_id,
        amountBase: p.amount_base,
        gst: p.gst,
        totalAmount: p.total_amount,
        utr: p.utr,
        notes: p.notes,
        status: p.status,
        submittedAt: p.submitted_at,
        verifiedAt: p.verified_at,
        verifiedBy: p.verified_by
      })));
    }

    // Payment verification: IST calendar-date subscription start & anniversary expiry calculations
    if (pathSegments[0] === 'admin' && pathSegments[1] === 'payments' && pathSegments[2] && pathSegments[3] === 'verify' && method === 'POST') {
      const user = await getAuthUser(request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required for mihirkapuria@gmail.com' }, 403);
      }

      const paymentId = pathSegments[2];
      const body = await request.json() as any;
      const action = body.action;

      const payment = await env.DB.prepare('SELECT * FROM payments WHERE id = ?').bind(paymentId).first();
      if (!payment) return json({ error: 'Payment not found' }, 404);

      if (payment.status === 'verified') {
        return json({ error: 'Verified payments cannot be approved again.' }, 400);
      }
      if (payment.status === 'rejected' && action === 'approve') {
        return json({ error: 'Rejected payments cannot be approved without a proper new payment process.' }, 400);
      }

      const now = new Date();
      const istDates = calculateIstSubscriptionDates(now);
      const nowIso = now.toISOString();

      if (action === 'approve') {
        await env.DB.prepare('UPDATE payments SET status = ?, verified_at = ?, verified_by = ? WHERE id = ?')
          .bind('verified', nowIso, user.email, paymentId).run();
        
        await env.DB.prepare('UPDATE users SET payment_status = ?, subscription_status = ?, trial_start = ?, trial_expiry = ? WHERE id = ?')
          .bind('verified', 'active_paid', istDates.startIso, istDates.expiryIso, payment.user_id).run();

        await env.DB.prepare(`
          INSERT INTO user_subscriptions (id, user_id, category_id, status, trial_start, trial_expiry, subscription_start, subscription_expiry, access_override)
          VALUES (?, ?, ?, 'active_paid', ?, ?, ?, ?, 0)
          ON CONFLICT(user_id, category_id) DO UPDATE SET
            status = 'active_paid',
            subscription_start = excluded.subscription_start,
            subscription_expiry = excluded.subscription_expiry
        `).bind('sub-' + crypto.randomUUID().slice(0, 8), payment.user_id, payment.category_id, nowIso, nowIso, istDates.startIso, istDates.expiryIso).run();

        await env.DB.prepare(`
          INSERT INTO audit_logs (id, timestamp, admin_email, action, details)
          VALUES (?, ?, ?, 'PAYMENT_APPROVED', ?)
        `).bind('log-' + crypto.randomUUID().slice(0, 8), nowIso, user.email, `Approved payment ${paymentId} (UTR: ${payment.utr}) for user ${payment.user_email}. IST Start: ${istDates.startIso}, Expiry: ${istDates.expiryIso}`).run();
      } else if (action === 'reject') {
        await env.DB.prepare('UPDATE payments SET status = ?, verified_at = ?, verified_by = ? WHERE id = ?')
          .bind('rejected', nowIso, user.email, paymentId).run();
        await env.DB.prepare('UPDATE users SET payment_status = ? WHERE id = ?')
          .bind('rejected', payment.user_id).run();

        await env.DB.prepare(`
          INSERT INTO audit_logs (id, timestamp, admin_email, action, details)
          VALUES (?, ?, ?, 'PAYMENT_REJECTED', ?)
        `).bind('log-' + crypto.randomUUID().slice(0, 8), nowIso, user.email, `Rejected payment ${paymentId} (UTR: ${payment.utr}) for user ${payment.user_email}`).run();
      } else {
        return json({ error: 'Invalid action' }, 400);
      }

      const updatedPayment = await env.DB.prepare('SELECT * FROM payments WHERE id = ?').bind(paymentId).first();
      return json({ success: true, payment: updatedPayment });
    }

    if (route === 'admin/categories' && method === 'GET') {
      const user = await getAuthUser(request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required' }, 403);
      }
      const { results } = await env.DB.prepare('SELECT * FROM categories').all();
      return json(results.map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        basePrice: c.base_price,
        gstRate: c.gst_rate,
        active: c.active === 1
      })));
    }

    if (route === 'admin/categories' && method === 'POST') {
      const user = await getAuthUser(request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required' }, 403);
      }
      const body = await request.json() as any;
      const { id, title, description, basePrice, gstRate, active } = body;
      if (!id || !title || !description) return json({ error: 'Missing category fields' }, 400);

      const bp = basePrice !== undefined ? parseFloat(basePrice) : 252.00;
      const gr = gstRate !== undefined ? parseFloat(gstRate) : 18.00;

      await env.DB.prepare('INSERT OR REPLACE INTO categories (id, title, description, base_price, gst_rate, active) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(id, title, description, bp, gr, active !== false ? 1 : 0).run();

      return json({ success: true, category: { id, title, description, basePrice: bp, gstRate: gr, active: active !== false } });
    }

    if (route === 'admin/settings' && method === 'GET') {
      const user = await getAuthUser(request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required' }, 403);
      }
      const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
      const settingsMap: any = {};
      for (const row of results) {
        settingsMap[row.key] = row.value;
      }
      return json(settingsMap);
    }

    if (route === 'admin/settings' && method === 'PUT') {
      const user = await getAuthUser(request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required' }, 403);
      }
      const body = await request.json() as any;
      for (const [key, value] of Object.entries(body)) {
        await env.DB.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
          .bind(key, String(value)).run();
      }
      return json({ success: true, message: 'Settings successfully updated.' });
    }

    if (route === 'admin/audit-logs' && method === 'GET') {
      const user = await getAuthUser(request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required for mihirkapuria@gmail.com' }, 403);
      }

      const { results } = await env.DB.prepare('SELECT * FROM audit_logs ORDER BY timestamp DESC').all();
      return json(results);
    }

    if (route === 'admin/export-csv' && method === 'GET') {
      const user = await getAuthUser(request);
      if (!user || user.email !== 'mihirkapuria@gmail.com' || user.role !== 'admin') {
        return json({ error: 'Forbidden: Administrator privileges required for mihirkapuria@gmail.com' }, 403);
      }

      const { results: users } = await env.DB.prepare('SELECT id, name, email, mobile, role, category, trial_start, trial_expiry, subscription_status, payment_status, access_override, telegram_connected, telegram_username, created_at FROM users').all();
      const { results: payments } = await env.DB.prepare('SELECT id, user_email, total_amount, utr, status, submitted_at, verified_at FROM payments').all();

      let csv = '=== CUSTOMERS & SUBSCRIPTIONS ===\n';
      csv += 'ID,Name,Email,Mobile,Role,Category,Trial Start (UTC),Trial Expiry (UTC),Subscription Status,Payment Status,Access Override,Telegram Connected,Telegram Username,Created At (UTC)\n';
      for (const u of (users as any[])) {
        csv += `"${u.id}","${u.name}","${u.email}","${u.mobile}","${u.role}","${u.category}","${u.trial_start}","${u.trial_expiry}","${u.subscription_status}","${u.payment_status}",${u.access_override},${u.telegram_connected},"${u.telegram_username || ''}","${u.created_at}"\n`;
      }

      csv += '\n=== PAYMENTS ===\n';
      csv += 'Payment ID,User Email,Total Amount (INR),UTR Reference,Status,Submitted At (UTC),Verified At (UTC)\n';
      for (const p of (payments as any[])) {
        csv += `"${p.id}","${p.user_email}",${p.total_amount},"${p.utr}","${p.status}","${p.submitted_at}","${p.verified_at || ''}"\n`;
      }

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="mydigitasset_export_' + new Date().toISOString().slice(0, 10) + '.csv"'
        }
      });
    }

    if (route === 'track' && method === 'GET') {
      const token = url.searchParams.get('t');
      if (!token) return new Response('Invalid tracking token', { status: 400 });

      const click = await env.DB.prepare('SELECT c.target_url FROM ad_clicks a JOIN ad_campaigns c ON a.campaign_id = c.id WHERE a.tracking_token = ?').bind(token).first();
      if (!click) return new Response('Campaign link not found or expired', { status: 404 });

      const targetUrl = click.target_url;
      if (!targetUrl) return new Response('Unsafe redirect destination', { status: 400 });

      const defaultAllowedDomains = ['mydigitasset.com', 'www.mydigitasset.com'];
      const envAllowed = env.ALLOWED_REDIRECT_DOMAINS ? env.ALLOWED_REDIRECT_DOMAINS.split(',').map((d: string) => d.trim()) : [];
      const allowedDomains = [...defaultAllowedDomains, ...envAllowed];

      let parsedTarget: URL;
      try {
        parsedTarget = new URL(targetUrl);
      } catch {
        return new Response('Malformed redirect destination URL', { status: 400 });
      }

      if (!allowedDomains.includes(parsedTarget.hostname.toLowerCase())) {
        return new Response('Forbidden: Redirect destination domain is not on the approved allowlist', { status: 403 });
      }

      return Response.redirect(parsedTarget.toString(), 302);
    }

    return json({ error: 'Not found' }, 404);
  } catch (err: any) {
    return json({ error: err.message || 'Internal server error' }, 500);
  }
}
