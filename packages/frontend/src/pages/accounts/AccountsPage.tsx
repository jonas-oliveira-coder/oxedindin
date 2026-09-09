import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toast } from '@/components/ui/use-toast';
import { toast } from '@/components/ui/use-toast';
import { formatMoney, getAccountTypeLabel } from '@/lib/utils';
import { Plus, Edit, Trash2, Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAccountSchema, updateAccountSchema, type CreateAccountInput, type UpdateAccountInput } from '@/lib/validation';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);

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
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAccountInput }) => updateAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Conta atualizada', description: 'Conta bancária atualizada com sucesso.' });
      setEditingAccount(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: 'Conta desativada', description: 'Conta bancária desativada com sucesso.' });
      setDeleteDialogOpen(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const createForm = useForm<CreateAccountInput>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: {
      type: 'CHECKING',
      initialBalance: 0,
    },
  });

  const updateForm = useForm<UpdateAccountInput>({
    resolver: zodResolver(updateAccountSchema),
  });

  const handleCreateSubmit = (data: CreateAccountInput) => {
    createMutation.mutate(data);
    createForm.reset({ type: 'CHECKING', initialBalance: 0 });
  };

  const handleUpdateSubmit = (data: UpdateAccountInput) => {
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data });
    }
  };

  const handleDelete = (id: string) => {
    setDeleteDialogOpen(id);
  };

  const handleConfirmDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const openCreateDialog = () => {
    setEditingAccount(null);
    createForm.reset({ type: 'CHECKING', initialBalance: 0 });
    setDialogOpen(true);
  };

  const openEditDialog = (account: BankAccount) => {
    setEditingAccount(account);
    updateForm.reset({
      name: account.name,
      institution: account.institution,
      type: account.type,
      number: account.number,
      agency: account.agency,
      status: account.status,
      notes: account.notes,
    });
    setDialogOpen(true);
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
            <form onSubmit={editingAccount ? updateForm.handleSubmit(handleUpdateSubmit) : createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da conta</Label>
                <Input id="name" {...(editingAccount ? updateForm.register('name') : createForm.register('name'))} placeholder="Minha Conta" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="institution">Instituição</Label>
                <Input id="institution" {...(editingAccount ? updateForm.register('institution') : createForm.register('institution'))} placeholder="Banco do Brasil" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select {...(editingAccount ? updateForm.register('type') : createForm.register('type'))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CHECKING">Conta Corrente</SelectItem>
                    <SelectItem value="SAVINGS">Poupança</SelectItem>
                    <SelectItem value="DIGITAL">Digital</SelectItem>
                    <SelectItem value="SALARY">Salário</SelectItem>
                    <SelectItem value="OTHER">Outra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="number">Número</Label>
                  <Input id="number" {...(editingAccount ? updateForm.register('number') : createForm.register('number'))} placeholder="12345-6" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agency">Agência</Label>
                  <Input id="agency" {...(editingAccount ? updateForm.register('agency') : createForm.register('agency'))} placeholder="1234" />
                </div>
              </div>
              {!editingAccount && (
                <div className="space-y-2">
                  <Label htmlFor="initialBalance">Saldo inicial</Label>
                  <Input id="initialBalance" type="number" step="0.01" {...createForm.register('initialBalance', { valueAsNumber: true })} placeholder="0,00" />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Input id="notes" {...(editingAccount ? updateForm.register('notes') : createForm.register('notes'))} placeholder="Observações opcionais" />
              </div>
              {editingAccount && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select {...updateForm.register('status')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Ativa</SelectItem>
                      <SelectItem value="INACTIVE">Inativa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="2" y="3" width="20" height="14" rx="2" />
                        <path d="M8 21h8" />
                        <path d="M12 17v4" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">{account.name}</h3>
                        <span className={cn('px-2 py-0.5 text-xs rounded-full', account.status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
                          {account.status === 'ACTIVE' ? 'Ativa' : 'Inativa'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{account.institution} • {getAccountTypeLabel(account.type)}</p>
                      {account.number && <p className="text-sm text-muted-foreground">Conta: {account.number} • Ag: {account.agency}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-2xl font-bold">{formatMoney(account.balance.cents)}</p>
                      <p className="text-sm text-muted-foreground">Saldo inicial: {formatMoney(account.initialBalance.cents)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(account)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(account.id)}>
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
            <svg className="mx-auto h-12 w-12 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8" />
              <path d="M12 17v4" />
            </svg>
            <h3 className="mt-4 text-lg font-medium">Nenhuma conta cadastrada</h3>
            <p className="mt-2 text-muted-foreground">Adicione sua primeira conta bancária para começar</p>
            <Button onClick={openCreateDialog} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Conta
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!isDeleteDialogOpen} onOpenChange={(open) => !open && setDeleteDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar conta?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação desativará a conta. Você poderá reativá-la depois nas configurações.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => isDeleteDialogOpen && handleConfirmDelete(isDeleteDialogOpen)}>
              Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}