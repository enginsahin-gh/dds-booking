import { format, addDays, subDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Button } from '../ui/Button';

interface DateNavigatorProps {
  date: Date;
  onChange: (date: Date) => void;
}

export function DateNavigator({ date, onChange }: DateNavigatorProps) {
  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="sm" onClick={() => onChange(subDays(date, 1))}>←</Button>
      <span className="text-sm font-semibold min-w-[180px] text-center">
        {format(date, 'EEEE d MMMM yyyy', { locale: nl })}
      </span>
      <Button variant="ghost" size="sm" onClick={() => onChange(addDays(date, 1))}>→</Button>
      <Button variant="secondary" size="sm" onClick={() => onChange(new Date())}>Vandaag</Button>
    </div>
  );
}
