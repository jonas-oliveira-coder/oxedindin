import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { formatMoney, formatDate, getStatusColor } from '@/lib/utils';
import { CreditCard, Loader2, CalendarClock } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { positiveMoneyCentsSchema, uuidSchema } from '@oxedindin/shared';
import { CurrencyInput } from '@/components/forms';

interface Invoice {
  id: string;
  cardId: string;
  periodStart: string;
  periodEnd: string;
  closingDate: string;
  dueDate: string;
  status: string;
  total: { cents: number; currency: string };
  paid: { cents: number; currency: string };
  remaining: { cents: number; currency: string };
  card?: { id: string; name: string; last4: string } | null;
}

interface UpcomingInvoice {
  cardId: string;
  cardName: string;
  cardLast4: string;
  dueDate: string;
  total: { cents: number; currency: string };
  remaining: { cents: number; currency: string };
}

interface IdName {
  id: string;
  name: string;
}

const statusLabels: Record<string, string> = {
  OPEN: 'Aberta',
  CLOSED: 'Fechada',
  PAID: 'Paga',
  PARTIALLY_PAID: 'Parcial',
  OVERDUE: 'Vencida',
};

const paySchema = z.object({
  amount: positiveMoneyCentsSchema,
  accountId: uuidSchema.optional().or(z.literal('')),
});

async function fetchInvoices(status?: string): Promise<Invoice[]> {
  const response = await api.get('/invoices', { params: status ? { status } : {} });
  return response.data.data;
}

async function fetchUpcoming(): Promise<UpcomingInvoice[]> {
  const response = await api.get('/invoices/upcoming');
  return response.data;
}

async function fetchAccounts(): Promise<IdName[]> {
  const response = await api.get('/accounts');
  return response.data.data.filter((a: any) => a.status === 'ACTIVE');
}

export function InvoicesPage({ embedded }: { embedded?: boolean } = {}) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ['invoices', statusFilter],
    queryFn: () => fetchInvoices(statusFilter),
  });

  const { data: upcoming } = useQuery({ queryKey: ['invoicesUpcoming'], queryFn: fetchUpcoming });
  const { data: accounts } = useQuery({ queryKey: ['accounts', 'active'], queryFn: fetchAccounts });

  const payForm = useForm<z.infer<typeof paySchema>>({ resolver: zodResolver(paySchema) });

  const payMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof paySchema> }) => {
      const payload: { amount: number; accountId?: string } = {
        amount: data.amount,
      };
      if (data.accountId && data.accountId.trim() !== '') {
        payload.accountId = data.accountId;
      }
      await api.post(`/invoices/${id}/pay`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoicesUpcoming'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Pagamento realizado', description: 'Fatura paga com sucesso.' });
      setPayingInvoice(null);
    },
    onError: (error: unknown) =>
      toast({
        title: 'Erro ao pagar fatura',
        description: getErrorMessage(error),
        variant: 'destructive',
      }),
  });

  const openPayDialog = (invoice: Invoice) => {
    setPayingInvoice(invoice);
    payForm.reset({ amount: invoice.remaining.cents, accountId: '' });
  };

  const handlePay = (data: z.infer<typeof paySchema>) => {
    if (payingInvoice) payMutation.mutate({ id: payingInvoice.id, data });
  };

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
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!embedded ? (
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Faturas</h1>
            <p className="text-muted-foreground">Gerencie as faturas dos seus cartões de crédito</p>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Faturas dos Cartões</h2>
          </div>
        )}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todas as faturas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todas</SelectItem>
            <SelectItem value="OPEN">Abertas</SelectItem>
            <SelectItem value="CLOSED">Fechadas</SelectItem>
            <SelectItem value="OVERDUE">Vencidas</SelectItem>
            <SelectItem value="PAID">Pagas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {upcoming && upcoming.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-3">
              <CalendarClock className="h-5 w-5 text-primary" />
              <h2 className="font-semibold">Próximas faturas</h2>
            </div>
            <div className="space-y-2">
              {upcoming.map((u) => (
                <div key={u.cardId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{u.cardName} • final {u.cardLast4}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">Vence em {formatDate(u.dueDate)}</p>
                  </div>
                  <p className="font-bold shrink-0">{formatMoney(u.remaining.cents)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {invoices && invoices.length > 0 ? (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <Card key={invoice.id} className="overflow-hidden">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 mt-0.5 sm:mt-0">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold truncate">{invoice.card?.name || 'Cartão'}</h3>
                        <Badge variant="outline" className={`shrink-0 ${getStatusColor(invoice.status)}`}>
                          {statusLabels[invoice.status] || invoice.status}
                        </Badge>
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                        Fechamento {formatDate(invoice.closingDate)} · Vence {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-3 border-t sm:border-0 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <p className="font-bold text-base sm:text-lg">{formatMoney(invoice.total.cents)}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground">Restante: {formatMoney(invoice.remaining.cents)}</p>
                    </div>
                    {invoice.status !== 'PAID' && (
                      <Button size="sm" className="shrink-0" onClick={() => openPayDialog(invoice)}>Pagar</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <CreditCard className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhuma fatura encontrada</h3>
            <p className="mt-2 text-muted-foreground">As faturas dos seus cartões aparecerão aqui.</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!payingInvoice} onOpenChange={(open) => !open && setPayingInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar fatura</DialogTitle>
          </DialogHeader>
          <form onSubmit={payForm.handleSubmit(handlePay)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="amount">Valor a pagar</Label>
              <Controller
                name="amount"
                control={payForm.control}
                render={({ field }) => (
                  <CurrencyInput
                    id="amount"
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="R$ 0,00"
                  />
                )}
              />
              {payForm.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {payForm.formState.errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountId">Conta (opcional)</Label>
              <Select
                value={payForm.watch('accountId') ?? ''}
                onValueChange={(value) => payForm.setValue('accountId', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {(accounts ?? []).map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayingInvoice(null)}>Cancelar</Button>
              <Button type="submit" disabled={payMutation.isPending}>
                {payMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}