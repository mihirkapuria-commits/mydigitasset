-- Migration 0004: Add explicit profile fields for customers (first_name, surname, country_code, mobile_number, trial_expires_at)
ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN surname TEXT;
ALTER TABLE users ADD COLUMN country_code TEXT DEFAULT '+91';
ALTER TABLE users ADD COLUMN mobile_number TEXT;
ALTER TABLE users ADD COLUMN trial_expires_at TEXT;
