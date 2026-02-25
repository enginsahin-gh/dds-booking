import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../components/ui/Toast';
import type { Salon, PaymentMode, DepositType } from '../../lib/types';
import type { User } from '@supabase/supabase-js';

export function PaymentSettingsPage() {
  const { salon } = useOutletContext<{ salon: Salon | null; user: User }>();
  const { addToast } = useToast();

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('deposit');
  const [depositType, setDepositType] = useState<DepositType>('percentage');
  const [depositValue, setDepositValue] = useState(25);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (salon) {
      setPaymentMode(salon.payment_mode || 'deposit');
      setDepositType(salon.deposit_type || 'percentage');
      setDepositValue(salon.deposit_value || 25);
    }
  }, [salon]);

  const handleSave = async () => {
    if (!salon) return;
    setSaving(true);

    const { error } = await supabase
      .from('salons')
      .update({
        payment_mode: paymentMode,
        deposit_type: depositType,
        deposit_value: depositValue,
      })
      .eq('id', salon.id);

    setSaving(false);
    if (error) {
      addToast('error', 'Opslaan mislukt');
    } else {
      addToast('success', 'Betalingsinstellingen opgeslagen');
    }
  };

  if (!salon) return null;

  // Preview calculation for €50 service
  const previewTotal = 5000;
  let previewDeposit = 0;
  if (paymentMode === 'full') {
    previewDeposit = previewTotal;
  } else if (paymentMode === 'deposit') {
    if (depositType === 'percentage') {
      previewDeposit = Math.round(previewTotal * (depositValue / 100));
    } else {
      previewDeposit = Math.min(Math.round(depositValue * 100), previewTotal);
    }
  }

  const fmt = (cents: number) => `\u20AC${(cents / 100).toFixed(2).replace('.', ',')}`;

  return (
    <div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Betalingen</h1>
      <p style={{ color: '#6B7280', marginBottom: 32 }}>
        Stel in hoe klanten online betalen bij het boeken.
      </p>

      {/* Payment mode selector */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
        {[
          { value: 'deposit' as const, label: 'Aanbetaling', desc: 'Klant betaalt een deel vooraf, de rest in de salon. Vermindert no-shows.' },
          { value: 'full' as const, label: 'Volledige betaling', desc: 'Klant betaalt het volledige bedrag online vooraf.' },
          { value: 'none' as const, label: 'Geen online betaling', desc: 'Klant betaalt alleen in de salon. Geen aanbetaling.' },
        ].map(opt => (
          <label
            key={opt.value}
            style={{
              display: 'flex', gap: 12, padding: 16,
              border: `2px solid ${paymentMode === opt.value ? '#8B5CF6' : '#E5E7EB'}`,
              borderRadius: 12, cursor: 'pointer',
              background: paymentMode === opt.value ? '#F5F3FF' : '#fff',
              transition: 'all 0.2s',
            }}
          >
            <input
              type="radio"
              name="paymentMode"
              value={opt.value}
              checked={paymentMode === opt.value}
              onChange={() => setPaymentMode(opt.value)}
              style={{ marginTop: 2 }}
            />
            <div>
              <div style={{ fontWeight: 600, color: '#111827' }}>{opt.label}</div>
              <div style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: 2 }}>{opt.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {/* Deposit settings */}
      {paymentMode === 'deposit' && (
        <div style={{
          padding: 24, background: '#FAFAFA', borderRadius: 12,
          border: '1px solid #E5E7EB', marginBottom: 32,
        }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 16 }}>Aanbetaling instelling</h3>

          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {[
              { value: 'percentage' as const, label: 'Percentage' },
              { value: 'fixed' as const, label: 'Vast bedrag' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setDepositType(opt.value)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  fontWeight: 500, fontSize: '0.875rem',
                  background: depositType === opt.value ? '#8B5CF6' : '#E5E7EB',
                  color: depositType === opt.value ? '#fff' : '#374151',
                  transition: 'all 0.2s',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              {depositType === 'percentage' ? 'Percentage van behandelprijs' : 'Vast bedrag per boeking'}
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {depositType === 'fixed' && <span style={{ fontSize: '1.1rem', color: '#6B7280' }}>&euro;</span>}
              <input
                type="number"
                min={depositType === 'percentage' ? 1 : 1}
                max={depositType === 'percentage' ? 100 : 500}
                step={depositType === 'percentage' ? 5 : 0.50}
                value={depositValue}
                onChange={(e) => setDepositValue(parseFloat(e.target.value) || 0)}
                style={{
                  width: 100, padding: '8px 12px', borderRadius: 8,
                  border: '1px solid #D1D5DB', fontSize: '1rem',
                }}
              />
              {depositType === 'percentage' && <span style={{ fontSize: '1.1rem', color: '#6B7280' }}>%</span>}
            </div>
          </div>

          {/* Preview */}
          <div style={{
            padding: 14, background: '#fff', borderRadius: 8,
            border: '1px solid #E5E7EB',
          }}>
            <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginBottom: 4 }}>VOORBEELD</div>
            <div style={{ fontSize: '0.9rem', color: '#111827' }}>
              Bij een behandeling van <strong>&euro;50,00</strong>:
            </div>
            <div style={{ fontSize: '0.9rem', color: '#111827', marginTop: 4 }}>
              Aanbetaling: <strong style={{ color: '#8B5CF6' }}>{fmt(previewDeposit)}</strong>
              &ensp;&middot;&ensp;
              Restbedrag: <strong>{fmt(previewTotal - previewDeposit)}</strong>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '10px 24px', borderRadius: 8, border: 'none',
          background: '#8B5CF6', color: '#fff', fontWeight: 600,
          fontSize: '0.9rem', cursor: saving ? 'not-allowed' : 'pointer',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Opslaan...' : 'Opslaan'}
      </button>
    </div>
  );
}
