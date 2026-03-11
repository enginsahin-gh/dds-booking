import { Input, Select } from '../../../components/ui/Input';
import { Toggle } from '../../../components/ui/Toggle';
import { Card, CardSection } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { useToast } from '../../../components/ui/Toast';
import { supabase as sbClient } from '../../../lib/supabase';
import {
  suggestColors, suggestTextColor, GRADIENT_PRESETS, EMAIL_TYPES,
} from '../../../lib/branding';
import type { Salon } from '../../../lib/types';

interface BrandingTabProps {
  salon: Salon;
  name: string;
  brandColor: string;
  setBrandColor: (v: string) => void;
  brandColorText: string;
  setBrandColorText: (v: string) => void;
  logoUrl: string;
  setLogoUrl: (v: string) => void;
  emailFooterText: string;
  setEmailFooterText: (v: string) => void;
  gradientEnabled: boolean;
  setGradientEnabled: (v: boolean) => void;
  gradientFrom: string;
  setGradientFrom: (v: string) => void;
  gradientTo: string;
  setGradientTo: (v: string) => void;
  gradientDirection: string;
  setGradientDirection: (v: string) => void;
  emailPreferences: Record<string, boolean>;
  setEmailPreferences: (v: Record<string, boolean>) => void;
  emailPreviewType: string;
  setEmailPreviewType: (v: string) => void;
  logoUploading: boolean;
  setLogoUploading: (v: boolean) => void;
  onSave: () => void;
  saving: boolean;
}

export function BrandingTab({
  salon, name,
  brandColor, setBrandColor,
  brandColorText, setBrandColorText,
  logoUrl, setLogoUrl,
  emailFooterText, setEmailFooterText,
  gradientEnabled, setGradientEnabled,
  gradientFrom, setGradientFrom,
  gradientTo, setGradientTo,
  gradientDirection, setGradientDirection,
  emailPreferences, setEmailPreferences,
  emailPreviewType, setEmailPreviewType,
  logoUploading, setLogoUploading,
  onSave, saving,
}: BrandingTabProps) {
  const { addToast } = useToast();

  return (
    <div className="space-y-5">
      {/* Colors */}
      <Card padding="lg">
        <CardSection title="Merkkleur" description="Kies je primaire kleur. Wordt gebruikt in e-mails, widget en knoppen.">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input type="color" value={brandColor} onChange={(e) => { setBrandColor(e.target.value); setBrandColorText(suggestTextColor(e.target.value)); if (!gradientEnabled) setGradientFrom(e.target.value); }} className="w-12 h-12 rounded-xl border border-gray-200 cursor-pointer p-0.5" />
              <div className="flex-1">
                <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} placeholder="#3B4E6C" />
              </div>
            </div>
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

      {/* Gradient */}
      <Card padding="lg">
        <CardSection title="Gradient header" description="Gebruik een kleurverloop voor een moderne uitstraling.">
          <div className="space-y-4">
            <Toggle label="Gradient gebruiken" checked={gradientEnabled} onChange={setGradientEnabled} />
            {gradientEnabled && (
              <>
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

      {/* Logo upload */}
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

      {/* Footer text */}
      <Card padding="lg">
        <CardSection title="Footer tekst" description="Optionele tekst onderaan elke e-mail.">
          <Input
            value={emailFooterText}
            onChange={(e) => setEmailFooterText(e.target.value)}
            placeholder="Bijv. Tot snel bij Salon Amara!"
          />
        </CardSection>
      </Card>

      {/* Email preview */}
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

            <div className="border border-gray-200 rounded-2xl overflow-hidden" style={{ background: '#F7F7F5' }}>
              <div className="p-4">
                <div className="rounded-xl overflow-hidden bg-white shadow-sm max-w-[480px] mx-auto">
                  <div style={{ background: gradientEnabled ? `linear-gradient(${gradientDirection}, ${gradientFrom}, ${gradientTo})` : brandColor, padding: '20px 24px', textAlign: 'center' as const }}>
                    {logoUrl ? (
                      <img src={logoUrl} alt="Logo" style={{ maxHeight: 48, maxWidth: 180, display: 'block', margin: '0 auto' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <span style={{ fontSize: 18, fontWeight: 700, color: brandColorText, letterSpacing: '-0.3px' }}>{name || 'Je Salon'}</span>
                    )}
                  </div>
                  <div style={{ padding: '24px' }}>
                    <p style={{ fontSize: 14, color: '#475569', textAlign: 'center' as const }}>
                      {emailPreviewType === 'confirmation' && 'Afspraak bevestigd — voorbeeld'}
                      {emailPreviewType === 'notification' && 'Nieuwe boeking — voorbeeld'}
                      {emailPreviewType === 'cancellation' && 'Afspraak geannuleerd — voorbeeld'}
                      {emailPreviewType === 'cancellation_notification' && 'Annulering door klant — voorbeeld'}
                      {emailPreviewType === 'reminder_24h' && 'Herinnering morgen — voorbeeld'}
                      {emailPreviewType === 'reminder_1h' && 'Over een uur — voorbeeld'}
                      {emailPreviewType === 'review_request' && 'Hoe was je bezoek? — voorbeeld'}
                    </p>
                  </div>
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

      {/* Email types toggle */}
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
                <Toggle checked={emailPreferences[et.key] ?? true} onChange={(v) => setEmailPreferences({ ...emailPreferences, [et.key]: v })} />
              </div>
            ))}
          </div>
        </CardSection>
      </Card>

      <Button onClick={onSave} loading={saving}>Opslaan</Button>
    </div>
  );
}
