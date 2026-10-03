import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SecurityPage } from '@/pages/security/SecurityPage';
import { CategoriesPage } from '@/pages/categories/CategoriesPage';
import { NotificationsPage } from '@/pages/notifications/NotificationsPage';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/use-toast';
import { Save, User as UserIcon, Camera, Trash2, Shield, Tags, Bell } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { settingsSchema, type SettingsInput } from '@/lib/validation';
import { FormField, TextInput } from '@/components/forms';
import { useAuth } from '@/hooks/use-auth';
import { InstallPWAButton } from '@/components/pwa/install-button';
import { validateAvatarFile } from '@/lib/avatar';

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
});

type ProfileInput = z.infer<typeof profileSchema>;

async function fetchSettings(): Promise<Settings> {
  const response = await api.get('/settings');
  return response.data;
}

export function ProfileSettingsTab({ embedded }: { embedded?: boolean } = {}) {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });

  const profileForm = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '' },
  });

  const settingsForm = useForm<SettingsInput>({ resolver: zodResolver(settingsSchema) });

  useEffect(() => {
    if (user) profileForm.reset({ name: user.name });
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

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileInput) => (await api.patch('/users/me', { name: data.name })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      refreshUser();
      toast({ title: 'Perfil atualizado', description: 'Suas informações foram salvas.' });
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const settingsMutation = useMutation({
    mutationFn: async (data: SettingsInput) => (await api.patch('/settings', data)).data as Settings,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      const isDark =
        data.theme === 'dark' ||
        (data.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      localStorage.setItem('drizzle-dark-mode', isDark.toString());
      document.documentElement.classList.toggle('dark', isDark);
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      toast({ title: 'Preferências salvas', description: 'Suas preferências foram atualizadas.' });
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await api.post('/users/me/avatar', fd);
      return res.data as { avatarUrl: string };
    },
    onSuccess: () => {
      refreshUser();
      setPreview(null);
      toast({ title: 'Foto atualizada', description: 'Sua foto de perfil foi salva.' });
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const removeAvatar = useMutation({
    mutationFn: async () => (await api.delete('/users/me/avatar')).data,
    onSuccess: () => {
      refreshUser();
      setPreview(null);
      toast({ title: 'Foto removida' });
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      toast({ title: 'Arquivo inválido', description: validation.error, variant: 'destructive' });
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
    avatarMutation.mutate(file);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-6">
            <div className="animate-pulse space-y-2">
              <div className="h-4 rounded bg-muted w-1/2" />
              <div className="h-4 rounded bg-muted w-3/4" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Configurações</h1>
          <p className="text-muted-foreground">Gerencie seu perfil e preferências do aplicativo</p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>Atualize suas informações e foto de perfil</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="relative">
              <Avatar className="h-20 w-20">
                <AvatarImage src={preview || user?.avatarUrl} alt={user?.name || ''} />
                <AvatarFallback>{user?.name?.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
                aria-label="Trocar foto"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
            <div className="flex flex-col gap-1">
              <p className="font-semibold">{user?.name}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={avatarMutation.isPending} onClick={() => fileInputRef.current?.click()}>
                  <Camera className="mr-1 h-4 w-4" /> Trocar foto
                </Button>
                {user?.avatarUrl && (
                  <Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={removeAvatar.isPending} onClick={() => removeAvatar.mutate()}>
                    <Trash2 className="mr-1 h-4 w-4" /> Remover
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG ou WebP · máx 2 MB · validado no servidor</p>
            </div>
          </div>

          <form onSubmit={profileForm.handleSubmit((data) => profileMutation.mutate(data))} className="space-y-4" noValidate>
            <FormField id="name" label="Nome" error={profileForm.formState.errors.name?.message}>
              <TextInput id="name" placeholder="Seu nome" {...profileForm.register('name')} />
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
                <SelectTrigger className="min-h-10"><SelectValue placeholder="Selecione o tema" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Claro</SelectItem>
                  <SelectItem value="dark">Escuro</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="language">Idioma</Label>
                <Select value={settingsForm.watch('language')} onValueChange={(value) => settingsForm.setValue('language', value as SettingsInput['language'])}>
                  <SelectTrigger className="min-h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Moeda</Label>
                <Select value={settingsForm.watch('currency')} onValueChange={(value) => settingsForm.setValue('currency', value as SettingsInput['currency'])}>
                  <SelectTrigger className="min-h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
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
                <SelectTrigger className="min-h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
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
          <CardTitle>Sobre o Aplicativo</CardTitle>
          <CardDescription>Versão e instalação do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <UserIcon className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">OxeDinDin — seu centro de controle financeiro pessoal.</p>
          </div>
          <InstallPWAButton className="w-full sm:w-auto" />
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = ['profile', 'security', 'categories', 'notifications'];
  const currentTab = searchParams.get('tab') || 'profile';
  const activeTab = validTabs.includes(currentTab) ? currentTab : 'profile';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          Perfil, segurança, categorias e preferências de notificação
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-2xl h-auto p-1 gap-1">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            <span>Perfil & Geral</span>
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span>Segurança</span>
          </TabsTrigger>
          <TabsTrigger value="categories" className="flex items-center gap-2">
            <Tags className="h-4 w-4" />
            <span>Categorias</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span>Notificações</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileSettingsTab embedded />
        </TabsContent>
        <TabsContent value="security" className="mt-6">
          <SecurityPage embedded />
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <CategoriesPage embedded />
        </TabsContent>
        <TabsContent value="notifications" className="mt-6">
          <NotificationsPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}