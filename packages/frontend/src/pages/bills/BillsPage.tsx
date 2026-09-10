import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { formatMoney, formatDate, getStatusColor, getFrequencyLabel } from '@/lib/utils';
import { Plus, Loader2, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

interface Bill {
  id: string;
  description: string;
  amount: { cents: number; currency: string };
  dueDate: string;
  status: string;
  paymentMethod?: string;
  paidAt?: string;
  notes?: string;
  recurringBill?: { id: string; description: string; frequency: string } | null;
}

interface RecurringBill {
  id: string;
  description: string;
  amount: { cents: number; currency: string };
  frequency: string;
  dueDay: number;
  status: string;
  nextDueDate: string;
}

interface IdName {
  id: string;
  name: string;
}

const billFormSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória').max(200),
  amount: z.number().positive('Valor deve ser positivo'),
  dueDate: z.string().min(1, 'Data é obrigatória'),
  accountId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

const recurringFormSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória').max(200),
  amount: z.number().positive('Valor deve ser positivo'),
  frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']),
  dueDay: z.number().int().min(1).max(31),
  startDate: z.string().min(1, 'Data é obrigatória'),
});

const paySchema = z.object({
  accountId: z.string().uuid().optional(),
});

type BillFormInput = z.infer<typeof billFormSchema>;
type RecurringFormInput = z.infer<typeof recurringFormSchema>;

async function fetchBills(): Promise<Bill[]> {
  const response = await api.get('/bills');
  return response.data.data;
}

async function fetchRecurring(): Promise<RecurringBill[]> {
  const response = await api.get('/bills/recurring');
  return response.data.data;
}

async function fetchAccounts(): Promise<IdName[]> {
  const response = await api.get('/accounts');
  return response.data.data.filter((a: any) => a.status === 'ACTIVE');
}

export function BillsPage() {
  const queryClient = useQueryClient();
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [recurringDialogOpen, setRecurringDialogOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Bill | null>(null);
  const [cancelBillId, setCancelBillId] = useState<string | null>(null);

  const { data: bills, isLoading } = useQuery({ queryKey: ['bills'], queryFn: fetchBills });
  const { data: recurring } = useQuery({ queryKey: ['recurringBills'], queryFn: fetchRecurring });
  const { data: accounts } = useQuery({ queryKey: ['accounts', 'active'], queryFn: fetchAccounts });

  const billForm = useForm<BillFormInput>({ resolver: zodResolver(billFormSchema) });
  const recurringForm = useForm<RecurringFormInput>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: { frequency: 'MONTHLY', dueDay: 10 },
  });
  const payForm = useForm<z.infer<typeof paySchema>>({ resolver: zodResolver(paySchema) });

  const createBillMutation = useMutation({
    mutationFn: async (data: BillFormInput) => {
      await api.post('/bills', {
        description: data.description,
        amount: Math.round(data.amount * 100),
        dueDate: new Date(`${data.dueDate}T00:00:00.000Z`).toISOString(),
        accountId: data.accountId,
        categoryId: data.categoryId,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast({ title: 'Conta criada', description: 'Conta a pagar criada com sucesso.' });
      setBillDialogOpen(false);
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const createRecurringMutation = useMutation({
    mutationFn: async (data: RecurringFormInput) => {
      await api.post('/bills/recurring', {
        description: data.description,
        amount: Math.round(data.amount * 100),
        frequency: data.frequency,
        dueDay: data.dueDay,
        startDate: new Date(`${data.startDate}T00:00:00.000Z`).toISOString(),
        dateType: 'FIXED',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringBills'] });
      toast({ title: 'Conta recorrente criada', description: 'Conta recorrente criada com sucesso.' });
      setRecurringDialogOpen(false);
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const payMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof paySchema> }) => {
      await api.post(`/bills/${id}/pay`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Conta paga', description: 'Conta marcada como paga.' });
      setPayTarget(null);
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const cancelBillMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/bills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast({ title: 'Conta cancelada', description: 'Conta cancelada com sucesso.' });
      setCancelBillId(null);
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const deactivateRecurringMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/bills/recurring/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringBills'] });
      toast({ title: 'Conta desativada', description: 'Conta recorrente desativada.' });
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const generateMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/bills/recurring/${id}/generate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringBills'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast({ title: 'Conta gerada', description: 'Próxima conta gerada na lista de contas.' });
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

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
          <h1 className="text-3xl font-bold tracking-tight">Contas a Pagar</h1>
          <p className="text-muted-foreground">Gerencie suas contas e boletos</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={recurringDialogOpen} onOpenChange={setRecurringDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                Conta recorrente
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nova conta recorrente</DialogTitle>
              </DialogHeader>
              <form onSubmit={recurringForm.handleSubmit((data) => createRecurringMutation.mutate(data))} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input id="description" {...recurringForm.register('description')} placeholder="Netflix, Aluguel..." />
                </div>
                <div className="grid gap-2 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor</Label>
                    <Input id="amount" type="number" step="0.01" {...recurringForm.register('amount', { valueAsNumber: true })} placeholder="39,90" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDay">Dia do vencimento</Label>
                    <Input id="dueDay" type="number" min={1} max={31} {...recurringForm.register('dueDay', { valueAsNumber: true })} placeholder="10" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="frequency">Frequência</Label>
                  <Select value={recurringForm.watch('frequency')} onValueChange={(v) => recurringForm.setValue('frequency', v as RecurringFormInput['frequency'])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WEEKLY">Semanal</SelectItem>
                      <SelectItem value="BIWEEKLY">Quinzenal</SelectItem>
                      <SelectItem value="MONTHLY">Mensal</SelectItem>
                      <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                      <SelectItem value="ANNUAL">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Início</Label>
                  <Input id="startDate" type="date" {...recurringForm.register('startDate')} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setRecurringDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createRecurringMutation.isPending}>
                    {createRecurringMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Criar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={billDialogOpen} onOpenChange={setBillDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Conta
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nova conta a pagar</DialogTitle>
              </DialogHeader>
              <form onSubmit={billForm.handleSubmit((data) => createBillMutation.mutate(data))} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input id="description" {...billForm.register('description')} placeholder="Conta de luz, Internet..." />
                </div>
                <div className="grid gap-2 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="amount">Valor</Label>
                    <Input id="amount" type="number" step="0.01" {...billForm.register('amount', { valueAsNumber: true })} placeholder="150,00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Vencimento</Label>
                    <Input id="dueDate" type="date" {...billForm.register('dueDate')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="accountId">Conta (opcional)</Label>
                  <Select value={billForm.watch('accountId')} onValueChange={(v) => billForm.setValue('accountId', v)}>
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
                <div className="space-y-2">
                  <Label htmlFor="notes">Observações</Label>
                  <Input id="notes" {...billForm.register('notes')} placeholder="Observações opcionais" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setBillDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createBillMutation.isPending}>
                    {createBillMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Criar
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="bills">
        <TabsList>
          <TabsTrigger value="bills">Contas</TabsTrigger>
          <TabsTrigger value="recurring">Recorrentes</TabsTrigger>
        </TabsList>

        <TabsContent value="bills" className="space-y-3">
          {bills && bills.length > 0 ? (
            bills.map((bill) => (
              <Card key={bill.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{bill.description}</h3>
                        <Badge variant="outline" className={getStatusColor(bill.status)}>
                          {bill.status === 'PAID' ? 'Paga' : bill.status === 'OVERDUE' ? 'Vencida' : bill.status === 'CANCELLED' ? 'Cancelada' : 'Pendente'}
                        </Badge>
                        {bill.recurringBill && <Badge variant="secondary">Recorrente</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">Vence em {formatDate(bill.dueDate)}</p>
                      {bill.notes && <p className="text-sm text-muted-foreground">{bill.notes}</p>}
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold text-lg">{formatMoney(bill.amount.cents)}</p>
                      {bill.status !== 'PAID' && bill.status !== 'CANCELLED' && (
                        <>
                          <Button size="sm" onClick={() => { setPayTarget(bill); payForm.reset({ accountId: undefined }); }}>Pagar</Button>
                          <Button variant="ghost" size="icon" onClick={() => setCancelBillId(bill.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                      {bill.status === 'PAID' && <CheckCircle2 className="h-5 w-5 text-success" />}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <h3 className="text-lg font-medium">Nenhuma conta a pagar</h3>
                <p className="mt-2 text-muted-foreground">Registre suas contas e boletos para não perder o prazo.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="recurring" className="space-y-3">
          {recurring && recurring.length > 0 ? (
            recurring.map((bill) => (
              <Card key={bill.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{bill.description}</h3>
                        <Badge variant="secondary">{getFrequencyLabel(bill.frequency)}</Badge>
                        {bill.status === 'INACTIVE' && <Badge variant="outline">Inativa</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Dia {bill.dueDay} · Próximo: {formatDate(bill.nextDueDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-lg">{formatMoney(bill.amount.cents)}</p>
                      <Button variant="outline" size="sm" onClick={() => generateMutation.mutate(bill.id)}>
                        Gerar próxima
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deactivateRecurringMutation.mutate(bill.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <h3 className="text-lg font-medium">Nenhuma conta recorrente</h3>
                <p className="mt-2 text-muted-foreground">Cadastre contas que se repetem todo mês.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!payTarget} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar conta</DialogTitle>
          </DialogHeader>
          <form onSubmit={payForm.handleSubmit((data) => payTarget && payMutation.mutate({ id: payTarget.id, data }))} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {payTarget?.description} · <span className="font-semibold">{payTarget ? formatMoney(payTarget.amount.cents) : ''}</span>
            </p>
            <div className="space-y-2">
              <Label htmlFor="accountId">Conta (opcional)</Label>
              <Select value={payForm.watch('accountId')} onValueChange={(v) => payForm.setValue('accountId', v)}>
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
              <Button type="button" variant="outline" onClick={() => setPayTarget(null)}>Cancelar</Button>
              <Button type="submit" disabled={payMutation.isPending}>
                {payMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmar pagamento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cancelBillId} onOpenChange={(open) => !open && setCancelBillId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar conta?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta conta será cancelada.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelBillId(null)}>Voltar</Button>
            <Button variant="destructive" onClick={() => cancelBillId && cancelBillMutation.mutate(cancelBillId)}>
              Cancelar conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}