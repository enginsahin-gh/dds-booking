-- Trial system columns for salons table
ALTER TABLE salons ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'none';
ALTER TABLE salons ADD COLUMN IF NOT EXISTS mollie_customer_id TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS mollie_subscription_id TEXT;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'booking_standalone';
