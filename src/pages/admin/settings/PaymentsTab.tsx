import { useState } from 'react';
import { Card, CardSection } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Toggle } from '../../../components/ui/Toggle';
import { useToast } from '../../../components/ui/Toast';
import { supabase } from '../../../lib/supabase';
import { API_BASE } from '../../../lib/config';
import type { Salon, PaymentMode, DepositType } from '../../../lib/types';

interface PaymentsTabProps {
  salon: Salon;
  paymentMode: PaymentMode;
  setPaymentMode: (v: PaymentMode) => void;
  depositType: DepositType;
  setDepositType: (v: DepositType) => void;
  depositValue: number;
  setDepositValue: (v: number) => void;
}

export function PaymentsTab({
  salon, paymentMode, setPaymentMode,
  depositType, setDepositType,
  depositValue, setDepositValue,
}: PaymentsTabProps) {
  const { addToast } = useToast();
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

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

  const previewTotal = 5000;
  const previewDeposit = paymentMode === 'full' ? previewTotal
    : paymentMode === 'deposit' ? (depositType === 'percentage' ? Math.round(previewTotal * (depositValue / 100)) : Math.min(Math.round(depositValue * 100), previewTotal))
    : 0;
  const fmt = (cents: number) => `€${(cents / 100).toFixed(2).replace('.', ',')}`;

  return (
    <div className="space-y-5">
      {/* Online payment toggle */}
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

      {paymentMode !== 'none' && (
        <>
          {/* Mollie Connect */}
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
                  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white overflow-hidden">
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

          {/* Payment mode when Mollie connected */}
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

                {paymentMode === 'full' && (
                  <div className="mt-3 flex items-center gap-1.5 text-[12px] text-gray-400">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    Mollie transactiekosten: &euro;0,29 per iDEAL-betaling (automatisch verrekend door Mollie)
                  </div>
                )}
              </CardSection>
            </Card>
          )}

          {/* Deposit settings */}
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

      {paymentMode === 'none' && (
        <Button onClick={handleSavePayment} loading={paymentSaving}>Betalingsinstellingen opslaan</Button>
      )}
    </div>
  );
}
