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
import { formatMoney } from '@/lib/utils';
import { Plus, Edit, Trash2, User, Building2, Mail, Phone, FileText, Share2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { personTypeSchema, type CreatePersonInput } from '@/lib/validation';
import { nameSchema, emailSchema, phoneSchema, documentSchema, positiveMoneyCentsSchema, formatPhone } from '@oxedindin/shared';
import { FormField, TextInput, EmailInput, PhoneInput, CpfInput, CnpjInput, Textarea, FormSelect, CurrencyInput, DateInput } from '@/components/forms';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';

interface Person {
  id: string;
  name: string;
  email?: string | null;
  type: string;
  phone?: string | null;
  document?: string | null;
  notes?: string | null;
}

interface IdLabel {
  id: string;
  label: string;
}

const debtTypeEnum = z.enum(['PERSONAL_LOAN', 'CREDIT_CARD', 'PURCHASE', 'BORROWED_MONEY', 'OTHER']);

const debtLinkKindEnum = z.enum(['', 'RESPONSIBLE_PAID', 'RESPONSIBLE_OWED', 'SPLIT']);

const amountOptionalSchema = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  positiveMoneyCentsSchema.optional(),
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

const personFormSchema = z.object({
  name: nameSchema,
  email: emailSchema.optional().or(z.literal('')),
  type: personTypeSchema.default('INDIVIDUAL'),
  phone: phoneSchema.optional().or(z.literal('')),
  document: documentSchema.optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  debtLinkKind: debtLinkKindEnum.default(''),
  debtDescription: z.string().max(200).optional().or(z.literal('')),
  debtTotalAmount: amountOptionalSchema,
  debtDueDate: z.string().optional().or(z.literal('')),
  debtType: debtTypeEnum.optional(),
  splitDebtId: z.string().optional().or(z.literal('')),
  splitAmount: amountOptionalSchema,
});

const linkFormSchema = z.object({
  debtLinkKind: debtLinkKindEnum.default('RESPONSIBLE_PAID'),
  debtDescription: z.string().max(200).optional().or(z.literal('')),
  debtTotalAmount: amountOptionalSchema,
  debtDueDate: z.string().optional().or(z.literal('')),
  debtType: debtTypeEnum.optional(),
  splitDebtId: z.string().optional().or(z.literal('')),
  splitAmount: amountOptionalSchema,
});

type PersonFormValues = z.infer<typeof personFormSchema>;
type LinkFormValues = z.infer<typeof linkFormSchema>;

const personFormDefaults = {
  name: '',
  type: 'INDIVIDUAL',
  email: '',
  phone: '',
  document: '',
  notes: '',
  debtLinkKind: '',
  debtDescription: '',
  debtTotalAmount: undefined,
  debtDueDate: '',
  debtType: 'PERSONAL_LOAN',
  splitDebtId: '',
  splitAmount: undefined,
} satisfies PersonFormValues;

const linkFormDefaults = {
  debtLinkKind: 'RESPONSIBLE_PAID',
  debtDescription: '',
  debtTotalAmount: undefined,
  debtDueDate: '',
  debtType: 'PERSONAL_LOAN',
  splitDebtId: '',
  splitAmount: undefined,
} satisfies LinkFormValues;

async function fetchPeople(): Promise<Person[]> {
  const response = await api.get('/people');
  return response.data.data;
}

async function fetchDebtOptions(): Promise<IdLabel[]> {
  const [debts, owed] = await Promise.all([
    api.get('/debts'),
    api.get('/debts/owed'),
  ]);
  const items: IdLabel[] = [];
  for (const d of debts.data.data ?? []) {
    items.push({ id: d.id, label: `A pagar: ${d.description} (${formatMoney(d.remainingAmount.cents)})` });
  }
  for (const d of owed.data.data ?? []) {
    items.push({ id: d.id, label: `A receber: ${d.description} (${formatMoney(d.remainingAmount.cents)})` });
  }
  return items;
}

function personPayload(values: PersonFormValues): CreatePersonInput {
  return {
    name: values.name,
    email: values.email || undefined,
    type: values.type,
    phone: values.phone || undefined,
    document: values.document || undefined,
    notes: values.notes || undefined,
  };
}

export function PeoplePage() {
  const queryClient = useQueryClient();
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState<Person | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: people, isLoading } = useQuery({ queryKey: ['people'], queryFn: fetchPeople });
  const { data: debtOptions = [] } = useQuery({ queryKey: ['debtOptions'], queryFn: fetchDebtOptions });

  const createMutation = useMutation({
    mutationFn: async (values: PersonFormValues) => {
      const created = await api.post('/people', personPayload(values));
      const personId = created.data.id;
      const kind = values.debtLinkKind;
      if (kind === 'RESPONSIBLE_PAID') {
        await api.post('/debts', {
          description: values.debtDescription,
          totalAmount: values.debtTotalAmount,
          dueDate: values.debtDueDate,
          type: values.debtType,
          relatedPersonId: personId,
        });
      } else if (kind === 'RESPONSIBLE_OWED') {
        await api.post('/debts/owed', {
          description: values.debtDescription,
          totalAmount: values.debtTotalAmount,
          dueDate: values.debtDueDate ? new Date(values.debtDueDate).toISOString() : undefined,
          type: values.debtType,
          personId,
        });
      } else if (kind === 'SPLIT' && values.splitDebtId) {
        await api.post(`/debts/${values.splitDebtId}/splits`, {
          personId,
          amountCents: values.splitAmount,
        });
      }
      return personId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['debtsOwed'] });
      queryClient.invalidateQueries({ queryKey: ['debtOptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Pessoa criada', description: 'Pessoa cadastrada com sucesso.' });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePersonInput> }) => api.patch(`/people/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast({ title: 'Pessoa atualizada', description: 'Pessoa atualizada com sucesso.' });
      setEditingPerson(null);
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const linkMutation = useMutation({
    mutationFn: async ({ person, values }: { person: Person; values: LinkFormValues }) => {
      const kind = values.debtLinkKind;
      if (kind === 'RESPONSIBLE_PAID') {
        await api.post('/debts', {
          description: values.debtDescription,
          totalAmount: values.debtTotalAmount,
          dueDate: values.debtDueDate,
          type: values.debtType,
          relatedPersonId: person.id,
        });
      } else if (kind === 'RESPONSIBLE_OWED') {
        await api.post('/debts/owed', {
          description: values.debtDescription,
          totalAmount: values.debtTotalAmount,
          dueDate: values.debtDueDate ? new Date(values.debtDueDate).toISOString() : undefined,
          type: values.debtType,
          personId: person.id,
        });
      } else if (kind === 'SPLIT' && values.splitDebtId) {
        await api.post(`/debts/${values.splitDebtId}/splits`, {
          personId: person.id,
          amountCents: values.splitAmount,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['debtsOwed'] });
      queryClient.invalidateQueries({ queryKey: ['debtOptions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Dívida vinculada', description: 'Pessoa vinculada à dívida com sucesso.' });
      setLinkTarget(null);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/people/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast({ title: 'Pessoa excluída', description: 'Pessoa excluída com sucesso.' });
      setDeleteId(null);
    },
    onError: (error) => toast({ title: 'Não foi possível excluir', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personFormSchema),
    defaultValues: personFormDefaults,
  });

  const linkForm = useForm<LinkFormValues>({
    resolver: zodResolver(linkFormSchema),
    defaultValues: linkFormDefaults,
  });

  const personType = form.watch('type');
  const debtLinkKind = form.watch('debtLinkKind');
  const linkKind = linkForm.watch('debtLinkKind');

  const openCreateDialog = () => {
    setEditingPerson(null);
    form.reset(personFormDefaults);
    setDialogOpen(true);
  };

  const openEditDialog = (person: Person) => {
    setEditingPerson(person);
    form.reset({
      ...personFormDefaults,
      name: person.name,
      email: person.email ?? '',
      type: person.type as PersonFormValues['type'],
      phone: person.phone ?? '',
      document: person.document ?? '',
      notes: person.notes ?? '',
    });
    setDialogOpen(true);
  };

  const openLinkDialog = (person: Person) => {
    setLinkTarget(person);
    linkForm.reset(linkFormDefaults);
  };

  const onSubmit = (values: PersonFormValues) => {
    if (editingPerson) {
      updateMutation.mutate({ id: editingPerson.id, data: personPayload(values) });
    } else {
      createMutation.mutate(values);
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
          <h1 className="text-3xl font-bold tracking-tight">Pessoas</h1>
          <p className="text-muted-foreground">Gerencie pessoas para dívidas compartilhadas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Pessoa
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingPerson ? 'Editar Pessoa' : 'Nova Pessoa'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField id="name" label="Nome" error={form.formState.errors.name?.message}>
                <TextInput id="name" placeholder="Maria Silva" {...form.register('name')} />
              </FormField>

              <div className="grid gap-2 grid-cols-2">
                <FormField id="type" label="Tipo" error={form.formState.errors.type?.message}>
                  <FormSelect control={form.control} name="type" placeholder="Selecione">
                    <SelectItem value="INDIVIDUAL">Pessoa Física</SelectItem>
                    <SelectItem value="COMPANY">Empresa</SelectItem>
                  </FormSelect>
                </FormField>
                <FormField id="email" label="Email" error={form.formState.errors.email?.message}>
                  <EmailInput id="email" placeholder="mail@exemplo.com" {...form.register('email')} />
                </FormField>
              </div>

              <div className="grid gap-2 grid-cols-2">
                <FormField id="phone" label="Telefone" error={form.formState.errors.phone?.message}>
                  <Controller
                    name="phone"
                    control={form.control}
                    render={({ field }) => (
                      <PhoneInput id="phone" placeholder="(11) 99999-9999" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                    )}
                  />
                </FormField>
                <FormField
                  id="document"
                  label={personType === 'COMPANY' ? 'CNPJ' : 'CPF'}
                  error={form.formState.errors.document?.message}
                >
                  <Controller
                    name="document"
                    control={form.control}
                    render={({ field }) =>
                      personType === 'COMPANY' ? (
                        <CnpjInput key="cnpj" id="document" placeholder="00.000.000/0000-00" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                      ) : (
                        <CpfInput key="cpf" id="document" placeholder="000.000.000-00" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                      )
                    }
                  />
                </FormField>
              </div>

              <FormField id="notes" label="Observações" error={form.formState.errors.notes?.message}>
                <Textarea id="notes" placeholder="Observações opcionais" {...form.register('notes')} />
              </FormField>

              {!editingPerson && (
                <div className="space-y-4 rounded-lg border p-3">
                  <FormField id="debtLinkKind" label="Vincular a uma dívida?">
                    <FormSelect control={form.control} name="debtLinkKind" placeholder="Selecione">
                      <SelectItem value="">Não, apenas cadastrar</SelectItem>
                      <SelectItem value="RESPONSIBLE_PAID">Responsável por dívida que eu pago</SelectItem>
                      <SelectItem value="RESPONSIBLE_OWED">Responsável por dívida que ela me paga</SelectItem>
                      <SelectItem value="SPLIT">Dividir valor de uma dívida</SelectItem>
                    </FormSelect>
                  </FormField>

                  <DebtLinkFields form={form} kind={debtLinkKind} debtOptions={debtOptions} />
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                  {editingPerson ? 'Salvar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {people && people.length > 0 ? (
        <div className="space-y-3">
          {people.map((person) => (
            <Card key={person.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      {person.type === 'COMPANY' ? <Building2 className="h-5 w-5 text-primary" /> : <User className="h-5 w-5 text-primary" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{person.name}</h3>
                        <Badge variant="secondary">{person.type === 'COMPANY' ? 'Empresa' : 'Pessoa Física'}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        {person.email && (
                          <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{person.email}</span>
                        )}
                        {person.phone && (
                          <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{formatPhone(person.phone)}</span>
                        )}
                        {person.document && (
                          <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{person.document}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openLinkDialog(person)} aria-label="Vincular a dívida" title="Vincular a dívida">
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(person)} aria-label="Editar pessoa">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(person.id)} aria-label="Excluir pessoa">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <User className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Nenhuma pessoa cadastrada</h3>
            <p className="mt-2 text-muted-foreground">Registre pessoas para compartilhar dívidas</p>
            <Button onClick={openCreateDialog} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar Pessoa
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!linkTarget} onOpenChange={(open) => !open && setLinkTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular {linkTarget?.name} a uma dívida</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={linkForm.handleSubmit((data) => linkTarget && linkMutation.mutate({ person: linkTarget, values: data }))}
            className="space-y-4"
            noValidate
          >
            <FormField id="link-debtLinkKind" label="Tipo de vínculo">
              <FormSelect control={linkForm.control} name="debtLinkKind" placeholder="Selecione">
                <SelectItem value="RESPONSIBLE_PAID">Responsável por dívida que eu pago</SelectItem>
                <SelectItem value="RESPONSIBLE_OWED">Responsável por dívida que ela me paga</SelectItem>
                <SelectItem value="SPLIT">Dividir valor de uma dívida</SelectItem>
              </FormSelect>
            </FormField>

            <DebtLinkFields form={linkForm} kind={linkKind} debtOptions={debtOptions} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setLinkTarget(null)}>Cancelar</Button>
              <Button type="submit" loading={linkMutation.isPending}>Vincular</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir pessoa?"
        description="Essa ação removerá permanentemente a pessoa. Pessoas com dívidas vinculadas não podem ser excluídas."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}

function DebtLinkFields({ form, kind, debtOptions }: { form: any; kind: string; debtOptions: IdLabel[] }) {
  const errors = form.formState.errors;

  if (kind === 'RESPONSIBLE_PAID' || kind === 'RESPONSIBLE_OWED') {
    return (
      <>
        <FormField id="debtDescription" label="Descrição da dívida" error={errors.debtDescription?.message}>
          <TextInput id="debtDescription" placeholder="Ex: empréstimo pessoal" {...form.register('debtDescription')} />
        </FormField>
        <div className="grid gap-2 grid-cols-2">
          <FormField id="debtTotalAmount" label="Valor total" error={errors.debtTotalAmount?.message}>
            <Controller
              name="debtTotalAmount"
              control={form.control}
              render={({ field }) => <CurrencyInput id="debtTotalAmount" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
            />
          </FormField>
          <FormField id="debtDueDate" label="Vencimento" error={errors.debtDueDate?.message}>
            <DateInput id="debtDueDate" {...form.register('debtDueDate')} />
          </FormField>
        </div>
        <FormField id="debtType" label="Tipo" error={errors.debtType?.message}>
          <FormSelect control={form.control} name="debtType" placeholder="Selecione">
            {debtTypeItems}
          </FormSelect>
        </FormField>
      </>
    );
  }

  if (kind === 'SPLIT') {
    return (
      <>
        <FormField id="splitDebtId" label="Dívida" error={errors.splitDebtId?.message}>
          <FormSelect control={form.control} name="splitDebtId" placeholder="Selecione a dívida">
            {debtOptions.map((d) => (
              <SelectItem key={d.id} value={d.id}>{d.label}</SelectItem>
            ))}
          </FormSelect>
        </FormField>
        <FormField id="splitAmount" label="Valor da parte da pessoa" error={errors.splitAmount?.message}>
          <Controller
            name="splitAmount"
            control={form.control}
            render={({ field }) => <CurrencyInput id="splitAmount" value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
          />
        </FormField>
      </>
    );
  }

  return null;
}