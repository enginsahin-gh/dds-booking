import { format, addDays, subDays, isToday } from 'date-fns';
import { nl } from 'date-fns/locale';

interface DateNavigatorProps {
  date: Date;
  onChange: (date: Date) => void;
}

export function DateNavigator({ date, onChange }: DateNavigatorProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(subDays(date, 1))}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      </button>
      <span className="text-xs lg:text-sm font-medium text-gray-700 min-w-[100px] lg:min-w-[180px] text-center">
        <span className="hidden lg:inline">{format(date, 'EEEE d MMMM yyyy', { locale: nl })}</span>
        <span className="lg:hidden">{format(date, 'EEE d MMM', { locale: nl })}</span>
      </span>
      <button
        onClick={() => onChange(addDays(date, 1))}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
      </button>
      {!isToday(date) && (
        <button
          onClick={() => onChange(new Date())}
          className="px-2 py-1 text-[10px] font-medium text-violet-600 bg-violet-50 rounded-lg hover:bg-violet-100 transition-colors"
        >
          Vandaag
        </button>
      )}
    </div>
  );
}
