import type { Staff } from '../../lib/types';

interface StaffPickerProps {
  staff: Staff[];
  selectedId: string | null;
  onSelect: (staffId: string | null) => void;
}

export function StaffPicker({ staff, selectedId, onSelect }: StaffPickerProps) {
  return (
    <div className="dds-animate-in">
      <h2 className="dds-step-title">Kies een medewerker</h2>
      <p className="dds-step-subtitle">Bij wie wil je je afspraak maken?</p>
      <div className="dds-staff-grid">
        {/* No preference option */}
        <div
          className={`dds-staff-card dds-no-preference ${selectedId === null ? 'dds-staff-card--selected' : ''}`}
          onClick={() => onSelect(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onSelect(null)}
        >
          <div className="dds-staff-avatar"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
          <div className="dds-staff-name">Geen voorkeur</div>
        </div>

        {staff.map((member) => (
          <div
            key={member.id}
            className={`dds-staff-card ${selectedId === member.id ? 'dds-staff-card--selected' : ''}`}
            onClick={() => onSelect(member.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(member.id)}
          >
            <div className="dds-staff-avatar">
              {member.photo_url ? (
                <img src={member.photo_url} alt={member.name} />
              ) : (
                member.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="dds-staff-name">{member.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
