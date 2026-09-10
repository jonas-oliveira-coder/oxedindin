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
import { toast } from '@/components/ui/use-toast';
import { Loader2, Plus, Edit, Trash2, User, Building2, Mail, Phone, FileText } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createPersonSchema, type CreatePersonInput } from '@/lib/validation';

interface Person {
  id: string;
  name: string;
  email?: string | null;
  type: string;
  phone?: string | null;
  document?: string | null;
  notes?: string | null;
}

const updatePersonSchema = createPersonSchema
  .omit({ name: true })
  .extend({
    name: z.string().min(1).max(100).optional(),
    type: z.enum(['INDIVIDUAL', 'COMPANY']).optional(),
    email: z.string().email().nullable().optional(),
    phone: z.string().max(20).nullable().optional(),
    document: z.string().max(20).nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
  });

type UpdatePersonInput = z.infer<typeof updatePersonSchema>;

async function fetchPeople(): Promise<Person[]> {
  const response = await api.get('/people');
  return response.data.data;
}

async function createPerson(data: CreatePersonInput): Promise<Person> {
  const response = await api.post('/people', data);
  return response.data;
}

async function updatePerson(id: string, data: UpdatePersonInput): Promise<Person> {
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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);

  const { data: people, isLoading } = useQuery({ queryKey: ['people'], queryFn: fetchPeople });

  const createMutation = useMutation({
    mutationFn: createPerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast({ title: 'Pessoa criada', description: 'Pessoa cadastrada com sucesso.' });
      setDialogOpen(false);
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePersonInput }) => updatePerson(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast({ title: 'Pessoa atualizada', description: 'Pessoa atualizada com sucesso.' });
      setEditingPerson(null);
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePerson,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['people'] });
      toast({ title: 'Pessoa excluída', description: 'Pessoa excluída com sucesso.' });
      setDeleteDialogOpen(null);
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const createForm = useForm<CreatePersonInput>({
    resolver: zodResolver(createPersonSchema),
    defaultValues: { type: 'INDIVIDUAL' },
  });

  const updateForm = useForm<UpdatePersonInput>({ resolver: zodResolver(updatePersonSchema) });

  const handleCreateSubmit = (data: CreatePersonInput) => {
    createMutation.mutate(data);
    createForm.reset({ type: 'INDIVIDUAL' });
  };

  const handleUpdateSubmit = (data: UpdatePersonInput) => {
    if (editingPerson) updateMutation.mutate({ id: editingPerson.id, data });
  };

  const openCreateDialog = () => {
    setEditingPerson(null);
    createForm.reset({ type: 'INDIVIDUAL' });
    setDialogOpen(true);
  };

  const openEditDialog = (person: Person) => {
    setEditingPerson(person);
    updateForm.reset({
      name: person.name,
      email: person.email,
      type: person.type as UpdatePersonInput['type'],
      phone: person.phone,
      document: person.document,
      notes: person.notes,
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
            <form onSubmit={editingPerson ? updateForm.handleSubmit(handleUpdateSubmit) : createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" {...(editingPerson ? updateForm.register('name') : createForm.register('name'))} placeholder="Maria Silva" />
              </div>
              <div className="grid gap-2 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select {...(editingPerson ? updateForm.register('type') : createForm.register('type'))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INDIVIDUAL">Pessoa Física</SelectItem>
                      <SelectItem value="COMPANY">Empresa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" {...(editingPerson ? updateForm.register('email') : createForm.register('email'))} placeholder="mail@exemplo.com" />
                </div>
              </div>
              <div className="grid gap-2 grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" {...(editingPerson ? updateForm.register('phone') : createForm.register('phone'))} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="document">Documento</Label>
                  <Input id="document" {...(editingPerson ? updateForm.register('document') : createForm.register('document'))} placeholder="CPF/CNPJ" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Observações</Label>
                <Input id="notes" {...(editingPerson ? updateForm.register('notes') : createForm.register('notes'))} placeholder="Observações opcionais" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      {person.type === 'COMPANY' ? <Building2 className="h-5 w-5 text-primary" /> : <User className="h-5 w-5 text-primary" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{person.name}</h3>
                        <Badge variant="secondary">{person.type === 'COMPANY' ? 'Empresa' : 'Pessoa Física'}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {person.email && (
                          <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{person.email}</span>
                        )}
                        {person.phone && (
                          <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{person.phone}</span>
                        )}
                        {person.document && (
                          <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{person.document}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(person)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteDialogOpen(person.id)}>
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

      <Dialog open={!!deleteDialogOpen} onOpenChange={(open) => !open && setDeleteDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir pessoa?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteDialogOpen && deleteMutation.mutate(deleteDialogOpen)}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}