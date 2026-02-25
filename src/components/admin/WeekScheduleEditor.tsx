import { useState } from 'react';
import { Button } from '../ui/Button';
import type { StaffSchedule } from '../../lib/types';

const DAY_NAMES = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];

interface WeekScheduleEditorProps {
  schedules: StaffSchedule[];
  staffId: string;
  onSave: (schedule: Omit<StaffSchedule, 'id'> & { id?: string }) => Promise<void>;
}

export function WeekScheduleEditor({ schedules, staffId, onSave }: WeekScheduleEditorProps) {
  const [saving, setSaving] = useState<number | null>(null);

  const getSchedule = (dow: number) => schedules.find((s) => s.day_of_week === dow);

  const handleToggle = async (dow: number) => {
    const existing = getSchedule(dow);
    setSaving(dow);
    try {
      await onSave({
        ...(existing?.id ? { id: existing.id } : {}),
        staff_id: staffId,
        day_of_week: dow,
        start_time: existing?.start_time || '09:00',
        end_time: existing?.end_time || '17:00',
        is_working: existing ? !existing.is_working : true,
      });
    } catch { /* toast */ }
    setSaving(null);
  };

  const handleTimeChange = async (dow: number, field: 'start_time' | 'end_time', value: string) => {
    const existing = getSchedule(dow);
    setSaving(dow);
    try {
      await onSave({
        ...(existing?.id ? { id: existing.id } : {}),
        staff_id: staffId,
        day_of_week: dow,
        start_time: field === 'start_time' ? value : existing?.start_time || '09:00',
        end_time: field === 'end_time' ? value : existing?.end_time || '17:00',
        is_working: existing?.is_working ?? true,
      });
    } catch { /* toast */ }
    setSaving(null);
  };

  return (
    <div className="space-y-3">
      {DAY_NAMES.map((name, i) => {
        const schedule = getSchedule(i);
        const isWorking = schedule?.is_working ?? false;

        return (
          <div key={i} className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4">
            <div className="w-28 font-medium text-gray-700">{name}</div>
            <button
              onClick={() => handleToggle(i)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isWorking ? 'bg-violet-600' : 'bg-gray-300'
              }`}
              disabled={saving === i}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isWorking ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
            {isWorking && (
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  value={schedule?.start_time?.slice(0, 5) || '09:00'}
                  onChange={(e) => handleTimeChange(i, 'start_time', e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                />
                <span className="text-gray-400">—</span>
                <input
                  type="time"
                  value={schedule?.end_time?.slice(0, 5) || '17:00'}
                  onChange={(e) => handleTimeChange(i, 'end_time', e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
                />
              </div>
            )}
            {!isWorking && <span className="text-sm text-gray-400">Vrij</span>}
          </div>
        );
      })}
    </div>
  );
}
