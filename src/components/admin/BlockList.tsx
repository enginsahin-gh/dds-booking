import { format, parseISO, isPast } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { StaffBlock } from '../../lib/types';

interface BlockListProps {
  blocks: StaffBlock[];
  onRemove: (id: string) => void;
}

export function BlockList({ blocks, onRemove }: BlockListProps) {
  const sorted = [...blocks].sort((a, b) => a.start_at.localeCompare(b.start_at));

  return (
    <div className="space-y-2">
      {sorted.map((block) => {
        const isExpired = isPast(parseISO(block.end_at));

        return (
          <div
            key={block.id}
            className={`flex items-center justify-between rounded-xl border p-4 transition-all ${
              isExpired
                ? 'bg-gray-50/50 border-gray-100'
                : 'bg-white border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                isExpired ? 'bg-gray-100 text-gray-400' : 'bg-red-50 text-red-500'
              }`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
              </div>
              <div className="min-w-0">
                <div className={`text-[14px] font-semibold ${isExpired ? 'text-gray-400' : 'text-gray-900'}`}>
                  {format(parseISO(block.start_at), 'd MMM HH:mm', { locale: nl })} — {format(parseISO(block.end_at), 'd MMM HH:mm', { locale: nl })}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {block.reason && (
                    <span className={`text-[12px] ${isExpired ? 'text-gray-400' : 'text-gray-500'}`}>{block.reason}</span>
                  )}
                  {isExpired && (
                    <span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Verlopen</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => onRemove(block.id)}
              className="flex-shrink-0 text-[12px] font-medium text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              Verwijderen
            </button>
          </div>
        );
      })}
    </div>
  );
}
