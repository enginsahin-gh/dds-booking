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
    <div className="bellure-animate-in">
      <h2 className="bellure-step-title">Kies datum & tijd</h2>
      <p className="bellure-step-subtitle">Wanneer wil je langskomen?</p>

      <div className="bellure-datetime-layout">
        <div className="bellure-datetime-calendar">
          <CalendarGrid
            selectedDate={selectedDate}
            onSelectDate={onSelectDate}
            currentMonth={currentMonth}
            onChangeMonth={setCurrentMonth}
            workingDays={workingDays}
            maxDate={maxDate}
          />
        </div>

        <div className="bellure-datetime-slots">
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
