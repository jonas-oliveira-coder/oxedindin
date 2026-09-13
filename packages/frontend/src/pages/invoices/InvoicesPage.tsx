import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { formatMoney, formatDate, getStatusColor } from '@/lib/utils';
import { CreditCard, Loader2, CalendarClock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

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
  amount: z.number().positive(),
  accountId: z.string().uuid().optional(),
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

export function InvoicesPage() {
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
      await api.post(`/invoices/${id}/pay`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['invoicesUpcoming'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Pagamento realizado', description: 'Fatura paga com sucesso.' });
      setPayingInvoice(null);
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const openPayDialog = (invoice: Invoice) => {
    setPayingInvoice(invoice);
    payForm.reset({ amount: invoice.remaining.cents / 100, accountId: undefined });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Faturas</h1>
          <p className="text-muted-foreground">Gerencie as faturas dos seus cartões de crédito</p>
        </div>
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
                <div key={u.cardId} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{u.cardName} • final {u.cardLast4}</p>
                    <p className="text-sm text-muted-foreground">Vence em {formatDate(u.dueDate)}</p>
                  </div>
                  <p className="font-bold">{formatMoney(u.remaining.cents)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {invoices && invoices.length > 0 ? (
        <div className="space-y-3">
          {invoices.map((invoice) => (
            <Card key={invoice.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{invoice.card?.name || 'Cartão'}</h3>
                        <Badge variant="outline" className={getStatusColor(invoice.status)}>
                          {statusLabels[invoice.status] || invoice.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Fechamento {formatDate(invoice.closingDate)} · Vence {formatDate(invoice.dueDate)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatMoney(invoice.total.cents)}</p>
                      <p className="text-sm text-muted-foreground">Restante: {formatMoney(invoice.remaining.cents)}</p>
                    </div>
                    {invoice.status !== 'PAID' && (
                      <Button size="sm" onClick={() => openPayDialog(invoice)}>Pagar</Button>
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
              <Label htmlFor="amount">Valor a pagar (R$)</Label>
              <Input id="amount" type="number" step="0.01" min="0.01" {...payForm.register('amount', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountId">Conta (opcional)</Label>
              <Select value={payForm.watch('accountId')} onValueChange={(value) => payForm.setValue('accountId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma conta" />
                </SelectTrigger>
                <SelectContent>
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