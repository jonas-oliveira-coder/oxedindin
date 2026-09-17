import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/use-toast';
import { Save, User as UserIcon, Camera, Trash2, BellRing, Download } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { settingsSchema, type SettingsInput } from '@/lib/validation';
import { FormField, TextInput } from '@/components/forms';
import { useAuth } from '@/hooks/use-auth';
import { InstallPWAButton } from '@/components/pwa/install-button';
import { subscribeToPush, unsubscribeFromPush, browserSupportsPush } from '@/lib/push';
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

interface NotificationPreferences {
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
}

const profileSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(100),
});

type ProfileInput = z.infer<typeof profileSchema>;

async function fetchSettings(): Promise<Settings> {
  const response = await api.get('/settings');
  return response.data;
}

async function fetchPushPrefs(): Promise<NotificationPreferences> {
  const response = await api.get('/notifications/preferences');
  return response.data;
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const { data: pushPrefs } = useQuery({ queryKey: ['notification-preferences'], queryFn: fetchPushPrefs });

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
    mutationFn: async (data: SettingsInput) => (await api.patch('/settings', data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
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

  const pushToggle = useMutation({
    mutationFn: async (enable: boolean) => {
      if (enable) {
        const ok = await subscribeToPush();
        if (!ok) throw new Error('Não foi possível ativar as notificações push.');
      } else {
        await unsubscribeFromPush();
      }
      await api.patch('/notifications/preferences', { pushEnabled: enable });
      return enable;
    },
    onSuccess: (enable) => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      toast({ title: enable ? 'Notificações push ativadas' : 'Notificações push desativadas' });
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Configurações</h1>
        <p className="text-muted-foreground">Gerencie seu perfil e preferências do aplicativo</p>
      </div>

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
          <CardTitle>Notificações</CardTitle>
          <CardDescription>Receba alertas de dívidas compartilhadas e pagamentos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <BellRing className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Notificações push</p>
                <p className="text-xs text-muted-foreground">
                  {browserSupportsPush() ? 'Receba notificações mesmo com o app fechado.' : 'Seu navegador não suporta notificações push.'}
                </p>
              </div>
            </div>
            <Switch
                checked={!!pushPrefs?.pushEnabled}
                disabled={!browserSupportsPush() || pushToggle.isPending}
                onCheckedChange={(checked) => pushToggle.mutate(checked)}
              />
          </div>
          <Separator />
          <div className="flex flex-col gap-3">
            <InstallPWAButton className="w-full sm:w-auto" />
            <Button variant="outline" className="w-full sm:w-auto" onClick={() => window.location.reload()}>
              <Download className="mr-2 h-4 w-4" />
              Atualizar aplicativo
            </Button>
          </div>
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