-- Migration 012: Enhanced branding system
-- Gradient support, email preferences per type

-- Gradient header fields
ALTER TABLE salons ADD COLUMN IF NOT EXISTS brand_gradient_enabled BOOLEAN DEFAULT false;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS brand_gradient_from TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS brand_gradient_to TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS brand_gradient_direction TEXT DEFAULT '135deg';

-- Email preferences: per-type toggle (JSON)
ALTER TABLE salons ADD COLUMN IF NOT EXISTS email_preferences JSONB DEFAULT '{
  "confirmation": true,
  "notification": true,
  "cancellation": true,
  "cancellation_notification": true,
  "reminder_24h": true,
  "reminder_1h": true,
  "review_request": false
}'::jsonb;

-- Supabase Storage bucket: salon-assets (created via API, documented here)
-- Bucket: salon-assets, public: true, max 2MB, image types only
-- Folder structure: salon-assets/{salon_id}/logo.png
-- RLS: owners can upload/update, public can read
