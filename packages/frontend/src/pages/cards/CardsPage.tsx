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
import { formatMoney, getCardBrandLabel } from '@/lib/utils';
import { Plus, Edit, Trash2, Loader2, CreditCard as CreditCardIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCardSchema, updateCardSchema, type CreateCardInput, type UpdateCardInput } from '@/lib/validation';
import { Separator } from '@/components/ui/separator';

interface CreditCard {
  id: string;
  name: string;
  institution: string;
  brand: string;
  last4: string;
  limit: { cents: number; currency: string };
  availableLimit: { cents: number; currency: string };
  closingDay: number;
  dueDay: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  account?: { id: string; name: string } | null;
}

async function fetchCards(): Promise<CreditCard[]> {
  const response = await api.get('/cards');
  return response.data.data;
}

async function fetchAccounts(): Promise<Array<{ id: string; name: string }>> {
  const response = await api.get('/accounts');
  return response.data.data.filter((a: any) => a.status === 'ACTIVE');
}

async function createCard(data: CreateCardInput): Promise<CreditCard> {
  const response = await api.post('/cards', data);
  return response.data;
}

async function updateCard(id: string, data: UpdateCardInput): Promise<CreditCard> {
  const response = await api.patch(`/cards/${id}`, data);
  return response.data;
}

async function deleteCard(id: string): Promise<void> {
  await api.delete(`/cards/${id}`);
}

export function CardsPage() {
  const queryClient = useQueryClient();
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string }>>([]);

  const { data: cards, isLoading } = useQuery({
    queryKey: ['cards'],
    queryFn: fetchCards,
  });

  const { data: fetchedAccounts } = useQuery({
    queryKey: ['accounts', 'active'],
    queryFn: fetchAccounts,
  });

  if (fetchedAccounts) {
    setAccounts(fetchedAccounts);
  }

  const createMutation = useMutation({
    mutationFn: createCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast({ title: 'Cartão criado', description: 'Cartão de crédito criado com sucesso.' });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCardInput }) => updateCard(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast({ title: 'Cartão atualizado', description: 'Cartão de crédito atualizado com sucesso.' });
      setEditingCard(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast({ title: 'Cartão desativado', description: 'Cartão de crédito desativado com sucesso.' });
      setDeleteDialogOpen(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    },
  });

  const createForm = useForm<CreateCardInput>({
    resolver: zodResolver(createCardSchema),
    defaultValues: {
      brand: 'VISA',
      closingDay: 15,
      dueDay: 25,
    },
  });

  const updateForm = useForm<UpdateCardInput>({
    resolver: zodResolver(updateCardSchema),
  });

  const handleCreateSubmit = (data: CreateCardInput) => {
    createMutation.mutate(data);
    createForm.reset({ brand: 'VISA', closingDay: 15, dueDay: 25 });
  };

  const handleUpdateSubmit = (data: UpdateCardInput) => {
    if (editingCard) {
      updateMutation.mutate({ id: editingCard.id, data });
    }
  };

  const handleDelete = (id: string) => {
    setDeleteDialogOpen(id);
  };

  const handleConfirmDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const openCreateDialog = () => {
    setEditingCard(null);
    createForm.reset({ brand: 'VISA', closingDay: 15, dueDay: 25 });
    setDialogOpen(true);
  };

  const openEditDialog = (card: CreditCard) => {
    setEditingCard(card);
    updateForm.reset({
      name: card.name,
      institution: card.institution,
      brand: card.brand,
      last4: card.last4,
      limit: card.limit.cents / 100,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      accountId: card.account?.id,
      status: card.status,
      notes: card.notes,
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
          <h1 className="text-3xl font-bold tracking-tight">Cartões de Crédito</h1>
          <p className="text-muted-foreground">Gerencie seus cartões e faturas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cartão
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCard ? 'Editar Cartão' : 'Novo Cartão de Crédito'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={editingCard ? updateForm.handleSubmit(handleUpdateSubmit) : createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome/Apelido</Label>
                <Input id="name" {...(editingCard ? updateForm.register('name') : createForm.register('name'))} placeholder="Meu Cartão" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="institution">Banco/Instituição</Label>
                <Input id="institution" {...(editingCard ? updateForm.register('institution') : createForm.register('institution'))} placeholder="Nubank, Itaú, etc." />
              </div>
              <div className="grid gap-2 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="brand">Bandeira</Label>
                  <Select {...(editingCard ? updateForm.register('brand') : createForm.register('brand'))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VISA">Visa</SelectItem>
                      <SelectItem value="MASTERCARD">Mastercard</SelectItem>
                      <SelectItem value="AMEX">American Express</SelectItem>
                      <SelectItem value="ELO">Elo</SelectItem>
                      <SelectItem value="HIPERCARD">Hipercard</SelectItem>
                      <SelectItem value="OTHER">Outra</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last4">Últimos 4 dígitos</Label>
                  <Input id="last4" {...(editingCard ? updateForm.register('last4') : createForm.register('last4'))} placeholder="1234" maxLength={4} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="limit">Limite total</Label>
                <Input id="limit" type="number" step="0.01" {...(editingCard ? updateForm.register('limit', { valueAsNumber: true }) : createForm.register('limit', { valueAsNumber: true }))} placeholder="5000,00" />
              </div>
              <div className="grid gap-2 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="closingDay">Dia do fechamento</Label>
                  <Input id="closingDay" type="number" min={1} max={31} {...(editingCard ? updateForm.register('closingDay', { valueAsNumber: true }) : createForm.register('closingDay', { valueAsNumber: true }))} placeholder="15" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDay">Dia do vencimento</Label>
                  <Input id="dueDay" type="number" min={1} max={31} {...(editingCard ? updateForm.register('dueDay', { valueAsNumber: true }) : createForm.register('dueDay', { valueAsNumber: true }))} placeholder="25" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountId">Conta vinculada (opcional)</Label>
                <Select {...(editingCard ? updateForm.register('accountId') : createForm.register('accountId'))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma conta (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhuma</SelectItem>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Input id="notes" {...(editingCard ? updateForm.register('notes') : createForm.register('notes'))} placeholder="Observações opcionais" />
              </div>
              {editingCard && (
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select {...updateForm.register('status')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Ativo</SelectItem>
                      <SelectItem value="INACTIVE">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {editingCard ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {cards && cards.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.id} className="relative">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-primary/10">
                      <CreditCardIcon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{card.name}</h3>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">
                          {getCardBrandLabel(card.brand)}
                        </span>
                        <span className={cn('px-2 py-0.5 text-xs rounded-full', card.status === 'ACTIVE' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground')}>
                          {card.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{card.institution} • Final {card.last4}</p>
                      {card.account && <p className="text-sm text-muted-foreground">Conta: {card.account.name}</p>}
                      <p className="text-sm text-muted-foreground">Fechamento: dia {card.closingDay} • Vencimento: dia {card.dueDay}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatMoney(card.availableLimit.cents)}</p>
                      <p className="text-sm text-muted-foreground">Disponível de {formatMoney(card.limit.cents)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(card)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(card.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-muted-foreground">Limite usado</div>
                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${((Number(card.limit.cents) - Number(card.availableLimit.cents)) / Number(card.limit.cents)) * 100}%` }}
                      />
                    </div>
                    <div className="text-sm font-medium w-24 text-right">
                      {(((Number(card.limit.cents) - Number(card.availableLimit.cents)) / Number(card.limit.cents)) * 100).toFixed(1)}%
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
            <CreditCardIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhum cartão cadastrado</h3>
            <p className="mt-2 text-muted-foreground">Adicione seu primeiro cartão de crédito</p>
            <Button onClick={openCreateDialog} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Cartão
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!deleteDialogOpen} onOpenChange={(open) => !open && setDeleteDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar cartão?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação desativará o cartão. Você poderá reativá-lo depois nas configurações.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteDialogOpen && handleConfirmDelete(deleteDialogOpen)}>
              Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}