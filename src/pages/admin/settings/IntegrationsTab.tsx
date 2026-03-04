import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Input, Select } from '../../../components/ui/Input';
import { Toggle } from '../../../components/ui/Toggle';
import { Card, CardSection } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { API_URL } from '../../../lib/api';
import type { Salon } from '../../../lib/types';

interface IntegrationsTabProps {
  salon: Salon;
  googlePlaceId: string;
  setGooglePlaceId: (v: string) => void;
  reviewEnabled: boolean;
  setReviewEnabled: (v: boolean) => void;
  reviewAfterVisit: number;
  setReviewAfterVisit: (v: number) => void;
}

export function IntegrationsTab({
  salon,
  googlePlaceId, setGooglePlaceId,
  reviewEnabled, setReviewEnabled,
  reviewAfterVisit, setReviewAfterVisit,
}: IntegrationsTabProps) {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);

  const isGoogleConnected = !!salon.google_calendar_connected_at;

  // Handle Google OAuth callback
  useEffect(() => {
    const googleStatus = searchParams.get('google');
    if (googleStatus === 'connected') {
      addToast('success', 'Google Calendar succesvol gekoppeld!');
      setSearchParams({}, { replace: true });
    } else if (googleStatus === 'error') {
      const reason = searchParams.get('reason') || 'onbekend';
      addToast('error', `Google Calendar koppeling mislukt: ${reason}`);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const handleGoogleConnect = () => {
    const token = localStorage.getItem('auth_token');
    // Redirect to API which will redirect to Google OAuth
    window.location.href = `${API_URL}/api/google/connect?salon_id=${salon.id}&token=${token}`;
  };

  const handleGoogleDisconnect = async () => {
    if (!confirm('Weet je zeker dat je Google Calendar wilt ontkoppelen? Alle gesynchroniseerde agenda items worden verwijderd.')) return;
    setDisconnecting(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_URL}/api/google/disconnect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ salonId: salon.id }),
      });
      if (!res.ok) throw new Error('Disconnect failed');
      addToast('success', 'Google Calendar ontkoppeld');
      window.location.reload();
    } catch {
      addToast('error', 'Kon Google Calendar niet ontkoppelen');
    }
    setDisconnecting(false);
  };

  return (
    <div className="space-y-5">
      {/* Google Calendar */}
      <Card padding="lg">
        <CardSection
          title="Google Calendar"
          description="Synchroniseer afspraken automatisch met je Google Agenda."
        >
          {isGoogleConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-600"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-green-800">Verbonden met {salon.google_calendar_name || 'Google Calendar'}</p>
                  <p className="text-[12px] text-green-600">
                    Gekoppeld op {new Date(salon.google_calendar_connected_at!).toLocaleDateString('nl-NL')}
                    {salon.google_calendar_last_sync_at && (
                      <> — Laatste sync: {new Date(salon.google_calendar_last_sync_at).toLocaleString('nl-NL')}</>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleGoogleDisconnect}
                  disabled={disconnecting}
                  className="text-[13px] text-red-600 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
                >
                  {disconnecting ? 'Ontkoppelen...' : 'Ontkoppelen'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] text-gray-600 leading-relaxed">
                Koppel je Google Agenda om afspraken automatisch te synchroniseren. Nieuwe boekingen verschijnen direct in je agenda, en blokkades uit je agenda worden automatisch overgenomen.
              </p>
              <Button onClick={handleGoogleConnect} variant="secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" className="mr-2" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Koppel Google Calendar
              </Button>
            </div>
          )}
        </CardSection>
      </Card>

      {/* Google Reviews */}
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

      {/* Widget embed */}
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
    </div>
  );
}
