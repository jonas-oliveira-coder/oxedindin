import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { SelectItem } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { formatMoney, getAccountTypeLabel, cn } from '@/lib/utils';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { accountTypeSchema, accountStatusSchema, type CreateAccountInput, type UpdateAccountInput } from '@/lib/validation';
import { nameSchema, moneyCentsSchema } from '@oxedindin/shared';
import { FormField, TextInput, CurrencyInput, Textarea, FormSelect } from '@/components/forms';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';

interface BankAccount {
  id: string;
  name: string;
  institution: string;
  type: string;
  number?: string;
  agency?: string;
  balance: { cents: number; currency: string };
  initialBalance: { cents: number; currency: string };
  status: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

const accountFormSchema = z.object({
  name: nameSchema,
  institution: z.string().trim().min(1, 'Informe a instituição.').max(100),
  type: accountTypeSchema,
  number: z.string().trim().max(20).optional().default(''),
  agency: z.string().trim().max(10).optional().default(''),
  initialBalance: moneyCentsSchema.default(0),
  status: accountStatusSchema.default('ACTIVE'),
  notes: z.string().max(500).optional().default(''),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

async function fetchAccounts(): Promise<BankAccount[]> {
  const response = await api.get('/accounts');
  return response.data.data;
}

async function createAccount(data: CreateAccountInput): Promise<BankAccount> {
  const response = await api.post('/accounts', data);
  return response.data;
}

async function updateAccount(id: string, data: UpdateAccountInput): Promise<BankAccount> {
  const response = await api.patch(`/accounts/${id}`, data);
  return response.data;
}

async function deleteAccount(id: string): Promise<void> {
  await api.delete(`/accounts/${id}`);
}

export function AccountsPage() {
  const queryClient = useQueryClient();
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: fetchAccounts,
  });

  const createMutation = useMutation({
    mutationFn: createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Conta criada', description: 'Conta bancária criada com sucesso.' });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAccountInput }) => updateAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Conta atualizada', description: 'Conta bancária atualizada com sucesso.' });
      setEditingAccount(null);
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Conta excluída', description: 'Conta bancária excluída com sucesso.' });
      setDeleteId(null);
    },
    onError: (error) => toast({ title: 'Não foi possível excluir', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: { type: 'CHECKING', initialBalance: 0, status: 'ACTIVE', number: '', agency: '', notes: '' },
  });

  const openCreateDialog = () => {
    setEditingAccount(null);
    form.reset({ type: 'CHECKING', initialBalance: 0, status: 'ACTIVE', number: '', agency: '', notes: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (account: BankAccount) => {
    setEditingAccount(account);
    form.reset({
      name: account.name,
      institution: account.institution,
      type: account.type as AccountFormValues['type'],
      number: account.number ?? '',
      agency: account.agency ?? '',
      status: account.status as AccountFormValues['status'],
      notes: account.notes ?? '',
      initialBalance: account.initialBalance.cents,
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: AccountFormValues) => {
    const base = {
      name: values.name,
      institution: values.institution,
      type: values.type,
      number: values.number || undefined,
      agency: values.agency || undefined,
      notes: values.notes || undefined,
    };
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: { ...base, status: values.status } as UpdateAccountInput });
    } else {
      createMutation.mutate({ ...base, initialBalance: values.initialBalance } as CreateAccountInput);
    }
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
          <h1 className="text-3xl font-bold tracking-tight">Contas Bancárias</h1>
          <p className="text-muted-foreground">Gerencie suas contas bancárias e saldos</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta Bancária'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField id="name" label="Nome da conta" error={form.formState.errors.name?.message}>
                <TextInput id="name" placeholder="Minha Conta" {...form.register('name')} />
              </FormField>

              <FormField id="institution" label="Instituição" error={form.formState.errors.institution?.message}>
                <TextInput id="institution" placeholder="Banco do Brasil" {...form.register('institution')} />
              </FormField>

              <FormField id="type" label="Tipo" error={form.formState.errors.type?.message}>
                <FormSelect control={form.control} name="type" placeholder="Selecione o tipo">
                  <SelectItem value="CHECKING">Conta Corrente</SelectItem>
                  <SelectItem value="SAVINGS">Poupança</SelectItem>
                  <SelectItem value="DIGITAL">Digital</SelectItem>
                  <SelectItem value="SALARY">Salário</SelectItem>
                  <SelectItem value="OTHER">Outra</SelectItem>
                </FormSelect>
              </FormField>

              <div className="grid gap-2 grid-cols-2">
                <FormField id="number" label="Número" error={form.formState.errors.number?.message}>
                  <TextInput id="number" placeholder="12345-6" {...form.register('number')} />
                </FormField>
                <FormField id="agency" label="Agência" error={form.formState.errors.agency?.message}>
                  <TextInput id="agency" placeholder="1234" {...form.register('agency')} />
                </FormField>
              </div>

              {!editingAccount && (
                <FormField id="initialBalance" label="Saldo inicial" error={form.formState.errors.initialBalance?.message}>
                  <Controller
                    name="initialBalance"
                    control={form.control}
                    render={({ field }) => (
                      <CurrencyInput id="initialBalance" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                    )}
                  />
                </FormField>
              )}

              <FormField id="notes" label="Observações" error={form.formState.errors.notes?.message}>
                <Textarea id="notes" placeholder="Observações opcionais" {...form.register('notes')} />
              </FormField>

              {editingAccount && (
                <FormField id="status" label="Status" error={form.formState.errors.status?.message}>
                  <FormSelect control={form.control} name="status" placeholder="Selecione o status">
                    <SelectItem value="ACTIVE">Ativa</SelectItem>
                    <SelectItem value="INACTIVE">Inativa</SelectItem>
                  </FormSelect>
                </FormField>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                  {editingAccount ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {accounts && accounts.length > 0 ? (
        <div className="space-y-4">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="p-3 rounded-lg bg-primary/10 shrink-0">
                      <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8" />
                        <path d="M12 17v4" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-lg">{account.name}</h3>
                        <span className={cn('px-2 py-0.5 text-xs rounded-full', account.status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
                          {account.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{account.institution} • {getAccountTypeLabel(account.type)}</p>
                      {account.number && <p className="text-sm text-muted-foreground">Conta: {account.number} • Ag: {account.agency}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold">{formatMoney(account.balance.cents)}</p>
                      <p className="text-sm text-muted-foreground">Saldo inicial: {formatMoney(account.initialBalance.cents)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(account)} aria-label="Editar conta">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(account.id)} aria-label="Excluir conta">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <h3 className="text-lg font-medium">Nenhuma conta cadastrada</h3>
            <p className="mt-2 text-muted-foreground">Adicione sua primeira conta bancária para começar</p>
            <Button onClick={openCreateDialog} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Conta
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir conta?"
        description="Essa ação removerá permanentemente a conta. Contas com transações, contas recorrentes ou cartões vinculados não podem ser excluídas."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}