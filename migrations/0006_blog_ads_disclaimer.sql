-- MyDigitAsset blog advertising controls and editable disclaimer (0006).
-- Additive migration: preserves existing customer, payment, subscription and delivery records.
ALTER TABLE blog_articles ADD COLUMN ad_placements_json TEXT NOT NULL DEFAULT '["blog-top","blog-inline","blog-bottom","blog-left","blog-right"]';
ALTER TABLE blog_articles ADD COLUMN disclaimer_override INTEGER NOT NULL DEFAULT -1 CHECK (disclaimer_override IN (-1, 0, 1));
CREATE TABLE IF NOT EXISTS site_display_settings (
  setting_key TEXT PRIMARY KEY, setting_value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_by TEXT NOT NULL DEFAULT ''
);
INSERT OR IGNORE INTO site_display_settings (setting_key, setting_value) VALUES
('ads_enabled', '1'), ('disclaimer_enabled', '1'),
('disclaimer_text', 'Please exercise caution when viewing advertisements displayed on this website. Advertisements are provided by third-party advertisers and are not necessarily endorsed or verified by MyDigitAsset. Any decision to click on an advertisement, purchase a product, or use an advertised service is entirely independent of MyDigitAsset.'),
('disclaimer_background_color', '#FCE8E8'), ('disclaimer_text_color', '#7F1D1D'),
('disclaimer_font_size', '14'), ('disclaimer_font_weight', '500'), ('disclaimer_alignment', 'left');
INSERT OR IGNORE INTO adsense_slots (placement_key, display_name, enabled) VALUES
('blog-left', 'Left side of blog article (desktop)', 1),
('blog-right', 'Right side of blog article (desktop)', 1);
UPDATE adsense_slots SET enabled = 1 WHERE placement_key IN ('blog-top', 'blog-inline', 'blog-bottom');
