import { useState, useEffect, lazy, Suspense } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useSalon } from '../../hooks/useSalon';
import { supabase } from '../../lib/supabase';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Card, CardSection } from '../../components/ui/Card';
import { Tabs, TabPanel } from '../../components/ui/Tabs';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import type { Salon, PaymentMode, DepositType } from '../../lib/types';
import type { User } from '@supabase/supabase-js';

const SubscriptionTab = lazy(() => import('./settings/SubscriptionTab').then(m => ({ default: m.SubscriptionTab })));
const GeneralTab = lazy(() => import('./settings/GeneralTab').then(m => ({ default: m.GeneralTab })));
const AppointmentsTab = lazy(() => import('./settings/AppointmentsTab').then(m => ({ default: m.AppointmentsTab })));
const PaymentsTab = lazy(() => import('./settings/PaymentsTab').then(m => ({ default: m.PaymentsTab })));
const BrandingTab = lazy(() => import('./settings/BrandingTab').then(m => ({ default: m.BrandingTab })));
const IntegrationsTab = lazy(() => import('./settings/IntegrationsTab').then(m => ({ default: m.IntegrationsTab })));

const settingsTabs = [
  {
    id: 'subscription',
    label: 'Abonnement',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/><path d="M7 15h.01M11 15h2"/></svg>,
  },
  {
    id: 'general',
    label: 'Algemeen',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>,
  },
  {
    id: 'location',
    label: 'Locatie',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  },
  {
    id: 'booking',
    label: 'Boekingen',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    id: 'payments',
    label: 'Betalingen',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  },
  {
    id: 'branding',
    label: 'Branding',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  },
  {
    id: 'integrations',
    label: 'Koppelingen',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  },
];

const planLabels: Record<string, string> = {
  booking_standalone: 'Booking Standalone',
  booking_website: 'Booking + Website',
};

const statusLabels: Record<string, string> = {
  none: 'Geen abonnement',
  trial: 'Trial',
  active: 'Actief',
  paused: 'Gepauzeerd',
  cancelled: 'Geannuleerd',
  past_due: 'Betaling mislukt',
};

function SettingsTabLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Spinner />
    </div>
  );
}

export function SettingsPage() {
  const { salon } = useOutletContext<{ salon: Salon | null; user: User }>();
  const { updateSalon } = useSalon(undefined, undefined, salon?.id);
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('subscription');
  const [searchParams, setSearchParams] = useSearchParams();

  // General settings state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [slug, setSlug] = useState('');
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [slotStepMinutes, setSlotStepMinutes] = useState(15);
  const [maxBookingWeeks, setMaxBookingWeeks] = useState(4);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');
  const [locationInfo, setLocationInfo] = useState('');
  const [rescheduleEnabled, setRescheduleEnabled] = useState(true);
  const [customerLoginEnabled, setCustomerLoginEnabled] = useState(false);
  const [guestBookingAllowed, setGuestBookingAllowed] = useState(true);
  const [customerLoginMethods, setCustomerLoginMethods] = useState<string[]>(['password', 'otp']);
  const [waitlistEnabled, setWaitlistEnabled] = useState(true);
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [reviewEnabled, setReviewEnabled] = useState(false);
  const [reviewAfterVisit, setReviewAfterVisit] = useState(3);
  const [saving, setSaving] = useState(false);

  // Branding state
  const [brandColor, setBrandColor] = useState('#8B5CF6');
  const [brandColorText, setBrandColorText] = useState('#FFFFFF');
  const [logoUrl, setLogoUrl] = useState('');
  const [emailFooterText, setEmailFooterText] = useState('');
  const [gradientEnabled, setGradientEnabled] = useState(false);
  const [gradientFrom, setGradientFrom] = useState('#8B5CF6');
  const [gradientTo, setGradientTo] = useState('#6366F1');
  const [gradientDirection, setGradientDirection] = useState('135deg');
  const [emailPreferences, setEmailPreferences] = useState<Record<string, boolean>>({
    confirmation: true, notification: true, cancellation: true,
    cancellation_notification: true, reminder_24h: true, reminder_1h: true, review_request: false,
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [emailPreviewType, setEmailPreviewType] = useState<string>('confirmation');

  // Payment state
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('none');
  const [depositType, setDepositType] = useState<DepositType>('percentage');
  const [depositValue, setDepositValue] = useState(25);

  // Handle Mollie OAuth callback
  useEffect(() => {
    const mollieStatus = searchParams.get('mollie');
    if (mollieStatus === 'success') {
      addToast('success', 'Mollie account succesvol gekoppeld!');
      setSearchParams({}, { replace: true });
      setActiveTab('payments');
    } else if (mollieStatus === 'error') {
      addToast('error', `Mollie koppeling mislukt: ${searchParams.get('reason') || 'onbekend'}`);
      setSearchParams({}, { replace: true });
      setActiveTab('payments');
    }

    // Handle Google Calendar OAuth callback
    const googleStatus = searchParams.get('google');
    if (googleStatus === 'connected' || googleStatus === 'error') {
      setActiveTab('integrations');
    }
  }, [searchParams]);

  // Sync state from salon
  useEffect(() => {
    if (salon) {
      setName(salon.name);
      setEmail(salon.email);
      setPhone(salon.phone || '');
      setSlug((salon as any).slug || '');
      setBufferMinutes(salon.buffer_minutes || 0);
      setSlotStepMinutes((salon as any).slot_step_minutes ?? 15);
      setMaxBookingWeeks((salon as any).max_booking_weeks ?? 4);
      setAddress((salon as any).address || '');
      setCity((salon as any).city || '');
      setPostalCode((salon as any).postal_code || '');
      setCancellationPolicy((salon as any).cancellation_policy || '');
      setLocationInfo((salon as any).location_info || '');
      setRescheduleEnabled((salon as any).reschedule_enabled ?? true);
      setCustomerLoginEnabled((salon as any).customer_login_enabled ?? false);
      setGuestBookingAllowed((salon as any).guest_booking_allowed ?? true);
      setCustomerLoginMethods((salon as any).customer_login_methods || ['password', 'otp']);
      setWaitlistEnabled((salon as any).waitlist_enabled ?? true);
      setGooglePlaceId((salon as any).google_place_id || '');
      setReviewEnabled((salon as any).review_enabled ?? false);
      setReviewAfterVisit((salon as any).review_after_visit ?? 3);
      setPaymentMode(salon.payment_mode || 'deposit');
      setDepositType(salon.deposit_type || 'percentage');
      setDepositValue(salon.deposit_value || 25);
      setBrandColor((salon as any).brand_color || '#8B5CF6');
      setBrandColorText((salon as any).brand_color_text || '#FFFFFF');
      setLogoUrl((salon as any).logo_url || '');
      setEmailFooterText((salon as any).email_footer_text || '');
      setGradientEnabled((salon as any).brand_gradient_enabled || false);
      setGradientFrom((salon as any).brand_gradient_from || '#8B5CF6');
      setGradientTo((salon as any).brand_gradient_to || '#6366F1');
      setGradientDirection((salon as any).brand_gradient_direction || '135deg');
      if ((salon as any).email_preferences) {
        setEmailPreferences(prev => ({ ...prev, ...(salon as any).email_preferences }));
      }
    }
  }, [salon]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSalon({
        name, email, phone: phone || null,
        address: address || null, city: city || null, postal_code: postalCode || null,
        cancellation_policy: cancellationPolicy || null,
        location_info: locationInfo || null,
        reschedule_enabled: rescheduleEnabled,
        customer_login_enabled: customerLoginEnabled,
        customer_login_methods: customerLoginMethods,
        guest_booking_allowed: guestBookingAllowed,
        waitlist_enabled: waitlistEnabled,
        buffer_minutes: bufferMinutes,
        slot_step_minutes: slotStepMinutes,
        max_booking_weeks: maxBookingWeeks,
        google_place_id: googlePlaceId || null,
        review_enabled: reviewEnabled, review_after_visit: reviewAfterVisit,
        brand_color: brandColor || '#8B5CF6',
        brand_color_text: brandColorText || '#FFFFFF',
        logo_url: logoUrl || null,
        email_footer_text: emailFooterText || null,
        brand_gradient_enabled: gradientEnabled,
        brand_gradient_from: gradientFrom || null,
        brand_gradient_to: gradientTo || null,
        brand_gradient_direction: gradientDirection || '135deg',
        email_preferences: emailPreferences,
      });
      addToast('success', 'Instellingen opgeslagen');
    } catch {
      addToast('error', 'Kon instellingen niet opslaan');
    }
    setSaving(false);
  };

  if (!salon) return null;

  const status = (salon.subscription_status || 'none') as string;
  const statusLabel = statusLabels[status] || 'Onbekend';
  const planLabel = salon.plan_type ? (planLabels[salon.plan_type] || salon.plan_type) : 'Geen plan';
  const trialEnds = salon.trial_ends_at ? new Date(salon.trial_ends_at) : null;
  const daysLeft = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
  const statusTone = status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : status === 'trial' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : status === 'paused' || status === 'cancelled' || status === 'past_due' ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-gray-100 text-gray-600 border-gray-200';
  const ctaLabel = status === 'active' ? 'Beheer abonnement' : 'Activeer abonnement';

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Instellingen</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Beheer je salon profiel en voorkeuren</p>
        </div>
        <div className="bg-white border border-gray-200/70 rounded-2xl p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Plan & status</div>
              <div className="mt-2 text-[16px] font-bold text-gray-900">{planLabel}</div>
              <div className="text-[12px] text-gray-500 mt-1">
                {status === 'trial' && trialEnds ? `Trial eindigt over ${daysLeft} ${daysLeft === 1 ? 'dag' : 'dagen'}` : statusLabel}
              </div>
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusTone}`}>
              {statusLabel}
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <Button variant="secondary" onClick={() => setActiveTab('subscription')}>
              {ctaLabel}
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Opslaan
            </Button>
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <Tabs tabs={settingsTabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <div className="bg-white border border-gray-200/70 rounded-2xl p-2">
            {settingsTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all ${
                  activeTab === tab.id ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className={`flex items-center justify-center w-7 h-7 rounded-lg ${activeTab === tab.id ? 'bg-white/15 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-w-2xl">
          <TabPanel active={activeTab === 'subscription'}>
            <Suspense fallback={<SettingsTabLoader />}>
              <SubscriptionTab salon={salon} />
            </Suspense>
          </TabPanel>

        <TabPanel active={activeTab === 'general'}>
          <Suspense fallback={<SettingsTabLoader />}>
            <GeneralTab
              name={name} setName={setName}
              email={email} setEmail={setEmail}
              phone={phone} setPhone={setPhone}
              slug={slug}
            />
          </Suspense>
        </TabPanel>

        <TabPanel active={activeTab === 'location'}>
          <Card padding="lg">
            <CardSection title="Locatie" description="Adres en route-informatie voor je klanten.">
              <div className="space-y-4">
                <Input label="Adres" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Keizersgracht 123" />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input label="Postcode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="1015 CJ" />
                  <div className="sm:col-span-2">
                    <Input label="Plaats" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Amsterdam" />
                  </div>
                </div>
                <Textarea
                  label="Parkeer- en route-informatie"
                  value={locationInfo}
                  onChange={(e) => setLocationInfo(e.target.value)}
                  placeholder="Bijv. Gratis parkeren op eigen terrein achter de salon."
                  rows={3}
                  hint="Wordt getoond in de bevestigingsmail aan klanten."
                />
              </div>
            </CardSection>
          </Card>
        </TabPanel>

        <TabPanel active={activeTab === 'booking'}>
          <Suspense fallback={<SettingsTabLoader />}>
            <AppointmentsTab
              bufferMinutes={bufferMinutes} setBufferMinutes={setBufferMinutes}
              slotStepMinutes={slotStepMinutes} setSlotStepMinutes={setSlotStepMinutes}
              maxBookingWeeks={maxBookingWeeks} setMaxBookingWeeks={setMaxBookingWeeks}
              cancellationPolicy={cancellationPolicy} setCancellationPolicy={setCancellationPolicy}
              rescheduleEnabled={rescheduleEnabled} setRescheduleEnabled={setRescheduleEnabled}
              customerLoginEnabled={customerLoginEnabled} setCustomerLoginEnabled={setCustomerLoginEnabled}
              guestBookingAllowed={guestBookingAllowed} setGuestBookingAllowed={setGuestBookingAllowed}
              customerLoginMethods={customerLoginMethods} setCustomerLoginMethods={setCustomerLoginMethods}
              waitlistEnabled={waitlistEnabled} setWaitlistEnabled={setWaitlistEnabled}
            />
          </Suspense>
        </TabPanel>

        <TabPanel active={activeTab === 'payments'}>
          <Suspense fallback={<SettingsTabLoader />}>
            <PaymentsTab
              salon={salon}
              paymentMode={paymentMode} setPaymentMode={setPaymentMode}
              depositType={depositType} setDepositType={setDepositType}
              depositValue={depositValue} setDepositValue={setDepositValue}
            />
          </Suspense>
        </TabPanel>

        <TabPanel active={activeTab === 'branding'}>
          <Suspense fallback={<SettingsTabLoader />}>
            <BrandingTab
              salon={salon}
              name={name}
              brandColor={brandColor} setBrandColor={setBrandColor}
              brandColorText={brandColorText} setBrandColorText={setBrandColorText}
              logoUrl={logoUrl} setLogoUrl={setLogoUrl}
              emailFooterText={emailFooterText} setEmailFooterText={setEmailFooterText}
              gradientEnabled={gradientEnabled} setGradientEnabled={setGradientEnabled}
              gradientFrom={gradientFrom} setGradientFrom={setGradientFrom}
              gradientTo={gradientTo} setGradientTo={setGradientTo}
              gradientDirection={gradientDirection} setGradientDirection={setGradientDirection}
              emailPreferences={emailPreferences} setEmailPreferences={setEmailPreferences}
              emailPreviewType={emailPreviewType} setEmailPreviewType={setEmailPreviewType}
              logoUploading={logoUploading} setLogoUploading={setLogoUploading}
              onSave={handleSave}
              saving={saving}
            />
          </Suspense>
        </TabPanel>

        <TabPanel active={activeTab === 'integrations'}>
          <Suspense fallback={<SettingsTabLoader />}>
            <IntegrationsTab
              salon={salon}
              googlePlaceId={googlePlaceId} setGooglePlaceId={setGooglePlaceId}
              reviewEnabled={reviewEnabled} setReviewEnabled={setReviewEnabled}
              reviewAfterVisit={reviewAfterVisit} setReviewAfterVisit={setReviewAfterVisit}
            />
          </Suspense>
        </TabPanel>
      </div>
    </div>
    </div>
  );
}
