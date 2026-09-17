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
import { CardsPage } from '@/pages/cards/CardsPage';
import { InvoicesPage } from '@/pages/invoices/InvoicesPage';
import { TransactionsPage } from '@/pages/transactions/TransactionsPage';
import { InstallmentsPage } from '@/pages/installments/InstallmentsPage';
import { BillsPage } from '@/pages/bills/BillsPage';
import { DebtsPage } from '@/pages/debts/DebtsPage';
import { SharedDebtsPage } from '@/pages/debts/SharedDebtsPage';
import { PeoplePage } from '@/pages/people/PeoplePage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { CategoriesPage } from '@/pages/categories/CategoriesPage';
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';
import { SecurityPage } from '@/pages/security/SecurityPage';
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
        <Route path="/cards" element={<CardsPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/installments" element={<InstallmentsPage />} />
        <Route path="/bills" element={<BillsPage />} />
        <Route path="/debts" element={<DebtsPage />} />
        <Route path="/shared-debts" element={<SharedDebtsPage />} />
        <Route path="/people" element={<PeoplePage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/security" element={<SecurityPage />} />
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