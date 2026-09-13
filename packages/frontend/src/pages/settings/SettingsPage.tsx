import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/use-toast';
import { Save, User as UserIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { settingsSchema, type SettingsInput } from '@/lib/validation';
import { FormField, TextInput } from '@/components/forms';
import { useAuth } from '@/hooks/use-auth';

interface Settings {
  theme: string;
  language: string;
  currency: string;
  dateFormat: string;
  firstDayOfWeek: number;
  defaultAccountId?: string | null;
  defaultCardId?: string | null;
  dashboardLayout: string[];
}

const profileSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
  avatarUrl: z.string().url('URL inválida').nullable().optional(),
});

type ProfileInput = z.infer<typeof profileSchema>;

async function fetchSettings(): Promise<Settings> {
  const response = await api.get('/settings');
  return response.data;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();

  const { data: settings, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  const profileForm = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', avatarUrl: '' },
  });

  const settingsForm = useForm<SettingsInput>({ resolver: zodResolver(settingsSchema) });

  useEffect(() => {
    if (user) {
      profileForm.reset({ name: user.name, avatarUrl: user.avatarUrl || '' });
    }
  }, [user, profileForm]);

  useEffect(() => {
    if (settings) {
      settingsForm.reset({
        theme: settings.theme as SettingsInput['theme'],
        language: settings.language as SettingsInput['language'],
        currency: settings.currency as SettingsInput['currency'],
        dateFormat: settings.dateFormat,
        firstDayOfWeek: settings.firstDayOfWeek as 0 | 1,
      });
    }
  }, [settings, settingsForm]);

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileInput) => {
      const response = await api.patch('/users/me', { name: data.name, avatarUrl: data.avatarUrl || null });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      refreshUser();
      toast({ title: 'Perfil atualizado', description: 'Suas informações foram salvas.' });
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const settingsMutation = useMutation({
    mutationFn: async (data: SettingsInput) => {
      const response = await api.patch('/settings', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast({ title: 'Preferências salvas', description: 'Suas preferências foram atualizadas.' });
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="h-4 bg-muted rounded w-3/4" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie seu perfil e preferências do aplicativo</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Atualize suas informações pessoais</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user?.avatarUrl} alt={user?.name || ''} />
              <AvatarFallback>{user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <form onSubmit={profileForm.handleSubmit((data) => profileMutation.mutate(data))} className="space-y-4" noValidate>
            <FormField id="name" label="Nome" error={profileForm.formState.errors.name?.message}>
              <TextInput id="name" placeholder="Seu nome" {...profileForm.register('name')} />
            </FormField>
            <FormField id="avatarUrl" label="URL do avatar" error={profileForm.formState.errors.avatarUrl?.message}>
              <TextInput id="avatarUrl" placeholder="https://exemplo.com/avatar.png" {...profileForm.register('avatarUrl')} />
            </FormField>
            <Button type="submit" loading={profileMutation.isPending}>
              {!profileMutation.isPending && <Save className="mr-2 h-4 w-4" />}
              Salvar perfil
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferências</CardTitle>
          <CardDescription>Personalize a experiência do OxeDinDin</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={settingsForm.handleSubmit((data) => settingsMutation.mutate(data))} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="theme">Tema</Label>
              <Select
                value={settingsForm.watch('theme')}
                onValueChange={(value) => settingsForm.setValue('theme', value as SettingsInput['theme'])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tema" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Escuro</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="language">Idioma</Label>
                <Select
                  value={settingsForm.watch('language')}
                  onValueChange={(value) => settingsForm.setValue('language', value as SettingsInput['language'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Moeda</Label>
                <Select
                  value={settingsForm.watch('currency')}
                  onValueChange={(value) => settingsForm.setValue('currency', value as SettingsInput['currency'])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BRL">Real (BRL)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="firstDayOfWeek">Primeiro dia da semana</Label>
              <Select
                value={String(settingsForm.watch('firstDayOfWeek') ?? 0)}
                onValueChange={(value) => settingsForm.setValue('firstDayOfWeek', value === '1' ? 1 : 0)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Domingo</SelectItem>
                  <SelectItem value="1">Segunda-feira</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <Button type="submit" loading={settingsMutation.isPending}>
              {!settingsMutation.isPending && <Save className="mr-2 h-4 w-4" />}
              Salvar preferências
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sobre</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <UserIcon className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">OxeDinDin — seu centro de controle financeiro pessoal.</p>
        </CardContent>
      </Card>
    </div>
  );
}