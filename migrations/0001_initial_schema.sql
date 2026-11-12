-- MyDigitAsset D1 Database Schema Migration (0001_initial_schema.sql)
-- Designed for Cloudflare D1 (SQLite) with UTC timestamps, relational integrity, and strict privacy safeguards (no IP collection).

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  first_name TEXT,
  surname TEXT,
  email TEXT UNIQUE NOT NULL,
  country_code TEXT DEFAULT '+91',
  mobile_number TEXT,
  mobile TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'customer',
  category TEXT NOT NULL,
  categories TEXT NOT NULL, -- Stored as JSON array string
  trial_start TEXT NOT NULL,
  trial_expiry TEXT NOT NULL,
  trial_expires_at TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trial', -- 'trial', 'active_paid', 'expired'
  payment_status TEXT NOT NULL DEFAULT 'none', -- 'none', 'pending', 'verified', 'rejected'
  access_override INTEGER NOT NULL DEFAULT 0, -- 0 or 1 for manual access override without changing payment status
  telegram_connected INTEGER NOT NULL DEFAULT 0, -- 0 or 1
  telegram_username TEXT,
  telegram_chat_id TEXT,
  created_at TEXT NOT NULL
);

-- 2. Categories Table (Includes category-specific pricing and initial seed categories)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  base_price REAL NOT NULL DEFAULT 252.00,
  gst_rate REAL NOT NULL DEFAULT 18.00,
  active INTEGER NOT NULL DEFAULT 1 -- 0 or 1
);

-- Seed initial India categories
INSERT OR IGNORE INTO categories (id, title, description, base_price, gst_rate, active) VALUES 
('startups', 'India Startups, Startup Discovery & Funding', 'Startup launches, emerging companies, funding rounds, investors, venture capital, accelerators, incubators, fundraising, and startup growth.', 252.00, 18.00, 1),
('banking_fintech', 'India Banking & FinTech', 'Banking, digital payments, fintech, lending, financial services, and relevant regulation.', 252.00, 18.00, 1),
('real_estate', 'India Real Estate & Infrastructure', 'Property markets, real estate businesses, housing, commercial property, construction, and infrastructure.', 252.00, 18.00, 1),
('it_ai', 'India IT, AI, Cybersecurity & General Technology', 'IT services, artificial intelligence, cybersecurity, software, digital technology, and technology companies.', 252.00, 18.00, 1),
('consumer_fmcg', 'India Consumer & FMCG', 'Consumer products, fast-moving consumer goods, retail brands, and consumer markets.', 252.00, 18.00, 1),
('manufacturing_auto', 'India Manufacturing & Auto', 'Manufacturing, automobiles, components, industrial production, and supply chains.', 252.00, 18.00, 1),
('energy_renewables', 'India Energy & Renewables', 'Power, oil and gas where relevant, clean energy, renewable projects, and energy technology.', 252.00, 18.00, 1),
('economy_business', 'India Economy & Business', 'Macroeconomics, major business developments, corporate performance, trade, and economic policy.', 252.00, 18.00, 1),
('hr_employment', 'India HR & Employment', 'Recruitment, employment trends, workplace developments, skills, and human resources.', 252.00, 18.00, 1),
('marketing_advertising', 'India Marketing & Advertising', 'Advertising, digital marketing, agencies, media buying, brand campaigns, and marketing technology.', 252.00, 18.00, 1);

-- 3. Settings Table (Bank & UPI details initialized blank, bootstrap status flag)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('bank_name', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('account_name', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('account_number', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('ifsc_code', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('upi_id', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('admin_initialized', 'false');

-- 4. Payments Table
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  category_id TEXT NOT NULL,
  amount_base REAL NOT NULL,
  gst REAL NOT NULL,
  total_amount REAL NOT NULL,
  utr TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'verified', 'rejected'
  submitted_at TEXT NOT NULL,
  verified_at TEXT,
  verified_by TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 5. Sessions Table
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 6. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL
);

-- 7. Delivery Logs Table
CREATE TABLE IF NOT EXISTS delivery_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'failed'
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 7b. Telegram Verification Tokens Table
CREATE TABLE IF NOT EXISTS telegram_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. Advertising Campaigns Table
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id TEXT PRIMARY KEY,
  campaign_name TEXT NOT NULL,
  category_id TEXT NOT NULL,
  target_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id)
);

-- 9. Ad Clicks Table
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
