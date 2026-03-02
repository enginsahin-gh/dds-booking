import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { TimeSlot } from '../../lib/types';

interface TimeSlotListProps {
  slots: TimeSlot[];
  selectedSlot: TimeSlot | null;
  onSelect: (slot: TimeSlot) => void;
  loading: boolean;
  timezone: string;
  dateSelected: boolean;
}

export function TimeSlotList({ slots, selectedSlot, onSelect, loading, timezone, dateSelected }: TimeSlotListProps) {
  if (!dateSelected) return null;

  if (loading) {
    return (
      <div className="bellure-slots">
        <div className="bellure-spinner">
          <div className="bellure-spinner-circle" />
        </div>
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className="bellure-slots">
        <div className="bellure-slots-empty">
          Geen beschikbare tijden op deze dag. Probeer een andere datum.
        </div>
      </div>
    );
  }

  return (
    <div className="bellure-slots bellure-animate-in">
      <div className="bellure-slots-label">Beschikbare tijden</div>
      <div className="bellure-slots-grid">
        {slots.map((slot) => {
          const zonedTime = toZonedTime(parseISO(slot.time), timezone);
          const timeStr = format(zonedTime, 'HH:mm');
          const isSelected = selectedSlot?.time === slot.time;

          return (
            <div
              key={slot.time + slot.staffId}
              className={`bellure-slot ${isSelected ? 'bellure-slot--selected' : ''}`}
              onClick={() => onSelect(slot)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(slot)}
            >
              {timeStr}
            </div>
          );
        })}
      </div>
    </div>
  );
}
