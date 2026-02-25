-- Migration: Add payments table and payment_status to bookings
-- Run this against Supabase SQL editor

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  mollie_payment_id text UNIQUE NOT NULL,
  amount decimal(10,2) NOT NULL,
  currency text DEFAULT 'EUR',
  status text DEFAULT 'open' CHECK (status IN ('open', 'paid', 'failed', 'expired', 'canceled')),
  method text, -- ideal, creditcard, etc
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  paid_at timestamptz
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Allow public read (widget needs to check payment status)
CREATE POLICY "Public read own payments" ON payments FOR SELECT USING (true);

-- Allow service role to insert/update (Netlify functions use service role key)
CREATE POLICY "Service role manage payments" ON payments FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_payments_booking ON payments(booking_id);
CREATE INDEX idx_payments_mollie ON payments(mollie_payment_id);

-- Add payment columns to bookings table
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'none' CHECK (payment_status IN ('none', 'pending', 'paid', 'failed'));
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_amount decimal(10,2);
