import { Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider, useAuth } from '@/hooks/use-auth';
import { PwaProvider } from '@/components/pwa/pwa-provider';
import { Layout } from '@/components/shared/layout';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { AccountsPage } from '@/pages/accounts/AccountsPage';
import { TransactionsPage } from '@/pages/transactions/TransactionsPage';
import { BillsPage } from '@/pages/bills/BillsPage';
import { DebtsPage } from '@/pages/debts/DebtsPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      
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

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
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