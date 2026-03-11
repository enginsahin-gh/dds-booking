export type PaymentMode = 'none' | 'optional' | 'deposit' | 'full';
export type DepositType = 'percentage' | 'fixed';

export interface Salon {
  id: string;
  slug: string;
  name: string;
  email: string;
  phone: string | null;
  owner_id: string;
  timezone: string;
  payment_mode: PaymentMode;
  deposit_type: DepositType;
  deposit_value: number; // percentage (25 = 25%) or fixed cents-equivalent in euros (10.00 = €10)
  buffer_minutes: number; // minutes between appointments (0, 5, 10, 15)
  slot_step_minutes?: number; // 15 or 30 (admin calendar granularity)
  max_booking_weeks: number; // 0 = unlimited, otherwise max weeks ahead
  google_place_id: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  cancellation_policy: string | null;
  location_info: string | null;
  reschedule_enabled: boolean;
  customer_login_enabled?: boolean;
  customer_login_methods?: string[];
  guest_booking_allowed?: boolean;
  waitlist_enabled?: boolean;
  // Tokens moved to salon_secrets (not accessible from frontend)
  mollie_profile_id: string | null;
  mollie_organization_id: string | null;
  mollie_organization_name: string | null;
  mollie_connected_at: string | null;
  google_calendar_connected_at: string | null;
  google_calendar_name: string | null;
  google_calendar_sync_enabled: boolean | null;
  google_calendar_last_sync_at: string | null;
  subscription_status: 'none' | 'trial' | 'active' | 'paused' | 'cancelled';
  trial_started_at: string | null;
  trial_ends_at: string | null;
  plan_type: string | null;
  created_at: string;
}

export interface Staff {
  id: string;
  salon_id: string;
  name: string;
  photo_url: string | null;
  is_active: boolean;
  all_services: boolean;
  sort_order: number;
  created_at: string;
}

export interface StaffService {
  staff_id: string;
  service_id: string;
}

export interface StaffSchedule {
  id: string;
  staff_id: string;
  day_of_week: number; // 0=monday, 6=sunday
  start_time: string; // "HH:mm:ss"
  end_time: string;
  is_working: boolean;
}

export interface StaffBlock {
  id: string;
  staff_id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_at: string;
}

export interface ServiceCategory {
  id: string;
  salon_id: string;
  name: string;
  sort_order: number;
  icon: string | null;
  created_at: string;
}

export interface Service {
  id: string;
  salon_id: string;
  category_id: string | null;
  name: string;
  duration_min: number;
  price_cents: number;
  is_active: boolean;
  sort_order: number;
  tags?: string[] | null;
  created_at: string;
}

export interface ServiceAddon {
  id: string;
  salon_id: string;
  service_id: string;
  name: string;
  price_cents: number;
  duration_min: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Booking {
  id: string;
  salon_id: string;
  service_id: string;
  staff_id: string;
  start_at: string;
  end_at: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  status: 'confirmed' | 'cancelled' | 'pending_payment' | 'no_show' | 'completed';
  payment_status: 'none' | 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_paid';
  payment_type: 'none' | 'optional' | 'deposit' | 'full';
  amount_total_cents: number;
  amount_paid_cents: number;
  amount_due_cents: number;
  refund_status: 'none' | 'pending' | 'refunded' | 'failed';
  deposit_amount: number | null;
  cancel_token: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface PublicBooking {
  staff_id: string;
  start_at: string;
  end_at: string;
}

export interface TimeSlot {
  time: string; // ISO string
  staffId: string;
}

export interface BookingFormData {
  salonId: string;
  serviceId: string;
  staffId: string;
  startAt: string;
  endAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
}

// 1=service, 2=staff, 3=datetime, 4=form+summary, 5=payment, 6=confirmation
export type BookingStep = 1 | 2 | 3 | 4 | 5 | 6;
