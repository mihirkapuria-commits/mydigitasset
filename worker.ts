// @ts-nocheck

import { runAllCategoryNewsDeliveries, sendIndiaStartupsNewsTest } from "./telegram-news";

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
  const now = new Date().toISOString();

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
  `).bind(tokenHash, now).first();

  // A legacy password session must never authenticate the administrator.
  if (result && !(
    result.role === 'admin' &&
    String(result.email || '').toLowerCase() === ADMIN_EMAIL
  )) {
    return result;
  }

  const adminSession = await env.DB.prepare(`
    SELECT email, google_sub, created_at
    FROM admin_google_sessions
    WHERE token_hash = ? AND expires_at > ?
    LIMIT 1
  `).bind(tokenHash, now).first();

  if (!adminSession || String(adminSession.email || '').toLowerCase() !== ADMIN_EMAIL) {
    return null;
  }

  return {
    id: 'google-admin',
    first_name: 'Mihir',
    surname: 'Kapuria',
    email: ADMIN_EMAIL,
    country_code: '+91',
    mobile_number: '',
    category: '',
    trial_expires_at: '',
    status: 'active',
    role: 'admin',
    created_at: adminSession.created_at || now,
    telegram_connected: 0,
    telegram_username: ''
  };
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

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS customer_telegram_notification_log (
      notification_key TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      notification_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sending',
      sent_at TEXT,
      updated_at TEXT NOT NULL
    )
  `).run();

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS customer_subscription_periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
}

async function sendCustomerTelegramNotification(env, userId, notificationKey, notificationType, message) {
  const connection = await env.DB.prepare(
    "SELECT telegram_chat_id FROM telegram_connections WHERE user_id = ? LIMIT 1"
  ).bind(userId).first();
  if (!connection?.telegram_chat_id) {
    console.log("Customer Telegram notification skipped: customer is not connected.", String(userId), notificationType);
    return false;
  }

  const now = new Date().toISOString();
  const inserted = await env.DB.prepare(`
    INSERT OR IGNORE INTO customer_telegram_notification_log
      (notification_key, user_id, notification_type, status, updated_at)
    VALUES (?, ?, ?, 'sending', ?)
  `).bind(notificationKey, userId, notificationType, now).run();

  if (Number(inserted?.meta?.changes || 0) !== 1) {
    const prior = await env.DB.prepare(
      "SELECT status, updated_at FROM customer_telegram_notification_log WHERE notification_key = ?"
    ).bind(notificationKey).first();
    const staleSending = prior?.status === "sending" &&
      Date.now() - Date.parse(String(prior.updated_at || "")) > 15 * 60 * 1000;
    if (prior?.status !== "failed" && !staleSending) return false;
    const retry = await env.DB.prepare(`
      UPDATE customer_telegram_notification_log
      SET status = 'sending', updated_at = ?
      WHERE notification_key = ? AND (status = 'failed' OR (status = 'sending' AND updated_at = ?))
    `).bind(now, notificationKey, prior.updated_at).run();
    if (Number(retry?.meta?.changes || 0) !== 1) return false;
  }

  const sent = await sendTelegramMessage(
    env.TELEGRAM_BOT_TOKEN,
    connection.telegram_chat_id,
    message
  );
  await env.DB.prepare(`
    UPDATE customer_telegram_notification_log
    SET status = ?, sent_at = ?, updated_at = ?
    WHERE notification_key = ?
  `).bind(sent ? "sent" : "failed", sent ? new Date().toISOString() : null,
    new Date().toISOString(), notificationKey).run();
  return sent;
}

function getIndiaDateKey(date) {
  const parts = getIndiaDateTimeParts(date);
  return parts.year + "-" + parts.month + "-" + parts.day;
}

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = String(dateKey).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.getUTCFullYear() + "-" +
    String(date.getUTCMonth() + 1).padStart(2, "0") + "-" +
    String(date.getUTCDate()).padStart(2, "0");
}

function formatIndiaDate(date) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "long", year: "numeric"
  }).format(date);
}

async function sendScheduledCustomerReminders(env) {
  await ensureTelegramTables(env);
  const today = getIndiaDateKey(new Date());

  const trials = await env.DB.prepare(`
    SELECT id, first_name, trial_expires_at
    FROM users
    WHERE role = 'customer' AND status = 'trial' AND trial_expires_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM payments p
        WHERE p.user_id = users.id AND p.status = 'pending'
      )
  `).all();

  for (const user of (trials.results || [])) {
    const expiryDate = new Date(user.trial_expires_at);
    if (Number.isNaN(expiryDate.getTime()) || getIndiaDateKey(expiryDate) !== today) continue;
    await sendCustomerTelegramNotification(
      env,
      user.id,
      "trial-payment-reminder:" + user.id + ":" + today,
      "trial_payment_reminder",
      "⏰ *Your MyDigitAsset free trial ends today.*\n\nTo continue receiving your selected category's daily news in its Telegram channel, please complete the annual subscription payment from the MyDigitAsset dashboard.\n\nOpen: https://mydigitasset.com/\n\nDaily news and promotional messages are posted in category channels only. Account and payment updates are sent here."
    );
  }

  const periods = await env.DB.prepare(`
    SELECT user_id, MAX(expires_at) AS expires_at
    FROM customer_subscription_periods
    GROUP BY user_id
  `).all();

  for (const period of (periods.results || [])) {
    const expiryDate = new Date(period.expires_at);
    if (Number.isNaN(expiryDate.getTime())) continue;
    const renewalNoticeDate = addDaysToDateKey(getIndiaDateKey(expiryDate), -7);
    if (renewalNoticeDate !== today) continue;
    await sendCustomerTelegramNotification(
      env,
      period.user_id,
      "subscription-renewal:" + period.user_id + ":" + String(period.expires_at),
      "subscription_renewal",
      "🔔 *Your MyDigitAsset annual subscription is due for renewal in 7 days.*\n\nCurrent access ends on *" + formatIndiaDate(expiryDate) + "* . To avoid interruption, please renew from the MyDigitAsset dashboard.\n\nOpen: https://mydigitasset.com/\n\nDaily news and promotional messages continue to appear in category channels only."
    );
  }
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



async function hasDatabaseColumn(env, tableName, columnName) {
  const allowedTables = ['payments', 'user_subscriptions', 'categories'];
  if (!allowedTables.includes(tableName)) return false;
  const result = await env.DB.prepare('PRAGMA table_info(' + tableName + ')').all();
  return (result.results || []).some(column => column.name === columnName);
}

function randomId(prefix) {
  return prefix + "_" + base64url(crypto.getRandomValues(new Uint8Array(18)));
}

function getIndiaDateTimeParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const values = {};
  for (const part of parts) values[part.type] = part.value;
  return values;
}

function nextPromotionDate(date = new Date()) {
  const p = getIndiaDateTimeParts(date);
  let year = Number(p.year);
  let month = Number(p.month);
  const day = Number(p.day);
  const time = p.hour + ":" + p.minute;
  let targetDay;
  if (day < 14 || (day === 14 && time < "06:15")) {
    targetDay = 14;
  } else if (day < 28 || (day === 28 && time < "06:15")) {
    targetDay = 28;
  } else {
    targetDay = 14;
    month += 1;
    if (month > 12) { month = 1; year += 1; }
  }
  return String(year).padStart(4, "0") + "-" +
    String(month).padStart(2, "0") + "-" +
    String(targetDay).padStart(2, "0");
}

function makeAffiliateDestination(rawUrl, parameterName, trackingCode) {
  try {
    const destination = new URL(String(rawUrl || ""));
    const parameter = String(parameterName || "").trim();
    if (parameter) destination.searchParams.set(parameter, trackingCode);
    return destination.toString();
  } catch {
    return String(rawUrl || "");
  }
}

async function sendPromotionToChannel(env, campaign, channel, delivery) {
  const token = String(env.TELEGRAM_BOT_TOKEN || "");
  if (!token) throw new Error("Telegram bot token is not configured.");
  const trackedUrl = "https://mydigitasset.com/api/affiliate/click?code=" +
    encodeURIComponent(delivery.tracking_code);
  const text = [campaign.message_text || "", campaign.affiliate_disclosure || ""]
    .filter(Boolean).join("\n\n");
  const replyMarkup = campaign.affiliate_url ? {
    inline_keyboard: [[{
      text: campaign.link_label || "View Offer",
      url: trackedUrl
    }]]
  } : undefined;
  const imageUrl = String(campaign.image_url || "").trim();
  let endpoint;
  let payload;
  if (imageUrl) {
    endpoint = "sendPhoto";
    payload = {
      chat_id: channel.telegram_chat_id,
      photo: imageUrl,
      caption: text.slice(0, 1024),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    };
  } else {
    endpoint = "sendMessage";
    payload = {
      chat_id: channel.telegram_chat_id,
      text: text.slice(0, 4096),
      disable_web_page_preview: false,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    };
  }
  const response = await fetch("https://api.telegram.org/bot" + token + "/" + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok !== true) {
    throw new Error(String(result.description || "Telegram rejected the promotional message."));
  }
  return String(result.result?.message_id || "");
}

async function runDuePromotionCampaigns(env) {
  const today = getIndiaDateTimeParts().year + "-" +
    getIndiaDateTimeParts().month + "-" + getIndiaDateTimeParts().day;
  const campaign = await env.DB.prepare(`
    SELECT * FROM promo_campaigns
    WHERE status = 'approved' AND scheduled_for = ?
    ORDER BY updated_at DESC
    LIMIT 1
  `).bind(today).first();
  if (!campaign) return;

  const channelsResult = await env.DB.prepare(`
    SELECT id, title, telegram_chat_id
    FROM managed_categories
    WHERE active = 1 AND telegram_chat_id <> ''
    ORDER BY display_order, title
  `).all();
  const channels = channelsResult.results || [];
  if (!channels.length) {
    console.error("Promotion skipped: no active Telegram channels are configured.");
    return;
  }

  for (const channel of channels) {
    let delivery = await env.DB.prepare(`
      SELECT * FROM promo_deliveries
      WHERE campaign_id = ? AND channel_id = ?
      LIMIT 1
    `).bind(campaign.id, String(channel.telegram_chat_id)).first();

    if (delivery?.status === "sent") continue;

    if (!delivery) {
      const trackingCode = base64url(crypto.getRandomValues(new Uint8Array(24)));
      const deliveryId = randomId("pd");
      await env.DB.prepare(`
        INSERT OR IGNORE INTO promo_deliveries
          (id, campaign_id, channel_id, channel_name, status, tracking_code, attempts)
        VALUES (?, ?, ?, ?, 'pending', ?, 0)
      `).bind(deliveryId, campaign.id, String(channel.telegram_chat_id),
        channel.title, trackingCode).run();

      await env.DB.prepare(`
        INSERT OR IGNORE INTO affiliate_tracking_links
          (tracking_code, campaign_id, product_name, source_type, source_id, outbound_url, created_at)
        VALUES (?, ?, ?, 'telegram', ?, ?, ?)
      `).bind(trackingCode, campaign.id, campaign.product_name || campaign.campaign_name,
        String(channel.id), makeAffiliateDestination(campaign.affiliate_url, campaign.tracking_parameter, trackingCode), new Date().toISOString()).run();

      delivery = await env.DB.prepare(`
        SELECT * FROM promo_deliveries
        WHERE campaign_id = ? AND channel_id = ?
        LIMIT 1
      `).bind(campaign.id, String(channel.telegram_chat_id)).first();
    }

    try {
      if (!campaign.affiliate_url) {
        throw new Error("Campaign has no affiliate destination URL.");
      }
      const messageId = await sendPromotionToChannel(env, campaign, channel, delivery);
      await env.DB.prepare(`
        UPDATE promo_deliveries
        SET status = 'sent', telegram_message_id = ?, error_message = NULL,
            attempts = attempts + 1, delivered_at = ?, updated_at = ?
        WHERE id = ?
      `).bind(messageId, new Date().toISOString(), new Date().toISOString(), delivery.id).run();
    } catch (error) {
      await env.DB.prepare(`
        UPDATE promo_deliveries
        SET status = 'failed', error_message = ?, attempts = attempts + 1, updated_at = ?
        WHERE id = ?
      `).bind(String(error?.message || error).slice(0, 500),
        new Date().toISOString(), delivery.id).run();
      console.error("Promotion delivery failed for channel " + channel.title + ":", String(error));
    }
  }

  const remaining = await env.DB.prepare(`
    SELECT COUNT(*) AS count FROM promo_deliveries
    WHERE campaign_id = ? AND status <> 'sent'
  `).bind(campaign.id).first();
  if (Number(remaining?.count || 0) === 0) {
    await env.DB.prepare(`
      UPDATE promo_campaigns SET status = 'sent', sent_at = ?, updated_at = ?
      WHERE id = ? AND status = 'approved'
    `).bind(new Date().toISOString(), new Date().toISOString(), campaign.id).run();
  }
}

var worker_default = {
  async scheduled(controller, env, ctx) {
    // The 07:15 IST cron sends private customer account reminders.
    if (String(controller.cron || "") === "45 1 * * *") {
      ctx.waitUntil(sendScheduledCustomerReminders(env));
      return;
    }

    // The 06:15 IST run sends the daily digests; the 06:45 IST run retries failed category deliveries.
    // Daily news is delivered to active category channels only, never to individual customers.
    const channelsResult = await env.DB.prepare(`
      SELECT id, title, telegram_chat_id
      FROM managed_categories
      WHERE active = 1 AND telegram_chat_id IS NOT NULL AND telegram_chat_id <> ''
      ORDER BY display_order, title
    `).all();
    ctx.waitUntil(runAllCategoryNewsDeliveries(env, channelsResult.results || []));

    // Existing channel-only promotional campaigns remain scheduled for the 14th and 28th.
    const parts = getIndiaDateTimeParts();
    if (parts.day === "14" || parts.day === "28") {
      ctx.waitUntil(runDuePromotionCampaigns(env));
    }
  },

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

      // Isolated Google OAuth state, one-time handoff codes and administrator sessions.
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS admin_oauth_states (
          state_hash TEXT PRIMARY KEY,
          code_verifier TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS admin_oauth_handoffs (
          code_hash TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          google_sub TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          used_at TEXT
        )
      `).run();
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS admin_google_sessions (
          token_hash TEXT PRIMARY KEY,
          email TEXT NOT NULL,
          google_sub TEXT NOT NULL,
          expires_at TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      await ensureTelegramTables(env);

      // ADMINISTRATOR GOOGLE OAUTH: start authorization with state + PKCE.
      if (url.pathname === '/api/auth/google/login' && method === 'GET') {
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
          return json({ error: 'Google administrator sign-in is not configured on the server.' }, 503);
        }

        const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
        const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
        const challenge = await sha256(verifier);
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

        await env.DB.prepare(
          'DELETE FROM admin_oauth_states WHERE expires_at <= ?'
        ).bind(new Date().toISOString()).run();
        await env.DB.prepare(`
          INSERT INTO admin_oauth_states (state_hash, code_verifier, expires_at)
          VALUES (?, ?, ?)
        `).bind(await sha256(state), verifier, expiresAt).run();

        const redirectUri = 'https://mydigitasset.com/api/auth/google/callback';
        const googleUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        googleUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
        googleUrl.searchParams.set('redirect_uri', redirectUri);
        googleUrl.searchParams.set('response_type', 'code');
        googleUrl.searchParams.set('scope', 'openid email profile');
        googleUrl.searchParams.set('state', state);
        googleUrl.searchParams.set('code_challenge', challenge);
        googleUrl.searchParams.set('code_challenge_method', 'S256');
        googleUrl.searchParams.set('prompt', 'select_account');

        return Response.redirect(googleUrl.toString(), 302);
      }

      // GOOGLE OAUTH CALLBACK: verify Google's signed identity before creating a one-time handoff.
      if (url.pathname === '/api/auth/google/callback' && method === 'GET') {
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
          return json({ error: 'Google administrator sign-in is not configured on the server.' }, 503);
        }

        const oauthError = url.searchParams.get('error');
        if (oauthError) return json({ error: 'Google sign-in was cancelled or denied.' }, 400);

        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        if (!code || !state) return json({ error: 'Google sign-in response is incomplete.' }, 400);

        const stateHash = await sha256(state);
        const stateRecord = await env.DB.prepare(`
          DELETE FROM admin_oauth_states
          WHERE state_hash = ? AND expires_at > ?
          RETURNING code_verifier
        `).bind(stateHash, new Date().toISOString()).first();

        if (!stateRecord?.code_verifier) {
          return json({ error: 'Google sign-in expired or could not be verified. Please try again.' }, 400);
        }

        const redirectUri = 'https://mydigitasset.com/api/auth/google/callback';
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code_verifier: stateRecord.code_verifier
          })
        });

        if (!tokenResponse.ok) {
          console.error('Google OAuth token exchange failed:', tokenResponse.status);
          return json({ error: 'Google could not complete sign-in. Please try again.' }, 401);
        }

        const tokenData = await tokenResponse.json();
        if (!tokenData.id_token) {
          return json({ error: 'Google did not return a verified identity.' }, 401);
        }

        const tokenInfoUrl = new URL('https://oauth2.googleapis.com/tokeninfo');
        tokenInfoUrl.searchParams.set('id_token', tokenData.id_token);
        const identityResponse = await fetch(tokenInfoUrl.toString());
        if (!identityResponse.ok) {
          return json({ error: 'Google identity verification failed.' }, 401);
        }

        const identity = await identityResponse.json();
        const verifiedEmail = String(identity.email || '').trim().toLowerCase();
        const emailVerified = identity.email_verified === true || identity.email_verified === 'true';
        const tokenExpiry = Number(identity.exp);

        if (
          identity.aud !== env.GOOGLE_CLIENT_ID ||
          (identity.iss !== 'accounts.google.com' && identity.iss !== 'https://accounts.google.com') ||
          !Number.isFinite(tokenExpiry) ||
          tokenExpiry <= Math.floor(Date.now() / 1000) ||
          !emailVerified ||
          verifiedEmail !== ADMIN_EMAIL ||
          !identity.sub
        ) {
          return json({ error: 'This Google account is not authorized to access the administrator portal.' }, 403);
        }

        const handoffCode = base64url(crypto.getRandomValues(new Uint8Array(32)));
        const handoffExpiry = new Date(Date.now() + 2 * 60 * 1000).toISOString();
        await env.DB.prepare(
          'DELETE FROM admin_oauth_handoffs WHERE expires_at <= ? OR used_at IS NOT NULL'
        ).bind(new Date().toISOString()).run();
        await env.DB.prepare(`
          INSERT INTO admin_oauth_handoffs (code_hash, email, google_sub, expires_at)
          VALUES (?, ?, ?, ?)
        `).bind(await sha256(handoffCode), ADMIN_EMAIL, String(identity.sub), handoffExpiry).run();

        const returnUrl = new URL('/', 'https://mydigitasset.com');
        returnUrl.searchParams.set('admin_oauth_code', handoffCode);
        return Response.redirect(returnUrl.toString(), 302);
      }

      // Exchange the short-lived, one-use browser handoff for an 8-hour admin bearer session.
      if (url.pathname === '/api/auth/google/session' && method === 'POST') {
        const data = await parseRequestBody(request);
        const handoffCode = String(data.code || '');
        if (!handoffCode) return json({ error: 'Administrator sign-in code is missing.' }, 400);

        const handoff = await env.DB.prepare(`
          UPDATE admin_oauth_handoffs
          SET used_at = ?
          WHERE code_hash = ? AND expires_at > ? AND used_at IS NULL
          RETURNING email, google_sub
        `).bind(
          new Date().toISOString(),
          await sha256(handoffCode),
          new Date().toISOString()
        ).first();

        if (!handoff || String(handoff.email || '').toLowerCase() !== ADMIN_EMAIL) {
          return json({ error: 'Administrator sign-in code expired or was already used. Please try again.' }, 401);
        }

        const sessionToken = base64url(crypto.getRandomValues(new Uint8Array(32)));
        const sessionExpiry = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
        await env.DB.prepare(`
          INSERT INTO admin_google_sessions (token_hash, email, google_sub, expires_at)
          VALUES (?, ?, ?, ?)
        `).bind(await sha256(sessionToken), ADMIN_EMAIL, handoff.google_sub, sessionExpiry).run();

        return json({
          success: true,
          token: sessionToken,
          user: {
            id: 'google-admin',
            name: 'Mihir Kapuria',
            firstName: 'Mihir',
            surname: 'Kapuria',
            email: ADMIN_EMAIL,
            countryCode: '+91',
            mobileNumber: '',
            mobile: '',
            role: 'admin',
            category: '',
            categories: [],
            trialStart: '',
            trialExpiry: '',
            trialExpiresAt: '',
            subscriptionStatus: 'active_paid',
            paymentStatus: 'verified',
            telegramConnected: false,
            telegramUsername: '',
            createdAt: new Date().toISOString()
          }
        });
      }

      // PUBLIC CATEGORY LIST — database-backed so admin-managed categories appear automatically.
      if (url.pathname === '/api/categories' && method === 'GET') {
        const result = await env.DB.prepare(`
          SELECT id, title, description, telegram_chat_id AS telegramChatId, active
          FROM managed_categories WHERE active = 1
          ORDER BY display_order, title
        `).all();
        return json(result.results || []);
      }


      // PUBLIC CMS CONTENT: only published items are visible on the website.
      if (url.pathname.startsWith('/api/site-content/') && method === 'GET') {
        const section = decodeURIComponent(url.pathname.split('/').pop() || '');
        if (!['offers', 'utilities', 'how-it-works', 'faq'].includes(section)) {
          return json({ error: 'Unknown website section.' }, 404);
        }
        const result = await env.DB.prepare(`
          SELECT id, section_key AS section, title, summary, body, image_url AS imageUrl,
                 target_url AS targetUrl, metadata_json AS metadataJson, display_order AS displayOrder
          FROM site_content_items
          WHERE section_key = ? AND status = 'published'
          ORDER BY display_order, created_at DESC
        `).bind(section).all();
        return json(result.results || []);
      }

      if (url.pathname === '/api/blog' && method === 'GET') {
        const result = await env.DB.prepare(`
          SELECT id, title, slug, excerpt, body, featured_image_url AS featuredImageUrl,
                 seo_title AS seoTitle, seo_description AS seoDescription, published_at AS publishedAt
          FROM blog_articles WHERE status = 'published'
          ORDER BY published_at DESC, created_at DESC
        `).all();
        return json(result.results || []);
      }

      if (url.pathname === '/api/tools' && method === 'GET') {
        const result = await env.DB.prepare(`
          SELECT id, title, description, target_url AS targetUrl, icon_name AS iconName,
                 display_order AS displayOrder
          FROM site_tools WHERE status = 'published'
          ORDER BY display_order, created_at DESC
        `).all();
        return json(result.results || []);
      }

      if (url.pathname === '/api/adsense' && method === 'GET') {
        const result = await env.DB.prepare(`
          SELECT placement_key AS placementKey, enabled, client_id AS clientId, slot_id AS slotId
          FROM adsense_slots WHERE enabled = 1
        `).all();
        return json(result.results || []);
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

      // ADMIN: USER AND CUSTOMER MANAGEMENT
      // "User" means no verified paid history; "Customer" means a verified payment
      // or an admin-created paid subscription. The internal auth role stays unchanged.
      if (url.pathname === '/api/admin/customers' && method === 'GET') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);

        const result = await env.DB.prepare(`
          SELECT u.id, u.first_name, u.surname, u.email, u.country_code, u.mobile_number,
                 u.category, u.trial_expires_at, u.status, u.role, u.created_at,
                 EXISTS (
                   SELECT 1 FROM telegram_connections tc WHERE tc.user_id = u.id
                 ) AS telegram_connected,
                 (
                   SELECT tc.telegram_username FROM telegram_connections tc
                   WHERE tc.user_id = u.id LIMIT 1
                 ) AS telegram_username,
                 EXISTS (
                   SELECT 1 FROM payments p
                   WHERE p.user_id = u.id AND lower(p.status) IN ('approved', 'verified')
                 ) OR EXISTS (
                   SELECT 1 FROM customer_subscription_periods sp WHERE sp.user_id = u.id
                 ) AS has_paid_history,
                 (
                   SELECT lower(p.status) FROM payments p
                   WHERE p.user_id = u.id ORDER BY p.rowid DESC LIMIT 1
                 ) AS latest_payment_status,
                 (
                   SELECT MAX(sp.expires_at) FROM customer_subscription_periods sp
                   WHERE sp.user_id = u.id
                 ) AS subscription_expires_at
          FROM users u
          WHERE lower(u.email) <> ?
          ORDER BY u.created_at DESC
        `).bind(ADMIN_EMAIL).all();

        return json((result.results || []).map(user => ({
          ...publicUser(user),
          accountType: Number(user.has_paid_history) === 1 ? 'customer' : 'user',
          paymentStatus: user.latest_payment_status === 'approved'
            ? 'verified'
            : (user.latest_payment_status || 'none'),
          subscriptionExpiry: user.subscription_expires_at || ''
        })));
      }

      // ADMIN: CSV EXPORT. Never include passwords, hashes, tokens or session data.
      if (url.pathname === '/api/admin/customers/export.csv' && method === 'GET') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const exportType = url.searchParams.get('type') === 'customers' ? 'Customer' :
          (url.searchParams.get('type') === 'users' ? 'User' : '');
        const result = await env.DB.prepare(`
          SELECT u.id, u.first_name, u.surname, u.email, u.country_code, u.mobile_number,
                 u.category, u.status, u.created_at, u.trial_expires_at,
                 CASE WHEN EXISTS (
                   SELECT 1 FROM payments p
                   WHERE p.user_id = u.id AND lower(p.status) IN ('approved', 'verified')
                 ) OR EXISTS (
                   SELECT 1 FROM customer_subscription_periods sp WHERE sp.user_id = u.id
                 ) THEN 'Customer' ELSE 'User' END AS account_type,
                 (SELECT lower(p.status) FROM payments p WHERE p.user_id = u.id
                  ORDER BY p.rowid DESC LIMIT 1) AS payment_status,
                 (SELECT MAX(sp.expires_at) FROM customer_subscription_periods sp
                  WHERE sp.user_id = u.id) AS subscription_expires_at,
                 CASE WHEN EXISTS (
                   SELECT 1 FROM telegram_connections tc WHERE tc.user_id = u.id
                 ) THEN 'Connected' ELSE 'Not connected' END AS telegram_status
          FROM users u
          WHERE lower(u.email) <> ?
            AND (? = '' OR (CASE WHEN EXISTS (
              SELECT 1 FROM payments p
              WHERE p.user_id = u.id AND lower(p.status) IN ('approved', 'verified')
            ) OR EXISTS (
              SELECT 1 FROM customer_subscription_periods sp WHERE sp.user_id = u.id
            ) THEN 'Customer' ELSE 'User' END) = ?)
          ORDER BY u.id ASC
        `).bind(ADMIN_EMAIL, exportType, exportType).all();
        const columns = [
          ['ID','id'],['Account Type','account_type'],['First Name','first_name'],
          ['Surname','surname'],['Email','email'],['Country Code','country_code'],
          ['Mobile','mobile_number'],['Category','category'],['Account Status','status'],
          ['Payment Status','payment_status'],['Registration Date','created_at'],
          ['Trial Expiry','trial_expires_at'],['Paid Subscription Expiry','subscription_expires_at'],
          ['Telegram','telegram_status']
        ];
        const csvCell = value => {
          let text = value == null ? '' : String(value);
          if (/^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
          return '"' + text.replace(/"/g, '""') + '"';
        };
        const csv = [
          columns.map(c => csvCell(c[0])).join(','),
          ...(result.results || []).map(row => columns.map(c => csvCell(row[c[1]])).join(','))
        ].join('\r\n');
        return new Response(csv, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="mydigitasset-accounts.csv"',
            'Cache-Control': 'no-store'
          }
        });
      }

      // ADMIN: CREATE USER OR PAID CUSTOMER. New accounts must set their own password
      // through the existing email + registered-mobile recovery process.
      if (url.pathname === '/api/admin/customers' && method === 'POST') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const data = await parseRequestBody(request);
        const firstName = String(data.firstName || '').trim();
        const surname = String(data.surname || '').trim();
        const email = String(data.email || '').trim().toLowerCase();
        const mobile = String(data.mobileNumber || '').replace(/\D/g, '');
        const category = String(data.category || '').trim();
        const accountType = data.accountType === 'customer' ? 'customer' : 'user';
        if (!firstName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            !/^[6-9]\d{9}$/.test(mobile) || !category) {
          return json({ error: 'Enter a first name, valid email, valid 10-digit mobile number and category.' }, 400);
        }
        if (email === ADMIN_EMAIL) return json({ error: 'The administrator identity cannot be added as a user.' }, 403);
        const duplicate = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ? LIMIT 1').bind(email).first();
        if (duplicate) return json({ error: 'An account with this email already exists.' }, 409);

        const pricing = accountType === 'customer' ? await getPricingSettings(env) : null;
        const randomPassword = base64url(crypto.getRandomValues(new Uint8Array(32)));
        const passwordHash = await hashPassword(randomPassword);
        const now = new Date();
        const trialExpiry = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
        const inserted = await env.DB.prepare(`
          INSERT INTO users (first_name, surname, email, country_code, mobile_number,
                             password, category, trial_expires_at, status, role)
          VALUES (?, ?, ?, '+91', ?, ?, ?, ?, ?, 'customer')
        `).bind(firstName, surname, email, mobile, passwordHash, category,
          accountType === 'user' ? trialExpiry : null,
          accountType === 'customer' ? 'active' : 'trial').run();
        const userId = Number(inserted.meta?.last_row_id || 0);
        if (accountType === 'customer') {
          await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS customer_subscription_periods (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              started_at TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
          `).run();
          const expiry = new Date(now);
          expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
          await env.DB.prepare(`
            INSERT INTO customer_subscription_periods (user_id, started_at, expires_at)
            VALUES (?, ?, ?)
          `).bind(userId, now.toISOString(), expiry.toISOString()).run();
          const adminReference = 'ADMIN-MANUAL-' + userId + '-' + Date.now();
          await env.DB.prepare(`
            INSERT INTO payments (user_id, amount, utr_number, status)
            VALUES (?, ?, ?, 'approved')
          `).bind(userId, pricing.totalAmount, adminReference).run();
        }
        await env.DB.prepare(`
          INSERT INTO audit_logs (timestamp, admin_email, action, details)
          VALUES (?, ?, ?, ?)
        `).bind(new Date().toISOString(), admin.email, 'account_created',
          'Created ' + accountType + ' account ID ' + userId).run();
        return json({ success: true, id: String(userId), accountType,
          message: 'Account created. The account holder must use Forgot Password with their registered email and mobile number to create their own password.' }, 201);
      }

      // ADMIN: EDIT ACCOUNT DETAILS. Payment and subscription records are not altered here.
      const editCustomerMatch = url.pathname.match(/^\/api\/admin\/customers\/(\d+)$/);
      if (editCustomerMatch && method === 'PUT') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const userId = Number(editCustomerMatch[1]);
        const data = await parseRequestBody(request);
        const firstName = String(data.firstName || '').trim();
        const surname = String(data.surname || '').trim();
        const email = String(data.email || '').trim().toLowerCase();
        const mobile = String(data.mobileNumber || '').replace(/\D/g, '');
        const category = String(data.category || '').trim();
        if (!firstName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
            !/^[6-9]\d{9}$/.test(mobile) || !category) {
          return json({ error: 'Enter a first name, valid email, valid 10-digit mobile number and category.' }, 400);
        }
        if (email === ADMIN_EMAIL) return json({ error: 'The administrator identity cannot be assigned to a customer account.' }, 403);
        const duplicate = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ? AND id <> ? LIMIT 1').bind(email, userId).first();
        if (duplicate) return json({ error: 'Another account already uses this email.' }, 409);
        const updated = await env.DB.prepare(`
          UPDATE users SET first_name = ?, surname = ?, email = ?,
            country_code = '+91', mobile_number = ?, category = ?
          WHERE id = ? AND lower(email) <> ?
        `).bind(firstName, surname, email, mobile, category, userId, ADMIN_EMAIL).run();
        if (Number(updated.meta?.changes || 0) !== 1) return json({ error: 'Account not found.' }, 404);
        await env.DB.prepare(`
          INSERT INTO audit_logs (timestamp, admin_email, action, details)
          VALUES (?, ?, ?, ?)
        `).bind(new Date().toISOString(), admin.email, 'account_updated',
          'Updated account ID ' + userId).run();
        return json({ success: true, message: 'Account details updated.' });
      }

      // ADMIN: PERMANENTLY DELETE AN ACCOUNT AND ITS USER-OWNED RECORDS.
      const deleteCustomerMatch = url.pathname.match(/^\/api\/admin\/customers\/(\d+)$/);
      if (deleteCustomerMatch && method === 'DELETE') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const userId = Number(deleteCustomerMatch[1]);
        const existing = await env.DB.prepare(
          'SELECT id FROM users WHERE id = ? AND lower(email) <> ? LIMIT 1'
        ).bind(userId, ADMIN_EMAIL).first();
        if (!existing) return json({ error: 'Account not found.' }, 404);
        await env.DB.batch([
          env.DB.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(userId),
          env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(String(userId)),
          env.DB.prepare('DELETE FROM delivery_logs WHERE user_id = ?').bind(String(userId)),
          env.DB.prepare('DELETE FROM telegram_link_tokens WHERE user_id = ?').bind(String(userId)),
          env.DB.prepare('DELETE FROM telegram_verification_tokens WHERE user_id = ?').bind(userId),
          env.DB.prepare('DELETE FROM telegram_connections WHERE user_id = ?').bind(userId),
          env.DB.prepare('DELETE FROM customer_telegram_notification_log WHERE user_id = ?').bind(userId),
          env.DB.prepare('DELETE FROM customer_subscription_periods WHERE user_id = ?').bind(userId),
          env.DB.prepare('DELETE FROM subscriptions WHERE user_id = ?').bind(userId),
          env.DB.prepare('DELETE FROM category_access WHERE user_id = ?').bind(userId),
          env.DB.prepare('DELETE FROM payments WHERE user_id = ?').bind(userId),
          env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId)
        ]);
        await env.DB.prepare(`
          INSERT INTO audit_logs (timestamp, admin_email, action, details)
          VALUES (?, ?, ?, ?)
        `).bind(new Date().toISOString(), admin.email, 'account_deleted',
          'Permanently deleted account ID ' + userId + ' and associated records').run();
        return json({ success: true, message: 'Account and associated database records deleted.' });
      }

      // ADMIN: PRESERVE THE EXISTING APPROVE / STOP CONTROLS.
      const statusCustomerMatch = url.pathname.match(/^\/api\/admin\/customers\/(\d+)\/status$/);
      if (statusCustomerMatch && method === 'POST') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const userId = Number(statusCustomerMatch[1]);
        const data = await parseRequestBody(request);
        const requestedStatus = String(data.status || '');
        const status = requestedStatus === 'active_paid' ? 'active' : requestedStatus;
        if (!['active', 'trial', 'stopped'].includes(status)) {
          return json({ error: 'Unsupported account status.' }, 400);
        }
        const existing = await env.DB.prepare(
          'SELECT id FROM users WHERE id = ? AND lower(email) <> ? LIMIT 1'
        ).bind(userId, ADMIN_EMAIL).first();
        if (!existing) return json({ error: 'Account not found.' }, 404);
        await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, userId).run();
        if (status === 'active') {
          await env.DB.prepare(`
            CREATE TABLE IF NOT EXISTS customer_subscription_periods (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              started_at TEXT NOT NULL,
              expires_at TEXT NOT NULL,
              created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
          `).run();
          const current = await env.DB.prepare(
            'SELECT MAX(expires_at) AS expires_at FROM customer_subscription_periods WHERE user_id = ?'
          ).bind(userId).first();
          if (!current?.expires_at || new Date(current.expires_at) <= new Date()) {
            const start = new Date();
            const expiry = new Date(start);
            expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
            await env.DB.prepare(
              'INSERT INTO customer_subscription_periods (user_id, started_at, expires_at) VALUES (?, ?, ?)'
            ).bind(userId, start.toISOString(), expiry.toISOString()).run();
          }
        }
        await env.DB.prepare(`
          INSERT INTO audit_logs (timestamp, admin_email, action, details)
          VALUES (?, ?, ?, ?)
        `).bind(new Date().toISOString(), admin.email, 'account_status_updated',
          'Updated account status for ID ' + userId + ' to ' + status).run();
        return json({ success: true, message: 'Account status updated.' });
      }

      // ADMIN: REQUIRE PASSWORD RESET. Admin never receives or chooses a password.
      const resetCustomerMatch = url.pathname.match(/^\/api\/admin\/customers\/(\d+)\/reset-password$/);
      if (resetCustomerMatch && method === 'POST') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const userId = Number(resetCustomerMatch[1]);
        const existing = await env.DB.prepare(
          'SELECT id FROM users WHERE id = ? AND lower(email) <> ? LIMIT 1'
        ).bind(userId, ADMIN_EMAIL).first();
        if (!existing) return json({ error: 'Account not found.' }, 404);
        const inaccessiblePassword = base64url(crypto.getRandomValues(new Uint8Array(32)));
        const passwordHash = await hashPassword(inaccessiblePassword);
        await env.DB.batch([
          env.DB.prepare('UPDATE users SET password = ? WHERE id = ?').bind(passwordHash, userId),
          env.DB.prepare('DELETE FROM auth_sessions WHERE user_id = ?').bind(userId)
        ]);
        await env.DB.prepare(`
          INSERT INTO audit_logs (timestamp, admin_email, action, details)
          VALUES (?, ?, ?, ?)
        `).bind(new Date().toISOString(), admin.email, 'password_reset_required',
          'Invalidated password and sessions for account ID ' + userId).run();
        return json({ success: true, message: 'Existing password invalidated. The account holder must use Forgot Password with their registered email and mobile number to create a new password.' });
      }

      // ADMIN: CUSTOMER, PAYMENT AND AUDIT DATA

      if (url.pathname === '/api/admin/payments' && method === 'GET') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);

        const result = await env.DB.prepare(`
          SELECT p.*, u.first_name, u.surname, u.email
          FROM payments p
          LEFT JOIN users u ON u.id = p.user_id
          ORDER BY p.rowid DESC
          LIMIT 500
        `).all();

        return json((result.results || []).map(payment => {
          const totalAmount = Number(payment.amount || payment.total_amount || 0);
          const gstRate = Number(payment.gst_rate ?? 18);
          const amountBase = Number(payment.amount_base ?? (
            gstRate >= 0 ? totalAmount / (1 + gstRate / 100) : totalAmount
          ));
          const gst = Number(payment.gst ?? (totalAmount - amountBase));
          const rawStatus = String(payment.status || 'pending').toLowerCase();
          return {
            id: String(payment.id || ''),
            userId: String(payment.user_id || ''),
            userName: `${payment.first_name || ''} ${payment.surname || ''}`.trim(),
            userEmail: payment.email || '',
            amountBase: roundMoney(amountBase),
            gst: roundMoney(gst),
            totalAmount: roundMoney(totalAmount),
            utr: String(payment.utr_number || payment.utr || ''),
            notes: String(payment.notes || ''),
            status: rawStatus === 'approved' ? 'verified' : rawStatus,
            submittedAt: String(payment.submitted_at || payment.created_at || ''),
            verifiedAt: String(payment.verified_at || ''),
            verifiedBy: String(payment.verified_by || '')
          };
        }));
      }

      if (url.pathname === '/api/admin/audit-logs' && method === 'GET') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);

        const result = await env.DB.prepare(`
          SELECT id, timestamp, admin_email, action, details
          FROM audit_logs
          ORDER BY timestamp DESC
          LIMIT 500
        `).all();

        return json((result.results || []).map(log => ({
          id: String(log.id),
          timestamp: String(log.timestamp),
          adminEmail: String(log.admin_email),
          action: String(log.action),
          details: String(log.details)
        })));
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




      // ADMIN: GENERIC CONTENT ITEMS FOR OFFERS, UTILITIES, HOW IT WORKS AND FAQ.
      if (url.pathname === '/api/admin/site-content' && method === 'GET') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const section = String(url.searchParams.get('section') || '');
        const validSections = ['offers', 'utilities', 'how-it-works', 'faq'];
        if (section && !validSections.includes(section)) return json({ error: 'Unknown section.' }, 400);
        const result = section
          ? await env.DB.prepare('SELECT * FROM site_content_items WHERE section_key = ? ORDER BY display_order, created_at DESC').bind(section).all()
          : await env.DB.prepare('SELECT * FROM site_content_items ORDER BY section_key, display_order, created_at DESC').all();
        return json(result.results || []);
      }

      if (url.pathname === '/api/admin/site-content' && method === 'POST') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const data = await parseRequestBody(request);
        const section = String(data.section || '');
        const title = String(data.title || '').trim();
        if (!['offers', 'utilities', 'how-it-works', 'faq'].includes(section) || !title) {
          return json({ error: 'Choose a valid section and enter a title.' }, 400);
        }
        const id = randomId('content');
        const now = new Date().toISOString();
        await env.DB.prepare(`
          INSERT INTO site_content_items
            (id, section_key, title, summary, body, image_url, target_url, metadata_json, status, display_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, section, title, String(data.summary || ''), String(data.body || ''),
          String(data.imageUrl || ''), String(data.targetUrl || ''),
          JSON.stringify(data.metadata || {}), ['draft', 'published', 'hidden'].includes(data.status) ? data.status : 'draft',
          Number(data.displayOrder || 0), now, now).run();
        return json({ success: true, id });
      }

      if (url.pathname.startsWith('/api/admin/site-content/') && method === 'PUT') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const id = decodeURIComponent(url.pathname.split('/').pop() || '');
        const data = await parseRequestBody(request);
        const title = String(data.title || '').trim();
        if (!title || !['offers', 'utilities', 'how-it-works', 'faq'].includes(String(data.section || ''))) {
          return json({ error: 'A valid section and title are required.' }, 400);
        }
        await env.DB.prepare(`
          UPDATE site_content_items SET section_key = ?, title = ?, summary = ?, body = ?,
            image_url = ?, target_url = ?, metadata_json = ?, status = ?, display_order = ?, updated_at = ?
          WHERE id = ?
        `).bind(String(data.section), title, String(data.summary || ''), String(data.body || ''),
          String(data.imageUrl || ''), String(data.targetUrl || ''),
          JSON.stringify(data.metadata || {}), ['draft', 'published', 'hidden'].includes(data.status) ? data.status : 'draft',
          Number(data.displayOrder || 0), new Date().toISOString(), id).run();
        return json({ success: true });
      }

      if (url.pathname.startsWith('/api/admin/site-content/') && method === 'DELETE') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const id = decodeURIComponent(url.pathname.split('/').pop() || '');
        await env.DB.prepare('DELETE FROM site_content_items WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      // ADMIN: BLOG ARTICLE CRUD.
      if (url.pathname === '/api/admin/blog' && method === 'GET') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const result = await env.DB.prepare('SELECT * FROM blog_articles ORDER BY updated_at DESC').all();
        return json(result.results || []);
      }

      if (url.pathname === '/api/admin/blog' && method === 'POST') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const data = await parseRequestBody(request);
        const title = String(data.title || '').trim();
        const slug = String(data.slug || '').trim().toLowerCase();
        if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          return json({ error: 'Enter a title and a URL-friendly article slug.' }, 400);
        }
        const id = randomId('blog');
        const status = ['draft', 'published', 'unpublished'].includes(data.status) ? data.status : 'draft';
        const now = new Date().toISOString();
        await env.DB.prepare(`
          INSERT INTO blog_articles
            (id, title, slug, excerpt, body, featured_image_url, seo_title, seo_description, status, published_at, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, title, slug, String(data.excerpt || ''), String(data.body || ''),
          String(data.featuredImageUrl || ''), String(data.seoTitle || ''),
          String(data.seoDescription || ''), status, status === 'published' ? now : null, now, now).run();
        return json({ success: true, id });
      }

      if (url.pathname.startsWith('/api/admin/blog/') && method === 'PUT') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const id = decodeURIComponent(url.pathname.split('/').pop() || '');
        const data = await parseRequestBody(request);
        const title = String(data.title || '').trim();
        const slug = String(data.slug || '').trim().toLowerCase();
        const status = ['draft', 'published', 'unpublished'].includes(data.status) ? data.status : 'draft';
        if (!title || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
          return json({ error: 'Enter a title and a URL-friendly article slug.' }, 400);
        }
        await env.DB.prepare(`
          UPDATE blog_articles SET title = ?, slug = ?, excerpt = ?, body = ?,
            featured_image_url = ?, seo_title = ?, seo_description = ?, status = ?,
            published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END,
            updated_at = ? WHERE id = ?
        `).bind(title, slug, String(data.excerpt || ''), String(data.body || ''),
          String(data.featuredImageUrl || ''), String(data.seoTitle || ''),
          String(data.seoDescription || ''), status, status, new Date().toISOString(),
          new Date().toISOString(), id).run();
        return json({ success: true });
      }

      if (url.pathname.startsWith('/api/admin/blog/') && method === 'DELETE') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const id = decodeURIComponent(url.pathname.split('/').pop() || '');
        await env.DB.prepare('DELETE FROM blog_articles WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      // ADMIN: TOOLS CRUD.
      if (url.pathname === '/api/admin/tools' && method === 'GET') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const result = await env.DB.prepare('SELECT * FROM site_tools ORDER BY display_order, created_at DESC').all();
        return json(result.results || []);
      }

      if (url.pathname === '/api/admin/tools' && method === 'POST') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const data = await parseRequestBody(request);
        const title = String(data.title || '').trim();
        if (!title) return json({ error: 'Tool title is required.' }, 400);
        const id = randomId('tool');
        const now = new Date().toISOString();
        await env.DB.prepare(`
          INSERT INTO site_tools (id, title, description, target_url, icon_name, status, display_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(id, title, String(data.description || ''), String(data.targetUrl || ''),
          String(data.iconName || ''), ['draft', 'published', 'hidden'].includes(data.status) ? data.status : 'draft',
          Number(data.displayOrder || 0), now, now).run();
        return json({ success: true, id });
      }

      if (url.pathname.startsWith('/api/admin/tools/') && method === 'PUT') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const id = decodeURIComponent(url.pathname.split('/').pop() || '');
        const data = await parseRequestBody(request);
        const title = String(data.title || '').trim();
        if (!title) return json({ error: 'Tool title is required.' }, 400);
        await env.DB.prepare(`
          UPDATE site_tools SET title = ?, description = ?, target_url = ?, icon_name = ?,
            status = ?, display_order = ?, updated_at = ? WHERE id = ?
        `).bind(title, String(data.description || ''), String(data.targetUrl || ''),
          String(data.iconName || ''), ['draft', 'published', 'hidden'].includes(data.status) ? data.status : 'draft',
          Number(data.displayOrder || 0), new Date().toISOString(), id).run();
        return json({ success: true });
      }

      if (url.pathname.startsWith('/api/admin/tools/') && method === 'DELETE') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const id = decodeURIComponent(url.pathname.split('/').pop() || '');
        await env.DB.prepare('DELETE FROM site_tools WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      // ADMIN: GOOGLE ADSENSE SLOT SETTINGS.
      if (url.pathname === '/api/admin/adsense' && method === 'GET') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const result = await env.DB.prepare('SELECT * FROM adsense_slots ORDER BY placement_key').all();
        return json(result.results || []);
      }

      if (url.pathname === '/api/admin/adsense' && method === 'PUT') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const data = await parseRequestBody(request);
        if (!Array.isArray(data.slots)) return json({ error: 'AdSense slots must be supplied as a list.' }, 400);
        for (const slot of data.slots) {
          const key = String(slot.placementKey || '');
          if (!/^[a-z0-9-]{2,50}$/.test(key)) continue;
          await env.DB.prepare(`
            UPDATE adsense_slots SET enabled = ?, client_id = ?, slot_id = ?,
              updated_at = ?, updated_by = ? WHERE placement_key = ?
          `).bind(slot.enabled ? 1 : 0, String(slot.clientId || ''),
            String(slot.slotId || ''), new Date().toISOString(), admin.email, key).run();
        }
        return json({ success: true });
      }

      if (url.pathname === '/api/admin/adsense' && method === 'POST') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const data = await parseRequestBody(request);
        const key = String(data.placementKey || '').trim();
        const name = String(data.displayName || '').trim();
        if (!/^[a-z0-9-]{2,50}$/.test(key) || !name) {
          return json({ error: 'Enter a valid placement key and display name.' }, 400);
        }
        await env.DB.prepare(`
          INSERT INTO adsense_slots (placement_key, display_name, enabled, client_id, slot_id, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(key, name, data.enabled ? 1 : 0, String(data.clientId || ''),
          String(data.slotId || ''), new Date().toISOString(), admin.email).run();
        return json({ success: true });
      }

      if (url.pathname.startsWith('/api/admin/adsense/') && method === 'DELETE') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const key = decodeURIComponent(url.pathname.split('/').pop() || '');
        await env.DB.prepare('DELETE FROM adsense_slots WHERE placement_key = ?').bind(key).run();
        return json({ success: true });
      }

      if (url.pathname === '/api/admin/affiliate/conversions' && method === 'GET') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const result = await env.DB.prepare(`
          SELECT v.id, v.network_name AS networkName, v.order_reference AS orderReference,
                 v.order_amount AS orderAmount, v.commission_amount AS commissionAmount,
                 v.currency, v.status, v.purchased_at AS purchasedAt, v.reported_at AS reportedAt,
                 l.product_name AS productName, l.source_type AS sourceType,
                 l.source_id AS sourceId, mc.title AS sourceName, p.campaign_name AS campaignName
          FROM affiliate_conversions v
          LEFT JOIN affiliate_tracking_links l ON l.tracking_code = v.tracking_code
          LEFT JOIN managed_categories mc ON mc.id = l.source_id
          LEFT JOIN promo_campaigns p ON p.id = l.campaign_id
          ORDER BY COALESCE(v.purchased_at, v.reported_at) DESC
          LIMIT 500
        `).all();
        return json(result.results || []);
      }

      // ADMIN: MANUAL CONVERSION IMPORT. Only actual merchant/network reports should be entered here.
      if (url.pathname === '/api/admin/affiliate/conversions' && method === 'POST') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const data = await parseRequestBody(request);
        const orderAmount = Number(data.orderAmount);
        const commissionAmount = Number(data.commissionAmount);
        if (!Number.isFinite(orderAmount) || orderAmount < 0 ||
            !Number.isFinite(commissionAmount) || commissionAmount < 0) {
          return json({ error: 'Enter valid reported order and commission amounts.' }, 400);
        }
        const trackingCode = data.trackingCode ? String(data.trackingCode).trim() : null;
        if (!trackingCode) return json({ error: 'Tracking code is required to attribute a purchase to its campaign and source channel.' }, 400);
        if (trackingCode) {
          const validLink = await env.DB.prepare(
            'SELECT tracking_code FROM affiliate_tracking_links WHERE tracking_code = ? LIMIT 1'
          ).bind(trackingCode).first();
          if (!validLink) return json({ error: 'Tracking code was not found. Copy it from the affiliate analytics table.' }, 400);
        }
        let purchasedAt = null;
        if (data.purchasedAt) {
          const parsedPurchaseDate = new Date(String(data.purchasedAt));
          if (Number.isNaN(parsedPurchaseDate.getTime())) return json({ error: 'Enter a valid purchase date and time.' }, 400);
          purchasedAt = parsedPurchaseDate.toISOString();
        }
        const id = randomId('conversion');
        await env.DB.prepare(`
          INSERT INTO affiliate_conversions
            (id, tracking_code, network_name, order_reference, order_amount, commission_amount, purchased_at, currency, status, reported_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'reported', ?)
        `).bind(id, trackingCode,
          String(data.networkName || ''), String(data.orderReference || ''),
          orderAmount, commissionAmount, purchasedAt, String(data.currency || 'INR'),
          new Date().toISOString()).run();
        return json({ success: true, id });
      }

      // ADMIN: MANAGE CATEGORY LIST AND ITS TELEGRAM CHANNEL
      if (url.pathname === '/api/admin/categories' && method === 'GET') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const result = await env.DB.prepare(`
          SELECT id, title, description, telegram_chat_id AS telegramChatId,
                 active, display_order AS displayOrder
          FROM managed_categories ORDER BY display_order, title
        `).all();
        return json(result.results || []);
      }

      if (url.pathname === '/api/admin/categories' && method === 'POST') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const data = await parseRequestBody(request);
        const id = String(data.id || '').trim().toLowerCase();
        const title = String(data.title || '').trim();
        const chatId = String(data.telegramChatId || '').trim();
        if (!/^[a-z0-9-]{2,60}$/.test(id) || !title || !/^(?:-?\d+|@[A-Za-z0-9_]{5,})$/.test(chatId)) {
          return json({ error: 'Enter a valid category ID, title and Telegram channel ID.' }, 400);
        }
        await env.DB.prepare(`
          INSERT INTO managed_categories (id, title, description, telegram_chat_id, active, display_order, updated_at)
          VALUES (?, ?, ?, ?, 1, ?, ?)
        `).bind(id, title, String(data.description || ''), chatId,
          Number(data.displayOrder || 0), new Date().toISOString()).run();
        if (await hasDatabaseColumn(env, 'categories', 'id') &&
            await hasDatabaseColumn(env, 'categories', 'title') &&
            await hasDatabaseColumn(env, 'categories', 'description') &&
            await hasDatabaseColumn(env, 'categories', 'base_price') &&
            await hasDatabaseColumn(env, 'categories', 'gst_rate') &&
            await hasDatabaseColumn(env, 'categories', 'active')) {
          await env.DB.prepare(`
            INSERT OR IGNORE INTO categories (id, title, description, base_price, gst_rate, active)
            VALUES (?, ?, ?, 252, 18, 1)
          `).bind(id, title, String(data.description || '')).run();
        }
        return json({ success: true });
      }

      if (url.pathname.startsWith('/api/admin/categories/') && method === 'PUT') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const id = decodeURIComponent(url.pathname.split('/').pop() || '');
        const data = await parseRequestBody(request);
        const title = String(data.title || '').trim();
        const chatId = String(data.telegramChatId || '').trim();
        if (!title || !/^(?:-?\d+|@[A-Za-z0-9_]{5,})$/.test(chatId)) return json({ error: 'Enter a valid category title and Telegram channel ID.' }, 400);
        await env.DB.prepare(`
          UPDATE managed_categories SET title = ?, description = ?, telegram_chat_id = ?,
            active = ?, display_order = ?, updated_at = ? WHERE id = ?
        `).bind(title, String(data.description || ''), chatId,
          data.active === false ? 0 : 1, Number(data.displayOrder || 0),
          new Date().toISOString(), id).run();
        if (await hasDatabaseColumn(env, 'categories', 'id') &&
            await hasDatabaseColumn(env, 'categories', 'title') &&
            await hasDatabaseColumn(env, 'categories', 'description') &&
            await hasDatabaseColumn(env, 'categories', 'active')) {
          await env.DB.prepare(`
            UPDATE categories SET title = ?, description = ?, active = ? WHERE id = ?
          `).bind(title, String(data.description || ''), data.active === false ? 0 : 1, id).run();
        }
        return json({ success: true });
      }

      if (url.pathname.startsWith('/api/admin/categories/') && method === 'DELETE') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const id = decodeURIComponent(url.pathname.split('/').pop() || '');
        const usedByUsers = await env.DB.prepare(
          'SELECT COUNT(*) AS count FROM users WHERE category = ?'
        ).bind(id).first();
        const hasSubscriptionCategory = await hasDatabaseColumn(env, 'user_subscriptions', 'category_id');
        const hasPaymentCategory = await hasDatabaseColumn(env, 'payments', 'category_id');
        const usedBySubscriptions = hasSubscriptionCategory
          ? await env.DB.prepare('SELECT COUNT(*) AS count FROM user_subscriptions WHERE category_id = ?').bind(id).first()
          : { count: 0 };
        const usedByPayments = hasPaymentCategory
          ? await env.DB.prepare('SELECT COUNT(*) AS count FROM payments WHERE category_id = ?').bind(id).first()
          : { count: 0 };
        if (Number(usedByUsers?.count || 0) + Number(usedBySubscriptions?.count || 0) + Number(usedByPayments?.count || 0) > 0) {
          return json({ error: 'This category is linked to customer, subscription or payment records. Deactivate it instead of deleting it.' }, 409);
        }
        await env.DB.prepare('DELETE FROM managed_categories WHERE id = ?').bind(id).run();
        if (await hasDatabaseColumn(env, 'categories', 'id')) {
          await env.DB.prepare('DELETE FROM categories WHERE id = ?').bind(id).run();
        }
        return json({ success: true });
      }

      // ADMIN: PROMOTIONAL CAMPAIGNS
      if (url.pathname === '/api/admin/promotions' && method === 'GET') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const result = await env.DB.prepare(`
          SELECT p.*,
            (SELECT COUNT(*) FROM promo_deliveries d WHERE d.campaign_id = p.id AND d.status = 'sent') AS sent_channels,
            (SELECT COUNT(*) FROM promo_deliveries d WHERE d.campaign_id = p.id AND d.status = 'failed') AS failed_channels
          FROM promo_campaigns p ORDER BY p.created_at DESC LIMIT 100
        `).all();
        return json(result.results || []);
      }

      if (url.pathname.startsWith('/api/admin/promotions/') && url.pathname.endsWith('/deliveries') && method === 'GET') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const parts = url.pathname.split('/');
        const campaignId = decodeURIComponent(parts[4] || '');
        const result = await env.DB.prepare(`
          SELECT channel_name AS channelName, channel_id AS channelId, status,
                 telegram_message_id AS telegramMessageId, tracking_code AS trackingCode,
                 error_message AS errorMessage, attempts, delivered_at AS deliveredAt
          FROM promo_deliveries WHERE campaign_id = ? ORDER BY channel_name
        `).bind(campaignId).all();
        return json(result.results || []);
      }

      if (url.pathname === '/api/admin/promotions' && method === 'POST') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const data = await parseRequestBody(request);
        const campaignName = String(data.campaignName || '').trim();
        const messageText = String(data.messageText || '').trim();
        const affiliateUrl = String(data.affiliateUrl || '').trim();
        if (!campaignName || !messageText || !/^https?:\/\//i.test(affiliateUrl)) {
          return json({ error: 'Campaign name, message and a valid affiliate URL are required.' }, 400);
        }
        const id = randomId('campaign');
        const now = new Date().toISOString();
        await env.DB.prepare(`
          INSERT INTO promo_campaigns
            (id, campaign_name, product_name, message_text, image_url, affiliate_url,
             tracking_parameter, link_label, affiliate_disclosure, status, scheduled_for, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
        `).bind(id, campaignName, String(data.productName || ''),
          messageText, String(data.imageUrl || ''), affiliateUrl,
          String(data.trackingParameter || 'subid'),
          String(data.linkLabel || 'View Offer'),
          String(data.affiliateDisclosure || 'We may earn a commission from qualifying purchases.'),
          nextPromotionDate(), now, now).run();
        return json({ success: true, id });
      }

      if (url.pathname.startsWith('/api/admin/promotions/') && method === 'PUT') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const id = decodeURIComponent(url.pathname.split('/').pop() || '');
        const data = await parseRequestBody(request);
        const existing = await env.DB.prepare('SELECT status, scheduled_for FROM promo_campaigns WHERE id = ?').bind(id).first();
        if (!existing || !['draft', 'approved'].includes(existing.status)) {
          return json({ error: 'Only draft or scheduled campaigns can be edited.' }, 409);
        }
        const priorDeliveries = await env.DB.prepare('SELECT COUNT(*) AS count FROM promo_deliveries WHERE campaign_id = ?').bind(id).first();
        if (Number(priorDeliveries?.count || 0) > 0) {
          return json({ error: 'Delivery has already started. Create a new campaign for the next scheduled date rather than changing a message already sent to some channels.' }, 409);
        }
        const campaignName = String(data.campaignName || '').trim();
        const messageText = String(data.messageText || '').trim();
        const affiliateUrl = String(data.affiliateUrl || '').trim();
        if (!campaignName || !messageText || !/^https?:\/\//i.test(affiliateUrl)) {
          return json({ error: 'Campaign name, message and a valid affiliate URL are required.' }, 400);
        }
        await env.DB.prepare(`
          UPDATE promo_campaigns SET campaign_name = ?, product_name = ?, message_text = ?,
            image_url = ?, affiliate_url = ?, tracking_parameter = ?, link_label = ?, affiliate_disclosure = ?,
            scheduled_for = ?, updated_at = ? WHERE id = ?
        `).bind(campaignName, String(data.productName || ''), messageText,
          String(data.imageUrl || ''), affiliateUrl, String(data.trackingParameter || 'subid'),
          String(data.linkLabel || 'View Offer'),
          String(data.affiliateDisclosure || 'We may earn a commission from qualifying purchases.'),
          nextPromotionDate(),
          new Date().toISOString(), id).run();
        const links = await env.DB.prepare("SELECT tracking_code FROM affiliate_tracking_links WHERE campaign_id = ? AND tracking_code IN (SELECT tracking_code FROM promo_deliveries WHERE campaign_id = ? AND status <> 'sent')").bind(id, id).all();
        for (const link of (links.results || [])) {
          await env.DB.prepare('UPDATE affiliate_tracking_links SET outbound_url = ? WHERE tracking_code = ?')
            .bind(makeAffiliateDestination(affiliateUrl, String(data.trackingParameter || 'subid'), link.tracking_code), link.tracking_code).run();
        }
        return json({ success: true });
      }

      if (url.pathname.startsWith('/api/admin/promotions/') && url.pathname.endsWith('/approve') && method === 'POST') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const id = decodeURIComponent(url.pathname.split('/')[4] || '');
        const campaign = await env.DB.prepare('SELECT * FROM promo_campaigns WHERE id = ?').bind(id).first();
        if (!campaign) return json({ error: 'Campaign not found.' }, 404);
        if (!campaign.message_text || !campaign.affiliate_url) return json({ error: 'Add a message and affiliate URL before approval.' }, 400);
        const scheduledFor = nextPromotionDate();
        const now = new Date().toISOString();
        await env.DB.prepare(`
          UPDATE promo_campaigns SET status = 'cancelled', updated_at = ?
          WHERE status = 'approved' AND scheduled_for = ? AND id <> ?
        `).bind(now, scheduledFor, id).run();
        await env.DB.prepare(`
          UPDATE promo_campaigns SET status = 'approved', scheduled_for = ?,
            approved_at = ?, approved_by = ?, updated_at = ? WHERE id = ?
        `).bind(scheduledFor, now, admin.email, now, id).run();
        return json({ success: true, scheduledFor });
      }

      if (url.pathname.startsWith('/api/admin/promotions/') && method === 'DELETE') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const id = decodeURIComponent(url.pathname.split('/').pop() || '');
        const existing = await env.DB.prepare('SELECT status FROM promo_campaigns WHERE id = ?').bind(id).first();
        if (!existing) return json({ error: 'Campaign not found.' }, 404);
        if (existing.status === 'sent') return json({ error: 'Sent campaigns cannot be deleted; retain them for reporting.' }, 409);
        await env.DB.prepare('DELETE FROM promo_campaigns WHERE id = ?').bind(id).run();
        return json({ success: true });
      }

      // AFFILIATE REDIRECT: record each click and then send the visitor to the merchant.
      if (url.pathname === '/api/affiliate/click' && method === 'GET') {
        const code = String(url.searchParams.get('code') || '');
        if (!code) return json({ error: 'Tracking code is missing.' }, 400);
        const link = await env.DB.prepare(`
          SELECT outbound_url FROM affiliate_tracking_links WHERE tracking_code = ? LIMIT 1
        `).bind(code).first();
        if (!link?.outbound_url || !/^https?:\/\//i.test(link.outbound_url)) {
          return json({ error: 'Affiliate link not found.' }, 404);
        }
        await env.DB.prepare(`
          INSERT INTO affiliate_clicks (id, tracking_code, clicked_at) VALUES (?, ?, ?)
        `).bind(randomId('click'), code, new Date().toISOString()).run();
        return Response.redirect(link.outbound_url, 302);
      }

      // ADMIN: AFFILIATE CLICK AND CONVERSION SUMMARY.
      if (url.pathname === '/api/admin/affiliate/analytics' && method === 'GET') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);
        const result = await env.DB.prepare(`
          SELECT l.tracking_code, l.campaign_id, p.campaign_name, l.product_name, l.source_type, l.source_id, mc.title AS source_name,
            (SELECT COUNT(*) FROM affiliate_clicks c WHERE c.tracking_code = l.tracking_code) AS clicks,
            (SELECT MAX(c.clicked_at) FROM affiliate_clicks c WHERE c.tracking_code = l.tracking_code) AS last_clicked_at,
            (SELECT COALESCE(SUM(v.order_amount), 0) FROM affiliate_conversions v WHERE v.tracking_code = l.tracking_code AND v.status <> 'reversed') AS reported_order_amount,
            (SELECT COALESCE(SUM(v.commission_amount), 0) FROM affiliate_conversions v WHERE v.tracking_code = l.tracking_code AND v.status <> 'reversed') AS reported_commission,
            (SELECT COUNT(*) FROM affiliate_conversions v WHERE v.tracking_code = l.tracking_code AND v.status <> 'reversed') AS reported_purchases,
            COALESCE(
              (SELECT MAX(v.purchased_at) FROM affiliate_conversions v WHERE v.tracking_code = l.tracking_code AND v.status <> 'reversed'),
              (SELECT MAX(v.reported_at) FROM affiliate_conversions v WHERE v.tracking_code = l.tracking_code AND v.status <> 'reversed')
            ) AS last_purchase_at
          FROM affiliate_tracking_links l
          LEFT JOIN promo_campaigns p ON p.id = l.campaign_id
          LEFT JOIN managed_categories mc ON mc.id = l.source_id
          ORDER BY clicks DESC
        `).all();
        return json(result.results || []);
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

            !/^[6-9]\d{9}$/.test(mobile) || !category) {
          return json({ error: 'Please enter a valid 10-digit Indian mobile number.' }, 400);
        }

        if (password.length !== 8) {
          return json({ error: 'Password must be exactly 8 characters.' }, 400);
        }

        const validCategory = await env.DB.prepare(
          'SELECT id FROM managed_categories WHERE id = ? AND active = 1 LIMIT 1'
        ).bind(category).first();
        if (!validCategory) {
          return json({ error: 'Please select a valid active news category.' }, 400);
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

        try {
          await configureTelegramWebhook(env);
        } catch (error) {
          // Return a safe, actionable webhook setup error to the signed-in customer.
          // configureTelegramWebhook only exposes configuration or Telegram API descriptions;
          // never include bot tokens or webhook secrets in this response.
          const reason = error instanceof Error
            ? error.message
            : 'Telegram webhook configuration failed.';
          console.error('Telegram webhook setup failed:', reason);
          return json({
            error: `Telegram webhook setup failed: ${reason}`
          }, 502);
        }

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

      // ADMIN: SEND A REAL 10-STORY INDIA STARTUPS NEWS TEST TO THE STARTUP CHANNEL
      if (url.pathname === '/api/admin/news/startup/test' && method === 'POST') {
        const admin = await getAuthorizedAdmin(request, env);
        if (!admin) return json({ error: 'Administrator access required.' }, 403);

        const startupCategory = await env.DB.prepare(
          "SELECT telegram_chat_id AS telegramChatId FROM managed_categories WHERE id = 'startup' AND active = 1 LIMIT 1"
        ).first();
        if (!startupCategory || !startupCategory.telegramChatId) {
          return json({ error: 'Startup Telegram channel mapping is missing.' }, 500);
        }

        const result = await sendIndiaStartupsNewsTest(env, startupCategory.telegramChatId);
        return json({
          success: true,
          category: startupCategory.id,
          storyCount: result.storyCount,
          messageIds: result.messageIds,
          message: 'Exactly 10 India Startups stories were delivered to the Startup Telegram channel.'
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
        if (email === ADMIN_EMAIL) {
          return json({ error: 'Administrator access is available only through Google sign-in.' }, 403);
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

            !/^[6-9]\d{9}$/.test(mobile) || !category) {
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
          await env.DB.prepare(
            'DELETE FROM admin_google_sessions WHERE token_hash = ?'
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

        if (email === ADMIN_EMAIL) {
          return json({ error: 'Administrator access is managed through Google sign-in, not password recovery.' }, 403);
        }

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

            await sendCustomerTelegramNotification(
              env,
              tokenRow.user_id,
              "welcome:" + tokenRow.user_id,
              "welcome",
              "🎉 *Welcome to MyDigitAsset!*\n\nYour Telegram account is connected. Daily news digests and promotional offers will be posted in your selected category Telegram channel. Welcome, payment confirmation, payment reminders and subscription renewal notices will be sent privately here.\n\nVisit https://mydigitasset.com/ to manage your subscription."
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
              const customer = await env.DB.prepare(
                "SELECT first_name, surname FROM users WHERE id = ? AND role = 'customer' LIMIT 1"
              ).bind(userId).first();

              const approvedPayment = await env.DB.prepare(
                "UPDATE payments SET status = 'approved' WHERE user_id = ? AND status = 'pending'"
              ).bind(userId).run();

              if (customer && Number(approvedPayment?.meta?.changes || 0) > 0) {
                const now = new Date();
                const currentPeriod = await env.DB.prepare(
                  "SELECT MAX(expires_at) AS expires_at FROM customer_subscription_periods WHERE user_id = ?"
                ).bind(userId).first();
                const existingExpiry = currentPeriod?.expires_at ? new Date(currentPeriod.expires_at) : null;
                const periodStart = existingExpiry && existingExpiry > now ? existingExpiry : now;
                const periodEnd = new Date(periodStart);
                periodEnd.setUTCFullYear(periodEnd.getUTCFullYear() + 1);
                const startedAt = periodStart.toISOString();
                const expiresAt = periodEnd.toISOString();

                await env.DB.prepare(
                  "INSERT INTO customer_subscription_periods (user_id, started_at, expires_at) VALUES (?, ?, ?)"
                ).bind(userId, startedAt, expiresAt).run();

                await env.DB.prepare(
                  "UPDATE users SET status = 'active' WHERE id = ?"
                ).bind(userId).run();

                await sendCustomerTelegramNotification(
                  env,
                  userId,
                  "payment-confirmation:" + userId + ":" + expiresAt,
                  "payment_confirmation",
                  "✅ *Your MyDigitAsset payment has been confirmed!*\n\nThank you. Your annual subscription is now active until *" + formatIndiaDate(periodEnd) + "* .\n\nDaily news digests and promotional offers will be posted in your selected category Telegram channel. Your account and payment notices will be sent privately here.\n\nOpen: https://mydigitasset.com/"
                );
              }

              await sendTelegramMessage(
                env.TELEGRAM_BOT_TOKEN,
                chatId,
                Number(approvedPayment?.meta?.changes || 0) > 0
                  ? `✅ Payment for customer #${userId} has been approved and the customer has been notified if Telegram is connected.`
                  : `ℹ️ No pending payment was found for customer #${userId}; no duplicate subscription period was created.`
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
