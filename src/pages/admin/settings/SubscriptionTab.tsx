import { useState } from 'react';
import { Card, CardSection } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { useToast } from '../../../components/ui/Toast';
import { API_BASE } from '../../../lib/config';
import { supabase as sbClient } from '../../../lib/supabase';
import type { Salon } from '../../../lib/types';

interface SubscriptionTabProps {
  salon: Salon;
}

export function SubscriptionTab({ salon }: SubscriptionTabProps) {
  const { addToast } = useToast();
  const [showPlanSelect, setShowPlanSelect] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const status = (salon.subscription_status || 'none') as string;

  // Calculate trial days remaining
  const trialEnds = salon.trial_ends_at ? new Date(salon.trial_ends_at) : null;
  const trialStarted = salon.trial_started_at ? new Date(salon.trial_started_at) : null;
  const now = new Date();
  const daysRemaining = trialEnds ? Math.max(0, Math.ceil((trialEnds.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : 0;
  const trialProgress = trialEnds && trialStarted
    ? Math.min(100, Math.max(0, ((now.getTime() - trialStarted.getTime()) / (trialEnds.getTime() - trialStarted.getTime())) * 100))
    : 0;

  const handleActivate = async () => {
    if (!selectedPlan) return;
    setActivating(true);
    try {
      const { data: { session } } = await sbClient.auth.getSession();
      const res = await fetch(`${API_BASE}/api/subscription/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ salonId: salon.id, planType: selectedPlan }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Activatie mislukt');
      if (data.paymentUrl) {
        window.location.href = data.paymentUrl;
      } else {
        addToast('success', 'Abonnement geactiveerd');
        window.location.reload();
      }
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : 'Kon abonnement niet activeren');
    }
    setActivating(false);
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      const { data: { session } } = await sbClient.auth.getSession();
      const res = await fetch(`${API_BASE}/api/subscription/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ salonId: salon.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Annulering mislukt');
      }
      addToast('success', 'Abonnement opgezegd');
      setShowCancelModal(false);
      window.location.reload();
    } catch (err: unknown) {
      addToast('error', err instanceof Error ? err.message : 'Kon abonnement niet opzeggen');
    }
    setCancelling(false);
  };

  const plans = [
    { id: 'booking_standalone', name: 'Booking Standalone', price: '29,98', desc: 'Compleet boekingssysteem voor je salon' },
    { id: 'booking_website', name: 'Booking + Website', price: '14,99', desc: 'Addon bij je Bellure website' },
  ];

  return (
    <div className="space-y-5">
      {/* Trial status */}
      {status === 'trial' && (
        <Card padding="lg">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-gray-900">Proefperiode</h3>
                  <p className="text-[13px] text-amber-700 font-medium">Nog {daysRemaining} {daysRemaining === 1 ? 'dag' : 'dagen'} resterend</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Trial</span>
            </div>
            <div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full transition-all duration-500" style={{ width: `${trialProgress}%` }} />
              </div>
              <div className="flex justify-between mt-1.5 text-[11px] text-gray-400">
                <span>{trialStarted ? trialStarted.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : ''}</span>
                <span>{trialEnds ? trialEnds.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : ''}</span>
              </div>
            </div>
            <p className="text-[13px] text-gray-500">Je proefperiode bevat alle functies. Activeer een abonnement om na de proefperiode door te gaan.</p>
            {!showPlanSelect && (
              <Button variant="primary" onClick={() => setShowPlanSelect(true)}>
                Abonnement activeren
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Active status */}
      {status === 'active' && (
        <Card padding="lg">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-gray-900">Abonnement actief</h3>
                  <p className="text-[13px] text-emerald-600 font-medium">
                    {salon.plan_type === 'booking_website' ? 'Booking + Website' : 'Booking Standalone'}
                    {' — '}
                    {salon.plan_type === 'booking_website' ? '€14,99' : '€29,98'}/mnd
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Actief</span>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <button
                onClick={() => setShowCancelModal(true)}
                className="text-[13px] font-medium text-red-500 hover:text-red-700 transition-colors"
              >
                Abonnement opzeggen
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Paused status */}
      {status === 'paused' && (
        <Card padding="lg">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="10" y1="15" x2="10" y2="9"/><line x1="14" y1="15" x2="14" y2="9"/></svg>
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-gray-900">Account gepauzeerd</h3>
                  <p className="text-[13px] text-red-600 font-medium">Je abonnement is gepauzeerd. Klanten kunnen niet boeken.</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700">Gepauzeerd</span>
            </div>
            {!showPlanSelect && (
              <Button variant="primary" onClick={() => setShowPlanSelect(true)}>
                Heractiveren
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Past due */}
      {status === 'past_due' && (
        <Card padding="lg">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-gray-900">Betaling mislukt</h3>
                  <p className="text-[13px] text-orange-600 font-medium">Je laatste betaling is mislukt. Update je betaalmethode binnen 7 dagen om pauzering te voorkomen.</p>
                </div>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">Actie vereist</span>
            </div>
            {!showPlanSelect && (
              <Button variant="primary" onClick={() => setShowPlanSelect(true)}>
                Betaling bijwerken
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* No subscription / cancelled */}
      {(status === 'none' || status === 'cancelled') && (
        <Card padding="lg">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
              <div>
                <h3 className="text-[16px] font-bold text-gray-900">Geen actief abonnement</h3>
                <p className="text-[13px] text-gray-500">Activeer een abonnement om het boekingssysteem te gebruiken.</p>
              </div>
            </div>
            {!showPlanSelect && (
              <Button variant="primary" onClick={() => setShowPlanSelect(true)}>
                Abonnement activeren
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Plan selection */}
      {showPlanSelect && (
        <Card padding="lg">
          <CardSection title="Kies je abonnement" description="Selecteer het plan dat bij jouw salon past.">
            <div className="space-y-3">
              {plans.map(plan => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`flex items-start gap-3.5 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                    selectedPlan === plan.id
                      ? 'border-violet-500 bg-violet-50/50 shadow-[0_0_0_1px_rgba(139,92,246,0.1)]'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                    selectedPlan === plan.id ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-400'
                  }`}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <div className="text-[14px] font-semibold text-gray-900">{plan.name}</div>
                      <div className="text-[14px] font-bold text-violet-600">&euro;{plan.price}<span className="text-[12px] font-normal text-gray-400">/mnd</span></div>
                    </div>
                    <div className="text-[13px] text-gray-500 mt-0.5">{plan.desc}</div>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                    selectedPlan === plan.id ? 'border-violet-600 bg-violet-600' : 'border-gray-300'
                  }`}>
                    {selectedPlan === plan.id && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-3 mt-5">
              <Button variant="primary" onClick={handleActivate} loading={activating} disabled={!selectedPlan}>
                Activeren
              </Button>
              <Button variant="secondary" onClick={() => { setShowPlanSelect(false); setSelectedPlan(null); }}>
                Annuleren
              </Button>
            </div>

            <p className="text-[12px] text-gray-400 mt-3">
              Je wordt doorgestuurd naar de betaalpagina van Mollie. Na betaling wordt je abonnement direct geactiveerd.
            </p>
          </CardSection>
        </Card>
      )}

      {/* Cancel confirmation modal */}
      <Modal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Abonnement opzeggen"
        footer={
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => setShowCancelModal(false)}>Behouden</Button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[13px] font-semibold transition-colors disabled:opacity-50"
            >
              {cancelling ? 'Bezig...' : 'Ja, opzeggen'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-[14px] text-gray-700">Weet je zeker dat je je abonnement wilt opzeggen?</p>
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <p className="text-[13px] text-amber-800">Na opzeggen kunnen klanten niet meer online boeken. Je gegevens blijven bewaard.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
