-- MyDigitAsset Admin CMS, Promotions and Affiliate Analytics (0005)
-- Additive only: preserves all existing users, payments, sessions and subscriptions.

CREATE TABLE IF NOT EXISTS managed_categories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  telegram_chat_id TEXT NOT NULL DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed the 15 currently configured Telegram category channels.
INSERT OR IGNORE INTO managed_categories (id, title, telegram_chat_id, active, display_order) VALUES
('banking-fintech', 'Banking and Fintech', '-1004377330142', 1, 1),
('consumer-fmcg', 'India Consumer & FMCG', '-1004356285380', 1, 2),
('economy-business', 'Economy and Business', '-1003773612503', 1, 3),
('energy-renewal', 'Energy and Renewal', '-1004305076677', 1, 4),
('hr-employment', 'HR and Employment', '-1003756538856', 1, 5),
('it-ai-cybersecurity', 'IT AI Cybersecurity', '-1004404579614', 1, 6),
('manufacturing-auto', 'Manufacturing and Auto', '-1004328043113', 1, 7),
('marketing-advertising', 'Marketing and Advertising', '-1003914193738', 1, 8),
('real-estate', 'Real Estate', '-1004322510775', 1, 9),
('bollywood', 'Bollywood', '-1004339246354', 1, 10),
('kids', 'Kids', '-1004312693379', 1, 11),
('women', 'Women', '-1003821497200', 1, 12),
('politics', 'Politics', '-1004350871154', 1, 13),
('stock-market', 'Stock Market', '-1004343493425', 1, 14),
('startup', 'Startup', '-1003720483555', 1, 15);

CREATE TABLE IF NOT EXISTS site_content_items (
  id TEXT PRIMARY KEY,
  section_key TEXT NOT NULL CHECK (section_key IN ('offers', 'utilities', 'how-it-works', 'faq')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  target_url TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'hidden')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_site_content_section_status_order
  ON site_content_items(section_key, status, display_order);

CREATE TABLE IF NOT EXISTS promo_campaigns (
  id TEXT PRIMARY KEY,
  campaign_name TEXT NOT NULL,
  product_name TEXT NOT NULL DEFAULT '',
  message_text TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  affiliate_url TEXT NOT NULL DEFAULT '',
  link_label TEXT NOT NULL DEFAULT 'View Offer',
  affiliate_disclosure TEXT NOT NULL DEFAULT 'We may earn a commission from qualifying purchases.',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent', 'cancelled')),
  scheduled_for TEXT NOT NULL,
  approved_at TEXT,
  approved_by TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_promo_campaigns_schedule_status
  ON promo_campaigns(scheduled_for, status);

CREATE TABLE IF NOT EXISTS promo_deliveries (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  channel_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  telegram_message_id TEXT,
  tracking_code TEXT,
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  delivered_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, channel_id),
  FOREIGN KEY (campaign_id) REFERENCES promo_campaigns(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_promo_deliveries_campaign_status
  ON promo_deliveries(campaign_id, status);

CREATE TABLE IF NOT EXISTS affiliate_tracking_links (
  tracking_code TEXT PRIMARY KEY,
  campaign_id TEXT,
  product_name TEXT NOT NULL DEFAULT '',
  source_type TEXT NOT NULL DEFAULT 'telegram',
  source_id TEXT NOT NULL DEFAULT '',
  outbound_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (campaign_id) REFERENCES promo_campaigns(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id TEXT PRIMARY KEY,
  tracking_code TEXT NOT NULL,
  clicked_at TEXT NOT NULL,
  FOREIGN KEY (tracking_code) REFERENCES affiliate_tracking_links(tracking_code) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_tracking
  ON affiliate_clicks(tracking_code, clicked_at);

CREATE TABLE IF NOT EXISTS affiliate_conversions (
  id TEXT PRIMARY KEY,
  tracking_code TEXT,
  network_name TEXT NOT NULL DEFAULT '',
  order_reference TEXT NOT NULL DEFAULT '',
  order_amount REAL NOT NULL DEFAULT 0,
  commission_amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'confirmed', 'reversed')),
  reported_at TEXT NOT NULL,
  FOREIGN KEY (tracking_code) REFERENCES affiliate_tracking_links(tracking_code) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_affiliate_conversions_tracking
  ON affiliate_conversions(tracking_code, reported_at);

CREATE TABLE IF NOT EXISTS blog_articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  featured_image_url TEXT NOT NULL DEFAULT '',
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'unpublished')),
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_blog_articles_status_published
  ON blog_articles(status, published_at);

CREATE TABLE IF NOT EXISTS site_tools (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  target_url TEXT NOT NULL DEFAULT '',
  icon_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'hidden')),
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_site_tools_status_order
  ON site_tools(status, display_order);

CREATE TABLE IF NOT EXISTS adsense_slots (
  placement_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0,
  client_id TEXT NOT NULL DEFAULT '',
  slot_id TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO adsense_slots (placement_key, display_name, enabled) VALUES
('blog-top', 'Above blog article', 0),
('blog-inline', 'Within blog article', 0),
('blog-bottom', 'Below blog article', 0),
('tools-top', 'Above tools section', 0),
('tools-inline', 'Within tools section', 0),
('tools-bottom', 'Below tools section', 0);
