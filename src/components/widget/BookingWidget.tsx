import { useState, useEffect, useCallback } from 'react';
import { addMinutes, addWeeks } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { calculateDepositCents, requiresPayment, formatCents } from '../../lib/payment';
import { StepIndicator } from './StepIndicator';
import { ServicePicker } from './ServicePicker';
import { StaffPicker } from './StaffPicker';
import { DateTimePicker } from './DateTimePicker';
import { CustomerForm } from './CustomerForm';
import { CustomerLogin } from './CustomerLogin';
import { PaymentStep } from './PaymentStep';
import { Confirmation } from './Confirmation';
import { useSlots } from '../../hooks/useSlots';
import type { Salon, Service, ServiceCategory, Staff, StaffService, TimeSlot, BookingStep } from '../../lib/types';

interface BookingWidgetProps {
  salonSlug: string;
  showSalonHeader?: boolean;
}

const FUNCTIONS_BASE = import.meta.env.VITE_API_URL
  || (typeof document !== 'undefined' && document.querySelector('script[data-bellure-origin]')?.getAttribute('data-bellure-origin'))
  || 'https://api.bellure.nl';

function BellureBadge() {
  return (
    <div className="bellure-powered-by">
      <span>Powered by</span>
      <a href="https://bellure.nl" target="_blank" rel="noopener noreferrer">Bellure</a>
    </div>
  );
}

export function BookingWidget({ salonSlug, showSalonHeader = false }: BookingWidgetProps) {
  const [step, setStep] = useState<BookingStep>(1);
  const [salon, setSalon] = useState<Salon | null>(null);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffServices, setStaffServices] = useState<StaffService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Available working days (0=Sun..6=Sat) for calendar highlighting
  const [workingDays, setWorkingDays] = useState<Set<number>>(new Set());

  // Selections — now multi-select
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [staffConfirmed, setStaffConfirmed] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  // Payment
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  // Customer data
  const [customerData, setCustomerData] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [customerSession, setCustomerSession] = useState<any>(null);
  const [customerProfile, setCustomerProfile] = useState<{ name: string; email: string; phone: string | null } | null>(null);

  // Confirmation data
  const [confirmedStaff, setConfirmedStaff] = useState<Staff | null>(null);
  const [confirmedStartAt, setConfirmedStartAt] = useState('');
  const [confirmedEndAt, setConfirmedEndAt] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [depositPaidCents, setDepositPaidCents] = useState(0);

  const timezone = salon?.timezone || 'Europe/Amsterdam';

  // Computed totals from selected services
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.duration_min, 0);
  const totalPriceCents = selectedServices.reduce((sum, s) => sum + s.price_cents, 0);

  // Filter staff based on selected services
  // staff.all_services=true → can do everything (backward compat)
  // staff.all_services=false → only services in staff_services table
  const filteredStaff = staff.filter((member) => {
    if (member.all_services) return true;
    if (selectedServices.length === 0) return true;
    const memberServiceIds = new Set(
      staffServices.filter(ss => ss.staff_id === member.id).map(ss => ss.service_id)
    );
    return selectedServices.every(svc => memberServiceIds.has(svc.id));
  });

  // When no staff can do the full combination, build per-service availability info
  const noStaffForCombo = selectedServices.length > 0 && filteredStaff.length === 0;
  const perServiceStaff = noStaffForCombo
    ? selectedServices.map(svc => ({
        service: svc,
        availableStaff: staff.filter(member => {
          if (member.all_services) return true;
          const memberServiceIds = new Set(
            staffServices.filter(ss => ss.staff_id === member.id).map(ss => ss.service_id)
          );
          return memberServiceIds.has(svc.id);
        }),
      }))
    : [];

  // Booking horizon — max weeks ahead (0 = unlimited)
  const maxBookingWeeks = (salon as any)?.max_booking_weeks ?? 4;
  const maxBookingDate = maxBookingWeeks > 0 ? addWeeks(new Date(), maxBookingWeeks) : null;

  const customerLoginEnabled = (salon as any)?.customer_login_enabled ?? false;
  const customerLoginMethods = (salon as any)?.customer_login_methods || ['password', 'otp'];
  const guestBookingAllowed = (salon as any)?.guest_booking_allowed ?? true;
  const waitlistEnabled = (salon as any)?.waitlist_enabled ?? true;
  const loginRequired = customerLoginEnabled && !guestBookingAllowed;

  // Slots — use total duration for availability check (with buffer)
  // Only pass filtered staff so slots are only calculated for staff who can do the service
  const bufferMinutes = salon?.buffer_minutes || 0;
  const { slots, loading: slotsLoading } = useSlots(
    selectedDate,
    totalDuration,
    filteredStaff,
    staffConfirmed ? selectedStaffId : null,
    timezone,
    bufferMinutes
  );

  // Payment return state
  const [paymentReturn, setPaymentReturn] = useState(false);
  const [paymentReturnStatus, setPaymentReturnStatus] = useState<'loading' | 'paid' | 'failed'>('loading');
  const [paymentReturnBooking, setPaymentReturnBooking] = useState<{
    customerName: string;
    serviceName: string;
    staffName: string;
    startAt: string;
    endAt: string;
    priceCents: number;
    paidCents: number;
    paymentMode: string;
  } | null>(null);

  // Load salon data + check payment return
  useEffect(() => {
    const init = async () => {
      setLoading(true);

      const params = new URLSearchParams(window.location.search);
      const isPaymentReturn = params.get('payment_return') === '1';
      const returnBookingId = params.get('booking_id');

      const { data: salonData, error: salonErr } = await supabase
        .from('salons')
        .select('*')
        .eq('slug', salonSlug)
        .single();

      if (salonErr || !salonData) {
        setError('Dit boekingssysteem is niet beschikbaar');
        setLoading(false);
        return;
      }

      setSalon(salonData);

      const [servicesRes, staffRes, categoriesRes, schedulesRes, staffServicesRes] = await Promise.all([
        supabase.from('services').select('*').eq('salon_id', salonData.id).eq('is_active', true).order('sort_order'),
        supabase.from('staff').select('*').eq('salon_id', salonData.id).eq('is_active', true).order('sort_order'),
        supabase.from('service_categories').select('*').eq('salon_id', salonData.id).order('sort_order'),
        supabase.from('staff_schedules').select('day_of_week, staff_id').eq('is_working', true),
        supabase.from('staff_services').select('staff_id, service_id'),
      ]);

      // Build set of working days (JS: 0=Sun, but DB might use 0=Mon — check)
      // DB uses: 0=Monday..6=Sunday. JS Date.getDay(): 0=Sunday..6=Saturday
      // Convert: DB 0(Mon)→JS 1, DB 1(Tue)→JS 2, ..., DB 6(Sun)→JS 0
      const activeStaffIds = new Set((staffRes.data || []).map((s: Staff) => s.id));
      const days = new Set<number>();
      for (const sched of (schedulesRes.data || [])) {
        if (activeStaffIds.has(sched.staff_id)) {
          const jsDay = sched.day_of_week === 6 ? 0 : sched.day_of_week + 1;
          days.add(jsDay);
        }
      }
      setWorkingDays(days);

      setServices(servicesRes.data || []);
      setCategories(categoriesRes.data || []);
      setStaff(staffRes.data || []);
      setStaffServices(staffServicesRes.data || []);

      // Handle payment return
      if (isPaymentReturn && returnBookingId) {
        setPaymentReturn(true);
        setPaymentReturnStatus('loading');

        // Scroll to widget and force-reveal parent elements so user sees the confirmation
        const scrollToBooking = () => {
          const widget = document.getElementById('bellure-booking-widget') || document.getElementById('dds-booking-widget')
            || document.querySelector('[id^="bellure-booking-widget"],[id^="dds-booking-widget"]');
          if (widget) {
            widget.style.opacity = '1';
            widget.style.transform = 'none';
            widget.classList.add('revealed', 'is-visible');
            const section = widget.closest('section') || widget.closest('.booking');
            if (section) {
              section.querySelectorAll('.reveal').forEach((el: Element) => {
                (el as HTMLElement).style.opacity = '1';
                (el as HTMLElement).style.transform = 'none';
                el.classList.add('revealed', 'is-visible');
              });
            }
          }
          const scrollTarget = document.getElementById('booking') || widget;
          if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        // Multiple attempts to ensure scroll works after full page load
        setTimeout(scrollToBooking, 100);
        setTimeout(scrollToBooking, 500);
        setTimeout(scrollToBooking, 1500);

        let attempts = 0;
        const checkPayment = async (): Promise<void> => {
          const { data: booking } = await supabase
            .from('bookings')
            .select('*, services:service_id(name, price_cents), staff:staff_id(name)')
            .eq('id', returnBookingId)
            .single();

          if (!booking) {
            setPaymentReturnStatus('failed');
            return;
          }

          if (booking.payment_status === 'paid' || booking.status === 'confirmed') {
            const svc = booking.services as unknown as { name: string; price_cents: number } | null;
            const stf = booking.staff as unknown as { name: string } | null;
            // For multi-service bookings, show combined name from notes or service name
            const serviceName = booking.notes || svc?.name || '';
            setPaymentReturnBooking({
              customerName: booking.customer_name,
              serviceName,
              staffName: stf?.name || '',
              startAt: booking.start_at,
              endAt: booking.end_at,
              priceCents: booking.amount_total_cents || svc?.price_cents || 0,
              paidCents: booking.amount_paid_cents || 0,
              paymentMode: booking.payment_type || 'none',
            });
            setPaymentReturnStatus('paid');
            window.history.replaceState({}, '', window.location.pathname);
          } else if (booking.payment_status === 'failed' || booking.status === 'cancelled') {
            setPaymentReturnStatus('failed');
          } else if (attempts < 10) {
            attempts++;
            setTimeout(checkPayment, 2000);
          } else {
            if (booking.status === 'confirmed') {
              setPaymentReturnStatus('paid');
            } else {
              setPaymentReturnStatus('failed');
            }
          }
        };

        await checkPayment();
      }

      setLoading(false);
    };

    init();
  }, [salonSlug]);

  // Apply salon branding to the widget root (booking page)
  useEffect(() => {
    if (!salon) return;
    const host = document.querySelector('.bellure-shadow-host') as HTMLElement | null;
    if (!host) return;
    const primary = (salon as any).brand_gradient_from || salon.brand_color || '#8B5CF6';
    host.style.setProperty('--bellure-color-primary', primary);
  }, [salon]);

  // Scroll to the booking section header (above the widget) for better context
  const scrollToWidget = useCallback(() => {
    const section = document.getElementById('booking')
      || document.querySelector('.booking')
      || document.getElementById('bellure-booking-widget') || document.getElementById('dds-booking-widget')
      || document.querySelector('[id^="bellure-booking-widget"],[id^="dds-booking-widget"]');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  useEffect(() => {
    setTimeout(scrollToWidget, 100);
  }, [scrollToWidget]);

  const goToStep = useCallback((s: BookingStep) => {
    setStep(s);
    setTimeout(scrollToWidget, 100);
  }, [scrollToWidget]);

  const handleServicesChange = useCallback((svcs: Service[]) => {
    setSelectedServices(svcs);
  }, []);

  const handleServicesContinue = useCallback(() => {
    if (selectedServices.length > 0) goToStep(2);
  }, [selectedServices, goToStep]);

  const handleCustomerAuth = useCallback((payload: { session: any; customer: { name: string; email: string; phone: string | null } | null }) => {
    setCustomerSession(payload.session);
    setCustomerProfile(payload.customer);
  }, []);

  const handleStaffSelect = useCallback((staffId: string | null) => {
    setSelectedStaffId(staffId);
    setStaffConfirmed(true);
    goToStep(3);
  }, [goToStep]);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  }, []);

  const handleSlotSelect = useCallback((slot: TimeSlot) => {
    setSelectedSlot(slot);
    goToStep(4);
  }, [goToStep]);

  const handleBack = useCallback(() => {
    if (step === 5) {
      goToStep(4);
    } else if (step > 1) {
      goToStep((step - 1) as BookingStep);
    }
  }, [step, goToStep]);

  // Build combined service name for display/storage
  const combinedServiceName = selectedServices.map(s => s.name).join(' + ');

  // Create booking via Worker API (server-side validation, rate limiting, atomic)
  const handleBooking = useCallback(async (data: { name: string; email: string; phone: string; hp?: string }) => {
    if (!salon || selectedServices.length === 0 || !selectedSlot) return;

    setBookingLoading(true);
    setBookingError(null);
    setCustomerData(data);

    const startAt = selectedSlot.time;
    const endAt = addMinutes(new Date(startAt), totalDuration).toISOString();
    const needsPayment = requiresPayment(salon);
    const depositCents = calculateDepositCents(salon, totalPriceCents);

    try {
      const res = await fetch(`${FUNCTIONS_BASE}/api/create-booking`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          salonId: salon.id,
          staffId: selectedSlot.staffId,
          startAt,
          endAt,
          name: data.name,
          email: data.email,
          phone: data.phone,
          hp: data.hp || '',
          services: selectedServices.map(s => ({
            id: s.id,
            priceCents: s.price_cents,
            durationMin: s.duration_min,
            name: s.name,
          })),
          paymentMode: salon.payment_mode,
          totalPriceCents,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        const err = result.error || '';
        if (err === 'SALON_PAUSED') {
          setError('Online boeken is op dit moment niet beschikbaar. Neem contact op met de salon.');
          setBookingLoading(false);
          return;
        } else if (err === 'SLOT_TAKEN') {
          setBookingError('Dit tijdslot is zojuist geboekt. Kies een ander tijdstip.');
          goToStep(3);
        } else if (err === 'RATE_LIMITED') {
          setBookingError('Te veel boekingen. Probeer het later opnieuw.');
        } else if (err === 'INVALID_EMAIL') {
          setBookingError('Ongeldig e-mailadres. Controleer je gegevens.');
          goToStep(4);
        } else {
          setBookingError('Er ging iets mis. Probeer het opnieuw.');
        }
        setBookingLoading(false);
        return;
      }

      const bookedStaff = staff.find((s) => s.id === selectedSlot.staffId) || null;
      setConfirmedStaff(bookedStaff);
      setConfirmedStartAt(startAt);
      setConfirmedEndAt(endAt);
      setCustomerName(data.name);
      setBookingId(result.bookingId);

      // If customer is logged in but no profile exists yet, create it now
      if (customerSession && !customerProfile) {
        fetch(`${FUNCTIONS_BASE}/api/customers/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${customerSession.access_token}`,
          },
          body: JSON.stringify({
            salonId: salon.id,
            name: data.name,
            phone: data.phone,
            email: data.email,
          }),
        }).catch(() => null);
      }

      if (needsPayment) {
        setDepositPaidCents(depositCents);
        goToStep(5);
      } else {
        setDepositPaidCents(0);
        goToStep(6);
      }
    } catch {
      setBookingError('Er ging iets mis. Probeer het opnieuw.');
    }

    setBookingLoading(false);
  }, [salon, selectedServices, selectedSlot, staff, goToStep, totalDuration, totalPriceCents, customerSession, customerProfile]);

  // Initiate Mollie payment
  const handlePayment = useCallback(async () => {
    if (!salon || selectedServices.length === 0 || !bookingId) return;

    setPaymentLoading(true);
    setPaymentError(null);

    const depositCents = calculateDepositCents(salon, totalPriceCents);
    const isDeposit = salon.payment_mode === 'deposit';
    const description = isDeposit
      ? `Aanbetaling: ${combinedServiceName} bij ${salon.name}`
      : `${combinedServiceName} bij ${salon.name}`;

    // Strip query params AND hash to build clean redirect URL, then re-add hash after params
    const baseUrl = window.location.origin + window.location.pathname;
    const hash = window.location.hash || '';
    const redirectUrl = `${baseUrl}?payment_return=1&booking_id=${bookingId}${hash}`;

    try {
      const res = await fetch(`${FUNCTIONS_BASE}/api/create-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          amount: depositCents,
          description,
          redirectUrl,
          salonSlug: salon.slug,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setPaymentError(errData.error || 'Betaling kon niet worden gestart. Probeer het opnieuw.');
        setPaymentLoading(false);
        return;
      }

      const { checkoutUrl } = await res.json();
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
      } else {
        setPaymentError('Geen betaallink ontvangen. Probeer het opnieuw.');
        setPaymentLoading(false);
      }
    } catch {
      setPaymentError('Er ging iets mis. Probeer het opnieuw.');
      setPaymentLoading(false);
    }
  }, [salon, selectedServices, bookingId, totalPriceCents, combinedServiceName]);

  // Loading state
  if (loading) {
    return (
      <div className="bellure-spinner">
        <div className="bellure-spinner-circle" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bellure-error">
        <p className="bellure-error-title">{error}</p>
      </div>
    );
  }

  if (!services.length || !staff.length) {
    return (
      <div className="bellure-error">
        <p className="bellure-error-title">Er zijn momenteel geen diensten beschikbaar</p>
      </div>
    );
  }

  // Payment return view
  if (paymentReturn) {
    if (paymentReturnStatus === 'loading') {
      return (
        <div className="bellure-spinner" style={{ padding: '40px 0' }}>
          <div className="bellure-spinner-circle" />
          <p style={{ textAlign: 'center', marginTop: 16, color: 'var(--bellure-color-text-muted)', fontSize: '0.9rem' }}>
            Betaalstatus controleren...
          </p>
          <BellureBadge />
        </div>
      );
    }

    if (paymentReturnStatus === 'paid' && paymentReturnBooking) {
      const b = paymentReturnBooking;
      const start = new Date(b.startAt);
      const end = new Date(b.endAt);
      const remainingCents = b.priceCents - b.paidCents;

      return (
        <div className="bellure-confirmation">
          <div className="bellure-confirmation-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="bellure-confirmation-title">Betaling gelukt!</h2>
          <p className="bellure-confirmation-text">
            Bedankt {b.customerName}! Je afspraak is bevestigd. Je ontvangt een bevestiging per e-mail.
          </p>
          <div className="bellure-summary-card" style={{ textAlign: 'left' }}>
            <div className="bellure-summary-row">
              <span className="bellure-summary-label">Behandeling</span>
              <span className="bellure-summary-value">{b.serviceName}</span>
            </div>
            <div className="bellure-summary-row">
              <span className="bellure-summary-label">Medewerker</span>
              <span className="bellure-summary-value">{b.staffName}</span>
            </div>
            <div className="bellure-summary-row">
              <span className="bellure-summary-label">Datum</span>
              <span className="bellure-summary-value">{start.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: timezone })}</span>
            </div>
            <div className="bellure-summary-row">
              <span className="bellure-summary-label">Tijd</span>
              <span className="bellure-summary-value">{start.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: timezone })} – {end.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: timezone })}</span>
            </div>
            <div className="bellure-summary-row">
              <span className="bellure-summary-label">Totaalprijs</span>
              <span className="bellure-summary-value">{formatCents(b.priceCents)}</span>
            </div>
            {b.paidCents > 0 && (
              <>
                <div className="bellure-summary-divider" />
                <div className="bellure-summary-row bellure-summary-row--highlight">
                  <span className="bellure-summary-label">{b.paymentMode === 'deposit' ? 'Aanbetaald' : 'Betaald'}</span>
                  <span className="bellure-summary-value bellure-summary-value--paid">{formatCents(b.paidCents)}</span>
                </div>
                {b.paymentMode === 'deposit' && remainingCents > 0 && (
                  <div className="bellure-summary-row">
                    <span className="bellure-summary-label">Restbedrag in salon</span>
                    <span className="bellure-summary-value">{formatCents(remainingCents)}</span>
                  </div>
                )}
              </>
            )}
          </div>
          <BellureBadge />
        </div>
      );
    }

    return (
      <div className="bellure-confirmation">
        <div className="bellure-confirmation-icon" style={{ background: '#FEF2F2', color: '#DC2626' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 className="bellure-confirmation-title">Betaling niet gelukt</h2>
        <p className="bellure-confirmation-text">
          De betaling is niet gelukt of verlopen. Probeer opnieuw een afspraak te maken.
        </p>
        <button className="bellure-btn bellure-btn-primary" style={{ marginTop: 16 }} onClick={() => { setPaymentReturn(false); window.history.replaceState({}, '', window.location.pathname); }}>
          Opnieuw boeken
        </button>
        <BellureBadge />
      </div>
    );
  }

  const depositCents = salon ? calculateDepositCents(salon, totalPriceCents) : 0;
  const needsPayment = salon ? requiresPayment(salon) : false;

  // Create a virtual "combined service" for PaymentStep and Confirmation
  const combinedService: Service = selectedServices.length > 0 ? {
    ...selectedServices[0],
    name: combinedServiceName,
    duration_min: totalDuration,
    price_cents: totalPriceCents,
  } : selectedServices[0];

  const addressLine = salon
    ? [salon.address, [salon.postal_code, salon.city].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    : '';
  const mapUrl = addressLine ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLine)}` : '';

  return (
    <div>
      {showSalonHeader && salon && (
        <div className="bellure-salon-header">
          <div className="bellure-salon-name">
            {salon.logo_url && (
              <img className="bellure-salon-logo" src={salon.logo_url} alt={`${salon.name} logo`} />
            )}
            <span>{salon.name}</span>
          </div>
          {addressLine && <div className="bellure-salon-meta">{addressLine}</div>}
          <div className="bellure-salon-actions">
            {salon.phone && (
              <a className="bellure-salon-action" href={`tel:${salon.phone}`}>Bel</a>
            )}
            {mapUrl && (
              <a className="bellure-salon-action" href={mapUrl} target="_blank" rel="noopener">Route</a>
            )}
          </div>
        </div>
      )}

      <StepIndicator currentStep={step} totalSteps={needsPayment ? 6 : 5} />

      {bookingError && step < 5 && (
        <div style={{ padding: '8px 16px', marginBottom: 12, background: '#FEF2F2', borderRadius: 8, color: '#DC2626', fontSize: '0.875rem', textAlign: 'center' }}>
          {bookingError}
        </div>
      )}

      {step === 1 && (
        <ServicePicker
          services={services}
          categories={categories}
          selectedIds={selectedServices.map(s => s.id)}
          onSelect={handleServicesChange}
          onContinue={handleServicesContinue}
        />
      )}

      {step === 2 && (
        <div>
          <StaffPicker
            staff={filteredStaff}
            selectedId={selectedStaffId}
            onSelect={handleStaffSelect}
            noStaffForCombo={noStaffForCombo}
            perServiceStaff={perServiceStaff}
            onBack={handleBack}
          />
          {!noStaffForCombo && (
            <div className="bellure-btn-group">
              <button className="bellure-btn bellure-btn-secondary" onClick={handleBack}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: "-3px"}}><polyline points="19 12 5 12"/><polyline points="12 19 5 12 12 5"/></svg> Terug</button>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div>
          <DateTimePicker
            selectedDate={selectedDate}
            onSelectDate={handleDateSelect}
            selectedSlot={selectedSlot}
            onSelectSlot={handleSlotSelect}
            slots={slots}
            slotsLoading={slotsLoading}
            timezone={timezone}
            workingDays={workingDays}
            maxDate={maxBookingDate}
            salonId={salon?.id}
            serviceId={selectedServices[0]?.id}
            staffId={selectedStaffId}
            waitlistEnabled={waitlistEnabled}
          />
          <div className="bellure-btn-group">
            <button className="bellure-btn bellure-btn-secondary" onClick={handleBack}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: "-3px"}}><polyline points="19 12 5 12"/><polyline points="12 19 5 12 12 5"/></svg> Terug</button>
            {selectedSlot && (
              <button className="bellure-btn bellure-btn-primary" onClick={() => goToStep(4)}>
                Verder <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: "-3px"}}><polyline points="5 12 19 12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            )}
          </div>
        </div>
      )}

      {step === 4 && (
        <div>
          <h2 className="bellure-step-title">Jouw afspraak</h2>
          <p className="bellure-step-subtitle">Controleer je gegevens en bevestig</p>

          <div className="bellure-step4-layout">
            {/* Left: customer form */}
            <div className="bellure-step4-form">
              {customerLoginEnabled && salon && (
                <CustomerLogin
                  salonId={salon.id}
                  apiBase={FUNCTIONS_BASE}
                  enabled={customerLoginEnabled}
                  methods={customerLoginMethods}
                  guestAllowed={guestBookingAllowed}
                  onAuthenticated={handleCustomerAuth}
                />
              )}

              {(!loginRequired || customerSession) ? (
                <CustomerForm
                  onSubmit={handleBooking}
                  loading={bookingLoading}
                  submitLabel={needsPayment ? 'Verder naar betaling' : 'Bevestig afspraak'}
                  initial={{
                    name: customerProfile?.name || customerData?.name || '',
                    email: customerProfile?.email || customerSession?.user?.email || customerData?.email || '',
                    phone: customerProfile?.phone || customerData?.phone || '',
                  }}
                  lockEmail={!!customerSession}
                />
              ) : (
                <div className="bellure-login-required">
                  Log in om verder te gaan met boeken.
                </div>
              )}
            </div>

            {/* Right: premium summary brief */}
            {selectedServices.length > 0 && selectedSlot && (
              <div className="bellure-step4-summary">
                <div className="bellure-brief">
                  <div className="bellure-brief-header">
                    <div className="bellure-brief-icon">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                      </svg>
                    </div>
                    <span className="bellure-brief-title">Overzicht</span>
                  </div>
                  <div className="bellure-brief-body">
                    <div className="bellure-brief-item">
                      <span className="bellure-brief-label">Behandeling{selectedServices.length > 1 ? 'en' : ''}</span>
                      <span className="bellure-brief-value">{combinedServiceName}</span>
                    </div>
                    <div className="bellure-brief-divider" />
                    <div className="bellure-brief-item">
                      <span className="bellure-brief-label">Stylist</span>
                      <span className="bellure-brief-value">{staff.find(s => s.id === selectedSlot.staffId)?.name || 'Geen voorkeur'}</span>
                    </div>
                    <div className="bellure-brief-divider" />
                    <div className="bellure-brief-item">
                      <span className="bellure-brief-label">Wanneer</span>
                      <span className="bellure-brief-value">
                        {new Date(selectedSlot.time).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })}
                        <br />
                        {new Date(selectedSlot.time).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', timeZone: timezone })} &middot; {totalDuration} min
                      </span>
                    </div>
                    <div className="bellure-brief-divider" />
                    <div className="bellure-brief-total">
                      <span className="bellure-brief-total-label">Totaal</span>
                      <span className="bellure-brief-total-price">{formatCents(totalPriceCents)}</span>
                    </div>
                    {needsPayment && (
                      <div className="bellure-brief-deposit">
                        {salon?.payment_mode === 'deposit' ? 'Aanbetaling' : 'Te betalen'}: <strong>{formatCents(depositCents)}</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bellure-btn-group" style={{ marginTop: 8 }}>
            <button className="bellure-btn bellure-btn-secondary" onClick={handleBack}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: "-3px"}}><polyline points="19 12 5 12"/><polyline points="12 19 5 12 12 5"/></svg> Terug</button>
          </div>
        </div>
      )}

      {step === 5 && salon && selectedServices.length > 0 && selectedSlot && (
        <div>
          <PaymentStep
            salon={salon}
            service={combinedService}
            staff={confirmedStaff}
            slot={selectedSlot}
            depositCents={depositPaidCents}
            totalCents={totalPriceCents}
            customerName={customerName}
            timezone={timezone}
            onPay={handlePayment}
            loading={paymentLoading}
            error={paymentError}
          />
          <div className="bellure-btn-group" style={{ marginTop: 8 }}>
            <button className="bellure-btn bellure-btn-secondary" onClick={handleBack} disabled={paymentLoading}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: "-3px"}}><polyline points="19 12 5 12"/><polyline points="12 19 5 12 12 5"/></svg> Terug
            </button>
          </div>
        </div>
      )}

      {step === 6 && selectedServices.length > 0 && confirmedStaff && (
        <Confirmation
          service={combinedService}
          staff={confirmedStaff}
          startAt={confirmedStartAt}
          endAt={confirmedEndAt}
          customerName={customerName}
          timezone={timezone}
          depositPaidCents={depositPaidCents}
          paymentMode={salon?.payment_mode || 'none'}
        />
      )}

      <BellureBadge />
    </div>
  );
}
