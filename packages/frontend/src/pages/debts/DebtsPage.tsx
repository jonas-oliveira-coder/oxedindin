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
import { formatMoney, formatDate, getStatusColor, getDebtTypeLabel } from '@/lib/utils';
import { Plus, Loader2, Trash2, Share2, CheckCircle2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

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

const debtFormSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória').max(200),
  totalAmount: z.number().positive('Valor deve ser positivo'),
  dueDate: z.string().min(1, 'Data é obrigatória'),
  type: z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']),
  relatedPersonId: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

const owedFormSchema = debtFormSchema.extend({
  personId: z.string().uuid('Selecione uma pessoa'),
});

const paySchema = z.object({
  amount: z.number().positive(),
});

const shareSchema = z.object({
  email: z.string().email('Email inválido'),
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
  const [shareTarget, setShareTarget] = useState<Debt | null>(null);

  const { data: debts, isLoading } = useQuery({ queryKey: ['debts'], queryFn: fetchDebts });
  const { data: owed } = useQuery({ queryKey: ['debtsOwed'], queryFn: fetchOwed });
  const { data: people } = useQuery({ queryKey: ['people'], queryFn: fetchPeople });

  const debtForm = useForm<DebtFormInput>({
    resolver: zodResolver(debtFormSchema),
    defaultValues: { type: 'PERSONAL_LOAN' },
  });
  const owedForm = useForm<z.infer<typeof owedFormSchema>>({
    resolver: zodResolver(owedFormSchema),
    defaultValues: { type: 'PERSONAL_LOAN' },
  });
  const payForm = useForm<PayFormInput>({ resolver: zodResolver(paySchema) });
  const shareForm = useForm<z.infer<typeof shareSchema>>({ resolver: zodResolver(shareSchema) });

  const createDebtMutation = useMutation({
    mutationFn: async (data: DebtFormInput) => {
      await api.post('/debts', {
        description: data.description,
        totalAmount: Math.round(data.totalAmount * 100),
        dueDate: new Date(`${data.dueDate}T00:00:00.000Z`).toISOString(),
        type: data.type,
        relatedPersonId: data.relatedPersonId,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast({ title: 'Dívida criada', description: 'Dívida registrada com sucesso.' });
      setDebtDialogOpen(false);
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const createOwedMutation = useMutation({
    mutationFn: async (data: z.infer<typeof owedFormSchema>) => {
      await api.post('/debts/owed', {
        description: data.description,
        totalAmount: Math.round(data.totalAmount * 100),
        dueDate: new Date(`${data.dueDate}T00:00:00.000Z`).toISOString(),
        type: data.type,
        personId: data.personId,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debtsOwed'] });
      toast({ title: 'Valor a receber criado', description: 'Valor a receber registrado.' });
      setOwedDialogOpen(false);
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const payMutation = useMutation({
    mutationFn: async ({ id, kind, data }: { id: string; kind: 'debt' | 'owed'; data: PayFormInput }) => {
      const amount = Math.round(data.amount * 100);
      await api.post(`/debts/${kind === 'debt' ? '' : 'owed/'}${id}/pay`, { amount });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['debtsOwed'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Pagamento registrado', description: 'Pagamento registrado com sucesso.' });
      setPayTarget(null);
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const shareMutation = useMutation({
    mutationFn: async ({ id, email }: { id: string; email: string }) => {
      await api.post(`/debts/owed/${id}/share`, { email });
    },
    onSuccess: () => {
      toast({ title: 'Dívida compartilhada', description: 'Compartilhamento solicitado.' });
      setShareTarget(null);
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/debts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      toast({ title: 'Dívida cancelada', description: 'Dívida cancelada.' });
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

  const renderDebt = (debt: Debt, kind: 'debt' | 'owed') => (
    <Card key={debt.id}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
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
          <div className="flex items-center gap-2">
            {debt.remainingAmount.cents > 0 && debt.status !== 'CANCELLED' && (
              <Button size="sm" onClick={() => { setPayTarget({ debt, kind }); payForm.reset({ amount: undefined }); }}>Pagar</Button>
            )}
            {kind === 'owed' && debt.remainingAmount.cents > 0 && (
              <Button variant="outline" size="sm" onClick={() => { setShareTarget(debt); shareForm.reset(); }}>
                <Share2 className="mr-1 h-4 w-4" />
                Compartilhar
              </Button>
            )}
            {kind === 'debt' && debt.status !== 'CANCELLED' && (
              <Button variant="ghost" size="icon" onClick={() => cancelMutation.mutate(debt.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
            {debt.remainingAmount.cents === 0 && <CheckCircle2 className="h-5 w-5 text-success" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
              <form onSubmit={owedForm.handleSubmit((data) => createOwedMutation.mutate(data))} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input id="description" {...owedForm.register('description')} placeholder="Empréstimo para..." />
                </div>
                <div className="grid gap-2 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="totalAmount">Valor total</Label>
                    <Input id="totalAmount" type="number" step="0.01" {...owedForm.register('totalAmount', { valueAsNumber: true })} placeholder="1000,00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Vencimento</Label>
                    <Input id="dueDate" type="date" {...owedForm.register('dueDate')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personId">Pessoa</Label>
                  <Select value={owedForm.watch('personId')} onValueChange={(v) => owedForm.setValue('personId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a pessoa" />
                    </SelectTrigger>
                    <SelectContent>
                      {(people ?? []).map((person) => (
                        <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select value={owedForm.watch('type')} onValueChange={(v) => owedForm.setValue('type', v as DebtFormInput['type'])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERSONAL_LOAN">Empréstimo</SelectItem>
                      <SelectItem value="BORROWED_MONEY">Dinheiro emprestado</SelectItem>
                      <SelectItem value="OTHER">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOwedDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createOwedMutation.isPending}>
                    {createOwedMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Criar
                  </Button>
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
              <form onSubmit={debtForm.handleSubmit((data) => createDebtMutation.mutate(data))} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Input id="description" {...debtForm.register('description')} placeholder="Empréstimo, financiamento..." />
                </div>
                <div className="grid gap-2 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="totalAmount">Valor total</Label>
                    <Input id="totalAmount" type="number" step="0.01" {...debtForm.register('totalAmount', { valueAsNumber: true })} placeholder="1000,00" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Vencimento</Label>
                    <Input id="dueDate" type="date" {...debtForm.register('dueDate')} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select value={debtForm.watch('type')} onValueChange={(v) => debtForm.setValue('type', v as DebtFormInput['type'])}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERSONAL_LOAN">Empréstimo pessoal</SelectItem>
                      <SelectItem value="CREDIT_CARD">Cartão de crédito</SelectItem>
                      <SelectItem value="PURCHASE">Compra</SelectItem>
                      <SelectItem value="BORROWED_MONEY">Dinheiro emprestado</SelectItem>
                      <SelectItem value="OTHER">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relatedPersonId">Pessoa (opcional)</Label>
                  <Select value={debtForm.watch('relatedPersonId')} onValueChange={(v) => debtForm.setValue('relatedPersonId', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(people ?? []).map((person) => (
                        <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDebtDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createDebtMutation.isPending}>
                    {createDebtMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Criar
                  </Button>
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
          <form onSubmit={payForm.handleSubmit((data) => payTarget && payMutation.mutate({ id: payTarget.debt.id, kind: payTarget.kind, data }))} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {payTarget?.debt.description} · Restante {payTarget ? formatMoney(payTarget.debt.remainingAmount.cents) : ''}
            </p>
            <div className="space-y-2">
              <Label htmlFor="amount">Valor do pagamento (R$)</Label>
              <Input id="amount" type="number" step="0.01" min="0.01" {...payForm.register('amount', { valueAsNumber: true })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPayTarget(null)}>Cancelar</Button>
              <Button type="submit" disabled={payMutation.isPending}>
                {payMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Confirmar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!shareTarget} onOpenChange={(open) => !open && setShareTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Compartilhar dívida</DialogTitle>
          </DialogHeader>
          <form onSubmit={shareForm.handleSubmit((data) => shareTarget && shareMutation.mutate({ id: shareTarget.id, email: data.email }))} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email do devedor</Label>
              <Input id="email" type="email" {...shareForm.register('email')} placeholder="devedor@exemplo.com" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShareTarget(null)}>Cancelar</Button>
              <Button type="submit" disabled={shareMutation.isPending}>
                {shareMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Compartilhar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}