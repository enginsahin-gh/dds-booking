import type { Staff, Service } from '../../lib/types';

interface PerServiceStaffInfo {
  service: Service;
  availableStaff: Staff[];
}

interface StaffPickerProps {
  staff: Staff[];
  selectedId: string | null;
  onSelect: (staffId: string | null) => void;
  noStaffForCombo?: boolean;
  perServiceStaff?: PerServiceStaffInfo[];
  onBack?: () => void;
}

export function StaffPicker({ staff, selectedId, onSelect, noStaffForCombo, perServiceStaff, onBack }: StaffPickerProps) {
  // Show info when no single staff member can do the full combination
  if (noStaffForCombo && perServiceStaff && perServiceStaff.length > 0) {
    return (
      <div className="bellure-animate-in">
        <h2 className="bellure-step-title">Kies een medewerker</h2>
        <div style={{
          padding: 16, marginBottom: 16, background: '#FFF7ED',
          borderRadius: 10, border: '1px solid #FED7AA',
        }}>
          <div style={{ fontWeight: 600, color: '#9A3412', fontSize: '0.9rem', marginBottom: 8 }}>
            Deze combinatie is niet bij één medewerker mogelijk
          </div>
          <p style={{ fontSize: '0.85rem', color: '#9A3412', margin: '0 0 12px', lineHeight: 1.5 }}>
            Je kunt de behandelingen apart boeken, of een andere combinatie kiezen.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {perServiceStaff.map(({ service, availableStaff }) => (
              <div key={service.id} style={{
                padding: '10px 12px', background: '#fff', borderRadius: 8,
                border: '1px solid #FED7AA', fontSize: '0.85rem',
              }}>
                <div style={{ fontWeight: 600, color: '#1E293B', marginBottom: 2 }}>{service.name}</div>
                <div style={{ color: '#64748B' }}>
                  {availableStaff.length > 0
                    ? availableStaff.map(s => s.name).join(', ')
                    : 'Geen medewerker beschikbaar'}
                </div>
              </div>
            ))}
          </div>
        </div>
        {onBack && (
          <button className="bellure-btn bellure-btn-secondary" onClick={onBack} style={{ marginTop: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{verticalAlign: "-3px"}}><polyline points="19 12 5 12"/><polyline points="12 19 5 12 12 5"/></svg> Andere behandeling kiezen
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bellure-animate-in">
      <h2 className="bellure-step-title">Kies een medewerker</h2>
      <p className="bellure-step-subtitle">Bij wie wil je je afspraak maken?</p>
      <div className="bellure-staff-grid">
        {/* No preference option */}
        <div
          className={`bellure-staff-card bellure-no-preference ${selectedId === null ? 'bellure-staff-card--selected' : ''}`}
          onClick={() => onSelect(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onSelect(null)}
        >
          <div className="bellure-staff-avatar"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          <div className="bellure-staff-name">Geen voorkeur</div>
        </div>

        {staff.map((member) => (
          <div
            key={member.id}
            className={`bellure-staff-card ${selectedId === member.id ? 'bellure-staff-card--selected' : ''}`}
            onClick={() => onSelect(member.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(member.id)}
          >
            <div className="bellure-staff-avatar">
              {member.photo_url ? (
                <img src={member.photo_url} alt={member.name} />
              ) : (
                member.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="bellure-staff-name">{member.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
