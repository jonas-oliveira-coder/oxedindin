import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/use-toast';
import { formatMoney, formatDate, getStatusColor, getFrequencyLabel } from '@/lib/utils';
import { Plus, Trash2, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { positiveMoneyCentsSchema, civilDateSchema, uuidSchema } from '@oxedindin/shared';
import { FormField, TextInput, CurrencyInput, NumberInput, DateInput, Textarea, FormSelect } from '@/components/forms';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';

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
  description: z.string().trim().min(1, 'Informe a descrição.').max(200),
  amount: positiveMoneyCentsSchema,
  dueDate: civilDateSchema,
  accountId: uuidSchema.optional().or(z.literal('')),
  categoryId: uuidSchema.optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});

const recurringFormSchema = z.object({
  description: z.string().trim().min(1, 'Informe a descrição.').max(200),
  amount: positiveMoneyCentsSchema,
  frequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL']),
  dueDay: z.number({ invalid_type_error: 'Informe o dia de vencimento.' }).int().min(1).max(31),
  startDate: civilDateSchema,
});

const paySchema = z.object({
  accountId: uuidSchema.optional().or(z.literal('')),
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
  const [deleteRecurringId, setDeleteRecurringId] = useState<string | null>(null);

  const { data: bills, isLoading } = useQuery({ queryKey: ['bills'], queryFn: fetchBills });
  const { data: recurring } = useQuery({ queryKey: ['recurringBills'], queryFn: fetchRecurring });
  const { data: accounts } = useQuery({ queryKey: ['accounts', 'active'], queryFn: fetchAccounts });

  const billForm = useForm<BillFormInput>({
    resolver: zodResolver(billFormSchema),
    defaultValues: { accountId: '', categoryId: '', notes: '' },
  });
  const recurringForm = useForm<RecurringFormInput>({
    resolver: zodResolver(recurringFormSchema),
    defaultValues: { frequency: 'MONTHLY', dueDay: 10 },
  });
  const payForm = useForm<z.infer<typeof paySchema>>({ resolver: zodResolver(paySchema), defaultValues: { accountId: '' } });

  const createBillMutation = useMutation({
    mutationFn: async (data: BillFormInput) => {
      await api.post('/bills', {
        description: data.description,
        amount: data.amount,
        dueDate: data.dueDate,
        accountId: data.accountId || undefined,
        categoryId: data.categoryId || undefined,
        notes: data.notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast({ title: 'Conta criada', description: 'Conta a pagar criada com sucesso.' });
      setBillDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const createRecurringMutation = useMutation({
    mutationFn: async (data: RecurringFormInput) => {
      await api.post('/bills/recurring', {
        description: data.description,
        amount: data.amount,
        frequency: data.frequency,
        dueDay: data.dueDay,
        startDate: data.startDate,
        dateType: 'FIXED',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringBills'] });
      toast({ title: 'Conta recorrente criada', description: 'Conta recorrente criada com sucesso.' });
      setRecurringDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const payMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: z.infer<typeof paySchema> }) => {
      await api.post(`/bills/${id}/pay`, { accountId: data.accountId || undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Conta paga', description: 'Conta marcada como paga.' });
      setPayTarget(null);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const cancelBillMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/bills/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      toast({ title: 'Conta excluída', description: 'Conta excluída com sucesso.' });
      setCancelBillId(null);
    },
    onError: (error) => toast({ title: 'Não foi possível excluir', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const deleteRecurringMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/bills/recurring/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurringBills'] });
      toast({ title: 'Conta excluída', description: 'Conta recorrente excluída.' });
      setDeleteRecurringId(null);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
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
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
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
      <div className="flex flex-wrap items-center justify-between gap-3">
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
              <form onSubmit={recurringForm.handleSubmit((data) => createRecurringMutation.mutate(data))} className="space-y-4" noValidate>
                <FormField id="description" label="Descrição" error={recurringForm.formState.errors.description?.message}>
                  <TextInput id="description" placeholder="Netflix, Aluguel..." {...recurringForm.register('description')} />
                </FormField>
                <div className="grid gap-2 grid-cols-2">
                  <FormField id="amount" label="Valor" error={recurringForm.formState.errors.amount?.message}>
                    <Controller
                      name="amount"
                      control={recurringForm.control}
                      render={({ field }) => <CurrencyInput id="amount" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
                    />
                  </FormField>
                  <FormField id="dueDay" label="Dia do vencimento" error={recurringForm.formState.errors.dueDay?.message}>
                    <NumberInput id="dueDay" min={1} max={31} placeholder="10" {...recurringForm.register('dueDay', { valueAsNumber: true })} />
                  </FormField>
                </div>
                <FormField id="frequency" label="Frequência" error={recurringForm.formState.errors.frequency?.message}>
                  <FormSelect control={recurringForm.control} name="frequency" placeholder="Selecione">
                    <SelectItem value="DAILY">Diário</SelectItem>
                    <SelectItem value="WEEKLY">Semanal</SelectItem>
                    <SelectItem value="BIWEEKLY">Quinzenal</SelectItem>
                    <SelectItem value="MONTHLY">Mensal</SelectItem>
                    <SelectItem value="QUARTERLY">Trimestral</SelectItem>
                    <SelectItem value="SEMIANNUAL">Semestral</SelectItem>
                    <SelectItem value="ANNUAL">Anual</SelectItem>
                  </FormSelect>
                </FormField>
                <FormField id="startDate" label="Início" error={recurringForm.formState.errors.startDate?.message}>
                  <DateInput id="startDate" {...recurringForm.register('startDate')} />
                </FormField>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setRecurringDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" loading={createRecurringMutation.isPending}>Criar</Button>
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
              <form onSubmit={billForm.handleSubmit((data) => createBillMutation.mutate(data))} className="space-y-4" noValidate>
                <FormField id="description" label="Descrição" error={billForm.formState.errors.description?.message}>
                  <TextInput id="description" placeholder="Conta de luz, Internet..." {...billForm.register('description')} />
                </FormField>
                <div className="grid gap-2 grid-cols-2">
                  <FormField id="amount" label="Valor" error={billForm.formState.errors.amount?.message}>
                    <Controller
                      name="amount"
                      control={billForm.control}
                      render={({ field }) => <CurrencyInput id="amount" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
                    />
                  </FormField>
                  <FormField id="dueDate" label="Vencimento" error={billForm.formState.errors.dueDate?.message}>
                    <DateInput id="dueDate" {...billForm.register('dueDate')} />
                  </FormField>
                </div>
                <FormField id="accountId" label="Conta (opcional)" error={billForm.formState.errors.accountId?.message}>
                  <FormSelect control={billForm.control} name="accountId" placeholder="Selecione uma conta">
                    <SelectItem value="">Nenhuma</SelectItem>
                    {(accounts ?? []).map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField id="notes" label="Observações" error={billForm.formState.errors.notes?.message}>
                  <Textarea id="notes" placeholder="Observações opcionais" {...billForm.register('notes')} />
                </FormField>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setBillDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" loading={createBillMutation.isPending}>Criar</Button>
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{bill.description}</h3>
                        <Badge variant="outline" className={getStatusColor(bill.status)}>
                          {bill.status === 'PAID' ? 'Paga' : bill.status === 'OVERDUE' ? 'Vencida' : bill.status === 'CANCELLED' ? 'Cancelada' : 'Pendente'}
                        </Badge>
                        {bill.recurringBill && <Badge variant="secondary">Recorrente</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">Vence em {formatDate(bill.dueDate)}</p>
                      {bill.notes && <p className="text-sm text-muted-foreground">{bill.notes}</p>}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-bold text-lg">{formatMoney(bill.amount.cents)}</p>
                      {bill.status !== 'PAID' && bill.status !== 'CANCELLED' && (
                        <>
                          <Button size="sm" onClick={() => { setPayTarget(bill); payForm.reset({ accountId: '' }); }}>Pagar</Button>
                          <Button variant="ghost" size="icon" onClick={() => setCancelBillId(bill.id)} aria-label="Excluir conta">
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
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{bill.description}</h3>
                        <Badge variant="secondary">{getFrequencyLabel(bill.frequency)}</Badge>
                        {bill.status === 'INACTIVE' && <Badge variant="outline">Inativa</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Dia {bill.dueDay} · Próximo: {formatDate(bill.nextDueDate)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-bold text-lg">{formatMoney(bill.amount.cents)}</p>
                      <Button variant="outline" size="sm" onClick={() => generateMutation.mutate(bill.id)}>
                        Gerar próxima
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteRecurringId(bill.id)} aria-label="Excluir conta recorrente">
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
          <form onSubmit={payForm.handleSubmit((data) => payTarget && payMutation.mutate({ id: payTarget.id, data }))} className="space-y-4" noValidate>
            <p className="text-sm text-muted-foreground">
              {payTarget?.description} · <span className="font-semibold">{payTarget ? formatMoney(payTarget.amount.cents) : ''}</span>
            </p>
            <FormField id="accountId" label="Conta (opcional)" error={payForm.formState.errors.accountId?.message}>
              <FormSelect control={payForm.control} name="accountId" placeholder="Selecione uma conta">
                <SelectItem value="">Nenhuma</SelectItem>
                {(accounts ?? []).map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                ))}
              </FormSelect>
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayTarget(null)}>Cancelar</Button>
              <Button type="submit" loading={payMutation.isPending}>Confirmar pagamento</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!cancelBillId}
        onOpenChange={(open) => !open && setCancelBillId(null)}
        title="Excluir conta?"
        description="Essa ação removerá permanentemente a conta. Contas já pagas não podem ser excluídas."
        loading={cancelBillMutation.isPending}
        onConfirm={() => cancelBillId && cancelBillMutation.mutate(cancelBillId)}
      />

      <ConfirmDeleteDialog
        open={!!deleteRecurringId}
        onOpenChange={(open) => !open && setDeleteRecurringId(null)}
        title="Excluir conta recorrente?"
        description="Essa ação removerá permanentemente a conta recorrente."
        loading={deleteRecurringMutation.isPending}
        onConfirm={() => deleteRecurringId && deleteRecurringMutation.mutate(deleteRecurringId)}
      />
    </div>
  );
}