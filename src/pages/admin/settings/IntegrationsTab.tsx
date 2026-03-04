import { Input, Select } from '../../../components/ui/Input';
import { Toggle } from '../../../components/ui/Toggle';
import { Card, CardSection } from '../../../components/ui/Card';
import { useToast } from '../../../components/ui/Toast';
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
  return (
    <div className="space-y-5">
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
