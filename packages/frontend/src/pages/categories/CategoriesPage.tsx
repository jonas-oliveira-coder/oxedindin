import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/components/ui/use-toast';
import { Loader2, Plus, Edit, Trash2, Paintbrush, Sparkles } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createCategorySchema, updateCategorySchema, type CreateCategoryInput, type UpdateCategoryInput } from '@/lib/validation';

interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  isDefault: boolean;
}

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);

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
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryInput }) => updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoria atualizada', description: 'Categoria atualizada com sucesso.' });
      setEditingCategory(null);
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoria excluída', description: 'Categoria excluída com sucesso.' });
      setDeleteDialogOpen(null);
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const initMutation = useMutation({
    mutationFn: initializeDefaults,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categorias padrão', description: 'Categorias padrão criadas.' });
    },
    onError: (error: Error) => toast({ title: 'Erro', description: error.message, variant: 'destructive' }),
  });

  const createForm = useForm<CreateCategoryInput>({ resolver: zodResolver(createCategorySchema) });
  const updateForm = useForm<UpdateCategoryInput>({ resolver: zodResolver(updateCategorySchema) });

  const handleCreateSubmit = (data: CreateCategoryInput) => {
    createMutation.mutate(data);
    createForm.reset();
  };

  const handleUpdateSubmit = (data: UpdateCategoryInput) => {
    if (editingCategory) updateMutation.mutate({ id: editingCategory.id, data });
  };

  const openCreateDialog = () => {
    setEditingCategory(null);
    createForm.reset();
    setDialogOpen(true);
  };

  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    updateForm.reset({ name: category.name, icon: category.icon, color: category.color });
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
          <h1 className="text-3xl font-bold tracking-tight">Categorias</h1>
          <p className="text-muted-foreground">Gerencie suas categorias de transações</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => initMutation.mutate()} disabled={initMutation.isPending}>
            {initMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
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
              <form onSubmit={editingCategory ? updateForm.handleSubmit(handleUpdateSubmit) : createForm.handleSubmit(handleCreateSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" {...(editingCategory ? updateForm.register('name') : createForm.register('name'))} placeholder="Alimentação" />
                </div>
                <div className="grid gap-2 grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="icon">Ícone (emoji)</Label>
                    <Input id="icon" {...(editingCategory ? updateForm.register('icon') : createForm.register('icon'))} placeholder="🍔" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="color">Cor</Label>
                    <Input id="color" {...(editingCategory ? updateForm.register('color') : createForm.register('color'))} placeholder="#EF4444" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {createMutation.isPending || updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(category)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteDialogOpen(category.id)}>
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

      <Dialog open={!!deleteDialogOpen} onOpenChange={(open) => !open && setDeleteDialogOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir categoria?</DialogTitle>
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