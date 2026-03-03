import { useState, useEffect } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useSalon } from '../../hooks/useSalon';
import { supabase } from '../../lib/supabase';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Toggle } from '../../components/ui/Toggle';
import { Card, CardSection } from '../../components/ui/Card';
import { Tabs, TabPanel } from '../../components/ui/Tabs';
import { useToast } from '../../components/ui/Toast';
import type { Salon, PaymentMode, DepositType } from '../../lib/types';
import type { User } from '@supabase/supabase-js';

import { API_BASE } from '../../lib/config';
import { supabase as sbClient } from '../../lib/supabase';
import {
  suggestColors, suggestTextColor, getBrandBackground, GRADIENT_PRESETS, EMAIL_TYPES,
  type SalonBranding,
} from '../../lib/branding';

const settingsTabs = [
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
    id: 'reviews',
    label: 'Reviews',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  },
  {
    id: 'payments',
    label: 'Betalingen',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  },
  {
    id: 'email',
    label: 'E-mail',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  },
  {
    id: 'embed',
    label: 'Widget',
    icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  },
];

export function SettingsPage() {
  const { salon } = useOutletContext<{ salon: Salon | null; user: User }>();
  const { updateSalon } = useSalon(undefined, undefined, salon?.id);
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('general');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [maxBookingWeeks, setMaxBookingWeeks] = useState(4);
  const [googlePlaceId, setGooglePlaceId] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');
  const [locationInfo, setLocationInfo] = useState('');
  const [rescheduleEnabled, setRescheduleEnabled] = useState(true);
  const [reviewEnabled, setReviewEnabled] = useState(false);
  const [reviewAfterVisit, setReviewAfterVisit] = useState(3);
  const [saving, setSaving] = useState(false);

  // Branding
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

  // Payment settings
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('none');
  const [depositType, setDepositType] = useState<DepositType>('percentage');
  const [depositValue, setDepositValue] = useState(25);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

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
  }, [searchParams]);

  useEffect(() => {
    if (salon) {
      setName(salon.name);
      setEmail(salon.email);
      setPhone(salon.phone || '');
      setBufferMinutes(salon.buffer_minutes || 0);
      setMaxBookingWeeks((salon as any).max_booking_weeks ?? 4);
      setAddress((salon as any).address || '');
      setCity((salon as any).city || '');
      setPostalCode((salon as any).postal_code || '');
      setCancellationPolicy((salon as any).cancellation_policy || '');
      setLocationInfo((salon as any).location_info || '');
      setRescheduleEnabled((salon as any).reschedule_enabled ?? true);
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
        setEmailPreferences({ ...emailPreferences, ...(salon as any).email_preferences });
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
        buffer_minutes: bufferMinutes, max_booking_weeks: maxBookingWeeks,
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

  const handleSavePayment = async () => {
    if (!salon) return;
    setPaymentSaving(true);
    const { error } = await supabase.from('salons').update({
      payment_mode: paymentMode,
      deposit_type: depositType,
      deposit_value: depositValue,
    }).eq('id', salon.id);
    setPaymentSaving(false);
    if (error) addToast('error', 'Opslaan mislukt');
    else addToast('success', 'Betalingsinstellingen opgeslagen');
  };

  const isMollieConnected = !!(salon as any)?.mollie_connected_at;

  const handleMollieConnect = () => {
    if (!salon) return;
    setConnecting(true);
    window.location.href = `${API_BASE}/api/mollie/connect?salon_id=${salon.id}`;
  };

  const handleMollieDisconnect = async () => {
    if (!salon) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`${API_BASE}/api/mollie/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salonId: salon.id }),
      });
      if (res.ok) {
        addToast('success', 'Mollie account ontkoppeld');
        window.location.reload();
      } else addToast('error', 'Ontkoppelen mislukt');
    } catch { addToast('error', 'Ontkoppelen mislukt'); }
    setDisconnecting(false);
  };

  // Preview for deposit
  const previewTotal = 5000;
  const previewDeposit = paymentMode === 'full' ? previewTotal
    : paymentMode === 'deposit' ? (depositType === 'percentage' ? Math.round(previewTotal * (depositValue / 100)) : Math.min(Math.round(depositValue * 100), previewTotal))
    : 0;
  const fmt = (cents: number) => `€${(cents / 100).toFixed(2).replace('.', ',')}`;

  if (!salon) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Instellingen</h1>
          <p className="text-[13px] text-gray-500 mt-0.5">Beheer je salon profiel en voorkeuren</p>
        </div>
        <Button onClick={handleSave} loading={saving}>
          Opslaan
        </Button>
      </div>

      <Tabs tabs={settingsTabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-5 max-w-2xl">
        {/* GENERAL TAB */}
        <TabPanel active={activeTab === 'general'}>
          <Card padding="lg">
            <CardSection title="Salongegevens" description="De basisinformatie van je salon.">
              <div className="space-y-4">
                <Input label="Salonnaam" value={name} onChange={(e) => setName(e.target.value)} placeholder="Bijv. Salon Amara" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="E-mailadres"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
                  />
                  <Input
                    label="Telefoonnummer"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="071 - 234 5678"
                    icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>}
                  />
                </div>
              </div>
            </CardSection>
          </Card>
        </TabPanel>

        {/* LOCATION TAB */}
        <TabPanel active={activeTab === 'location'}>
          <Card padding="lg">
            <CardSection title="Adresgegevens" description="Wordt gebruikt in bevestigingsmails en Google Maps.">
              <div className="space-y-4">
                <Input label="Adres" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Keizersgracht 123" />
                <div className="grid grid-cols-3 gap-4">
                  <Input label="Postcode" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="1015 CJ" />
                  <div className="col-span-2">
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

        {/* BOOKING TAB */}
        <TabPanel active={activeTab === 'booking'}>
          <div className="space-y-4">
            <Card padding="lg">
              <CardSection title="Beschikbaarheid" description="Bepaal wanneer klanten kunnen boeken.">
                <div className="space-y-4">
                  <Select
                    label="Pauze tussen afspraken"
                    value={bufferMinutes}
                    onChange={(e) => setBufferMinutes(parseInt(e.target.value))}
                    hint="Automatische pauze na elke afspraak. Nieuwe klanten kunnen niet boeken in deze tijd."
                    options={[
                      { value: 0, label: 'Geen pauze' },
                      { value: 5, label: '5 minuten' },
                      { value: 10, label: '10 minuten' },
                      { value: 15, label: '15 minuten' },
                      { value: 30, label: '30 minuten' },
                    ]}
                  />
                  <Select
                    label="Hoe ver vooruit kunnen klanten boeken?"
                    value={maxBookingWeeks}
                    onChange={(e) => setMaxBookingWeeks(parseInt(e.target.value))}
                    options={[
                      { value: 1, label: '1 week' },
                      { value: 2, label: '2 weken' },
                      { value: 3, label: '3 weken' },
                      { value: 4, label: '4 weken' },
                      { value: 6, label: '6 weken' },
                      { value: 8, label: '8 weken' },
                      { value: 12, label: '12 weken' },
                      { value: 0, label: 'Onbeperkt' },
                    ]}
                  />
                </div>
              </CardSection>
            </Card>

            <Card padding="lg">
              <CardSection title="Annuleren & verplaatsen" description="Regels voor afspraken wijzigen.">
                <div className="space-y-4">
                  <Textarea
                    label="Annuleringsbeleid"
                    value={cancellationPolicy}
                    onChange={(e) => setCancellationPolicy(e.target.value)}
                    placeholder="Bijv. Annuleren kan tot 24 uur voor de afspraak."
                    rows={3}
                    hint="Wordt getoond in de bevestigingsmail. Laat leeg om niets te tonen."
                  />
                  <Toggle
                    checked={rescheduleEnabled}
                    onChange={setRescheduleEnabled}
                    label="Klanten mogen afspraak verplaatsen"
                    description="Toont een 'Afspraak verplaatsen' link in de bevestigingsmail."
                  />
                </div>
              </CardSection>
            </Card>
          </div>
        </TabPanel>

        {/* REVIEWS TAB */}
        <TabPanel active={activeTab === 'reviews'}>
          <Card padding="lg">
            <CardSection
              title="Google Reviews"
              description="Automatisch review verzoeken sturen na een bezoek."
            >
              <div className="space-y-4">
                <Toggle
                  checked={reviewEnabled}
                  onChange={setReviewEnabled}
                  label="Automatisch review verzoek sturen"
                  description="Na de ingestelde bezoeken krijgt de klant een mail met link naar je Google Reviews."
                />

                {reviewEnabled && (
                  <div className="pl-0 sm:pl-[52px] space-y-4 pt-2">
                    <Select
                      label="Na welk bezoek?"
                      value={reviewAfterVisit}
                      onChange={(e) => setReviewAfterVisit(parseInt(e.target.value))}
                      hint="Hoe later, hoe loyaler de klant en hoe groter de kans op een goede review."
                      options={[
                        { value: 1, label: 'Na het 1e bezoek' },
                        { value: 2, label: 'Na het 2e bezoek' },
                        { value: 3, label: 'Na het 3e bezoek (aanbevolen)' },
                        { value: 5, label: 'Na het 5e bezoek' },
                      ]}
                    />
                    <Input
                      label="Google Place ID"
                      value={googlePlaceId}
                      onChange={(e) => setGooglePlaceId(e.target.value)}
                      placeholder="ChIJ..."
                      hint="Nodig om klanten naar jouw Google Reviews pagina te sturen."
                    />
                  </div>
                )}
              </div>
            </CardSection>
          </Card>
        </TabPanel>

        {/* PAYMENTS TAB */}
        <TabPanel active={activeTab === 'payments'}>
          <div className="space-y-5">
            {/* Online betaling toggle */}
            <Card padding="lg">
              <CardSection title="Online betalen" description="Laat klanten vooraf betalen bij het boeken via iDEAL, creditcard of andere methodes.">
                <div className="space-y-4">
                  <Toggle
                    checked={paymentMode !== 'none'}
                    onChange={(enabled) => setPaymentMode(enabled ? 'deposit' : 'none')}
                    label="Online betalen inschakelen"
                    description={paymentMode === 'none'
                      ? 'Klanten betalen nu alleen in de salon.'
                      : 'Klanten betalen (deels) vooraf bij het boeken.'}
                  />

                  {/* Benefits prompt when disabled */}
                  {paymentMode === 'none' && (
                    <div className="ml-0 sm:ml-[52px] p-4 rounded-xl bg-amber-50 border border-amber-200/60">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-amber-900 mb-1">Wist je dat?</div>
                          <p className="text-[12px] text-amber-800 leading-relaxed">
                            Salons met online betaling zien tot 60% minder no-shows. Een kleine aanbetaling motiveert klanten om op te komen dagen.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardSection>
            </Card>

            {/* Mollie Connect — FIRST when payments enabled (prerequisite) */}
            {paymentMode !== 'none' && (
              <>
                <Card padding="lg">
                  <CardSection
                    title={<div className="flex items-center gap-2">
                      <span>Betaalrekening</span>
                      {isMollieConnected
                        ? <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Actief</span>
                        : <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Vereist</span>
                      }
                    </div>}
                    description="Koppel je betaalaccount zodat klanten veilig kunnen afrekenen via iDEAL, creditcard en meer."
                  >
                    {isMollieConnected ? (
                      <div className="space-y-4">
                        {/* Connected state — premium card */}
                        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white overflow-hidden">
                          {/* Header bar */}
                          <div className="px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center shadow-sm">
                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              </div>
                              <div>
                                <div className="text-[15px] font-bold text-gray-900">
                                  {(salon as any)?.mollie_organization_name || 'Mollie account'}
                                </div>
                                <div className="text-[12px] text-emerald-600 font-medium">Gekoppeld en actief</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-emerald-600">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                              <span className="text-[11px] font-semibold">Beveiligd</span>
                            </div>
                          </div>

                          {/* Details */}
                          <div className="border-t border-emerald-100 divide-y divide-emerald-50">
                            {(salon as any)?.mollie_organization_name && (
                              <div className="flex justify-between px-5 py-3 text-[13px]">
                                <span className="text-gray-500">Bedrijfsnaam</span>
                                <span className="font-semibold text-gray-900">{(salon as any).mollie_organization_name}</span>
                              </div>
                            )}
                            <div className="flex justify-between px-5 py-3 text-[13px]">
                              <span className="text-gray-500">Betaalmethoden</span>
                              <span className="text-gray-700">iDEAL, Creditcard, Bancontact</span>
                            </div>
                            <div className="flex justify-between px-5 py-3 text-[13px]">
                              <span className="text-gray-500">Transactiekosten</span>
                              <span className="text-gray-700">&euro;0,29 per iDEAL <span className="text-gray-400">(verrekend door Mollie)</span></span>
                            </div>
                            {(salon as any)?.mollie_connected_at && (
                              <div className="flex justify-between px-5 py-3 text-[13px]">
                                <span className="text-gray-500">Gekoppeld sinds</span>
                                <span className="text-gray-700">{new Date((salon as any).mollie_connected_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="border-t border-emerald-100 px-5 py-3 flex items-center justify-between bg-emerald-50/40">
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                              Betalingen gaan direct naar jouw rekening
                            </div>
                            <button
                              onClick={handleMollieDisconnect}
                              disabled={disconnecting}
                              className="text-[12px] font-medium text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                            >
                              {disconnecting ? 'Bezig...' : 'Ontkoppelen'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Not connected — trust-building card */}
                        <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50/50 p-6">
                          <div className="text-center space-y-4">
                            <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center mx-auto">
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            </div>
                            <div>
                              <div className="text-[15px] font-bold text-gray-900 mb-1">Koppel je Mollie account</div>
                              <p className="text-[13px] text-gray-500 leading-relaxed max-w-sm mx-auto">
                                Om online betalingen te ontvangen koppel je eenmalig je Mollie account. Betalingen komen direct op jouw rekening.
                              </p>
                            </div>
                            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                              <Button onClick={handleMollieConnect} loading={connecting}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                {connecting ? 'Doorverbinden...' : 'Koppel Mollie account'}
                              </Button>
                              <a href="https://www.mollie.com/signup" target="_blank" rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-violet-600 hover:text-violet-800 transition-colors"
                              >
                                Nog geen Mollie account?
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                              </a>
                            </div>
                          </div>
                        </div>

                        {/* Trust indicators */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 rounded-xl bg-white border border-gray-100">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" className="mx-auto mb-1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                            <div className="text-[11px] font-medium text-gray-600">Veilig</div>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-white border border-gray-100">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" className="mx-auto mb-1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                            <div className="text-[11px] font-medium text-gray-600">Direct uitbetaald</div>
                          </div>
                          <div className="text-center p-3 rounded-xl bg-white border border-gray-100">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="1.5" className="mx-auto mb-1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                            <div className="text-[11px] font-medium text-gray-600">iDEAL & meer</div>
                          </div>
                        </div>

                        <p className="text-[12px] text-gray-400 text-center">Transactiekosten (&euro;0,29 per iDEAL) worden door Mollie verrekend. Bellure rekent geen extra kosten.</p>
                      </div>
                    )}
                  </CardSection>
                </Card>

                {/* Payment mode — only when Mollie connected */}
                {isMollieConnected && (
                  <Card padding="lg">
                    <CardSection title="Betaalmethode" description="Kies hoeveel klanten vooraf betalen.">
                      <div className="space-y-3">
                        {([
                          {
                            value: 'deposit' as PaymentMode,
                            label: 'Aanbetaling',
                            desc: 'Klant betaalt een deel vooraf, de rest in de salon.',
                            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>,
                            tag: 'Aanbevolen',
                          },
                          {
                            value: 'full' as PaymentMode,
                            label: 'Volledige betaling',
                            desc: 'Klant betaalt het volledige bedrag online vooraf.',
                            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
                            tag: null,
                          },
                        ]).map(opt => (
                          <div
                            key={opt.value}
                            onClick={() => setPaymentMode(opt.value)}
                            className={`flex items-start gap-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                              paymentMode === opt.value
                                ? 'border-violet-500 bg-violet-50/50 shadow-[0_0_0_1px_rgba(139,92,246,0.1)]'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                              paymentMode === opt.value ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400'
                            }`}>
                              {opt.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="text-[14px] font-semibold text-gray-900">{opt.label}</div>
                                {opt.tag && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">{opt.tag}</span>
                                )}
                              </div>
                              <div className="text-[13px] text-gray-500 mt-0.5">{opt.desc}</div>
                            </div>
                            <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                              paymentMode === opt.value ? 'border-violet-600 bg-violet-600' : 'border-gray-300'
                            }`}>
                              {paymentMode === opt.value && <div className="w-2 h-2 rounded-full bg-white" />}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Transaction cost note for full payment */}
                      {paymentMode === 'full' && (
                        <div className="mt-3 flex items-center gap-1.5 text-[12px] text-gray-400">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                          Mollie transactiekosten: &euro;0,29 per iDEAL-betaling (automatisch verrekend door Mollie)
                        </div>
                      )}
                    </CardSection>
                  </Card>
                )}

                {/* Deposit settings — only when Mollie connected + deposit mode */}
                {isMollieConnected && paymentMode === 'deposit' && (
                  <Card padding="lg">
                    <CardSection title="Aanbetaling instelling" description="Stel het bedrag of percentage van de aanbetaling in.">
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          {([
                            { value: 'percentage' as DepositType, label: 'Percentage' },
                            { value: 'fixed' as DepositType, label: 'Vast bedrag' },
                          ]).map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => setDepositType(opt.value)}
                              className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                                depositType === opt.value
                                  ? 'bg-violet-600 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        <div>
                          <label className="block text-[13px] font-semibold text-gray-700 mb-1.5">
                            {depositType === 'percentage' ? 'Percentage van behandelprijs' : 'Vast bedrag per boeking'}
                          </label>
                          <div className="flex items-center gap-2">
                            {depositType === 'fixed' && <span className="text-[16px] text-gray-500 font-medium">&euro;</span>}
                            <input
                              type="number"
                              min={1}
                              max={depositType === 'percentage' ? 100 : 500}
                              step={depositType === 'percentage' ? 5 : 0.50}
                              value={depositValue}
                              onChange={e => setDepositValue(parseFloat(e.target.value) || 0)}
                              className="w-24 px-4 py-3 rounded-xl text-[14px] bg-white border border-gray-200 hover:border-gray-300 focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 transition-all"
                            />
                            {depositType === 'percentage' && <span className="text-[16px] text-gray-500 font-medium">%</span>}
                          </div>
                        </div>

                        {/* Preview */}
                        <div className="bg-gray-50 rounded-xl px-4 py-4 border border-gray-100 space-y-3">
                          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Voorbeeld bij een behandeling van &euro;50,00</div>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[14px]">
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-violet-500" />
                              <span className="text-gray-600">Aanbetaling:</span>
                              <strong className="text-violet-600">{fmt(previewDeposit)}</strong>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-2 h-2 rounded-full bg-gray-300" />
                              <span className="text-gray-600">Rest in salon:</span>
                              <strong className="text-gray-900">{fmt(previewTotal - previewDeposit)}</strong>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-gray-200/60 flex items-center gap-1.5 text-[12px] text-gray-400">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                            Mollie transactiekosten: &euro;0,29 per iDEAL-betaling (wordt automatisch verrekend door Mollie)
                          </div>
                        </div>
                      </div>
                    </CardSection>
                  </Card>
                )}

                <Button onClick={handleSavePayment} loading={paymentSaving}>Betalingsinstellingen opslaan</Button>
              </>
            )}

            {/* Save button for 'none' mode */}
            {paymentMode === 'none' && (
              <Button onClick={handleSavePayment} loading={paymentSaving}>Betalingsinstellingen opslaan</Button>
            )}
          </div>
        </TabPanel>

        {/* EMAIL / BRANDING TAB */}
        <TabPanel active={activeTab === 'email'}>
          <div className="space-y-5">

            {/* 1. Kleuren */}
            <Card padding="lg">
              <CardSection title="Merkkleur" description="Kies je primaire kleur. Wordt gebruikt in e-mails, widget en knoppen.">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <input type="color" value={brandColor} onChange={(e) => { setBrandColor(e.target.value); setBrandColorText(suggestTextColor(e.target.value)); if (!gradientEnabled) setGradientFrom(e.target.value); }} className="w-12 h-12 rounded-xl border border-gray-200 cursor-pointer p-0.5" />
                    <div className="flex-1">
                      <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} placeholder="#8B5CF6" />
                    </div>
                  </div>

                  {/* Color suggestions */}
                  {brandColor && (
                    <div>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Suggesties</p>
                      <div className="flex flex-wrap gap-2">
                        {suggestColors(brandColor).map((s, i) => (
                          <button key={i} onClick={() => { setBrandColor(s.color); setBrandColorText(suggestTextColor(s.color)); }} className="group flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors" title={s.label}>
                            <div className="w-5 h-5 rounded-md border border-gray-200" style={{ background: s.color }} />
                            <span className="text-[11px] text-gray-500 group-hover:text-gray-700">{s.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardSection>
            </Card>

            {/* 2. Gradient */}
            <Card padding="lg">
              <CardSection title="Gradient header" description="Gebruik een kleurverloop voor een moderne uitstraling.">
                <div className="space-y-4">
                  <Toggle label="Gradient gebruiken" checked={gradientEnabled} onChange={setGradientEnabled} />

                  {gradientEnabled && (
                    <>
                      {/* Presets */}
                      <div>
                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Preset gradients</p>
                        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                          {GRADIENT_PRESETS.map((preset, i) => (
                            <button key={i} onClick={() => { setGradientFrom(preset.from); setGradientTo(preset.to); setGradientDirection(preset.direction); setBrandColorText(suggestTextColor(preset.from)); }} className="group" title={preset.name}>
                              <div className="w-full aspect-square rounded-xl border-2 border-transparent hover:border-violet-400 transition-all" style={{ background: `linear-gradient(${preset.direction}, ${preset.from}, ${preset.to})` }} />
                              <span className="block text-[10px] text-gray-400 text-center mt-1 truncate">{preset.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Custom gradient */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[12px] font-medium text-gray-600 mb-1">Van</label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={gradientFrom} onChange={(e) => setGradientFrom(e.target.value)} className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                            <Input value={gradientFrom} onChange={(e) => setGradientFrom(e.target.value)} />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[12px] font-medium text-gray-600 mb-1">Naar</label>
                          <div className="flex items-center gap-2">
                            <input type="color" value={gradientTo} onChange={(e) => setGradientTo(e.target.value)} className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer p-0.5" />
                            <Input value={gradientTo} onChange={(e) => setGradientTo(e.target.value)} />
                          </div>
                        </div>
                      </div>

                      <Select
                        label="Richting"
                        value={gradientDirection}
                        onChange={(e) => setGradientDirection(e.target.value)}
                        options={[
                          { value: '135deg', label: 'Diagonaal ↘' },
                          { value: 'to right', label: 'Horizontaal →' },
                          { value: 'to bottom', label: 'Verticaal ↓' },
                          { value: '45deg', label: 'Diagonaal ↗' },
                          { value: 'to left', label: 'Horizontaal ←' },
                        ]}
                      />

                      {/* Live gradient preview */}
                      <div className="rounded-xl overflow-hidden h-16" style={{ background: `linear-gradient(${gradientDirection}, ${gradientFrom}, ${gradientTo})` }}>
                        <div className="h-full flex items-center justify-center">
                          <span style={{ color: brandColorText, fontSize: 15, fontWeight: 600 }}>{name || 'Je Salon'}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardSection>
            </Card>

            {/* 3. Logo upload */}
            <Card padding="lg">
              <CardSection title="Logo" description="Upload je salonlogo. Wordt getoond in de header van elke e-mail.">
                <div className="space-y-3">
                  {logoUrl && (
                    <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                      <img src={logoUrl} alt="Logo" className="max-h-12 max-w-[160px] object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <button onClick={() => setLogoUrl('')} className="text-[12px] text-red-500 hover:text-red-600 font-medium">Verwijderen</button>
                    </div>
                  )}
                  <div>
                    <label className="block">
                      <span className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-[13px] font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        {logoUploading ? 'Uploaden...' : 'Logo uploaden'}
                      </span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/svg+xml,image/webp"
                        className="hidden"
                        disabled={logoUploading}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file || !salon) return;
                          if (file.size > 2 * 1024 * 1024) { addToast('error', 'Logo mag maximaal 2MB zijn'); return; }
                          setLogoUploading(true);
                          const ext = file.name.split('.').pop() || 'png';
                          const path = `${salon.id}/logo.${ext}`;
                          const { error } = await sbClient.storage.from('salon-assets').upload(path, file, { upsert: true });
                          if (error) { addToast('error', 'Upload mislukt: ' + error.message); setLogoUploading(false); return; }
                          const { data: urlData } = sbClient.storage.from('salon-assets').getPublicUrl(path);
                          setLogoUrl(urlData.publicUrl + '?t=' + Date.now());
                          addToast('success', 'Logo geupload');
                          setLogoUploading(false);
                        }}
                      />
                    </label>
                    <p className="text-[11px] text-gray-400 mt-1.5">PNG, JPG, SVG of WebP. Maximaal 2MB. Aanbevolen: transparante achtergrond.</p>
                  </div>
                </div>
              </CardSection>
            </Card>

            {/* 4. Footer text */}
            <Card padding="lg">
              <CardSection title="Footer tekst" description="Optionele tekst onderaan elke e-mail.">
                <Input
                  value={emailFooterText}
                  onChange={(e) => setEmailFooterText(e.target.value)}
                  placeholder="Bijv. Tot snel bij Salon Amara!"
                />
              </CardSection>
            </Card>

            {/* 5. Email preview */}
            <Card padding="lg">
              <CardSection title="E-mail voorbeeld" description="Bekijk hoe je e-mails eruitzien met jouw branding.">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {EMAIL_TYPES.map((et) => (
                      <button key={et.key} onClick={() => setEmailPreviewType(et.key)} className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${emailPreviewType === et.key ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {et.label}
                      </button>
                    ))}
                  </div>

                  {/* Preview */}
                  <div className="border border-gray-200 rounded-2xl overflow-hidden" style={{ background: '#F7F7F5' }}>
                    <div className="p-4">
                      <div className="rounded-xl overflow-hidden bg-white shadow-sm max-w-[480px] mx-auto">
                        {/* Branded header */}
                        <div style={{ background: gradientEnabled ? `linear-gradient(${gradientDirection}, ${gradientFrom}, ${gradientTo})` : brandColor, padding: '20px 24px', textAlign: 'center' as const }}>
                          {logoUrl ? (
                            <img src={logoUrl} alt="Logo" style={{ maxHeight: 48, maxWidth: 180, display: 'block', margin: '0 auto' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <span style={{ fontSize: 18, fontWeight: 700, color: brandColorText, letterSpacing: '-0.3px' }}>{name || 'Je Salon'}</span>
                          )}
                        </div>
                        {/* Preview content per type */}
                        <div style={{ padding: '24px' }}>
                          {emailPreviewType === 'confirmation' && (
                            <div>
                              <div style={{ textAlign: 'center' as const, marginBottom: 16 }}>
                                <div style={{ display: 'inline-flex', width: 40, height: 40, background: gradientEnabled ? `linear-gradient(${gradientDirection}, ${gradientFrom}, ${gradientTo})` : brandColor, borderRadius: '50%', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ color: brandColorText, fontSize: 18 }}>&#10003;</span>
                                </div>
                                <p style={{ fontSize: 18, fontWeight: 700, color: brandColor, margin: '8px 0 0' }}>Afspraak bevestigd</p>
                              </div>
                              <p style={{ fontSize: 14, color: '#475569' }}>Hoi Anna, je afspraak bij <strong>{name}</strong> is bevestigd.</p>
                              <div style={{ margin: '16px 0', padding: 14, background: '#F8FAFC', borderRadius: 10 }}>
                                <table style={{ width: '100%', fontSize: 13 }}><tbody>
                                  <tr><td style={{ padding: '4px 0', color: '#64748B' }}>Behandeling</td><td><strong>Knippen + Kleuren</strong></td></tr>
                                  <tr><td style={{ padding: '4px 0', color: '#64748B' }}>Bij</td><td><strong>Lisa</strong></td></tr>
                                  <tr><td style={{ padding: '4px 0', color: '#64748B' }}>Datum</td><td><strong>dinsdag 10 maart 2026</strong></td></tr>
                                  <tr><td style={{ padding: '4px 0', color: '#64748B' }}>Tijd</td><td><strong>14:00 - 15:30</strong></td></tr>
                                </tbody></table>
                              </div>
                              <div style={{ textAlign: 'center' as const }}>
                                <span style={{ display: 'inline-block', padding: '10px 20px', background: gradientEnabled ? `linear-gradient(${gradientDirection}, ${gradientFrom}, ${gradientTo})` : brandColor, color: brandColorText, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Voeg toe aan agenda</span>
                              </div>
                            </div>
                          )}
                          {emailPreviewType === 'notification' && (
                            <div>
                              <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 12px' }}>Nieuwe boeking</p>
                              <div style={{ padding: 14, background: '#F8FAFC', borderRadius: 10, fontSize: 13 }}>
                                <table style={{ width: '100%' }}><tbody>
                                  <tr><td style={{ padding: '4px 0', color: '#64748B' }}>Klant</td><td><strong>Anna de Vries</strong></td></tr>
                                  <tr><td style={{ padding: '4px 0', color: '#64748B' }}>Telefoon</td><td>06 12345678</td></tr>
                                  <tr><td style={{ padding: '4px 0', color: '#64748B' }}>Dienst</td><td><strong>Knippen + Kleuren (90 min)</strong></td></tr>
                                  <tr><td style={{ padding: '4px 0', color: '#64748B' }}>Datum/Tijd</td><td><strong>di 10 mrt, 14:00 - 15:30</strong></td></tr>
                                </tbody></table>
                              </div>
                              <p style={{ marginTop: 12 }}><span style={{ color: brandColor, fontSize: 13 }}>Bekijk in dashboard →</span></p>
                            </div>
                          )}
                          {emailPreviewType === 'cancellation' && (
                            <div>
                              <p style={{ fontSize: 18, fontWeight: 700, color: '#EF4444', margin: '0 0 12px' }}>Afspraak geannuleerd</p>
                              <p style={{ fontSize: 14, color: '#475569' }}>Hoi Anna, je afspraak bij <strong>{name}</strong> is geannuleerd.</p>
                              <div style={{ margin: '12px 0', padding: 12, background: '#FEF2F2', borderRadius: 8, fontSize: 13, color: '#991B1B' }}>
                                Knippen + Kleuren — dinsdag 10 maart, 14:00
                              </div>
                              <div style={{ textAlign: 'center' as const, marginTop: 16 }}>
                                <span style={{ display: 'inline-block', padding: '10px 20px', background: gradientEnabled ? `linear-gradient(${gradientDirection}, ${gradientFrom}, ${gradientTo})` : brandColor, color: brandColorText, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Nieuwe afspraak maken</span>
                              </div>
                            </div>
                          )}
                          {emailPreviewType === 'cancellation_notification' && (
                            <div>
                              <p style={{ fontSize: 18, fontWeight: 700, color: '#EF4444', margin: '0 0 12px' }}>Annulering door klant</p>
                              <div style={{ padding: 14, background: '#FEF2F2', borderRadius: 10, fontSize: 13 }}>
                                <table style={{ width: '100%' }}><tbody>
                                  <tr><td style={{ padding: '4px 0', color: '#991B1B' }}>Klant</td><td><strong>Anna de Vries</strong></td></tr>
                                  <tr><td style={{ padding: '4px 0', color: '#991B1B' }}>Dienst</td><td>Knippen + Kleuren</td></tr>
                                  <tr><td style={{ padding: '4px 0', color: '#991B1B' }}>Datum</td><td><strong>di 10 mrt, 14:00</strong></td></tr>
                                </tbody></table>
                              </div>
                            </div>
                          )}
                          {emailPreviewType === 'reminder_24h' && (
                            <div>
                              <p style={{ fontSize: 18, fontWeight: 700, color: brandColor, margin: '0 0 12px' }}>Herinnering: morgen je afspraak</p>
                              <p style={{ fontSize: 14, color: '#475569' }}>Hoi Anna, morgen heb je een afspraak bij <strong>{name}</strong>.</p>
                              <div style={{ margin: '12px 0', padding: 14, background: '#F8FAFC', borderRadius: 10, fontSize: 13 }}>
                                Knippen + Kleuren bij Lisa — dinsdag 10 maart, 14:00
                              </div>
                              <p style={{ fontSize: 12, color: '#DC2626', textAlign: 'center' as const, marginTop: 12, textDecoration: 'underline' }}>Kan je niet? Annuleer je afspraak</p>
                            </div>
                          )}
                          {emailPreviewType === 'reminder_1h' && (
                            <div>
                              <p style={{ fontSize: 18, fontWeight: 700, color: brandColor, margin: '0 0 12px' }}>Over een uur: je afspraak</p>
                              <p style={{ fontSize: 14, color: '#475569' }}>Hoi Anna, over een uur word je verwacht bij <strong>{name}</strong>.</p>
                              <div style={{ margin: '12px 0', padding: 14, background: '#F5F3FF', borderRadius: 10, textAlign: 'center' as const, fontSize: 15, fontWeight: 600 }}>
                                Vandaag om <strong>14:00</strong>
                              </div>
                            </div>
                          )}
                          {emailPreviewType === 'review_request' && (
                            <div>
                              <p style={{ fontSize: 18, fontWeight: 700, color: brandColor, margin: '0 0 12px' }}>Hoe was je bezoek?</p>
                              <p style={{ fontSize: 14, color: '#475569' }}>Hoi Anna, bedankt voor je bezoek aan <strong>{name}</strong>! We hopen dat je tevreden bent.</p>
                              <div style={{ textAlign: 'center' as const, margin: '20px 0' }}>
                                <span style={{ display: 'inline-block', padding: '12px 24px', background: gradientEnabled ? `linear-gradient(${gradientDirection}, ${gradientFrom}, ${gradientTo})` : brandColor, color: brandColorText, borderRadius: 8, fontSize: 14, fontWeight: 600 }}>Laat een review achter</span>
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Footer */}
                        <div style={{ padding: '12px 24px', borderTop: '1px solid #F1F1EF', textAlign: 'center' as const }}>
                          {emailFooterText && <p style={{ color: '#94A3B8', fontSize: 12, margin: '0 0 4px', fontStyle: 'italic' }}>{emailFooterText}</p>}
                          <p style={{ color: '#CBD5E1', fontSize: 10, margin: 0 }}>Powered by Bellure</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardSection>
            </Card>

            {/* 6. Email types toggle */}
            <Card padding="lg">
              <CardSection title="E-mail instellingen" description="Bepaal welke e-mails automatisch worden verstuurd.">
                <div className="space-y-1">
                  {EMAIL_TYPES.map((et) => (
                    <div key={et.key} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-gray-900">{et.label}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${et.recipient === 'klant' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                            {et.recipient}
                          </span>
                        </div>
                        <p className="text-[12px] text-gray-500 mt-0.5 leading-relaxed">{et.description}</p>
                      </div>
                      <Toggle checked={emailPreferences[et.key] ?? true} onChange={(v) => setEmailPreferences(prev => ({ ...prev, [et.key]: v }))} />
                    </div>
                  ))}
                </div>
              </CardSection>
            </Card>

            <Button onClick={handleSave} loading={saving}>Opslaan</Button>
          </div>
        </TabPanel>

        {/* EMBED TAB */}
        <TabPanel active={activeTab === 'embed'}>
          <Card padding="lg">
            <CardSection
              title="Booking widget"
              description="Voeg het boekingssysteem toe aan je website."
            >
              <div className="space-y-3">
                <p className="text-[13px] text-gray-600 leading-relaxed">
                  Kopieer onderstaande code en plak deze in de HTML van je website, vlak voor de sluitende <code className="px-1.5 py-0.5 bg-gray-100 rounded text-[12px] font-mono">&lt;/body&gt;</code> tag.
                </p>
                <div className="relative group">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-xl text-[13px] font-mono overflow-x-auto leading-relaxed">
{`<script
  src="https://mijn.bellure.nl/embed.js"
  data-salon="${salon.slug}"
></script>`}
                  </pre>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`<script src="https://mijn.bellure.nl/embed.js" data-salon="${salon.slug}"></script>`);
                      addToast('success', 'Code gekopieerd');
                    }}
                    className="absolute top-3 right-3 p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  </button>
                </div>
                <div className="flex items-start gap-2 p-3 bg-violet-50 rounded-xl">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5 text-violet-600"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                  <p className="text-[12px] text-violet-700 leading-relaxed">
                    De widget past zich automatisch aan de breedte van je pagina aan en werkt op zowel desktop als mobiel.
                  </p>
                </div>
              </div>
            </CardSection>
          </Card>
        </TabPanel>
      </div>
    </div>
  );
}
