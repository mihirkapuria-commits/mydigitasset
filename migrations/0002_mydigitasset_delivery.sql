
-- MyDigitAsset: customer delivery and category access
-- Additive migration; does not modify existing news-agent scripts.

-- Telegram delivery identity
ALTER TABLE users ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE users ADD COLUMN trial_reminder_sent_at TEXT;

-- Admin-controlled access overrides:
-- normal = apply normal trial/payment rules
-- allow  = admin grants access
-- deny   = admin blocks access
ALTER TABLE users ADD COLUMN admin_access_override TEXT
  NOT NULL DEFAULT 'normal'
  CHECK (admin_access_override IN ('normal', 'allow', 'deny'));

ALTER TABLE users ADD COLUMN admin_access_until TEXT;

-- Category-specific prices and private Telegram channel IDs.
-- Channel IDs remain private server-side.
ALTER TABLE categories ADD COLUMN price_inr REAL NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN telegram_channel_id TEXT;

-- Each payment submission can identify the category being purchased.
ALTER TABLE payments ADD COLUMN category_id TEXT
  REFERENCES categories(id) ON DELETE SET NULL;

-- Category-specific entitlement records.
CREATE TABLE IF NOT EXISTS category_access (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  payment_id TEXT,
  access_status TEXT NOT NULL DEFAULT 'active'
    CHECK (access_status IN ('active', 'revoked', 'expired')),
  starts_at TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (user_id, category_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_category_access_user
  ON category_access(user_id);

CREATE INDEX IF NOT EXISTS idx_category_access_category
  ON category_access(category_id);

CREATE INDEX IF NOT EXISTS idx_category_access_expiry
  ON category_access(access_status, expires_at);

-- One-time Telegram account-linking tokens.
-- Store a hash of the token, never the raw token.
CREATE TABLE IF NOT EXISTS telegram_link_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Configurable business rules.
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

INSERT OR IGNORE INTO system_settings
  (setting_key, setting_value, updated_at)
VALUES
  ('trial_duration_days', '3', datetime('now')),
  ('trial_reminder_day', '3', datetime('now')),
  ('news_delivery_time_ist', '06:15', datetime('now'));

-- Delivery idempotency: prevent duplicate customer/category/day records.
ALTER TABLE delivery_logs ADD COLUMN delivery_date TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_delivery_once_per_day
  ON delivery_logs(user_id, category_id, delivery_date)
  WHERE delivery_date IS NOT NULL;
