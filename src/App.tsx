import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AdminLayout } from './components/admin/AdminLayout';
import { ProtectedRoute, OwnerRoute } from './components/admin/ProtectedRoute';
import { LoginPage } from './pages/admin/LoginPage';
const RegisterPage = lazy(() => import('./pages/admin/RegisterPage').then(m => ({ default: m.RegisterPage })));
const OnboardingWizard = lazy(() => import('./pages/admin/OnboardingWizard').then(m => ({ default: m.OnboardingWizard })));
import { SetPasswordPage } from './pages/admin/SetPasswordPage';
import { Spinner } from './components/ui/Spinner';

// Lazy load pages — only fetched when navigated to
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage').then(m => ({ default: m.DashboardPage })));
const BookingsPage = lazy(() => import('./pages/admin/BookingsPage').then(m => ({ default: m.BookingsPage })));
const ServicesPage = lazy(() => import('./pages/admin/ServicesPage').then(m => ({ default: m.ServicesPage })));
const StaffPage = lazy(() => import('./pages/admin/StaffPage').then(m => ({ default: m.StaffPage })));
const SchedulePage = lazy(() => import('./pages/admin/SchedulePage').then(m => ({ default: m.SchedulePage })));
const BlocksPage = lazy(() => import('./pages/admin/BlocksPage').then(m => ({ default: m.BlocksPage })));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage').then(m => ({ default: m.SettingsPage })));
// PaymentSettingsPage is now embedded in SettingsPage as a tab
const CustomersPage = lazy(() => import('./pages/admin/CustomersPage').then(m => ({ default: m.CustomersPage })));
const UsersPage = lazy(() => import('./pages/admin/UsersPage').then(m => ({ default: m.UsersPage })));
const StatsPage = lazy(() => import('./pages/admin/StatsPage').then(m => ({ default: m.StatsPage })));
const WaitlistPage = lazy(() => import('./pages/admin/WaitlistPage').then(m => ({ default: m.WaitlistPage })));
const BookingPage = lazy(() => import('./pages/BookingPage').then(m => ({ default: m.BookingPage })));
const CustomerPortalPage = lazy(() => import('./pages/CustomerPortalPage').then(m => ({ default: m.CustomerPortalPage })));
const PaymentReturnPage = lazy(() => import('./pages/PaymentReturnPage').then(m => ({ default: m.PaymentReturnPage })));

function PageLoader() {
  return <Spinner className="min-h-[50vh]" />;
}

/** Root route: if ?salon= param present, show booking widget. Otherwise redirect to admin. */
function RootRedirect() {
  const [params] = useSearchParams();
  const isBookingDomain = typeof window !== 'undefined' && window.location.hostname.startsWith('booking.');
  if (params.get('salon') || params.get('payment_return') || isBookingDomain) {
    return (
      <Suspense fallback={<PageLoader />}>
        <BookingPage />
      </Suspense>
    );
  }
  return <Navigate to="/admin" replace />;
}

export function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public booking page */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="/mijn-afspraken" element={<CustomerPortalPage />} />
              <Route path="/:salonSlug" element={<BookingPage />} />
              <Route path="/boeking/bevestiging" element={<PaymentReturnPage />} />
              {/* Admin routes */}
              <Route path="/admin/login" element={<LoginPage />} />
              <Route path="/admin/registreren" element={<RegisterPage />} />
              <Route path="/admin/set-password" element={<SetPasswordPage />} />
              <Route path="/admin/onboarding" element={<ProtectedRoute><OnboardingWizard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
                <Route index element={<DashboardPage />} />
                <Route path="bookings" element={<BookingsPage />} />
                <Route path="services" element={<OwnerRoute><ServicesPage /></OwnerRoute>} />
                <Route path="staff" element={<StaffPage />} />
                <Route path="staff/:staffId/schedule" element={<OwnerRoute><SchedulePage /></OwnerRoute>} />
                <Route path="staff/:staffId/blocks" element={<OwnerRoute><BlocksPage /></OwnerRoute>} />
                <Route path="settings" element={<OwnerRoute><SettingsPage /></OwnerRoute>} />
                <Route path="customers" element={<CustomersPage />} />
                <Route path="waitlist" element={<WaitlistPage />} />
                <Route path="stats" element={<OwnerRoute><StatsPage /></OwnerRoute>} />
                <Route path="users" element={<OwnerRoute><UsersPage /></OwnerRoute>} />
                <Route path="payments" element={<Navigate to="/admin/settings" replace />} />
              </Route>
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
