import { useState } from 'react';
import { Input } from '../../../components/ui/Input';
import { Card, CardSection } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';

interface GeneralTabProps {
  name: string;
  setName: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  slug: string;
}

export function GeneralTab({ name, setName, email, setEmail, phone, setPhone, slug }: GeneralTabProps) {
  const [copied, setCopied] = useState(false);
  const bookingBase = 'https://booking.bellure.nl';
  const bookingUrl = slug ? `${bookingBase}/${slug}` : '';

  const handleCopy = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
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

          <div className="pt-2">
            <label className="block text-[13px] font-semibold text-gray-700 tracking-tight mb-1.5">Directe boekingslink</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className="w-full rounded-xl text-[14px] text-gray-900 px-4 py-3 bg-white border border-gray-200"
                value={bookingUrl}
                readOnly
              />
              <Button variant="secondary" size="md" onClick={handleCopy} disabled={!bookingUrl}>
                {copied ? 'Gekopieerd' : 'Kopieer link'}
              </Button>
            </div>
            <p className="text-[12px] text-gray-500 mt-2">Gebruik deze link in je Instagram‑bio, WhatsApp of andere socials.</p>
          </div>
        </div>
      </CardSection>
    </Card>
  );
}
