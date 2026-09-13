import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Plus, Edit, Trash2, Paintbrush, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateCategoryInput, UpdateCategoryInput } from '@/lib/validation';
import { FormField, TextInput } from '@/components/forms';
import { ConfirmDeleteDialog } from '@/components/confirm-delete-dialog';

interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  isDefault: boolean;
}

const categoryFormSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome.').max(50),
  icon: z.string().max(50).optional().default(''),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida. Use o formato #RRGGBB.').optional().or(z.literal('')),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

async function fetchCategories(): Promise<Category[]> {
  const response = await api.get('/categories');
  return response.data.data;
}

async function createCategory(data: CreateCategoryInput): Promise<Category> {
  const response = await api.post('/categories', data);
  return response.data;
}

async function updateCategory(id: string, data: UpdateCategoryInput): Promise<Category> {
  const response = await api.patch(`/categories/${id}`, data);
  return response.data;
}

async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/categories/${id}`);
}

async function initializeDefaults(): Promise<void> {
  await api.post('/categories/initialize-defaults');
}

export function CategoriesPage() {
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoria criada', description: 'Categoria criada com sucesso.' });
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryInput }) => updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoria atualizada', description: 'Categoria atualizada com sucesso.' });
      setEditingCategory(null);
      setDialogOpen(false);
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoria excluída', description: 'Categoria excluída com sucesso.' });
      setDeleteId(null);
    },
    onError: (error) => toast({ title: 'Não foi possível excluir', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const initMutation = useMutation({
    mutationFn: initializeDefaults,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categorias padrão', description: 'Categorias padrão criadas.' });
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { icon: '', color: '' },
  });

  const openCreateDialog = () => {
    setEditingCategory(null);
    form.reset({ icon: '', color: '' });
    setDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    form.reset({ name: category.name, icon: category.icon ?? '', color: category.color ?? '' });
    setDialogOpen(true);
  };

  const onSubmit = (values: CategoryFormValues) => {
    if (editingCategory) {
      updateMutation.mutate({
        id: editingCategory.id,
        data: {
          name: values.name,
          icon: values.icon || null,
          color: values.color || null,
        } as UpdateCategoryInput,
      });
    } else {
      createMutation.mutate({
        name: values.name,
        icon: values.icon || undefined,
        color: values.color || undefined,
      } as CreateCategoryInput);
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
          <h1 className="text-3xl font-bold tracking-tight">Categorias</h1>
          <p className="text-muted-foreground">Gerencie suas categorias de transações</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => initMutation.mutate()} loading={initMutation.isPending}>
            {!initMutation.isPending && <Sparkles className="mr-2 h-4 w-4" />}
            Categorias padrão
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <FormField id="name" label="Nome" error={form.formState.errors.name?.message}>
                  <TextInput id="name" placeholder="Alimentação" {...form.register('name')} />
                </FormField>
                <div className="grid gap-2 grid-cols-2">
                  <FormField id="icon" label="Ícone (emoji)" error={form.formState.errors.icon?.message}>
                    <TextInput id="icon" placeholder="🍔" {...form.register('icon')} />
                  </FormField>
                  <FormField id="color" label="Cor" error={form.formState.errors.color?.message}>
                    <TextInput id="color" placeholder="#EF4444" {...form.register('color')} />
                  </FormField>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" loading={createMutation.isPending || updateMutation.isPending}>
                    {editingCategory ? 'Salvar' : 'Criar'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {categories && categories.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Card key={category.id}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg text-lg" style={{ backgroundColor: category.color ? `${category.color}22` : undefined }}>
                      {category.icon || <Paintbrush className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{category.name}</h3>
                        {category.isDefault && (
                          <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-muted-foreground">Padrão</span>
                        )}
                      </div>
                      {category.color && <p className="text-sm text-muted-foreground">{category.color}</p>}
                    </div>
                  </div>
                  {!category.isDefault && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(category)} aria-label="Editar categoria">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(category.id)} aria-label="Excluir categoria">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <h3 className="mt-4 text-lg font-medium">Nenhuma categoria cadastrada</h3>
            <p className="mt-2 text-muted-foreground">Crie categorias ou importe as categorias padrão</p>
            <Button onClick={openCreateDialog} className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Criar Categoria
            </Button>
          </CardContent>
        </Card>
      )}

      <ConfirmDeleteDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir categoria?"
        description="Essa ação removerá permanentemente a categoria. Categorias com transações, parcelas ou contas vinculadas não podem ser excluídas."
        loading={deleteMutation.isPending}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}