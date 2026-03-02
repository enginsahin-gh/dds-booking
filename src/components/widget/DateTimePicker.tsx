import { useState } from 'react';
import { startOfMonth } from 'date-fns';
import { CalendarGrid } from './CalendarGrid';
import { TimeSlotList } from './TimeSlotList';
import type { TimeSlot } from '../../lib/types';

interface DateTimePickerProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  selectedSlot: TimeSlot | null;
  onSelectSlot: (slot: TimeSlot) => void;
  slots: TimeSlot[];
  slotsLoading: boolean;
  timezone: string;
  workingDays?: Set<number>;
  maxDate?: Date | null;
}

export function DateTimePicker({
  selectedDate,
  onSelectDate,
  selectedSlot,
  onSelectSlot,
  slots,
  slotsLoading,
  timezone,
  workingDays,
  maxDate,
}: DateTimePickerProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

  return (
    <div className="dds-animate-in">
      <h2 className="dds-step-title">Kies datum & tijd</h2>
      <p className="dds-step-subtitle">Wanneer wil je langskomen?</p>

      <div className="dds-datetime-layout">
        <div className="dds-datetime-calendar">
          <CalendarGrid
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            currentMonth={currentMonth}
            onChangeMonth={setCurrentMonth}
            workingDays={workingDays}
            maxDate={maxDate}
          />
        </div>

        <div className="dds-datetime-slots">
          <TimeSlotList
            slots={slots}
            selectedSlot={selectedSlot}
            onSelect={onSelectSlot}
            loading={slotsLoading}
            timezone={timezone}
            dateSelected={!!selectedDate}
          />
        </div>
      </div>
    </div>
  );
}
