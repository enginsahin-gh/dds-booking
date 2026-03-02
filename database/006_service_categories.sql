-- 006: Service categories + Extra salon columns

CREATE TABLE IF NOT EXISTS service_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_id uuid NOT NULL REFERENCES salons(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  icon text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY categories_select ON service_categories FOR SELECT USING (true);
CREATE POLICY categories_all ON service_categories FOR ALL USING (true) WITH CHECK (true);

-- Add category_id to services
ALTER TABLE services ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES service_categories(id);

-- Add extra salon columns for email/booking features
ALTER TABLE salons
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postal_code text,
  ADD COLUMN IF NOT EXISTS cancellation_policy text,
  ADD COLUMN IF NOT EXISTS location_info text,
  ADD COLUMN IF NOT EXISTS reschedule_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mollie_organization_name text,
  ADD COLUMN IF NOT EXISTS google_place_id text,
  ADD COLUMN IF NOT EXISTS review_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_after_visit integer NOT NULL DEFAULT 3;

-- Leads table for bellure.nl contact form
CREATE TABLE IF NOT EXISTS leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  salon_name text NOT NULL,
  contact_person text NOT NULL,
  contact_method text NOT NULL,
  current_website text,
  message text,
  source text DEFAULT 'bellure-site',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_insert ON leads FOR INSERT WITH CHECK (true);
