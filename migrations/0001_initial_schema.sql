-- MyDigitAsset D1 Database Schema Migration (0001_initial_schema.sql)
-- Designed for Cloudflare D1 (SQLite) with UTC timestamps, relational integrity, and strict privacy safeguards (no IP collection).

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  mobile TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  category TEXT NOT NULL,
  categories TEXT NOT NULL, -- Stored as JSON array string
  trial_start TEXT NOT NULL,
  trial_expiry TEXT NOT NULL,
  subscription_status TEXT NOT NULL DEFAULT 'trial', -- 'trial', 'active_paid', 'expired'
  payment_status TEXT NOT NULL DEFAULT 'none', -- 'none', 'pending', 'verified', 'rejected'
  telegram_connected INTEGER NOT NULL DEFAULT 0, -- 0 or 1
  telegram_username TEXT,
  created_at TEXT NOT NULL
);

-- 2. Categories Table
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1 -- 0 or 1
);

-- 3. Payments Table (Supports multiple payment attempts & annual subscription history)
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  amount_base REAL NOT NULL DEFAULT 252.00,
  gst REAL NOT NULL DEFAULT 45.36,
  total_amount REAL NOT NULL DEFAULT 297.36,
  utr TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  submitted_at TEXT NOT NULL,
  verified_at TEXT,
  verified_by TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL
);

-- 6. Delivery Logs Table (Tracks daily news delivery events via Telegram)
CREATE TABLE IF NOT EXISTS delivery_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed'
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Advertising Campaigns Table
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id TEXT PRIMARY KEY,
  campaign_name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  target_url TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 8. Ad Clicks Table (Privacy-first click tracking without IP collection or PII)
CREATE TABLE IF NOT EXISTS ad_clicks (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  tracking_token TEXT UNIQUE NOT NULL, -- Opaque secure UUID
  user_agent TEXT,
  clicked_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES ad_campaigns(id) ON DELETE CASCADE
);

-- Indexes for performance and lookup
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_user_id ON delivery_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_clicks_token ON ad_clicks(tracking_token);
