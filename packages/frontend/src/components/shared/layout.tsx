import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Logo } from '@/components/shared/logo';
import {
  LayoutDashboard,
  CreditCard,
  FileText,
  Receipt,
  ListChecks,
  DollarSign,
  Users,
  BarChart3,
  Tags,
  Bell,
  Shield,
  Settings,
  LogOut,
  Menu,
  X,
  Moon,
  Sun,
  MoreHorizontal,
} from 'lucide-react';
import { useState, useEffect } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Contas', href: '/accounts', icon: CreditCard },
  { name: 'Cartões', href: '/cards', icon: CreditCard },
  { name: 'Faturas', href: '/invoices', icon: FileText },
  { name: 'Transações', href: '/transactions', icon: Receipt },
  { name: 'Parcelamentos', href: '/installments', icon: ListChecks },
  { name: 'Contas a Pagar', href: '/bills', icon: DollarSign },
  { name: 'Dívidas', href: '/debts', icon: Users },
  { name: 'Dívidas compartilhadas', href: '/shared-debts', icon: Users },
  { name: 'Pessoas', href: '/people', icon: Users },
  { name: 'Relatórios', href: '/reports', icon: BarChart3 },
  { name: 'Categorias', href: '/categories', icon: Tags },
  { name: 'Notificações', href: '/notifications', icon: Bell },
  { name: 'Segurança', href: '/security', icon: Shield },
  { name: 'Configurações', href: '/settings', icon: Settings },
];

const MAIN_TABS = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Dívidas', href: '/debts', icon: Users },
  { name: 'Transações', href: '/transactions', icon: Receipt },
  { name: 'Notificações', href: '/notifications', icon: Bell },
];

function useUnreadNotifications() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await api.get('/notifications', { params: { read: false, limit: 1 } });
      return res.data?.meta?.total ?? 0;
    },
    staleTime: 30_000,
  });
}

function NotificationBadge() {
  const { data } = useUnreadNotifications();
  if (!data) return null;
  return (
    <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
      {data > 99 ? '99+' : data}
    </span>
  );
}

function SidebarContent({ onNavigate, onLogout }: { onNavigate: () => void; onLogout: () => void }) {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('drizzle-dark-mode');
    return saved ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', darkMode);
    html.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('drizzle-dark-mode', darkMode.toString());
  }, [darkMode]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <div className="flex items-center gap-2">
          <Logo className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-tight">OxeDinDin</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        <div className="space-y-1">
          {navigation.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{item.name}</span>
              {item.href === '/notifications' && <NotificationBadge />}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="shrink-0 border-t p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-11 w-full justify-start gap-3 px-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.avatarUrl} alt={user?.name || ''} />
                <AvatarFallback>{user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium">{user?.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60" sideOffset={8}>
            <DropdownMenuLabel className="font-normal">Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <NavLink to="/settings" onClick={onNavigate}>
                <Settings className="mr-2 h-4 w-4" />
                Configurações
              </NavLink>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDarkMode((prev) => !prev); }}>
              {darkMode ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {darkMode ? 'Modo claro' : 'Modo escuro'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive" inset>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r bg-card lg:flex',
        )}
      >
        <SidebarContent onNavigate={() => {}} onLogout={handleLogout} />
      </aside>

      {/* Mobile drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-72 transform flex-col border-r bg-card transition-transform duration-200 ease-in-out lg:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="absolute right-2 top-2 z-10">
          <button
            className="rounded-md p-2 text-muted-foreground hover:bg-accent"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <SidebarContent onNavigate={() => setSidebarOpen(false)} onLogout={handleLogout} />
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 lg:h-16 lg:px-6">
          <button
            className="rounded-md p-2 text-muted-foreground hover:bg-accent lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex-1" />
        </header>

        <main className="p-4 pb-20 lg:p-6 lg:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {MAIN_TABS.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )
            }
          >
            <span className="relative">
              <item.icon className="h-6 w-6" />
              {item.href === '/notifications' && <NotificationBadge />}
            </span>
            {item.name}
          </NavLink>
        ))}
        <button
          className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          onClick={() => setSidebarOpen(true)}
          aria-label="Mais opções"
        >
          <MoreHorizontal className="h-6 w-6" />
          Mais
        </button>
      </nav>
    </div>
  );
}