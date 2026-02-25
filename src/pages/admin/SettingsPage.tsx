import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useSalon } from '../../hooks/useSalon';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useToast } from '../../components/ui/Toast';
import type { Salon } from '../../lib/types';
import type { User } from '@supabase/supabase-js';

export function SettingsPage() {
  const { salon } = useOutletContext<{ salon: Salon | null; user: User }>();
  const { updateSalon } = useSalon(undefined, salon?.owner_id);
  const { addToast } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (salon) {
      setName(salon.name);
      setEmail(salon.email);
      setPhone(salon.phone || '');
    }
  }, [salon]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSalon({ name, email, phone: phone || null });
      addToast('success', 'Instellingen opgeslagen');
    } catch {
      addToast('error', 'Kon instellingen niet opslaan');
    }
    setSaving(false);
  };

  if (!salon) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Instellingen</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg space-y-4">
        <Input label="Salonnaam" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="E-mailadres" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Telefoonnummer" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />

        <div className="pt-2">
          <Button onClick={handleSave} loading={saving}>Opslaan</Button>
        </div>

        <div className="pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            <strong>Embed code:</strong>
          </p>
          <pre className="mt-2 bg-gray-50 p-3 rounded-lg text-xs overflow-x-auto">
{`<script src="https://boeken.ensalabs.nl/embed.js" data-salon="${salon.slug}"></script>`}
          </pre>
        </div>
      </div>
    </div>
  );
}
