import { useState } from 'react';
import { Toggle } from '../ui/Toggle';
import type { StaffSchedule } from '../../lib/types';

const DAY_NAMES = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
const DAY_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

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
    } catch { /* toast handles errors */ }
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
    } catch { /* toast handles errors */ }
    setSaving(null);
  };

  const workingDays = DAY_NAMES.filter((_, i) => getSchedule(i)?.is_working).length;

  return (
    <div className="space-y-2">
      <div className="text-[12px] text-gray-400 font-medium mb-3">
        {workingDays} van 7 dagen actief
      </div>

      {DAY_NAMES.map((name, i) => {
        const schedule = getSchedule(i);
        const isWorking = schedule?.is_working ?? false;
        const isWeekend = i >= 5;

        return (
          <div
            key={i}
            className={`flex items-center gap-4 rounded-xl border p-4 transition-all ${
              isWorking
                ? 'bg-white border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
                : 'bg-gray-50/50 border-gray-100'
            }`}
          >
            <div className="w-24 sm:w-28 flex-shrink-0">
              <span className="hidden sm:inline text-[14px] font-semibold text-gray-900">{name}</span>
              <span className="sm:hidden text-[14px] font-semibold text-gray-900">{DAY_SHORT[i]}</span>
              {isWeekend && !isWorking && (
                <span className="hidden sm:inline ml-2 text-[11px] text-gray-400">weekend</span>
              )}
            </div>

            <Toggle
              checked={isWorking}
              onChange={() => handleToggle(i)}
              disabled={saving === i}
            />

            {isWorking ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <input
                  type="time"
                  value={schedule?.start_time?.slice(0, 5) || '09:00'}
                  onChange={(e) => handleTimeChange(i, 'start_time', e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-[14px] bg-white hover:border-gray-300 focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 transition-all w-[110px]"
                />
                <span className="text-gray-300 flex-shrink-0">—</span>
                <input
                  type="time"
                  value={schedule?.end_time?.slice(0, 5) || '17:00'}
                  onChange={(e) => handleTimeChange(i, 'end_time', e.target.value)}
                  className="px-3 py-2 rounded-xl border border-gray-200 text-[14px] bg-white hover:border-gray-300 focus:outline-none focus:border-violet-500 focus:ring-[3px] focus:ring-violet-500/10 transition-all w-[110px]"
                />
              </div>
            ) : (
              <span className="text-[13px] text-gray-400 font-medium">Vrij</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
