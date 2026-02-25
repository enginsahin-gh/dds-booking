import { Link } from 'react-router-dom';
import { Button } from '../ui/Button';
import type { Staff } from '../../lib/types';

interface StaffListProps {
  staff: Staff[];
  onEdit: (member: Staff) => void;
}

export function StaffList({ staff, onEdit }: StaffListProps) {
  if (!staff.length) {
    return <p className="text-gray-500 text-sm py-8 text-center">Nog geen medewerkers toegevoegd</p>;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {staff.map((member) => (
        <div key={member.id} className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-lg font-bold">
              {member.photo_url ? (
                <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover rounded-full" />
              ) : (
                member.name.charAt(0)
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{member.name}</h3>
              <span className={`text-xs ${member.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                {member.is_active ? 'Actief' : 'Inactief'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => onEdit(member)}>Bewerken</Button>
            <Link to={`/admin/staff/${member.id}/schedule`}>
              <Button variant="ghost" size="sm">Rooster</Button>
            </Link>
            <Link to={`/admin/staff/${member.id}/blocks`}>
              <Button variant="ghost" size="sm">Blokkades</Button>
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
