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
import { Plus, Edit, Trash2, User, Building2, Mail, Phone, FileText } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { personTypeSchema, type CreatePersonInput } from '@/lib/validation';
import { nameSchema, emailSchema, phoneSchema, documentSchema, formatPhone } from '@oxedindin/shared';
import { FormField, TextInput, EmailInput, PhoneInput, CpfInput, CnpjInput, Textarea, FormSelect } from '@/components/forms';
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

const personFormSchema = z.object({
  name: nameSchema,
  email: emailSchema.optional().or(z.literal('')),
  type: personTypeSchema.default('INDIVIDUAL'),
  phone: phoneSchema.optional().or(z.literal('')),
  document: documentSchema.optional().or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
});

type PersonFormValues = z.infer<typeof personFormSchema>;

async function fetchPeople(): Promise<Person[]> {
  const response = await api.get('/people');
  return response.data.data;
}

async function createPerson(data: CreatePersonInput): Promise<Person> {
  const response = await api.post('/people', data);
  return response.data;
}

async function updatePerson(id: string, data: Partial<CreatePersonInput>): Promise<Person> {
  const response = await api.patch(`/people/${id}`, data);
  return response.data;
}

async function deletePerson(id: string): Promise<void> {
  await api.delete(`/people/${id}`);
}

export function PeoplePage() {
  const queryClient = useQueryClient();
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: people, isLoading } = useQuery({ queryKey: ['people'], queryFn: fetchPeople });

  const createMutation = useMutation({
    mutationFn: createPerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast({ title: 'Pessoa criada', description: 'Pessoa cadastrada com sucesso.' });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePersonInput> }) => updatePerson(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast({ title: 'Pessoa atualizada', description: 'Pessoa atualizada com sucesso.' });
      setEditingPerson(null);
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast({ title: 'Pessoa excluída', description: 'Pessoa excluída com sucesso.' });
      setDeleteId(null);
    },
    onError: (error) => toast({ title: 'Não foi possível excluir', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const form = useForm<PersonFormValues>({
    resolver: zodResolver(personFormSchema),
    defaultValues: { type: 'INDIVIDUAL', email: '', phone: '', document: '', notes: '' },
  });

  const personType = form.watch('type');

  const openCreateDialog = () => {
    setEditingPerson(null);
    form.reset({ type: 'INDIVIDUAL', email: '', phone: '', document: '', notes: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (person: Person) => {
    setEditingPerson(person);
    form.reset({
      name: person.name,
      email: person.email ?? '',
      type: person.type as PersonFormValues['type'],
      phone: person.phone ?? '',
      document: person.document ?? '',
      notes: person.notes ?? '',
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: PersonFormValues) => {
    const payload = {
      name: values.name,
      email: values.email || undefined,
      type: values.type,
      phone: values.phone || undefined,
      document: values.document || undefined,
      notes: values.notes || undefined,
    };
    if (editingPerson) updateMutation.mutate({ id: editingPerson.id, data: payload });
    else createMutation.mutate(payload as CreatePersonInput);
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