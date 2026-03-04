import { Input, Textarea, Select } from '../../../components/ui/Input';
import { Toggle } from '../../../components/ui/Toggle';
import { Card, CardSection } from '../../../components/ui/Card';

interface AppointmentsTabProps {
  bufferMinutes: number;
  setBufferMinutes: (v: number) => void;
  maxBookingWeeks: number;
  setMaxBookingWeeks: (v: number) => void;
  cancellationPolicy: string;
  setCancellationPolicy: (v: string) => void;
  rescheduleEnabled: boolean;
  setRescheduleEnabled: (v: boolean) => void;
  customerLoginEnabled: boolean;
  setCustomerLoginEnabled: (v: boolean) => void;
  guestBookingAllowed: boolean;
  setGuestBookingAllowed: (v: boolean) => void;
  customerLoginMethods: string[];
  setCustomerLoginMethods: (v: string[]) => void;
}

export function AppointmentsTab({
  bufferMinutes, setBufferMinutes,
  maxBookingWeeks, setMaxBookingWeeks,
  cancellationPolicy, setCancellationPolicy,
  rescheduleEnabled, setRescheduleEnabled,
  customerLoginEnabled, setCustomerLoginEnabled,
  guestBookingAllowed, setGuestBookingAllowed,
  customerLoginMethods, setCustomerLoginMethods,
}: AppointmentsTabProps) {
  const hasMethod = (method: string) => customerLoginMethods.includes(method);
  const toggleMethod = (method: string, enabled: boolean) => {
    if (enabled) {
      const next = Array.from(new Set([...customerLoginMethods, method]));
      setCustomerLoginMethods(next);
    } else {
      const next = customerLoginMethods.filter((m) => m !== method);
      setCustomerLoginMethods(next);
    }
  };
  return (
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

      <Card padding="lg">
        <CardSection title="Klantlogin" description="Laat klanten een account gebruiken voor sneller boeken.">
          <div className="space-y-4">
            <Toggle
              checked={customerLoginEnabled}
              onChange={setCustomerLoginEnabled}
              label="Klantlogin inschakelen"
              description="Klanten kunnen een account gebruiken om sneller te boeken."
            />
            <Toggle
              checked={guestBookingAllowed}
              onChange={setGuestBookingAllowed}
              label="Gast boeken toegestaan"
              description="Laat klanten ook boeken zonder account."
              disabled={!customerLoginEnabled}
            />
            <div className="grid grid-cols-1 gap-3">
              <Toggle
                checked={hasMethod('password')}
                onChange={(v) => toggleMethod('password', v)}
                label="Inloggen met wachtwoord"
                description="Klant maakt een eigen wachtwoord aan."
                disabled={!customerLoginEnabled}
              />
              <Toggle
                checked={hasMethod('otp')}
                onChange={(v) => toggleMethod('otp', v)}
                label="Inloggen met e‑mailcode"
                description="Eenmalige code via e‑mail."
                disabled={!customerLoginEnabled}
              />
            </div>
            <p className="text-[12px] text-gray-500">
              Tip: zet beide methodes aan voor maximale flexibiliteit.
            </p>
          </div>
        </CardSection>
      </Card>
    </div>
  );
}
