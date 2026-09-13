import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { formatMoney, formatDate, getStatusColor } from '@/lib/utils';
import { Plus, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { positiveMoneyCentsSchema, civilDateSchema, uuidSchema } from '@oxedindin/shared';
import { FormField, TextInput, CurrencyInput, NumberInput, DateInput, FormSelect } from '@/components/forms';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';

const createPlanFormSchema = z.object({
  description: z.string().trim().min(1, 'Informe a descrição.').max(200),
  totalAmount: positiveMoneyCentsSchema,
  installmentsCount: z.number({ invalid_type_error: 'Informe o número de parcelas.' }).int('Número de parcelas inválido.').min(1, 'O número de parcelas deve ser positivo.').max(60, 'Máximo de 60 parcelas.'),
  startDate: civilDateSchema,
  firstInvoiceDate: civilDateSchema,
  cardId: uuidSchema,
  categoryId: uuidSchema.optional().or(z.literal('')),
});

type CreatePlanFormInput = z.infer<typeof createPlanFormSchema>;

interface Installment {
  id: string;
  planId: string;
  number: number;
  amount: { cents: number; currency: string };
  dueDate: string;
  status: string;
  plan?: { id: string; description: string; installmentsCount: number; totalAmountCents: string; cardId: string } | null;
}

interface IdName {
  id: string;
  name: string;
}

const paySchema = z.object({
  accountId: uuidSchema.optional().or(z.literal('')),
});

const statusLabels: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Paga',
  OVERDUE: 'Vencida',
  CANCELLED: 'Cancelada',
};

async function fetchInstallments(): Promise<Installment[]> {
  const response = await api.get('/installments');
  return response.data.data;
}

async function fetchCards(): Promise<IdName[]> {
  const response = await api.get('/cards');
  return response.data.data.filter((c: any) => c.status === 'ACTIVE');
}

async function fetchAccounts(): Promise<IdName[]> {
  const response = await api.get('/accounts');
  return response.data.data.filter((a: any) => a.status === 'ACTIVE');
}

export function InstallmentsPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<Installment | null>(null);
  const [cancelPlanId, setCancelPlanId] = useState<string | null>(null);

  const { data: installments, isLoading } = useQuery({ queryKey: ['installments'], queryFn: fetchInstallments });
  const { data: cards } = useQuery({ queryKey: ['cards', 'active'], queryFn: fetchCards });
  const { data: accounts } = useQuery({ queryKey: ['accounts', 'active'], queryFn: fetchAccounts });

  const createForm = useForm<CreatePlanFormInput>({
    resolver: zodResolver(createPlanFormSchema),
    defaultValues: { categoryId: '' },
  });
  const payForm = useForm<z.infer<typeof paySchema>>({ resolver: zodResolver(paySchema), defaultValues: { accountId: '' } });

  const createMutation = useMutation({
    mutationFn: async (data: CreatePlanFormInput) => {
      await api.post('/transactions/installment', {
        description: data.description,
        totalAmount: data.totalAmount,
        installmentsCount: data.installmentsCount,
        startDate: data.startDate,
        firstInvoiceDate: data.firstInvoiceDate,
        cardId: data.cardId,
        categoryId: data.categoryId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Parcelamento criado', description: 'Compra parcelada registrada com sucesso.' });
      setCreateOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const payMutation = useMutation({
    mutationFn: async ({ installment, data }: { installment: Installment; data: z.infer<typeof paySchema> }) => {
      await api.post(`/installments/${installment.planId}/installments/${installment.number}/pay`, {
        accountId: data.accountId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Parcela paga', description: 'Parcela paga com sucesso.' });
      setPayTarget(null);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (planId: string) => {
      await api.delete(`/installments/${planId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['installments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Parcelamento cancelado', description: 'As parcelas pendentes foram canceladas.' });
      setCancelPlanId(null);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const grouped = new Map<string, { plan: NonNullable<Installment['plan']>; items: Installment[] }>();
  for (const item of installments ?? []) {
    const plan = item.plan;
    if (!plan) continue;
    const existing = grouped.get(plan.id);
    if (existing) existing.items.push(item);
    else grouped.set(plan.id, { plan, items: [item] });
  }

  const openPayDialog = (installment: Installment) => {
    setPayTarget(installment);
    payForm.reset({ accountId: '' });
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
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Parcelamentos</h1>
          <p className="text-muted-foreground">Gerencie suas compras parceladas</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Novo Parcelamento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova compra parcelada</DialogTitle>
            </DialogHeader>
            <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4" noValidate>
              <FormField id="description" label="Descrição" error={createForm.formState.errors.description?.message}>
                <TextInput id="description" placeholder="Smartphone, Notebook..." {...createForm.register('description')} />
              </FormField>
              <div className="grid gap-2 grid-cols-2">
                <FormField id="totalAmount" label="Valor total" error={createForm.formState.errors.totalAmount?.message}>
                  <Controller
                    name="totalAmount"
                    control={createForm.control}
                    render={({ field }) => <CurrencyInput id="totalAmount" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
                  />
                </FormField>
                <FormField id="installmentsCount" label="Nº de parcelas" error={createForm.formState.errors.installmentsCount?.message}>
                  <NumberInput id="installmentsCount" min={1} max={60} placeholder="10" {...createForm.register('installmentsCount', { valueAsNumber: true })} />
                </FormField>
              </div>
              <FormField id="cardId" label="Cartão" error={createForm.formState.errors.cardId?.message}>
                <FormSelect control={createForm.control} name="cardId" placeholder="Selecione o cartão">
                  {(cards ?? []).map((card) => (
                    <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                  ))}
                </FormSelect>
              </FormField>
              <div className="grid gap-2 grid-cols-2">
                <FormField id="startDate" label="Data da compra" error={createForm.formState.errors.startDate?.message}>
                  <DateInput id="startDate" {...createForm.register('startDate')} />
                </FormField>
                <FormField id="firstInvoiceDate" label="Primeira fatura" error={createForm.formState.errors.firstInvoiceDate?.message}>
                  <DateInput id="firstInvoiceDate" {...createForm.register('firstInvoiceDate')} />
                </FormField>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" loading={createMutation.isPending}>Criar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {grouped.size > 0 ? (
        <div className="space-y-6">
          {Array.from(grouped.values()).map(({ plan, items }) => (
            <Card key={plan.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{plan.description}</h3>
                    <p className="text-sm text-muted-foreground">
                      {items.length} de {plan.installmentsCount} parcelas · Total {formatMoney(Number(plan.totalAmountCents))}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setCancelPlanId(plan.id)}>
                    <TriangleAlert className="mr-1 h-4 w-4" />
                    Cancelar
                  </Button>
                </div>
                <div className="space-y-2">
                  {items
                    .sort((a, b) => a.number - b.number)
                    .map((installment) => (
                      <div key={installment.id} className="flex flex-col gap-2 p-3 rounded-lg border sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                            {installment.number}
                          </div>
                          <div>
                            <p className="font-medium">{formatMoney(installment.amount.cents)}</p>
                            <p className="text-sm text-muted-foreground">Vence em {formatDate(installment.dueDate)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={getStatusColor(installment.status)}>
                            {statusLabels[installment.status] || installment.status}
                          </Badge>
                          {installment.status === 'PENDING' || installment.status === 'OVERDUE' ? (
                            <Button size="sm" onClick={() => openPayDialog(installment)}>Pagar</Button>
                          ) : (
                            <CheckCircle2 className="h-5 w-5 text-success" />
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <TriangleAlert className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhum parcelamento cadastrado</h3>
            <p className="mt-2 text-muted-foreground">Suas compras parceladas aparecerão aqui.</p>
            <Button onClick={() => setCreateOpen(true)} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Novo Parcelamento
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!payTarget} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Pagar parcela {payTarget?.number}</DialogTitle>
          </DialogHeader>
          <form onSubmit={payForm.handleSubmit((data) => payTarget && payMutation.mutate({ installment: payTarget, data }))} className="space-y-4" noValidate>
            <p className="text-sm text-muted-foreground">
              Valor: <span className="font-semibold">{payTarget ? formatMoney(payTarget.amount.cents) : ''}</span>
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
              <Button type="submit" loading={payMutation.isPending}>Confirmar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!cancelPlanId}
        onOpenChange={(open) => !open && setCancelPlanId(null)}
        title="Cancelar parcelamento?"
        description="As parcelas pendentes serão canceladas e o limite restaurado."
        confirmLabel="Cancelar parcelamento"
        loading={cancelMutation.isPending}
        onConfirm={() => cancelPlanId && cancelMutation.mutate(cancelPlanId)}
      />
    </div>
  );
}