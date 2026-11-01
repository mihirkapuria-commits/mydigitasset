-- MyDigitAsset Unique Index for User Subscriptions (0003_category_subscriptions_unique.sql)
-- Prevents duplicate subscription records for the same user and category.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_subscriptions_user_category ON user_subscriptions(user_id, category_id);
