import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import { formatMoney, formatDate, getTransactionTypeColor, cleanParams } from '@/lib/utils';
import { Plus, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTransactionSchema, type CreateTransactionInput } from '@/lib/validation';
import { FormField, TextInput, CurrencyInput, DateInput, Textarea, FormSelect } from '@/components/forms';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';
import { todayCivilDate } from '@oxedindin/shared';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  description: string;
  amount: { cents: number; currency: string };
  type: string;
  category?: { id: string; name: string; color?: string } | null;
  date: string;
  paymentMethod: string;
  account?: { id: string; name: string } | null;
  card?: { id: string; name: string } | null;
  notes?: string;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  color?: string;
}

async function fetchTransactions(params?: Record<string, unknown>): Promise<{ data: Transaction[]; meta: any }> {
  const cleaned = cleanParams(params);
  const response = await api.get('/transactions', { params: cleaned });
  return response.data;
}

async function fetchCategories(): Promise<Category[]> {
  const response = await api.get('/categories');
  return response.data.data;
}

async function fetchAccounts(): Promise<Array<{ id: string; name: string }>> {
  const response = await api.get('/accounts');
  return response.data.data.filter((a: any) => a.status === 'ACTIVE');
}

async function fetchCards(): Promise<Array<{ id: string; name: string }>> {
  const response = await api.get('/cards');
  return response.data.data.filter((c: any) => c.status === 'ACTIVE');
}

async function createTransaction(data: CreateTransactionInput): Promise<Transaction> {
  const response = await api.post('/transactions', data);
  return response.data;
}

async function deleteTransaction(id: string): Promise<void> {
  await api.delete(`/transactions/${id}`);
}

const transactionTypeLabels: Record<string, string> = {
  EXPENSE: 'Despesa',
  INCOME: 'Receita',
  TRANSFER: 'Transferência',
};

const paymentMethodLabels: Record<string, string> = {
  CASH: 'Dinheiro',
  DEBIT_CARD: 'Débito',
  CREDIT_CARD: 'Crédito',
  PIX: 'PIX',
  BANK_TRANSFER: 'Transferência',
  BOLETO: 'Boleto',
  OTHER: 'Outro',
};

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    startDate: '',
    endDate: '',
    categoryId: '',
    accountId: '',
    cardId: '',
    type: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
  });

  const { data: fetchedCategories } = useQuery({ queryKey: ['categories'], queryFn: fetchCategories });
  const { data: fetchedAccounts } = useQuery({ queryKey: ['accounts', 'active'], queryFn: fetchAccounts });
  const { data: fetchedCards } = useQuery({ queryKey: ['cards', 'active'], queryFn: fetchCards });

  const createMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Transação criada', description: 'Transação registrada com sucesso.' });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Transação excluída', description: 'Transação removida com sucesso.' });
      setDeleteId(null);
    },
    onError: (error) => toast({ title: 'Não foi possível excluir', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const form = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      type: 'EXPENSE',
      paymentMethod: 'CREDIT_CARD',
      date: todayCivilDate(),
    },
  });

  const onSubmit = (data: CreateTransactionInput) => {
    createMutation.mutate({
      ...data,
      accountId: data.accountId || undefined,
      cardId: data.cardId || undefined,
      categoryId: data.categoryId || undefined,
      notes: data.notes || undefined,
    });
    form.reset({ type: 'EXPENSE', paymentMethod: 'CREDIT_CARD', date: todayCivilDate() });
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
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

  const transactions = data?.data || [];
  const meta = data?.meta || { total: 0, page: 1, limit: 20, totalPages: 1 };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transações</h1>
          <p className="text-muted-foreground">Registre e gerencie suas transações financeiras</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Transação
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Nova Transação</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField id="description" label="Descrição" error={form.formState.errors.description?.message}>
                <TextInput id="description" placeholder="Supermercado, Uber, Salário..." {...form.register('description')} />
              </FormField>

              <div className="grid gap-2 grid-cols-2">
                <FormField id="amount" label="Valor" error={form.formState.errors.amount?.message}>
                  <Controller
                    name="amount"
                    control={form.control}
                    render={({ field }) => <CurrencyInput id="amount" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
                  />
                </FormField>
                <FormField id="type" label="Tipo" error={form.formState.errors.type?.message}>
                  <FormSelect control={form.control} name="type" placeholder="Selecione">
                    <SelectItem value="EXPENSE">Despesa</SelectItem>
                    <SelectItem value="INCOME">Receita</SelectItem>
                    <SelectItem value="TRANSFER">Transferência</SelectItem>
                  </FormSelect>
                </FormField>
              </div>

              <FormField id="categoryId" label="Categoria" error={form.formState.errors.categoryId?.message}>
                <FormSelect control={form.control} name="categoryId" placeholder="Selecione uma categoria">
                  <SelectItem value="">Sem categoria</SelectItem>
                  {(fetchedCategories ?? []).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        {cat.color && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />}
                        {cat.name}
                      </span>
                    </SelectItem>
                  ))}
                </FormSelect>
              </FormField>

              <div className="grid gap-2 grid-cols-2">
                <FormField id="date" label="Data" error={form.formState.errors.date?.message}>
                  <DateInput id="date" {...form.register('date')} />
                </FormField>
                <FormField id="paymentMethod" label="Forma de pagamento" error={form.formState.errors.paymentMethod?.message}>
                  <FormSelect control={form.control} name="paymentMethod" placeholder="Selecione">
                    <SelectItem value="CASH">Dinheiro</SelectItem>
                    <SelectItem value="DEBIT_CARD">Débito</SelectItem>
                    <SelectItem value="CREDIT_CARD">Crédito</SelectItem>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="BANK_TRANSFER">Transferência</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="OTHER">Outro</SelectItem>
                  </FormSelect>
                </FormField>
              </div>

              <div className="grid gap-2 grid-cols-2">
                <FormField id="accountId" label="Conta (opcional)" error={form.formState.errors.accountId?.message}>
                  <FormSelect control={form.control} name="accountId" placeholder="Selecione">
                    <SelectItem value="">Nenhuma</SelectItem>
                    {(fetchedAccounts ?? []).map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </FormSelect>
                </FormField>
                <FormField id="cardId" label="Cartão (opcional)" error={form.formState.errors.cardId?.message}>
                  <FormSelect control={form.control} name="cardId" placeholder="Selecione">
                    <SelectItem value="">Nenhum</SelectItem>
                    {(fetchedCards ?? []).map((card) => (
                      <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                    ))}
                  </FormSelect>
                </FormField>
              </div>

              <FormField id="notes" label="Observações" error={form.formState.errors.notes?.message}>
                <Textarea id="notes" placeholder="Observações opcionais" {...form.register('notes')} />
              </FormField>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" loading={createMutation.isPending}>Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-6">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data inicial</Label>
              <Input id="startDate" type="date" value={filters.startDate} onChange={(e) => handleFilterChange('startDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data final</Label>
              <Input id="endDate" type="date" value={filters.endDate} onChange={(e) => handleFilterChange('endDate', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={filters.categoryId} onValueChange={(value) => handleFilterChange('categoryId', value)}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {(fetchedCategories ?? []).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Conta</Label>
              <Select value={filters.accountId} onValueChange={(value) => handleFilterChange('accountId', value)}>
                <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {(fetchedAccounts ?? []).map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cartão</Label>
              <Select value={filters.cardId} onValueChange={(value) => handleFilterChange('cardId', value)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {(fetchedCards ?? []).map((card) => (
                    <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="EXPENSE">Despesas</SelectItem>
                  <SelectItem value="INCOME">Receitas</SelectItem>
                  <SelectItem value="TRANSFER">Transferências</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {transactions.length > 0 ? (
            <div>
              <div className="hidden md:grid grid-cols-[1.7fr_1.1fr_0.9fr_1fr_1.1fr_1fr_1fr_48px] gap-3 px-4 py-3 text-sm font-medium text-muted-foreground border-b">
                <div>Descrição</div>
                <div>Categoria</div>
                <div>Data</div>
                <div>Forma</div>
                <div>Conta/Cartão</div>
                <div className="text-right">Valor</div>
                <div className="text-right">Tipo</div>
                <div></div>
              </div>

              {transactions.map((transaction) => (
                <div key={transaction.id}>
                  <div className="flex items-start justify-between gap-3 border-b px-4 py-3 md:hidden">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{transaction.description}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {transaction.category && (
                          <span className="flex items-center gap-1.5">
                            {transaction.category.color && (
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: transaction.category.color }} />
                            )}
                            {transaction.category.name}
                          </span>
                        )}
                        <span>{formatDate(transaction.date)}</span>
                        <span>{paymentMethodLabels[transaction.paymentMethod] || transaction.paymentMethod}</span>
                        {transaction.account?.name && <span>{transaction.account.name}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <p className={cn('font-semibold', getTransactionTypeColor(transaction.type))}>{formatMoney(transaction.amount.cents)}</p>
                      <span className="text-xs text-muted-foreground">{transactionTypeLabels[transaction.type]}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(transaction.id)} aria-label="Excluir transação">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <div className="hidden md:grid grid-cols-[1.7fr_1.1fr_0.9fr_1fr_1.1fr_1fr_1fr_48px] gap-3 px-4 py-3 border-b hover:bg-accent/50 items-center">
                    <div className="font-medium truncate">{transaction.description}</div>
                    <div className="truncate">
                      {transaction.category && (
                        <span className="flex items-center gap-1.5">
                          {transaction.category.color && (
                            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: transaction.category.color }} />
                          )}
                          <span className="truncate">{transaction.category.name}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(transaction.date)}</div>
                    <div className="text-sm text-muted-foreground whitespace-nowrap">{paymentMethodLabels[transaction.paymentMethod] || transaction.paymentMethod}</div>
                    <div className="text-sm text-muted-foreground truncate">{transaction.account?.name || transaction.card?.name || '-'}</div>
                    <div className={cn('text-right font-medium whitespace-nowrap', getTransactionTypeColor(transaction.type))}>{formatMoney(transaction.amount.cents)}</div>
                    <div className="text-right">
                      <span className={cn('inline-block px-2 py-0.5 text-xs rounded-full', getTransactionTypeColor(transaction.type))}>
                        {transactionTypeLabels[transaction.type]}
                      </span>
                    </div>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(transaction.id)} aria-label="Excluir transação">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Nenhuma transação encontrada</p>
              <Button onClick={() => setDialogOpen(true)} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Nova Transação
              </Button>
            </div>
          )}

          {meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Mostrando {((meta.page - 1) * meta.limit) + 1} a {Math.min(meta.page * meta.limit, meta.total)} de {meta.total}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))} disabled={meta.page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))} disabled={meta.page === meta.totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir transação?"
        description="Essa ação removerá permanentemente a transação e revertirá seus efeitos no saldo. Essa ação não pode ser desfeita."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}