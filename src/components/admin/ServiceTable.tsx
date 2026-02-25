import { Button } from '../ui/Button';
import type { Service } from '../../lib/types';

interface ServiceTableProps {
  services: Service[];
  onEdit: (service: Service) => void;
  onToggleActive: (id: string, isActive: boolean) => void;
}

function formatPrice(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`;
}

export function ServiceTable({ services, onEdit, onToggleActive }: ServiceTableProps) {
  if (!services.length) {
    return <p className="text-gray-500 text-sm py-8 text-center">Nog geen diensten toegevoegd</p>;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Naam</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Duur</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Prijs</th>
            <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {services.map((service) => (
            <tr key={service.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 font-medium">{service.name}</td>
              <td className="px-4 py-3">{service.duration_min} min</td>
              <td className="px-4 py-3">{formatPrice(service.price_cents)}</td>
              <td className="px-4 py-3">
                <button
                  onClick={() => onToggleActive(service.id, !service.is_active)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    service.is_active ? 'bg-violet-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    service.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </td>
              <td className="px-4 py-3">
                <Button variant="ghost" size="sm" onClick={() => onEdit(service)}>Bewerken</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
