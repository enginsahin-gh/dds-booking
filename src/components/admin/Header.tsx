import { useAuth } from '../../hooks/useAuth';

interface HeaderProps {
  salonName?: string;
}

export function Header({ salonName }: HeaderProps) {
  const { signOut } = useAuth();

  return (
    <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6">
      <div className="flex items-center gap-3">
        <span className="lg:hidden text-lg font-bold">💇 DDS</span>
        {salonName && <h2 className="text-sm font-semibold text-gray-700">{salonName}</h2>}
      </div>
      <button
        onClick={signOut}
        className="text-sm text-gray-500 hover:text-gray-700 font-medium"
      >
        Uitloggen
      </button>
    </header>
  );
}
