-- MyDigitAsset Additive Security & Business Logic Migration (0002_security_and_business_logic.sql)
-- Safe for existing databases; does not drop or recreate existing tables/columns.

-- 1. User Categories / Subscriptions Table for Independent Category-Specific Subscriptions & Access
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'trial', -- 'trial', 'active_paid', 'expired'
  trial_start TEXT NOT NULL,
  trial_expiry TEXT NOT NULL,
  subscription_start TEXT,
  subscription_expiry TEXT,
  access_override INTEGER NOT NULL DEFAULT 0, -- 0 or 1
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 2. Telegram Tokens Table (Reconciled naming convention)
CREATE TABLE IF NOT EXISTS telegram_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Useful Performance Indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_category_id ON user_subscriptions(category_id);
CREATE INDEX IF NOT EXISTS idx_telegram_tokens_user_id ON telegram_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
