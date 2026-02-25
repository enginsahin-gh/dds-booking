import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AdminLayout } from './components/admin/AdminLayout';
import { ProtectedRoute } from './components/admin/ProtectedRoute';
import { LoginPage } from './pages/admin/LoginPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { BookingsPage } from './pages/admin/BookingsPage';
import { ServicesPage } from './pages/admin/ServicesPage';
import { StaffPage } from './pages/admin/StaffPage';
import { SchedulePage } from './pages/admin/SchedulePage';
import { BlocksPage } from './pages/admin/BlocksPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { PaymentSettingsPage } from './pages/admin/PaymentSettingsPage';
import { BookingPage } from './pages/BookingPage';
import { PaymentReturnPage } from './pages/PaymentReturnPage';

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public booking page */}
          <Route path="/" element={<BookingPage />} />
          <Route path="/boeking/bevestiging" element={<PaymentReturnPage />} />
          {/* Admin routes */}
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="bookings" element={<BookingsPage />} />
            <Route path="services" element={<ServicesPage />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="staff/:staffId/schedule" element={<SchedulePage />} />
            <Route path="staff/:staffId/blocks" element={<BlocksPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="payments" element={<PaymentSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
