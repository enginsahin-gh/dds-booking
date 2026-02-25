import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  addMonths,
  subMonths,
  startOfDay,
} from 'date-fns';
import { nl } from 'date-fns/locale';

interface CalendarGridProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  currentMonth: Date;
  onChangeMonth: (date: Date) => void;
}

const WEEKDAYS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

export function CalendarGrid({ selectedDate, onSelectDate, currentMonth, onChangeMonth }: CalendarGridProps) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });
  const today = startOfDay(new Date());

  const canGoPrev = !isBefore(startOfMonth(subMonths(currentMonth, 1)), startOfMonth(today));

  return (
    <div className="dds-calendar">
      <div className="dds-calendar-header">
        <button
          className="dds-calendar-btn"
          onClick={() => onChangeMonth(subMonths(currentMonth, 1))}
          disabled={!canGoPrev}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="dds-calendar-title">
          {format(currentMonth, 'MMMM yyyy', { locale: nl })}
        </span>
        <button
          className="dds-calendar-btn"
          onClick={() => onChangeMonth(addMonths(currentMonth, 1))}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div className="dds-calendar-weekdays">
        {WEEKDAYS.map((d) => (
          <div key={d} className="dds-calendar-weekday">{d}</div>
        ))}
      </div>

      <div className="dds-calendar-days">
        {days.map((day) => {
          const inMonth = isSameMonth(day, currentMonth);
          const isPast = isBefore(day, today);
          const selected = selectedDate && isSameDay(day, selectedDate);
          const todayClass = isToday(day);

          let cls = 'dds-calendar-day';
          if (!inMonth) cls += ' dds-calendar-day--empty dds-calendar-day--disabled';
          else if (isPast) cls += ' dds-calendar-day--disabled';
          else {
            if (todayClass) cls += ' dds-calendar-day--today';
            if (selected) cls += ' dds-calendar-day--selected';
          }

          return (
            <div
              key={day.toISOString()}
              className={cls}
              onClick={() => inMonth && !isPast && onSelectDate(day)}
            >
              {inMonth ? format(day, 'd') : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}
