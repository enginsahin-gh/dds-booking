-- ============================================
-- 004: Payment Settings & Deposit System
-- ============================================

-- Add payment configuration to salons
ALTER TABLE salons ADD COLUMN IF NOT EXISTS payment_mode text DEFAULT 'deposit'
  CHECK (payment_mode IN ('none', 'deposit', 'full'));
ALTER TABLE salons ADD COLUMN IF NOT EXISTS deposit_type text DEFAULT 'percentage'
  CHECK (deposit_type IN ('percentage', 'fixed'));
ALTER TABLE salons ADD COLUMN IF NOT EXISTS deposit_value decimal(10,2) DEFAULT 25.00;
  -- percentage: 25 = 25%, fixed: 10.00 = €10,00
ALTER TABLE salons ADD COLUMN IF NOT EXISTS mollie_api_key text;
  -- Per-salon Mollie key (encrypted at rest via Supabase)

-- Add payment tracking to bookings
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_type text DEFAULT 'none'
  CHECK (payment_type IN ('none', 'deposit', 'full'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount_total_cents int DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount_paid_cents int DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS amount_due_cents int DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_status text DEFAULT 'none'
  CHECK (refund_status IN ('none', 'pending', 'refunded', 'failed'));

-- Update status check to include pending_payment
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check
  CHECK (status IN ('confirmed', 'cancelled', 'pending_payment', 'no_show'));

-- Update payment_status check to include refunded
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_payment_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_payment_status_check
  CHECK (payment_status IN ('none', 'pending', 'paid', 'failed', 'refunded', 'partially_paid'));

-- Refunds table
CREATE TABLE IF NOT EXISTS refunds (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  payment_id uuid REFERENCES payments(id) ON DELETE CASCADE,
  mollie_refund_id text UNIQUE,
  amount_cents int NOT NULL,
  reason text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'refunded', 'failed')),
  created_at timestamptz DEFAULT now(),
  processed_at timestamptz
);

-- RLS for refunds
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read refunds" ON refunds FOR SELECT USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_refunds_booking ON refunds(booking_id);
CREATE INDEX IF NOT EXISTS idx_refunds_mollie ON refunds(mollie_refund_id);

-- Update payments status check to include refunded
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('open', 'paid', 'failed', 'expired', 'canceled', 'refunded'));
