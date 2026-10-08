import { useEffect, Suspense, lazy } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { PwaProvider } from '@/components/pwa/pwa-provider';
import { Layout } from '@/components/shared/layout';

const LandingPage = lazy(() => import('@/pages/landing/LandingPage').then((m) => ({ default: m.LandingPage })));
const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((m) => ({ default: m.LoginPage })));
const RegisterPage = lazy(() => import('@/pages/auth/RegisterPage').then((m) => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })));
const TermsPage = lazy(() => import('@/pages/legal/TermsPage').then((m) => ({ default: m.TermsPage })));
const PrivacyPage = lazy(() => import('@/pages/legal/PrivacyPage').then((m) => ({ default: m.PrivacyPage })));
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const AccountsPage = lazy(() => import('@/pages/accounts/AccountsPage').then((m) => ({ default: m.AccountsPage })));
const TransactionsPage = lazy(() => import('@/pages/transactions/TransactionsPage').then((m) => ({ default: m.TransactionsPage })));
const BillsPage = lazy(() => import('@/pages/bills/BillsPage').then((m) => ({ default: m.BillsPage })));
const DebtsPage = lazy(() => import('@/pages/debts/DebtsPage').then((m) => ({ default: m.DebtsPage })));
const ReportsPage = lazy(() => import('@/pages/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

function PageLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/cards" element={<Navigate to="/accounts?tab=cards" replace />} />
            <Route path="/invoices" element={<Navigate to="/accounts?tab=invoices" replace />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/installments" element={<Navigate to="/accounts?tab=installments" replace />} />
            <Route path="/bills" element={<BillsPage />} />
            <Route path="/debts" element={<DebtsPage />} />
            <Route path="/shared-debts" element={<Navigate to="/debts?tab=shared" replace />} />
            <Route path="/people" element={<Navigate to="/debts?tab=people" replace />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/categories" element={<Navigate to="/settings?tab=categories" replace />} />
            <Route path="/notifications" element={<Navigate to="/settings?tab=notifications" replace />} />
            <Route path="/security" element={<Navigate to="/settings?tab=security" replace />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>

          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppRoutes />
          <PwaProvider />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}