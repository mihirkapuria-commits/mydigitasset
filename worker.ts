
// @ts-nocheck

const CATEGORIES = [
  { id: 'banking-fintech', title: 'Banking and Fintech', telegramChatId: '-1004377330142' },
  { id: 'consumer-fmcg', title: 'India Consumer & FMCG', telegramChatId: '-1004356285380' },
  { id: 'economy-business', title: 'Economy and Business', telegramChatId: '-1003773612503' },
  { id: 'energy-renewal', title: 'Energy and Renewal', telegramChatId: '-1004305076677' },
  { id: 'hr-employment', title: 'HR and Employment', telegramChatId: '-1003756538856' },
  { id: 'it-ai-cybersecurity', title: 'IT AI Cybersecurity', telegramChatId: '-1004404579614' },
  { id: 'manufacturing-auto', title: 'Manufacturing and Auto', telegramChatId: '-1004328043113' },
  { id: 'marketing-advertising', title: 'Marketing and Advertising', telegramChatId: '-1003914193738' },
  { id: 'real-estate', title: 'Real Estate', telegramChatId: '-1004322510775' },
  { id: 'bollywood', title: 'Bollywood', telegramChatId: '-1004339246354' },
  { id: 'kids', title: 'Kids', telegramChatId: '-1004312693379' },
  { id: 'women', title: 'Women', telegramChatId: '-1003821497200' },
  { id: 'politics', title: 'Politics', telegramChatId: '-1004350871154' },
  { id: 'stock-market', title: 'Stock Market', telegramChatId: '-1004343493425' },
  { id: 'startup', title: 'Startup', telegramChatId: '-1003720483555' }
];

const ADMIN_EMAIL = 'mihirkapuria@gmail.com';
const PASSWORD_ITERATIONS = 100000;
const SESSION_DAYS = 30;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    }
  });
}

async function parseRequestBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function base64url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function sha256(value) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return base64url(new Uint8Array(digest));
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    salt,
    iterations: PASSWORD_ITERATIONS,
    hash: 'SHA-256'
  }, key, 256);

  return `pbkdf2$${PASSWORD_ITERATIONS}$${base64url(salt)}$${base64url(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  if (!stored || !stored.startsWith('pbkdf2$')) {
    return {
      valid: stored === password,
      needsUpgrade: stored === password
    };
  }

  try {
    const parts = stored.split('$');
    if (parts.length !== 4) return { valid: false, needsUpgrade: false };

    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) {
      return { valid: false, needsUpgrade: false };
    }

    const salt = fromBase64url(parts[2]);
    const expected = fromBase64url(parts[3]);

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits']
    );

    const bits = await crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    }, key, 256);

    const actual = new Uint8Array(bits);

    if (actual.length !== expected.length) {
      return { valid: false, needsUpgrade: false };
    }

    let difference = 0;
    for (let i = 0; i < actual.length; i++) {
      difference |= actual[i] ^ expected[i];
    }

    return { valid: difference === 0, needsUpgrade: false };
  } catch {
    return { valid: false, needsUpgrade: false };
  }
}

async function createSession(env, userId) {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const token = base64url(random);
  const tokenHash = await sha256(token);

  const expiresAt = new Date(
    Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  await env.DB.prepare(`
    INSERT INTO auth_sessions (user_id, token_hash, expires_at)
    VALUES (?, ?, ?)
  `).bind(userId, tokenHash, expiresAt).run();

  return token;
}

function getBearerToken(request) {
  const header = request.headers.get('Authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

async function getAuthenticatedUser(request, env) {
  const token = getBearerToken(request);
  if (!token) return null;

  const tokenHash = await sha256(token);

  const result = await env.DB.prepare(`
    SELECT
      u.id,
      u.first_name,
      u.surname,
      u.email,
      u.country_code,
      u.mobile_number,
      u.category,
      u.trial_expires_at,
      u.status,
      u.role,
      u.created_at,
      EXISTS (
        SELECT 1 FROM telegram_connections tc WHERE tc.user_id = u.id
      ) AS telegram_connected,
      (
        SELECT tc.telegram_username FROM telegram_connections tc
        WHERE tc.user_id = u.id LIMIT 1
      ) AS telegram_username
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
      AND s.expires_at > ?
    LIMIT 1
  `).bind(tokenHash, new Date().toISOString()).first();

  return result || null;
}

async function getAuthorizedAdmin(request, env) {
  const user = await getAuthenticatedUser(request, env);

  if (
    !user ||
    user.role !== 'admin' ||
    String(user.email || '').toLowerCase() !== ADMIN_EMAIL
  ) {
    return null;
  }

  return user;
}

function publicUser(user) {
  const category = user.category || '';
  const trialExpiry = user.trial_expires_at || '';

  let subscriptionStatus = user.status || 'trial';

  if (subscriptionStatus === 'active') {
    subscriptionStatus = 'active_paid';
  }

  return {
    id: String(user.id),
    name: `${user.first_name || ''} ${user.surname || ''}`.trim(),
    firstName: user.first_name || '',
    surname: user.surname || '',
    email: user.email,
    countryCode: user.country_code || '+91',
    mobileNumber: user.mobile_number || '',
    mobile: `${user.country_code || '+91'}${user.mobile_number || ''}`,
    role: user.role === 'admin' ? 'admin' : 'customer',
    category,
    categories: category ? [category] : [],
    trialStart: user.created_at || '',
    trialExpiry,
    trialExpiresAt: trialExpiry,
    subscriptionStatus,
    paymentStatus: 'none',
    telegramConnected: Boolean(user.telegram_connected),
    telegramUsername: user.telegram_username || '',
    createdAt: user.created_at || ''
  };
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Read the current pricing values from D1.
// There are deliberately no hardcoded customer-facing price fallbacks.
async function getPricingSettings(env) {
  const result = await env.DB.prepare(`
    SELECT setting_key, setting_value
    FROM system_settings
    WHERE setting_key IN ('monthly_price', 'gst_rate')
  `).all();

  const values = {};

  for (const row of (result.results || [])) {
    values[row.setting_key] = row.setting_value;
  }

  const monthlyPrice = Number(values.monthly_price);
  const gstRate = Number(values.gst_rate);

  if (
    !Number.isFinite(monthlyPrice) ||
    monthlyPrice <= 0 ||
    !Number.isFinite(gstRate) ||
    gstRate < 0 ||
    gstRate > 100
  ) {
    throw new Error('Monthly price or GST rate is missing or invalid in system_settings.');
  }

  const annualBasePrice = roundMoney(monthlyPrice * 12);
  const gstAmount = roundMoney(annualBasePrice * gstRate / 100);
  const totalAmount = roundMoney(annualBasePrice + gstAmount);

  return {
    monthlyPrice,
    annualBasePrice,
    gstRate,
    gstAmount,
    totalAmount
  };
}

async function saveSystemSetting(env, key, value, adminEmail) {
  await env.DB.prepare(`
    INSERT INTO system_settings (
      setting_key,
      setting_value,
      updated_at,
      updated_by
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      updated_at = excluded.updated_at,
      updated_by = excluded.updated_by
  `).bind(
    key,
    String(value),
    new Date().toISOString(),
    adminEmail
  ).run();
}

async function sendTelegramMessage(token, chatId, message, replyMarkup = null) {
  if (!token || !chatId) {
    console.error('Telegram sendMessage skipped: bot token or chat ID is missing.');
    return false;
  }

  const body = {
    chat_id: chatId,
    text: message,
    parse_mode: 'Markdown'
  };

  if (replyMarkup) body.reply_markup = replyMarkup;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok || result.ok !== true) {
      console.error('Telegram sendMessage rejected:', {
        httpStatus: response.status,
        description: result.description || 'Telegram returned an unsuccessful response.'
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error('Telegram sendMessage network failure:', String(error));
    return false;
  }
}

async function ensureTelegramTables(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS telegram_verification_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS telegram_connections (
      user_id INTEGER PRIMARY KEY,
      telegram_chat_id TEXT NOT NULL UNIQUE,
      telegram_username TEXT,
      connected_at TEXT NOT NULL
    )
  `).run();
}

async function configureTelegramWebhook(env) {
  const token = String(env.TELEGRAM_BOT_TOKEN || '');
  const secret = String(env.TELEGRAM_WEBHOOK_SECRET || '');

  if (!token || !secret) {
    throw new Error('Telegram bot token or webhook secret is not configured.');
  }

  if (!/^[A-Za-z0-9_-]{1,256}$/.test(secret)) {
    throw new Error('Telegram webhook secret must contain only letters, numbers, underscores or hyphens.');
  }

  const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: 'https://mydigitasset.com/api/telegram/webhook',
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false
    })
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok || result.ok !== true) {
    console.error('Telegram setWebhook rejected:', {
      httpStatus: response.status,
      description: result.description || 'Telegram returned an unsuccessful response.'
    });
    throw new Error(result.description || 'Telegram could not register the MyDigitAsset webhook.');
  }

  return true;
}

var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': url.origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS auth_sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token_hash TEXT NOT NULL UNIQUE,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      await ensureTelegramTables(env);

      // PUBLIC CATEGORY LIST
      if (url.pathname === '/api/categories' && method === 'GET') {
        return json(CATEGORIES);
      }

      // PUBLIC PAYMENT DETAILS AND CURRENT PRICING
      if (url.pathname === '/api/settings' && method === 'GET') {
        const settingsResult = await env.DB.prepare(`
          SELECT key, value
          FROM settings
          WHERE key IN (
            'account_name',
            'account_number',
            'bank_name',
            'upi_id'
          )
        `).all();

        const paymentSettings = {};

        for (const row of (settingsResult.results || [])) {
          paymentSettings[row.key] = row.value;
        }

        const pricing = await getPricingSettings(env);

        return json({
          accountName: paymentSettings.account_name || '',
          accountNumber: paymentSettings.account_number || '',
          bankName: paymentSettings.bank_name || '',
          upiId: paymentSettings.upi_id || '',
          ...pricing
        });
      }

      // ADMIN: READ CURRENT PRICING
      if (url.pathname === '/api/admin/pricing' && method === 'GET') {
        const admin = await getAuthorizedAdmin(request, env);

        if (!admin) {
          return json({ error: 'Administrator access required.' }, 403);
        }

        const pricing = await getPricingSettings(env);
        return json(pricing);
      }

      // ADMIN: UPDATE MONTHLY PRICE AND GST RATE
      if (url.pathname === '/api/admin/pricing' && method === 'PUT') {
        const admin = await getAuthorizedAdmin(request, env);

        if (!admin) {
          return json({ error: 'Administrator access required.' }, 403);
        }

        const data = await parseRequestBody(request);
        const monthlyPrice = Number(data.monthlyPrice);
        const gstRate = Number(data.gstRate);

        if (
          !Number.isFinite(monthlyPrice) ||
          monthlyPrice <= 0 ||
          monthlyPrice > 100000
        ) {
          return json({
            error: 'Monthly price must be greater than zero and no more than 100000.'
          }, 400);
        }

        if (
          !Number.isFinite(gstRate) ||
          gstRate < 0 ||
          gstRate > 100
        ) {
          return json({
            error: 'GST rate must be between 0 and 100.'
          }, 400);
        }

        const roundedMonthlyPrice = roundMoney(monthlyPrice);
        const roundedGstRate = roundMoney(gstRate);

        await saveSystemSetting(
          env,
          'monthly_price',
          roundedMonthlyPrice,
          admin.email
        );

        await saveSystemSetting(
          env,
          'gst_rate',
          roundedGstRate,
          admin.email
        );

        const updatedPricing = await getPricingSettings(env);

        return json({
          success: true,
          message: 'Pricing settings updated successfully.',
          ...updatedPricing
        });
      }

      // CUSTOMER REGISTRATION
      if (url.pathname === '/api/auth/register' && method === 'POST') {
        const data = await parseRequestBody(request);

        const firstName = String(data.firstName || '').trim();
        const surname = String(data.surname || '').trim();
        const email = String(data.email || '').trim().toLowerCase();
        const mobileNumber = String(data.mobileNumber || '').replace(/\D/g, '');
        const password = String(data.password || '');
        const category = String(data.category || '').trim();
        const countryCode = '+91';

        if (!firstName || !surname || !email || !mobileNumber || !password || !category) {
          return json({ error: 'Please complete all required fields.' }, 400);
        }

        if (email === ADMIN_EMAIL) {
          return json({ error: 'This email address cannot be used for public registration.' }, 403);
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return json({ error: 'Please enter a valid email address.' }, 400);
        }

        if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
          return json({ error: 'Please enter a valid 10-digit Indian mobile number.' }, 400);
        }

        if (password.length !== 8) {
          return json({ error: 'Password must be exactly 8 characters.' }, 400);
        }

        if (!CATEGORIES.some(item => item.id === category)) {
          return json({ error: 'Please select a valid news category.' }, 400);
        }

        const existing = await env.DB.prepare(
          'SELECT id FROM users WHERE lower(email) = ? LIMIT 1'
        ).bind(email).first();

        if (existing) {
          return json({ error: 'An account with this email already exists.' }, 409);
        }

        const existingMobile = await env.DB.prepare(
          'SELECT id FROM users WHERE mobile_number = ? LIMIT 1'
        ).bind(mobileNumber).first();

        if (existingMobile) {
          return json({ error: 'This mobile number is already registered.' }, 409);
        }

        const passwordHash = await hashPassword(password);
        const trialExpires = new Date(
          Date.now() + 3 * 24 * 60 * 60 * 1000
        ).toISOString();

        const insert = await env.DB.prepare(`
          INSERT INTO users (
            first_name, surname, email, country_code, mobile_number,
            password, category, trial_expires_at, status, role
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'trial', 'customer')
        `).bind(
          firstName,
          surname,
          email,
          countryCode,
          mobileNumber,
          passwordHash,
          category,
          trialExpires
        ).run();

        const userId = insert.meta.last_row_id;

        const user = await env.DB.prepare(`
          SELECT id, first_name, surname, email, country_code,
                 mobile_number, category, trial_expires_at,
                 status, role, created_at
          FROM users WHERE id = ?
        `).bind(userId).first();

        const sessionToken = await createSession(env, userId);
        const selectedCategory = CATEGORIES.find(item => item.id === category);

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          env.OWNER_TELEGRAM_CHAT_ID,
          `⏳ *New Trial Started!*\n\n` +
          `*User ID:* #${userId}\n` +
          `*Name:* ${firstName} ${surname}\n` +
          `*Mobile:* +91 ${mobileNumber}\n` +
          `*Email:* ${email}\n` +
          `*Category:* ${selectedCategory.title}`
        );

        return json({
          success: true,
          token: sessionToken,
          user: publicUser(user)
        });
      }

      // TELEGRAM: GENERATE A SINGLE-USE VERIFICATION TOKEN
      if (url.pathname === '/api/telegram/request-token' && method === 'POST') {
        const user = await getAuthenticatedUser(request, env);
        if (!user) return json({ error: 'Please sign in again.' }, 401);

        await configureTelegramWebhook(env);

        const tokenBytes = crypto.getRandomValues(new Uint8Array(24));
        const verificationToken = base64url(tokenBytes);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        await env.DB.prepare(`
          UPDATE telegram_verification_tokens
          SET used = 1
          WHERE user_id = ? AND used = 0
        `).bind(user.id).run();

        await env.DB.prepare(`
          INSERT INTO telegram_verification_tokens (token, user_id, expires_at, used)
          VALUES (?, ?, ?, 0)
        `).bind(verificationToken, user.id, expiresAt).run();

        return json({
          success: true,
          verificationToken,
          expiresAt
        });
      }

      // TELEGRAM: CHECK WHETHER THE CUSTOMER HAS VERIFIED THE BOT
      if (url.pathname === '/api/telegram/status' && method === 'GET') {
        const user = await getAuthenticatedUser(request, env);
        if (!user) return json({ error: 'Please sign in again.' }, 401);

        return json({
          configured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_WEBHOOK_SECRET),
          connected: Boolean(user.telegram_connected),
          username: user.telegram_username || ''
        });
      }

      // TELEGRAM: CONFIRM THE ONE-TIME TOKEN AFTER WEBHOOK VERIFICATION
      if (url.pathname === '/api/telegram/connect' && method === 'POST') {
        const user = await getAuthenticatedUser(request, env);
        if (!user) return json({ error: 'Please sign in again.' }, 401);

        const data = await parseRequestBody(request);
        const verificationToken = String(data.verificationToken || '').trim();

        if (!verificationToken) {
          return json({ error: 'Verification token is required.' }, 400);
        }

        const verifiedToken = await env.DB.prepare(`
          SELECT token FROM telegram_verification_tokens
          WHERE token = ? AND user_id = ? AND used = 1
            AND expires_at > ?
          LIMIT 1
        `).bind(verificationToken, user.id, new Date().toISOString()).first();

        const connection = await env.DB.prepare(`
          SELECT telegram_username FROM telegram_connections
          WHERE user_id = ? LIMIT 1
        `).bind(user.id).first();

        if (!verifiedToken || !connection) {
          return json({
            error: 'Telegram has not verified this code yet. Please send the full /verify command to the bot.'
          }, 409);
        }

        const refreshedUser = await getAuthenticatedUser(request, env);
        return json({
          success: true,
          user: publicUser(refreshedUser)
        });
      }

      // CUSTOMER LOGIN
      if (url.pathname === '/api/auth/login' && method === 'POST') {
        const data = await parseRequestBody(request);
        const email = String(data.email || '').trim().toLowerCase();
        const password = String(data.password || '');

        if (!email || !password) {
          return json({ error: 'Please enter your email and password.' }, 400);
        }

        const user = await env.DB.prepare(`
          SELECT id, first_name, surname, email, country_code,
                 mobile_number, password, category, trial_expires_at,
                 status, role, created_at
          FROM users
          WHERE lower(email) = ?
          LIMIT 1
        `).bind(email).first();

        if (!user) {
          return json({ error: 'Invalid email or password.' }, 401);
        }

        const verification = await verifyPassword(password, user.password);

        if (!verification.valid) {
          return json({ error: 'Invalid email or password.' }, 401);
        }

        if (verification.needsUpgrade) {
          const upgradedHash = await hashPassword(password);
          await env.DB.prepare(
            'UPDATE users SET password = ? WHERE id = ?'
          ).bind(upgradedHash, user.id).run();
        }

        const token = await createSession(env, user.id);

        return json({
          success: true,
          token,
          user: publicUser(user)
        });
      }

      // SECURE MOBILE NUMBER UPDATE
      if (url.pathname === '/api/profile' && method === 'PUT') {
        const authenticatedUser = await getAuthenticatedUser(request, env);

        if (!authenticatedUser) {
          return json({ error: 'Please sign in again.' }, 401);
        }

        const data = await parseRequestBody(request);
        const mobileNumber = String(data.mobileNumber || '').replace(/\D/g, '');

        if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
          return json({
            error: 'Please enter a valid 10-digit Indian mobile number.'
          }, 400);
        }

        const duplicate = await env.DB.prepare(`
          SELECT id FROM users
          WHERE mobile_number = ?
            AND id != ?
          LIMIT 1
        `).bind(mobileNumber, authenticatedUser.id).first();

        if (duplicate) {
          return json({
            error: 'This mobile number is already registered to another account.'
          }, 409);
        }

        await env.DB.prepare(`
          UPDATE users
          SET country_code = '+91',
              mobile_number = ?
          WHERE id = ?
        `).bind(mobileNumber, authenticatedUser.id).run();

        const updatedUser = await env.DB.prepare(`
          SELECT id, first_name, surname, email, country_code,
                 mobile_number, category, trial_expires_at,
                 status, role, created_at
          FROM users
          WHERE id = ?
          LIMIT 1
        `).bind(authenticatedUser.id).first();

        return json({
          success: true,
          user: publicUser(updatedUser)
        });
      }

      // VALIDATE CURRENT SESSION
      if (url.pathname === '/api/auth/me' && method === 'GET') {
        const user = await getAuthenticatedUser(request, env);

        if (!user) {
          return json({ error: 'Session expired. Please sign in again.' }, 401);
        }

        return json(publicUser(user));
      }

      // LOG OUT
      if (url.pathname === '/api/auth/logout' && method === 'POST') {
        const token = getBearerToken(request);

        if (token) {
          const tokenHash = await sha256(token);
          await env.DB.prepare(
            'DELETE FROM auth_sessions WHERE token_hash = ?'
          ).bind(tokenHash).run();
        }

        return json({ success: true });
      }

      // PASSWORD RECOVERY
      if (url.pathname === '/api/auth/reset-password' && method === 'POST') {
        const data = await parseRequestBody(request);
        const email = String(data.email || '').trim().toLowerCase();
        const mobileNumber = String(data.mobileNumber || '').replace(/\D/g, '');
        const newPassword = String(data.newPassword || '');

        if (!email || mobileNumber.length !== 10 || newPassword.length !== 8) {
          return json({
            error: 'Enter your registered email, 10-digit mobile number and an 8-character new password.'
          }, 400);
        }

        const user = await env.DB.prepare(`
          SELECT id FROM users
          WHERE lower(email) = ?
            AND mobile_number = ?
          LIMIT 1
        `).bind(email, mobileNumber).first();

        if (!user) {
          return json({
            error: 'The email and mobile number do not match our registration records.'
          }, 400);
        }

        const passwordHash = await hashPassword(newPassword);

        await env.DB.prepare(
          'UPDATE users SET password = ? WHERE id = ?'
        ).bind(passwordHash, user.id).run();

        await env.DB.prepare(
          'DELETE FROM auth_sessions WHERE user_id = ?'
        ).bind(user.id).run();

        return json({
          success: true,
          message: 'Password reset successfully. Please sign in again.'
        });
      }

      // SUBMIT PAYMENT: UTR / REFERENCE NUMBER ONLY.
      // The server calculates the amount using the current D1 pricing settings.
      if (url.pathname === '/api/auth/submit-payment' && method === 'POST') {
        const data = await parseRequestBody(request);
        const userId = Number(data.userId);
        const utrNumber = String(data.utrNumber || '').trim();

        if (!Number.isInteger(userId) || userId <= 0 || !utrNumber) {
          return json({ error: 'Missing user ID or UTR/reference number.' }, 400);
        }

        if (utrNumber.length < 6 || utrNumber.length > 100) {
          return json({ error: 'Please enter a valid UTR/reference number.' }, 400);
        }

        const authenticatedUser = await getAuthenticatedUser(request, env);

        if (!authenticatedUser || Number(authenticatedUser.id) !== userId) {
          return json({ error: 'Please sign in to submit your payment reference.' }, 401);
        }

        const user = await env.DB.prepare(`
          SELECT first_name, surname, email, mobile_number, category
          FROM users WHERE id = ?
        `).bind(userId).first();

        if (!user) {
          return json({ error: 'Customer account not found.' }, 404);
        }

        const pricing = await getPricingSettings(env);
        const paymentAmount = pricing.totalAmount;

        await env.DB.prepare(`
          INSERT INTO payments (user_id, amount, utr_number, status)
          VALUES (?, ?, ?, 'pending')
        `).bind(userId, paymentAmount, utrNumber).run();

        const selectedCategory = CATEGORIES.find(
          item => item.id === user.category
        );

        const categoryTitle = selectedCategory
          ? selectedCategory.title
          : user.category;

        const keyboard = {
          inline_keyboard: [[
            { text: '✅ Approve', callback_data: `APPROVE_${userId}` },
            { text: '❌ Stop', callback_data: `STOP_${userId}` }
          ]]
        };

        await sendTelegramMessage(
          env.TELEGRAM_BOT_TOKEN,
          env.OWNER_TELEGRAM_CHAT_ID,
          `💳 *Annual Subscription Payment Submitted!*\n\n` +
          `*User ID:* #${userId}\n` +
          `*Name:* ${user.first_name || ''} ${user.surname || ''}\n` +
          `*Mobile:* ${user.mobile_number || ''}\n` +
          `*Email:* ${user.email}\n` +
          `*Category:* ${categoryTitle}\n` +
          `*Annual Base Price:* ₹${pricing.annualBasePrice.toFixed(2)}\n` +
          `*GST (${pricing.gstRate}%):* ₹${pricing.gstAmount.toFixed(2)}\n` +
          `*Total Amount:* ₹${paymentAmount.toFixed(2)}\n` +
          `*UTR / Reference No:* \`${utrNumber}\``,
          keyboard
        );

        return json({
          success: true,
          amount: paymentAmount,
          message: 'Payment reference submitted successfully for verification.'
        });
      }

      
      // TELEGRAM WEBHOOK
      if (url.pathname === '/api/telegram/webhook' && method === 'POST') {
        // Verify Telegram's configured webhook secret.
        const configuredSecret = String(env.TELEGRAM_WEBHOOK_SECRET || '');
        const receivedSecret =
          request.headers.get('X-Telegram-Bot-Api-Secret-Token') || '';

        if (!configuredSecret || receivedSecret !== configuredSecret) {
          return json({ error: 'Unauthorized' }, 401);
        }

        const update = await parseRequestBody(request);

        // Customer verification messages are accepted only in a private chat.
        if (update.message) {
          const message = update.message;
          const chat = message.chat || {};
          const from = message.from || {};
          const messageText = String(message.text || '').trim();

          if (chat.type === 'private' && messageText.startsWith('/verify')) {
            const match = messageText.match(/^\/verify(?:@\w+)?\s+([A-Za-z0-9_-]{20,})$/);

            if (!match) {
              await sendTelegramMessage(
                env.TELEGRAM_BOT_TOKEN,
                chat.id,
                'Please send the complete one-time command copied from the MyDigitAsset website.'
              );
              return json({ ok: true });
            }

            const verificationToken = match[1];
            const tokenRow = await env.DB.prepare(`
              SELECT user_id FROM telegram_verification_tokens
              WHERE token = ? AND used = 0 AND expires_at > ?
              LIMIT 1
            `).bind(verificationToken, new Date().toISOString()).first();

            if (!tokenRow) {
              await sendTelegramMessage(
                env.TELEGRAM_BOT_TOKEN,
                chat.id,
                'This verification code is invalid, already used, or expired. Please generate a new code on the MyDigitAsset website.'
              );
              return json({ ok: true });
            }

            const telegramUsername = from.username
              ? `@${String(from.username).replace(/^@/, '')}`
              : String(from.first_name || 'Telegram user');

            await env.DB.prepare(`
              INSERT INTO telegram_connections (
                user_id, telegram_chat_id, telegram_username, connected_at
              )
              VALUES (?, ?, ?, ?)
              ON CONFLICT(user_id) DO UPDATE SET
                telegram_chat_id = excluded.telegram_chat_id,
                telegram_username = excluded.telegram_username,
                connected_at = excluded.connected_at
            `).bind(
              tokenRow.user_id,
              String(chat.id),
              telegramUsername,
              new Date().toISOString()
            ).run();

            await env.DB.prepare(`
              UPDATE telegram_verification_tokens SET used = 1
              WHERE token = ? AND used = 0
            `).bind(verificationToken).run();

            await sendTelegramMessage(
              env.TELEGRAM_BOT_TOKEN,
              chat.id,
              '✅ Your Telegram account is now securely connected to MyDigitAsset. You can return to the website.'
            );

            console.log('Telegram customer verification completed for user:', String(tokenRow.user_id));
            return json({ ok: true });
          }

          return json({ ok: true });
        }

        if (update.callback_query) {
          const callback = update.callback_query;
          const callbackData = String(callback.data || '');
          const chatId = callback.message?.chat?.id;

          // Only accept approval buttons from the configured owner chat.
          const expectedChatId = String(env.OWNER_TELEGRAM_CHAT_ID || '');

          if (!expectedChatId || String(chatId ?? '') !== expectedChatId) {
            return json({ error: 'Unauthorized' }, 403);
          }

          const match = callbackData.match(/^(APPROVE|STOP)_(\d+)$/);

          if (match) {
            const action = match[1];
            const userId = Number(match[2]);

            if (action === 'APPROVE') {
              await env.DB.prepare(
                "UPDATE users SET status = 'active' WHERE id = ?"
              ).bind(userId).run();

              await env.DB.prepare(
                "UPDATE payments SET status = 'approved' WHERE user_id = ? AND status = 'pending'"
              ).bind(userId).run();

              await sendTelegramMessage(
                env.TELEGRAM_BOT_TOKEN,
                chatId,
                `✅ Payment for customer #${userId} has been approved.`
              );
            } else {
              await env.DB.prepare(
                "UPDATE users SET status = 'stopped' WHERE id = ?"
              ).bind(userId).run();

              await env.DB.prepare(
                "UPDATE payments SET status = 'rejected' WHERE user_id = ? AND status = 'pending'"
              ).bind(userId).run();

              await sendTelegramMessage(
                env.TELEGRAM_BOT_TOKEN,
                chatId,
                `❌ Customer #${userId} has been stopped.`
              );
            }
          }
        }

        return json({ ok: true });
      }


      // SECURITY TEST ENDPOINT MUST NOT BE PUBLIC
      if (url.pathname === '/api/security-test-suite') {
        return json({ error: 'Not found' }, 404);
      }

      // SERVE WEBSITE
      if (env.ASSETS) {
        let response = await env.ASSETS.fetch(request);

        if (response.status === 404) {
          const indexUrl = new URL('/index.html', request.url);
          response = await env.ASSETS.fetch(new Request(indexUrl, request));
        }

        return response;
      }

      return json({ error: 'Not found' }, 404);

    } catch (error) {
      console.error('Worker request failed:', error);
      return json({ error: 'An unexpected server error occurred.' }, 500);
    }
  }
};

export { worker_default as default };
