import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { formatMoney, formatDate, formatDateTime, cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import { toast } from '@/components/ui/use-toast';
import { Check, X, HandCoins, Clock, CheckCircle2, AlertTriangle, Ban, Inbox } from 'lucide-react';

type SharedDebtStatus =
  | 'PENDING' | 'ACCEPTED' | 'PAYMENT_REPORTED' | 'PAYMENT_CONFIRMED'
  | 'PAYMENT_VERIFYING' | 'REJECTED' | 'CANCELLED';

interface SharedDebt {
  id: string;
  debtId: string;
  status: SharedDebtStatus;
  amountCents: number;
  amount: { cents: number; currency: string };
  acceptedAt?: string;
  rejectedAt?: string;
  createdAt: string;
  debt?: { id: string; description: string; dueDate: string; type: string } | null;
  counterparty?: { id: string; name: string; email: string; avatarUrl?: string } | null;
  role: 'debtor' | 'creditor';
  payments?: Array<{
    id: string;
    amount: { cents: number };
    paymentDate: string;
    method?: string | null;
    notes?: string | null;
    status: 'REPORTED' | 'CONFIRMED' | 'DISPUTED';
    confirmedAt?: string;
    createdAt: string;
    reportedBy?: { name: string; avatarUrl?: string } | null;
  }>;
  history?: Array<{ id: string; type: string; message: string; createdAt: string; actor?: { name: string; avatarUrl?: string } | null }>;
}

const STATUS_META: Record<SharedDebtStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pendente de resposta', className: 'bg-warning/15 text-warning' },
  ACCEPTED: { label: 'Aceita / aguardando pagamento', className: 'bg-primary/15 text-primary' },
  PAYMENT_REPORTED: { label: 'Pagamento informado', className: 'bg-warning/15 text-warning' },
  PAYMENT_CONFIRMED: { label: 'Pagamento confirmado', className: 'bg-success/15 text-success' },
  PAYMENT_VERIFYING: { label: 'Pagamento em verificação', className: 'bg-warning/15 text-warning' },
  REJECTED: { label: 'Recusada', className: 'bg-destructive/15 text-destructive' },
  CANCELLED: { label: 'Cancelada', className: 'bg-muted text-muted-foreground' },
};

const PAYMENT_METHODS = ['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'PIX', 'BANK_TRANSFER', 'BOLETO', 'OTHER'];
const METHOD_LABELS: Record<string, string> = {
  CASH: 'Dinheiro', DEBIT_CARD: 'Débito', CREDIT_CARD: 'Crédito',
  PIX: 'Pix', BANK_TRANSFER: 'Transferência', BOLETO: 'Boleto', OTHER: 'Outro',
};

function statusIcon(status: SharedDebtStatus) {
  switch (status) {
    case 'PAYMENT_CONFIRMED': return <CheckCircle2 className="h-4 w-4" />;
    case 'PAYMENT_VERIFYING': return <Clock className="h-4 w-4" />;
    case 'REJECTED': return <X className="h-4 w-4" />;
    case 'CANCELLED': return <Ban className="h-4 w-4" />;
    case 'PAYMENT_REPORTED': return <HandCoins className="h-4 w-4" />;
    default: return <Clock className="h-4 w-4" />;
  }
}

export function SharedDebtsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'debtor' | 'creditor'>('debtor');
  const [selected, setSelected] = useState<SharedDebt | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [payId, setPayId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ title: string; label: string; action: () => void } | null>(null);
  const [form, setForm] = useState({ amount: '', paymentDate: '', method: 'PIX', notes: '' });

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared-debts', tab],
    queryFn: async () => {
      const res = await api.get('/shared-debts', { params: { role: tab } });
      return res.data?.data as SharedDebt[];
    },
  });

  const { data: detail } = useQuery({
    queryKey: ['shared-debts', 'detail', selected?.id],
    queryFn: async () => {
      if (!selected) return null;
      const res = await api.get(`/shared-debts/${selected.id}`);
      return res.data as SharedDebt;
    },
    enabled: !!selected,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['shared-debts'] });
    qc.invalidateQueries({ queryKey: ['debts'] });
    qc.invalidateQueries({ queryKey: ['debtsOwed'] });
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const runAction = useMutation({
    mutationFn: async ({ url }: { url: string }) => {
      const res = await api.post(url);
      return res.data;
    },
    onSuccess: () => {
      toast({ title: 'Concluído', description: 'Operação realizada com sucesso.' });
      invalidate();
      setConfirm(null);
      setDetailOpen(false);
    },
    onError: (e) => toast({ title: 'Erro', description: getErrorMessage(e), variant: 'destructive' }),
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!payId) return;
      const res = await api.post(`/shared-debts/${payId}/pay`, {
        amount: Number(form.amount),
        paymentDate: form.paymentDate || undefined,
        method: form.method,
        notes: form.notes || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      toast({ title: 'Pagamento informado', description: 'O pagamento será confirmado pelo credor.' });
      invalidate();
      setPayOpen(false);
      setForm({ amount: '', paymentDate: '', method: 'PIX', notes: '' });
    },
    onError: (e) => toast({ title: 'Erro', description: getErrorMessage(e), variant: 'destructive' }),
  });

  const openPay = (item: SharedDebt) => {
    setPayId(item.id);
    setForm({
      amount: item.amountCents > 0 ? String(item.amountCents / 100) : '',
      paymentDate: '',
      method: 'PIX',
      notes: '',
    });
    setPayOpen(true);
  };

  const openDetail = (item: SharedDebt) => {
    setSelected(item);
    setDetailOpen(true);
  };

  const pendingForAction = detail || selected;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dívidas compartilhadas</h1>
          <p className="text-sm text-muted-foreground">Solicitações de divisão de contas entre usuários.</p>
        </div>
      </div>

      <div className="inline-flex rounded-lg bg-muted p-1">
        {(['debtor', 'creditor'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'min-h-10 rounded-md px-4 py-2 text-sm font-medium transition-colors',
              tab === t ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'debtor' ? 'A pagar' : 'A receber'}
          </button>
        ))}
      </div>

      {isLoading && <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" /></div>}
      {error && <p className="text-sm text-destructive">{getErrorMessage(error)}</p>}

      {!isLoading && (!data || data.length === 0) && (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card py-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            {tab === 'debtor' ? 'Nenhuma dívida compartilhada com você.' : 'Nenhuma dívida compartilhada por você.'}
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {data?.map((item) => {
          const meta = STATUS_META[item.status];
          const cp = item.counterparty;
          return (
            <button
              key={item.id}
              onClick={() => openDetail(item)}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/50"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={cp?.avatarUrl} alt={cp?.name || ''} />
                    <AvatarFallback>{cp?.name?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.debt?.description || 'Dívida'}</p>
                    <p className="truncate text-xs text-muted-foreground">{cp?.name || 'Usuário'}</p>
                  </div>
                </div>
                <Badge className={cn('shrink-0 gap-1', meta.className)}>
                  {statusIcon(item.status)}
                  {meta.label}
                </Badge>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <p className="text-lg font-semibold">{formatMoney(item.amountCents)}</p>
                  {item.debt?.dueDate && <p className="text-xs text-muted-foreground">Vence {formatDate(item.debt.dueDate)}</p>}
                </div>
                <div className="flex gap-1.5">
                  {item.role === 'debtor' && item.status === 'PENDING' && (
                    <>
                      <Button size="sm" variant="outline" className="h-9" onClick={(e) => { e.stopPropagation(); setConfirm({
                        title: 'Recusar dívida', label: 'Recusar',
                        action: () => runAction.mutate({ url: `/shared-debts/${item.id}/reject` }),
                      }); }}>
                        <X className="mr-1 h-4 w-4" /> Recusar
                      </Button>
                      <Button size="sm" className="h-9" onClick={(e) => { e.stopPropagation(); setConfirm({
                        title: 'Aceitar dívida', label: 'Aceitar',
                        action: () => runAction.mutate({ url: `/shared-debts/${item.id}/accept` }),
                      }); }}>
                        <Check className="mr-1 h-4 w-4" /> Aceitar
                      </Button>
                    </>
                  )}
                  {item.role === 'debtor' && (item.status === 'ACCEPTED' || item.status === 'PAYMENT_VERIFYING') && (
                    <Button size="sm" className="h-9" onClick={(e) => { e.stopPropagation(); openPay(item); }}>
                      <HandCoins className="mr-1 h-4 w-4" /> Marcar como pago
                    </Button>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalhes da dívida compartilhada</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              {pendingForAction && (
                <Badge className={cn('gap-1', STATUS_META[pendingForAction.status].className)}>
                  {statusIcon(pendingForAction.status)}
                  {STATUS_META[pendingForAction.status].label}
                </Badge>
              )}
            </DialogDescription>
          </DialogHeader>

          {pendingForAction && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4">
                <p className="text-lg font-semibold">{formatMoney(pendingForAction.amountCents)}</p>
                <p className="text-sm">{pendingForAction.debt?.description}</p>
                {pendingForAction.debt?.dueDate && (
                  <p className="text-xs text-muted-foreground">Vencimento: {formatDate(pendingForAction.debt.dueDate)}</p>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={pendingForAction.counterparty?.avatarUrl} alt="" />
                    <AvatarFallback>{pendingForAction.counterparty?.name?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{pendingForAction.counterparty?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {pendingForAction.role === 'debtor' ? 'Credor (você deve)' : 'Devedor (te deve)'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payments */}
              {pendingForAction.payments && pendingForAction.payments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Pagamentos</p>
                  {pendingForAction.payments.map((p) => (
                    <div key={p.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{formatMoney(p.amount.cents)}</span>
                        <Badge variant={p.status === 'CONFIRMED' ? 'default' : p.status === 'DISPUTED' ? 'destructive' : 'secondary'}>
                          {p.status === 'CONFIRMED' ? 'Confirmado' : p.status === 'DISPUTED' ? 'Contestado' : 'Informado'}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.paymentDate ? formatDate(p.paymentDate) : ''}
                        {p.method ? ` · ${METHOD_LABELS[p.method] || p.method}` : ''}
                      </p>
                      {p.notes && <p className="mt-1 text-xs">{p.notes}</p>}
                      <p className="mt-1 text-xs text-muted-foreground">
                        Informado por {p.reportedBy?.name || 'usuário'}{p.confirmedAt ? ` · confirmado ${formatDateTime(p.confirmedAt)}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* Timeline */}
              {pendingForAction.history && pendingForAction.history.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Histórico</p>
                  <ol className="relative space-y-3 border-l pl-5">
                    {pendingForAction.history.map((h) => (
                      <li key={h.id} className="relative">
                        <span className="absolute -left-[27px] top-1 flex h-4 w-4 items-center justify-center rounded-full border bg-background" />
                        <p className="text-sm">{h.message}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(h.createdAt)}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Contextual actions */}
              <div className="flex flex-col gap-2 sm:flex-row">
                {pendingForAction.role === 'debtor' && pendingForAction.status === 'PENDING' && (
                  <>
                    <Button variant="outline" className="flex-1" onClick={() => setConfirm({
                      title: 'Recusar dívida', label: 'Recusar',
                      action: () => runAction.mutate({ url: `/shared-debts/${pendingForAction.id}/reject` }),
                    })}><X className="mr-2 h-4 w-4" />Recusar</Button>
                    <Button className="flex-1" onClick={() => setConfirm({
                      title: 'Aceitar dívida', label: 'Aceitar',
                      action: () => runAction.mutate({ url: `/shared-debts/${pendingForAction.id}/accept` }),
                    })}><Check className="mr-2 h-4 w-4" />Aceitar</Button>
                  </>
                )}
                {pendingForAction.role === 'debtor' && (pendingForAction.status === 'ACCEPTED' || pendingForAction.status === 'PAYMENT_VERIFYING') && (
                  <Button className="flex-1" onClick={() => openPay(pendingForAction)}>
                    <HandCoins className="mr-2 h-4 w-4" />Marcar como pago
                  </Button>
                )}
                {pendingForAction.role === 'creditor' && pendingForAction.status === 'PAYMENT_REPORTED' && (
                  <>
                    <Button variant="outline" className="flex-1" onClick={() => setConfirm({
                      title: 'Ainda não recebeu?', label: 'Confirmar como não recebido',
                      action: () => runAction.mutate({ url: `/shared-debts/${pendingForAction.id}/payments/${pendingForAction.payments?.[0]?.id}/dispute` }),
                    })}><AlertTriangle className="mr-2 h-4 w-4" />Não recebi</Button>
                    <Button className="flex-1" onClick={() => setConfirm({
                      title: 'Confirmar pagamento', label: 'Confirmar recebimento',
                      action: () => runAction.mutate({ url: `/shared-debts/${pendingForAction.id}/payments/${pendingForAction.payments?.[0]?.id}/confirm` }),
                    })}><Check className="mr-2 h-4 w-4" />Confirmar pagamento</Button>
                  </>
                )}
                {pendingForAction.role === 'creditor' && ['PENDING', 'ACCEPTED', 'PAYMENT_REPORTED', 'PAYMENT_VERIFYING'].includes(pendingForAction.status) && (
                  <Button variant="outline" className="flex-1" onClick={() => setConfirm({
                    title: 'Cancelar dívida compartilhada', label: 'Cancelar',
                    action: () => runAction.mutate({ url: `/shared-debts/${pendingForAction.id}/cancel` }),
                  })}><Ban className="mr-2 h-4 w-4" />Cancelar</Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Marcar como pago</DialogTitle>
            <DialogDescription>Informe os dados do pagamento. O credor precisará confirmar o recebimento.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="pay-amount">Valor (R$)</Label>
              <Input id="pay-amount" type="number" min="0" step="0.01" inputMode="decimal"
                value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-date">Data do pagamento</Label>
              <Input id="pay-date" type="date" value={form.paymentDate} onChange={(e) => setForm({ ...form, paymentDate: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Método de pagamento</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger className="min-h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{METHOD_LABELS[m]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pay-notes">Observação (opcional)</Label>
              <Textarea id="pay-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button loading={payMutation.isPending} onClick={() => payMutation.mutate()}>Informar pagamento</Button>
          </div>
        </DialogContent>
      </Dialog>

      {confirm && (
        <ConfirmDeleteDialog
          open
          onOpenChange={(o) => { if (!o) setConfirm(null); }}
          title={confirm.title}
          description="Deseja continuar com esta operação?"
          confirmLabel={confirm.label}
          loading={runAction.isPending}
          onConfirm={confirm.action}
        />
      )}
    </div>
  );
}