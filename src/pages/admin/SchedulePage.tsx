import { useParams, Link } from 'react-router-dom';
import { useStaff, useStaffSchedules } from '../../hooks/useStaff';
import { WeekScheduleEditor } from '../../components/admin/WeekScheduleEditor';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { useOutletContext } from 'react-router-dom';
import type { Salon } from '../../lib/types';

export function SchedulePage() {
  const { staffId } = useParams<{ staffId: string }>();
  const { salon } = useOutletContext<{ salon: Salon | null }>();
  const { staff } = useStaff(salon?.id);
  const { schedules, loading, saveSchedule } = useStaffSchedules(staffId);
  const { addToast } = useToast();

  const member = staff.find(s => s.id === staffId);

  const handleSave = async (schedule: Parameters<typeof saveSchedule>[0]) => {
    try {
      await saveSchedule(schedule);
      addToast('success', 'Rooster bijgewerkt');
    } catch {
      addToast('error', 'Kon rooster niet opslaan');
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Link
          to="/admin/staff"
          className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </Link>
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900 tracking-tight">Weekrooster</h1>
          {member && <p className="text-[13px] text-gray-500 mt-0.5">{member.name}</p>}
        </div>
      </div>

      {loading ? <Spinner className="py-12" /> : (
        <WeekScheduleEditor schedules={schedules} staffId={staffId!} onSave={handleSave} />
      )}
    </div>
  );
}
