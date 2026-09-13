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
import { formatMoney, formatDate, getStatusColor, getDebtTypeLabel } from '@/lib/utils';
import { Plus, Trash2, Share2, CheckCircle2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { positiveMoneyCentsSchema, civilDateSchema, uuidSchema, emailSchema } from '@oxedindin/shared';
import { FormField, TextInput, CurrencyInput, DateInput, EmailInput, FormSelect } from '@/components/forms';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';

interface Debt {
  id: string;
  description: string;
  totalAmount: { cents: number; currency: string };
  paidAmount: { cents: number; currency: string };
  remainingAmount: { cents: number; currency: string };
  dueDate: string;
  type: string;
  status: string;
  relatedPerson?: { id: string; name: string } | null;
}

interface IdName {
  id: string;
  name: string;
}

const debtTypeEnum = z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']);

const debtFormSchema = z.object({
  description: z.string().trim().min(1, 'Informe a descrição.').max(200),
  totalAmount: positiveMoneyCentsSchema,
  dueDate: civilDateSchema,
  type: debtTypeEnum,
  relatedPersonId: uuidSchema.optional().or(z.literal('')),
  personId: uuidSchema.optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});

const paySchema = z.object({
  amount: positiveMoneyCentsSchema,
});

const shareSchema = z.object({
  email: emailSchema,
});

type DebtFormInput = z.infer<typeof debtFormSchema>;
type PayFormInput = z.infer<typeof paySchema>;

async function fetchDebts(): Promise<Debt[]> {
  const response = await api.get('/debts');
  return response.data.data;
}

async function fetchOwed(): Promise<Debt[]> {
  const response = await api.get('/debts/owed');
  return response.data.data;
}

async function fetchPeople(): Promise<IdName[]> {
  const response = await api.get('/people');
  return response.data.data;
}

export function DebtsPage() {
  const queryClient = useQueryClient();
  const [debtDialogOpen, setDebtDialogOpen] = useState(false);
  const [owedDialogOpen, setOwedDialogOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<{ debt: Debt; kind: 'debt' | 'owed' } | null>(null);
  const [shareTarget, setShareTarget] = useState<{ debt: Debt; kind: 'debt' | 'owed' } | null>(null);
  const [deleteDebtId, setDeleteDebtId] = useState<string | null>(null);

  const { data: debts, isLoading } = useQuery({ queryKey: ['debts'], queryFn: fetchDebts });
  const { data: owed } = useQuery({ queryKey: ['debtsOwed'], queryFn: fetchOwed });
  const { data: people } = useQuery({ queryKey: ['people'], queryFn: fetchPeople });

  const debtForm = useForm<DebtFormInput>({
    resolver: zodResolver(debtFormSchema),
    defaultValues: { type: 'PERSONAL_LOAN', relatedPersonId: '', personId: '', notes: '' },
  });
  const owedForm = useForm<DebtFormInput>({
    resolver: zodResolver(debtFormSchema),
    defaultValues: { type: 'PERSONAL_LOAN', relatedPersonId: '', personId: '', notes: '' },
  });
  const payForm = useForm<PayFormInput>({ resolver: zodResolver(paySchema) });
  const shareForm = useForm<z.infer<typeof shareSchema>>({ resolver: zodResolver(shareSchema) });

  const createDebtMutation = useMutation({
    mutationFn: async (data: DebtFormInput) => {
      await api.post('/debts', {
        description: data.description,
        totalAmount: data.totalAmount,
        dueDate: data.dueDate,
        type: data.type,
        relatedPersonId: data.relatedPersonId || undefined,
        notes: data.notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast({ title: 'Dívida criada', description: 'Dívida registrada com sucesso.' });
      setDebtDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const createOwedMutation = useMutation({
    mutationFn: async (data: DebtFormInput) => {
      await api.post('/debts/owed', {
        description: data.description,
        totalAmount: data.totalAmount,
        dueDate: data.dueDate,
        type: data.type,
        personId: data.personId,
        notes: data.notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debtsOwed'] });
      toast({ title: 'Valor a receber criado', description: 'Valor a receber registrado.' });
      setOwedDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const payMutation = useMutation({
    mutationFn: async ({ id, kind, data }: { id: string; kind: 'debt' | 'owed'; data: PayFormInput }) => {
      await api.post(`/debts/${kind === 'debt' ? '' : 'owed/'}${id}/pay`, { amount: data.amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['debtsOwed'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Pagamento registrado', description: 'Pagamento registrado com sucesso.' });
      setPayTarget(null);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const shareMutation = useMutation({
    mutationFn: async ({ id, kind, email }: { id: string; kind: 'debt' | 'owed'; email: string }) => {
      if (kind === 'owed') {
        await api.post(`/debts/owed/${id}/share`, { email });
      } else {
        await api.post(`/debts/${id}/link-person`, { email });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['debtsOwed'] });
      toast({ title: 'Dívida compartilhada', description: 'Pessoa vinculada com sucesso.' });
      setShareTarget(null);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/debts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast({ title: 'Dívida excluída', description: 'Dívida excluída com sucesso.' });
      setDeleteDebtId(null);
    },
    onError: (error) => toast({ title: 'Não foi possível excluir', description: getErrorMessage(error), variant: 'destructive' }),
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

  const renderDebt = (debt: Debt, kind: 'debt' | 'owed') => (
    <Card key={debt.id}>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"> 
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{debt.description}</h3>
              <Badge variant="outline" className={getStatusColor(debt.status)}>
                {debt.status === 'PAID' ? 'Paga' : debt.status === 'OVERDUE' ? 'Vencida' : debt.status === 'ACTIVE' ? 'Ativa' : debt.status}
              </Badge>
              <Badge variant="secondary">{getDebtTypeLabel(debt.type)}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Vence em {formatDate(debt.dueDate)}
              {debt.relatedPerson ? ` · ${debt.relatedPerson.name}` : ''}
            </p>
            <p className="text-sm text-muted-foreground">
              Restante: <span className="font-medium">{formatMoney(debt.remainingAmount.cents)}</span> de {formatMoney(debt.totalAmount.cents)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {debt.remainingAmount.cents > 0 && debt.status !== 'CANCELLED' && (
              <Button size="sm" onClick={() => { setPayTarget({ debt, kind }); payForm.reset({ amount: undefined }); }}>Pagar</Button>
            )}
            {kind === 'owed' && debt.remainingAmount.cents > 0 && (
              <Button variant="outline" size="sm" onClick={() => { setShareTarget({ debt, kind }); shareForm.reset(); }}>
                <Share2 className="mr-1 h-4 w-4" />
                Compartilhar
              </Button>
            )}
            {kind === 'debt' && debt.status !== 'CANCELLED' && debt.remainingAmount.cents > 0 && (
              <Button variant="outline" size="sm" onClick={() => { setShareTarget({ debt, kind }); shareForm.reset(); }}>
                <Share2 className="mr-1 h-4 w-4" />
                Vincular pessoa
              </Button>
            )}
            {kind === 'debt' && debt.status !== 'CANCELLED' && (
              <Button variant="ghost" size="icon" onClick={() => setDeleteDebtId(debt.id)} aria-label="Excluir dívida">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
            {debt.remainingAmount.cents === 0 && <CheckCircle2 className="h-5 w-5 text-success" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const debtTypeItems = (
    <>
      <SelectItem value="PERSONAL_LOAN">Empréstimo pessoal</SelectItem>
      <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>
      <SelectItem value="PURCHASE">Compra</SelectItem>
      <SelectItem value="BORROWED_MONEY">Dinheiro emprestado</SelectItem>
      <SelectItem value="OTHER">Outro</SelectItem>
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dívidas</h1>
          <p className="text-muted-foreground">Gerencie suas dívidas e valores a receber</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={owedDialogOpen} onOpenChange={setOwedDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Valor a receber
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Novo valor a receber</DialogTitle>
              </DialogHeader>
              <form onSubmit={owedForm.handleSubmit((data) => createOwedMutation.mutate(data))} className="space-y-4" noValidate>
                <FormField id="description" label="Descrição" error={owedForm.formState.errors.description?.message}>
                  <TextInput id="description" placeholder="Empréstimo para..." {...owedForm.register('description')} />
                </FormField>
                <div className="grid gap-2 grid-cols-2">
                  <FormField id="totalAmount" label="Valor total" error={owedForm.formState.errors.totalAmount?.message}>
                    <Controller
                      name="totalAmount"
                      control={owedForm.control}
                      render={({ field }) => <CurrencyInput id="totalAmount" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
                    />
                  </FormField>
                  <FormField id="dueDate" label="Vencimento" error={owedForm.formState.errors.dueDate?.message}>
                    <DateInput id="dueDate" {...owedForm.register('dueDate')} />
                  </FormField>
                </div>
                <FormField id="personId" label="Pessoa" error={owedForm.formState.errors.personId?.message}>
                  <FormSelect control={owedForm.control} name="personId" placeholder="Selecione a pessoa">
                    {(people ?? []).map((person) => (
                      <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField id="type" label="Tipo" error={owedForm.formState.errors.type?.message}>
                  <FormSelect control={owedForm.control} name="type" placeholder="Selecione">
                    {debtTypeItems}
                  </FormSelect>
                </FormField>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOwedDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" loading={createOwedMutation.isPending}>Criar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={debtDialogOpen} onOpenChange={setDebtDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nova Dívida
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nova dívida</DialogTitle>
              </DialogHeader>
              <form onSubmit={debtForm.handleSubmit((data) => createDebtMutation.mutate(data))} className="space-y-4" noValidate>
                <FormField id="description" label="Descrição" error={debtForm.formState.errors.description?.message}>
                  <TextInput id="description" placeholder="Empréstimo, financiamento..." {...debtForm.register('description')} />
                </FormField>
                <div className="grid gap-2 grid-cols-2">
                  <FormField id="totalAmount" label="Valor total" error={debtForm.formState.errors.totalAmount?.message}>
                    <Controller
                      name="totalAmount"
                      control={debtForm.control}
                      render={({ field }) => <CurrencyInput id="totalAmount" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
                    />
                  </FormField>
                  <FormField id="dueDate" label="Vencimento" error={debtForm.formState.errors.dueDate?.message}>
                    <DateInput id="dueDate" {...debtForm.register('dueDate')} />
                  </FormField>
                </div>
                <FormField id="type" label="Tipo" error={debtForm.formState.errors.type?.message}>
                  <FormSelect control={debtForm.control} name="type" placeholder="Selecione">
                    {debtTypeItems}
                  </FormSelect>
                </FormField>
                <FormField id="relatedPersonId" label="Pessoa (opcional)" error={debtForm.formState.errors.relatedPersonId?.message}>
                  <FormSelect control={debtForm.control} name="relatedPersonId" placeholder="Selecione">
                    <SelectItem value="">Nenhuma</SelectItem>
                    {(people ?? []).map((person) => (
                      <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                    ))}
                  </FormSelect>
                </FormField>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDebtDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" loading={createDebtMutation.isPending}>Criar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="pay">
        <TabsList>
          <TabsTrigger value="pay">A pagar</TabsTrigger>
          <TabsTrigger value="receive">A receber</TabsTrigger>
        </TabsList>

        <TabsContent value="pay" className="space-y-3">
          {debts && debts.length > 0 ? (
            debts.map((debt) => renderDebt(debt, 'debt'))
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <h3 className="text-lg font-medium">Nenhuma dívida a pagar</h3>
                <p className="mt-2 text-muted-foreground">Você não possui dívidas registradas.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="receive" className="space-y-3">
          {owed && owed.length > 0 ? (
            owed.map((debt) => renderDebt(debt, 'owed'))
          ) : (
            <Card>
              <CardContent className="pt-6 text-center py-12">
                <h3 className="text-lg font-medium">Nenhum valor a receber</h3>
                <p className="mt-2 text-muted-foreground">Registre valores que outras pessoas lhe devem.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!payTarget} onOpenChange={(open) => !open && setPayTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{payTarget?.kind === 'owed' ? 'Receber pagamento' : 'Pagar dívida'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={payForm.handleSubmit((data) => payTarget && payMutation.mutate({ id: payTarget.debt.id, kind: payTarget.kind, data }))} className="space-y-4" noValidate>
            <p className="text-sm text-muted-foreground">
              {payTarget?.debt.description} · Restante {payTarget ? formatMoney(payTarget.debt.remainingAmount.cents) : ''}
            </p>
            <FormField id="amount" label="Valor do pagamento" error={payForm.formState.errors.amount?.message}>
              <Controller
                name="amount"
                control={payForm.control}
                render={({ field }) => <CurrencyInput id="amount" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
              />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayTarget(null)}>Cancelar</Button>
              <Button type="submit" loading={payMutation.isPending}>Confirmar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!shareTarget} onOpenChange={(open) => !open && setShareTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{shareTarget?.kind === 'owed' ? 'Compartilhar dívida' : 'Vincular pessoa'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={shareForm.handleSubmit((data) => shareTarget && shareMutation.mutate({ id: shareTarget.debt.id, kind: shareTarget.kind, email: data.email }))} className="space-y-4" noValidate>
            <p className="text-sm text-muted-foreground">
              {shareTarget?.debt.description} ·{' '}
              <span className="font-semibold">{shareTarget ? formatMoney(shareTarget.debt.remainingAmount.cents) : ''}</span>
            </p>
            <FormField id="email" label={shareTarget?.kind === 'owed' ? 'Email do devedor' : 'Email da pessoa'} error={shareForm.formState.errors.email?.message}>
              <EmailInput id="email" placeholder="pessoa@exemplo.com" {...shareForm.register('email')} />
            </FormField>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShareTarget(null)}>Cancelar</Button>
              <Button type="submit" loading={shareMutation.isPending}>{shareTarget?.kind === 'owed' ? 'Compartilhar' : 'Vincular'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteDebtId}
        onOpenChange={(open) => !open && setDeleteDebtId(null)}
        title="Excluir dívida?"
        description="Essa ação removerá permanentemente a dívida. Dívidas com pagamentos registrados não podem ser excluídas."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteDebtId && deleteMutation.mutate(deleteDebtId)}
      />
    </div>
  );
}