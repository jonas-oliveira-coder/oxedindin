import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { formatMoney, formatDate, getTransactionTypeColor } from '@/lib/utils';
import { Plus, Trash2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createTransactionSchema, type CreateTransactionInput } from '@/lib/validation';
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

async function fetchTransactions(params?: { page?: number; limit?: number; startDate?: string; endDate?: string; categoryId?: string; accountId?: string; cardId?: string; type?: string }): Promise<{ data: Transaction[]; meta: any }> {
  const response = await api.get('/transactions', { params });
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

export function TransactionsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
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

  const { data: fetchedCategories } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const { data: fetchedAccounts } = useQuery({
    queryKey: ['accounts', 'active'],
    queryFn: fetchAccounts,
  });

  const { data: fetchedCards } = useQuery({
    queryKey: ['cards', 'active'],
    queryFn: fetchCards,
  });

  const createMutation = useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Transação criada', description: 'Transação registrada com sucesso.' });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Transação excluída', description: 'Transação removida com sucesso.' });
      setDeleteDialogOpen(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const form = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      type: 'EXPENSE',
      paymentMethod: 'CREDIT_CARD',
      date: new Date().toISOString(),
    },
  });

  const handleSubmit = (data: CreateTransactionInput) => {
    createMutation.mutate(data);
    form.reset({ type: 'EXPENSE', paymentMethod: 'CREDIT_CARD', date: new Date().toISOString() });
  };

  const handleDelete = (id: string) => {
    setDeleteDialogOpen(id);
  };

  const handleConfirmDelete = (id: string) => {
    deleteMutation.mutate(id);
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
      <div className="flex items-center justify-between">
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
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Input id="description" {...form.register('description')} placeholder="Supermercado, Uber, Salário..." />
              </div>
              <div className="grid gap-2 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor</Label>
                  <Input id="amount" type="number" step="0.01" min="0.01" {...form.register('amount', { valueAsNumber: true })} placeholder="0,00" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select {...form.register('type')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EXPENSE">Despesa</SelectItem>
                      <SelectItem value="INCOME">Receita</SelectItem>
                      <SelectItem value="TRANSFER">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryId">Categoria</Label>
                <Select {...form.register('categoryId')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem categoria</SelectItem>
                    {(fetchedCategories ?? []).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          {cat.color && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color }} />}
                          {cat.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date">Data</Label>
                  <Input id="date" type="date" {...form.register('date')} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paymentMethod">Forma de pagamento</Label>
                  <Select {...form.register('paymentMethod')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CASH">Dinheiro</SelectItem>
                      <SelectItem value="DEBIT_CARD">Débito</SelectItem>
                      <SelectItem value="CREDIT_CARD">Crédito</SelectItem>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="BANK_TRANSFER">Transferência</SelectItem>
                      <SelectItem value="BOLETO">Boleto</SelectItem>
                      <SelectItem value="OTHER">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="accountId">Conta (opcional)</Label>
                  <Select {...form.register('accountId')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {(fetchedAccounts ?? []).map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cardId">Cartão (opcional)</Label>
                  <Select {...form.register('cardId')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {(fetchedCards ?? []).map((card) => (
                        <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Input id="notes" {...form.register('notes')} placeholder="Observações opcionais" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Salvar
                </Button>
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
              <Label htmlFor="categoryId">Categoria</Label>
              <Select value={filters.categoryId} onValueChange={(value) => handleFilterChange('categoryId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {(fetchedCategories ?? []).map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountId">Conta</Label>
              <Select value={filters.accountId} onValueChange={(value) => handleFilterChange('accountId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {(fetchedAccounts ?? []).map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cardId">Cartão</Label>
              <Select value={filters.cardId} onValueChange={(value) => handleFilterChange('cardId', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  {(fetchedCards ?? []).map((card) => (
                    <SelectItem key={card.id} value={card.id}>{card.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select value={filters.type} onValueChange={(value) => handleFilterChange('type', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
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
            <div className="space-y-0">
              <div className="hidden md:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] gap-4 px-4 py-3 text-sm font-medium text-muted-foreground border-b">
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
                <div key={transaction.id} className="md:grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_1fr_80px] gap-4 px-4 py-3 border-b last:border-0 hover:bg-accent/50 items-center">
                  <div className="font-medium">{transaction.description}</div>
                  <div>
                    {transaction.category && (
                      <span className="flex items-center gap-1">
                        {transaction.category.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: transaction.category.color }} />}
                        {transaction.category.name}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">{formatDate(transaction.date)}</div>
                  <div className="text-sm text-muted-foreground">{transaction.paymentMethod}</div>
                  <div className="text-sm text-muted-foreground">
                    {transaction.account?.name || transaction.card?.name || '-'}
                  </div>
                  <div className="text-right font-medium">{formatMoney(transaction.amount.cents)}</div>
                  <div className="text-right">
                    <span className={cn('px-2 py-0.5 text-xs rounded-full', getTransactionTypeColor(transaction.type))}>
                      {transaction.type === 'EXPENSE' ? 'Despesa' : transaction.type === 'INCOME' ? 'Receita' : 'Transferência'}
                    </span>
                  </div>
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(transaction.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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

      <Dialog open={!!deleteDialogOpen} onOpenChange={(open) => !open && setDeleteDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir transação?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteDialogOpen && handleConfirmDelete(deleteDialogOpen)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}