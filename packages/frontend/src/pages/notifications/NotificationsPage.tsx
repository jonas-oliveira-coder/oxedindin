import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/components/ui/use-toast';
import { cn, formatDateTime } from '@/lib/utils';
import { CheckCheck, Bell, Check } from 'lucide-react';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NotificationPreferences {
  userId: string;
  invoiceDueSoon: boolean;
  invoiceOverdue: boolean;
  billDueSoon: boolean;
  billOverdue: boolean;
  installmentDueSoon: boolean;
  debtDueSoon: boolean;
  sharedDebtAdded: boolean;
  sharedDebtUpdated: boolean;
  paymentReceived: boolean;
  securityAlert: boolean;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
}

async function fetchNotifications(): Promise<Notification[]> {
  const response = await api.get('/notifications');
  return response.data.data;
}

async function markRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

async function markAllRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}

async function fetchPreferences(): Promise<NotificationPreferences> {
  const response = await api.get('/notifications/preferences');
  return response.data;
}

async function updatePreferences(data: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
  const response = await api.patch('/notifications/preferences', data);
  return response.data;
}

type PreferenceKey = Exclude<keyof NotificationPreferences, 'userId'>;

const preferenceGroups: Array<{ label: string; items: Array<{ key: PreferenceKey; label: string }> }> = [
  {
    label: 'Notificações financeiras',
    items: [
      { key: 'invoiceDueSoon', label: 'Fatura próxima do vencimento' },
      { key: 'invoiceOverdue', label: 'Fatura vencida' },
      { key: 'billDueSoon', label: 'Conta próxima do vencimento' },
      { key: 'billOverdue', label: 'Conta vencida' },
      { key: 'installmentDueSoon', label: 'Parcela próxima do vencimento' },
      { key: 'debtDueSoon', label: 'Dívida próxima do vencimento' },
      { key: 'sharedDebtAdded', label: 'Nova dívida compartilhada' },
      { key: 'sharedDebtUpdated', label: 'Dívida compartilhada atualizada' },
      { key: 'paymentReceived', label: 'Pagamento recebido' },
      { key: 'securityAlert', label: 'Alerta de segurança' },
    ],
  },
  {
    label: 'Canais',
    items: [
      { key: 'inAppEnabled', label: 'Notificações no aplicativo' },
      { key: 'emailEnabled', label: 'Notificações por email' },
      { key: 'pushEnabled', label: 'Notificações push' },
    ],
  },
];

export function NotificationsPage() {
  const queryClient = useQueryClient();
  const [showPreferences, setShowPreferences] = useState(false);

  const { data: notifications, isLoading } = useQuery({ queryKey: ['notifications'], queryFn: fetchNotifications });
  const { data: prefs } = useQuery({ queryKey: ['notificationPreferences'], queryFn: fetchPreferences });

  const markReadMutation = useMutation({
    mutationFn: markRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({ title: 'Tudo lido', description: 'Todas as notificações foram marcadas como lidas.' });
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const prefsMutation = useMutation({
    mutationFn: updatePreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notificationPreferences'] });
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const togglePreference = (key: PreferenceKey, value: boolean) => {
    if (!prefs) return;
    prefsMutation.mutate({ [key]: value });
  };

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-8 bg-muted rounded w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notificações</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} não lida(s)` : 'Todas as notificações foram lidas'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowPreferences((v) => !v)}>
            Preferências
          </Button>
          <Button variant="outline" onClick={() => markAllReadMutation.mutate()} disabled={unreadCount === 0 || markAllReadMutation.isPending}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Marcar todas como lidas
          </Button>
        </div>
      </div>

      {showPreferences && prefs && (
        <Card>
          <CardHeader>
            <CardTitle>Preferências de notificação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {preferenceGroups.map((group) => (
              <div key={group.label}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">{group.label}</h3>
                <div className="space-y-3">
                  {group.items.map((item) => (
                    <div key={item.key} className="flex items-center justify-between">
                      <span className="text-sm">{item.label}</span>
                      <Switch
                        checked={prefs[item.key]}
                        onCheckedChange={(checked) => togglePreference(item.key, checked)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {notifications && notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card key={notification.id} className={cn(!notification.read && 'border-primary/40')}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-full', notification.read ? 'bg-muted' : 'bg-primary/10')}>
                      <Bell className={cn('h-4 w-4', notification.read ? 'text-muted-foreground' : 'text-primary')} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={cn('font-medium', !notification.read && 'font-semibold')}>{notification.title}</h3>
                        {!notification.read && <Badge variant="default">Nova</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(notification.createdAt)}</p>
                    </div>
                  </div>
                  {!notification.read && (
                    <Button variant="ghost" size="sm" onClick={() => markReadMutation.mutate(notification.id)}>
                      <Check className="mr-1 h-4 w-4" />
                      Marcar lida
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <Bell className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhuma notificação</h3>
            <p className="mt-2 text-muted-foreground">Você está em dia por aqui.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}