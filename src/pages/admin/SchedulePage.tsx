import { useParams, Link } from 'react-router-dom';
import { useStaffSchedules } from '../../hooks/useStaff';
import { WeekScheduleEditor } from '../../components/admin/WeekScheduleEditor';
import { Spinner } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';

export function SchedulePage() {
  const { staffId } = useParams<{ staffId: string }>();
  const { schedules, loading, saveSchedule } = useStaffSchedules(staffId);
  const { addToast } = useToast();

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
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/staff" className="text-gray-400 hover:text-gray-600">← Terug</Link>
        <h1 className="text-2xl font-bold text-gray-900">Weekrooster</h1>
      </div>

      {loading ? <Spinner className="py-12" /> : (
        <WeekScheduleEditor schedules={schedules} staffId={staffId!} onSave={handleSave} />
      )}
    </div>
  );
}
