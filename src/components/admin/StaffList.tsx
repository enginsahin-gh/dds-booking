import { Link } from 'react-router-dom';
import type { Staff } from '../../lib/types';

interface StaffListProps {
  staff: Staff[];
  onEdit?: (member: Staff) => void;
}

export function StaffList({ staff, onEdit }: StaffListProps) {
  if (!staff.length) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <p className="text-[14px] font-medium text-gray-600">Nog geen medewerkers</p>
        <p className="text-[13px] text-gray-400 mt-1">Voeg je eerste medewerker toe om te beginnen.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {staff.map((member) => (
        <div
          key={member.id}
          className="bg-white rounded-2xl border border-gray-200/60 shadow-[0_1px_3px_rgba(0,0,0,0.06)] p-5 hover:shadow-[0_8px_25px_rgba(0,0,0,0.08)] hover:-translate-y-px transition-all duration-200"
        >
          <div className="flex items-center gap-3.5 mb-4">
            <div className="w-12 h-12 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center text-lg font-bold flex-shrink-0 overflow-hidden">
              {member.photo_url ? (
                <img src={member.photo_url} alt={member.name} className="w-full h-full object-cover" />
              ) : (
                member.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-bold text-gray-900 truncate">{member.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`inline-flex items-center gap-1 text-[12px] font-medium ${member.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${member.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  {member.is_active ? 'Actief' : 'Inactief'}
                </span>
                {member.is_active && !member.all_services && (
                  <span className="text-[11px] text-violet-500 font-medium bg-violet-50 px-1.5 py-0.5 rounded-md">Specifieke diensten</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(member)}
                className="flex-1 px-3 py-2 text-[13px] font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-center"
              >
                Bewerken
              </button>
            )}
            {onEdit && (
              <>
                <Link
                  to={`/admin/staff/${member.id}/schedule`}
                  className="px-3 py-2 text-[13px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Rooster
                </Link>
                <Link
                  to={`/admin/staff/${member.id}/blocks`}
                  className="px-3 py-2 text-[13px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-xl transition-colors"
                >
                  Blokkades
                </Link>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
