import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { SelectItem } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { formatMoney, getCardBrandLabel, cn } from '@/lib/utils';
import { Plus, Edit, Trash2, CreditCard as CreditCardIcon } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { cardBrandSchema, cardStatusSchema, type CreateCardInput, type UpdateCardInput } from '@/lib/validation';
import { nameSchema, positiveMoneyCentsSchema, uuidSchema } from '@oxedindin/shared';
import { FormField, TextInput, CurrencyInput, NumberInput, Textarea, FormSelect } from '@/components/forms';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';

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

const last4Schema = z.string().regex(/^\d{4}$/, 'Informe os 4 últimos dígitos do cartão.');

const cardFormSchema = z.object({
  name: nameSchema,
  institution: z.string().trim().min(1, 'Informe a instituição.').max(100),
  brand: cardBrandSchema,
  last4: last4Schema,
  limit: positiveMoneyCentsSchema,
  closingDay: z.number({ invalid_type_error: 'Informe o dia de fechamento.' }).int('Dia de fechamento inválido.').min(1).max(31),
  dueDay: z.number({ invalid_type_error: 'Informe o dia de vencimento.' }).int('Dia de vencimento inválido.').min(1).max(31),
  accountId: uuidSchema.optional().or(z.literal('')),
  status: cardStatusSchema.default('ACTIVE'),
  notes: z.string().max(500).optional().default(''),
});

type CardFormValues = z.infer<typeof cardFormSchema>;

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
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: cards, isLoading } = useQuery({ queryKey: ['cards'], queryFn: fetchCards });
  const { data: fetchedAccounts } = useQuery({ queryKey: ['accounts', 'active'], queryFn: fetchAccounts });

  const createMutation = useMutation({
    mutationFn: createCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast({ title: 'Cartão criado', description: 'Cartão de crédito criado com sucesso.' });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCardInput }) => updateCard(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast({ title: 'Cartão atualizado', description: 'Cartão de crédito atualizado com sucesso.' });
      setEditingCard(null);
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCard,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      toast({ title: 'Cartão excluído', description: 'Cartão de crédito excluído com sucesso.' });
      setDeleteId(null);
    },
    onError: (error) => toast({ title: 'Não foi possível excluir', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const form = useForm<CardFormValues>({
    resolver: zodResolver(cardFormSchema),
    defaultValues: { brand: 'VISA', closingDay: 15, dueDay: 25, status: 'ACTIVE', accountId: '', notes: '' },
  });

  const openCreateDialog = () => {
    setEditingCard(null);
    form.reset({ brand: 'VISA', closingDay: 15, dueDay: 25, status: 'ACTIVE', accountId: '', notes: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (card: CreditCard) => {
    setEditingCard(card);
    form.reset({
      name: card.name,
      institution: card.institution,
      brand: card.brand as CardFormValues['brand'],
      last4: card.last4,
      limit: card.limit.cents,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      accountId: card.account?.id ?? '',
      status: card.status as CardFormValues['status'],
      notes: card.notes ?? '',
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: CardFormValues) => {
    const base = {
      name: values.name,
      institution: values.institution,
      brand: values.brand,
      last4: values.last4,
      limit: values.limit,
      closingDay: values.closingDay,
      dueDay: values.dueDay,
      accountId: values.accountId || undefined,
      notes: values.notes || undefined,
    };
    if (editingCard) {
      updateMutation.mutate({ id: editingCard.id, data: { ...base, status: values.status } as UpdateCardInput });
    } else {
      createMutation.mutate(base as CreateCardInput);
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField id="name" label="Nome/Apelido" error={form.formState.errors.name?.message}>
                <TextInput id="name" placeholder="Meu Cartão" {...form.register('name')} />
              </FormField>

              <FormField id="institution" label="Banco/Instituição" error={form.formState.errors.institution?.message}>
                <TextInput id="institution" placeholder="Nubank, Itaú, etc." {...form.register('institution')} />
              </FormField>

              <div className="grid gap-2 grid-cols-2">
                <FormField id="brand" label="Bandeira" error={form.formState.errors.brand?.message}>
                  <FormSelect control={form.control} name="brand" placeholder="Selecione">
                    <SelectItem value="VISA">Visa</SelectItem>
                    <SelectItem value="MASTERCARD">Mastercard</SelectItem>
                    <SelectItem value="AMEX">American Express</SelectItem>
                    <SelectItem value="ELO">Elo</SelectItem>
                    <SelectItem value="HIPERCARD">Hipercard</SelectItem>
                    <SelectItem value="OTHER">Outra</SelectItem>
                  </FormSelect>
                </FormField>
                <FormField id="last4" label="Últimos 4 dígitos" error={form.formState.errors.last4?.message}>
                  <TextInput id="last4" placeholder="1234" maxLength={4} inputMode="numeric" {...form.register('last4')} />
                </FormField>
              </div>

              <FormField id="limit" label="Limite total" error={form.formState.errors.limit?.message}>
                <Controller
                  name="limit"
                  control={form.control}
                  render={({ field }) => (
                    <CurrencyInput id="limit" value={field.value} onChange={field.onChange} onBlur={field.onBlur} placeholder="R$ 5.000,00" />
                  )}
                />
              </FormField>

              <div className="grid gap-2 grid-cols-2">
                <FormField id="closingDay" label="Dia do fechamento" error={form.formState.errors.closingDay?.message}>
                  <NumberInput id="closingDay" min={1} max={31} placeholder="15" {...form.register('closingDay', { valueAsNumber: true })} />
                </FormField>
                <FormField id="dueDay" label="Dia do vencimento" error={form.formState.errors.dueDay?.message}>
                  <NumberInput id="dueDay" min={1} max={31} placeholder="25" {...form.register('dueDay', { valueAsNumber: true })} />
                </FormField>
              </div>

              <FormField id="accountId" label="Conta vinculada (opcional)" error={form.formState.errors.accountId?.message}>
                <FormSelect control={form.control} name="accountId" placeholder="Selecione uma conta (opcional)">
                  <SelectItem value="">Nenhuma</SelectItem>
                  {(fetchedAccounts ?? []).map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                  ))}
                </FormSelect>
              </FormField>

              <FormField id="notes" label="Observações" error={form.formState.errors.notes?.message}>
                <Textarea id="notes" placeholder="Observações opcionais" {...form.register('notes')} />
              </FormField>

              {editingCard && (
                <FormField id="status" label="Status" error={form.formState.errors.status?.message}>
                  <FormSelect control={form.control} name="status" placeholder="Selecione o status">
                    <SelectItem value="ACTIVE">Ativo</SelectItem>
                    <SelectItem value="INACTIVE">Inativo</SelectItem>
                  </FormSelect>
                </FormField>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
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
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(card)} aria-label="Editar cartão">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(card.id)} aria-label="Excluir cartão">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
                <Separator className="my-4" />
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Limite usado</div>
                  <div className="flex-1 mx-4 h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${(Number(card.limit.cents) === 0 ? 0 : ((Number(card.limit.cents) - Number(card.availableLimit.cents)) / Number(card.limit.cents)) * 100)}%` }}
                    />
                  </div>
                  <div className="text-sm font-medium w-24 text-right">
                    {(Number(card.limit.cents) === 0 ? 0 : ((Number(card.limit.cents) - Number(card.availableLimit.cents)) / Number(card.limit.cents)) * 100).toFixed(1)}%
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

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir cartão?"
        description="Essa ação removerá permanentemente o cartão. Cartões com faturas, parcelas ou transações vinculadas não podem ser excluídos."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}