import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuth } from '../../hooks/useAuth';
import { useSalon } from '../../hooks/useSalon';

export function AdminLayout() {
  const { user } = useAuth();
  const { salon } = useSalon(undefined, user?.id);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header salonName={salon?.name} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet context={{ salon, user }} />
        </main>
      </div>
    </div>
  );
}
