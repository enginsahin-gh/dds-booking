import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Button } from '../ui/Button';
import type { StaffBlock } from '../../lib/types';

interface BlockListProps {
  blocks: StaffBlock[];
  onRemove: (id: string) => void;
}

export function BlockList({ blocks, onRemove }: BlockListProps) {
  if (!blocks.length) {
    return <p className="text-gray-500 text-sm py-8 text-center">Geen blokkades ingesteld</p>;
  }

  return (
    <div className="space-y-3">
      {blocks.map((block) => (
        <div key={block.id} className="flex items-center justify-between bg-white rounded-xl border border-gray-200 p-4">
          <div>
            <div className="font-medium text-sm">
              {format(parseISO(block.start_at), 'd MMM yyyy HH:mm', { locale: nl })} —{' '}
              {format(parseISO(block.end_at), 'd MMM yyyy HH:mm', { locale: nl })}
            </div>
            {block.reason && <div className="text-xs text-gray-400 mt-1">{block.reason}</div>}
          </div>
          <Button variant="danger" size="sm" onClick={() => onRemove(block.id)}>Verwijderen</Button>
        </div>
      ))}
    </div>
  );
}
