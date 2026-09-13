import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import { formatDateTime } from '@/lib/utils';
import { KeyRound, Smartphone, Fingerprint, ShieldCheck, Copy, Trash2, ScrollText, Plus } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, type ChangePasswordInput } from '@/lib/validation';
import { FormField, PasswordInput } from '@/components/forms';
import { registerPasskey, isPasskeySupported } from '@/lib/passkey';

interface Device {
  id: string;
  deviceName: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  expiresAt: string;
  current: boolean;
}

interface Passkey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt?: string;
}

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  userAgent?: string;
}

async function fetchDevices(): Promise<Device[]> {
  const response = await api.get('/security/devices');
  return response.data;
}

async function fetchPasskeys(): Promise<Passkey[]> {
  const response = await api.get('/auth/passkeys');
  return response.data;
}

async function fetchAuditLog(): Promise<AuditLog[]> {
  const response = await api.get('/security/audit-log');
  return response.data.data;
}

export function SecurityPage() {
  const queryClient = useQueryClient();
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [genOptions, setGenOptions] = useState({ length: 16, uppercase: true, lowercase: true, numbers: true, symbols: true });

  const { data: devices } = useQuery({ queryKey: ['devices'], queryFn: fetchDevices });
  const { data: passkeys } = useQuery({ queryKey: ['passkeys'], queryFn: fetchPasskeys });
  const { data: auditLogs } = useQuery({ queryKey: ['auditLog'], queryFn: fetchAuditLog });

  const changePasswordForm = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordInput) => {
      await api.post('/auth/password/change', data);
    },
    onSuccess: () => {
      toast({ title: 'Senha alterada', description: 'Sua senha foi alterada com sucesso.' });
      changePasswordForm.reset();
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const generatePasswordMutation = useMutation({
    mutationFn: async (options: typeof genOptions) => {
      const response = await api.post('/security/password/generate', options);
      return response.data.password as string;
    },
    onSuccess: (password) => setGeneratedPassword(password),
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/auth/sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      toast({ title: 'Sessão encerrada', description: 'Dispositivo removido com sucesso.' });
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const registerPasskeyMutation = useMutation({
    mutationFn: async () => {
      const start = await api.post('/auth/passkey/register/start');
      const options = start.data;
      const credential = await registerPasskey(options);
      await api.post('/auth/passkey/register/finish', { challengeId: options.challengeId, credential });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      toast({ title: 'Passkey adicionada', description: 'Passkey registrada com sucesso.' });
    },
    onError: (error) => toast({ title: 'Falha ao adicionar passkey', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const revokePasskeyMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/auth/passkeys/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passkeys'] });
      toast({ title: 'Passkey removida', description: 'Passkey removida com sucesso.' });
    },
    onError: (error) => toast({ title: 'Erro', description: getErrorMessage(error), variant: 'destructive' }),
  });

  const copyPassword = async () => {
    await navigator.clipboard.writeText(generatedPassword);
    toast({ title: 'Copiado', description: 'Senha copiada para a área de transferência.' });
  };

  const toggleGenOption = (key: keyof typeof genOptions, value: boolean | number) => {
    setGenOptions((prev) => ({ ...prev, [key]: value }));
    setGeneratedPassword('');
  };

  const addPasskey = () => {
    if (!isPasskeySupported()) {
      toast({ title: 'Passkey indisponível', description: 'Seu navegador não suporta passkeys.', variant: 'destructive' });
      return;
    }
    registerPasskeyMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Segurança</h1>
        <p className="text-muted-foreground">Gerencie sua segurança, sessões e credenciais</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" /> Alterar senha</CardTitle>
          <CardDescription>Use uma senha forte e única</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={changePasswordForm.handleSubmit((data) => changePasswordMutation.mutate(data))} className="space-y-4 max-w-md" noValidate>
            <FormField id="currentPassword" label="Senha atual" error={changePasswordForm.formState.errors.currentPassword?.message}>
              <PasswordInput id="currentPassword" autoComplete="current-password" {...changePasswordForm.register('currentPassword')} />
            </FormField>
            <FormField id="newPassword" label="Nova senha" error={changePasswordForm.formState.errors.newPassword?.message} hint="A senha deve ter pelo menos 8 caracteres.">
              <PasswordInput id="newPassword" autoComplete="new-password" {...changePasswordForm.register('newPassword')} />
            </FormField>
            <Button type="submit" loading={changePasswordMutation.isPending}>Alterar senha</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Gerador de senhas</CardTitle>
          <CardDescription>Crie uma senha forte e aleatória</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 max-w-2xl">
            <div className="space-y-2">
              <span className="text-sm font-medium leading-none">Comprimento ({genOptions.length})</span>
              <Input
                id="genLength"
                type="number"
                min={8}
                max={128}
                value={genOptions.length}
                onChange={(e) => toggleGenOption('length', parseInt(e.target.value, 10) || 16)}
              />
            </div>
            <div className="flex flex-col justify-end gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Letras maiúsculas</span>
                <Switch checked={genOptions.uppercase} onCheckedChange={(v) => toggleGenOption('uppercase', v)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Letras minúsculas</span>
                <Switch checked={genOptions.lowercase} onCheckedChange={(v) => toggleGenOption('lowercase', v)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Números</span>
                <Switch checked={genOptions.numbers} onCheckedChange={(v) => toggleGenOption('numbers', v)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Símbolos</span>
                <Switch checked={genOptions.symbols} onCheckedChange={(v) => toggleGenOption('symbols', v)} />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => generatePasswordMutation.mutate(genOptions)} loading={generatePasswordMutation.isPending}>
              Gerar senha
            </Button>
            {generatedPassword && (
              <>
                <Input value={generatedPassword} readOnly className="font-mono" />
                <Button variant="ghost" size="icon" onClick={copyPassword} aria-label="Copiar senha">
                  <Copy className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Fingerprint className="h-5 w-5" /> Passkeys</CardTitle>
          <CardDescription>Chaves de acesso sem senha</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={addPasskey} loading={registerPasskeyMutation.isPending}>
            {!registerPasskeyMutation.isPending && <Plus className="mr-2 h-4 w-4" />}
            Adicionar Passkey
          </Button>
          {passkeys && passkeys.length > 0 ? (
            <div className="space-y-3 mt-4">
              {passkeys.map((passkey) => (
                <div key={passkey.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{passkey.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Criada em {formatDateTime(passkey.createdAt)}
                      {passkey.lastUsedAt ? ` · Último uso ${formatDateTime(passkey.lastUsedAt)}` : ''}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => revokePasskeyMutation.mutate(passkey.id)} aria-label="Remover passkey">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-4">Nenhuma passkey cadastrada.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5" /> Dispositivos e sessões</CardTitle>
          <CardDescription>Gerencie onde sua conta está conectada</CardDescription>
        </CardHeader>
        <CardContent>
          {devices && devices.length > 0 ? (
            <div className="space-y-3">
              {devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{device.deviceName || 'Dispositivo'}</p>
                      {device.current && <Badge variant="success">Atual</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {device.ip || ''}{device.userAgent ? ` · ${device.userAgent}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">Ativa desde {formatDateTime(device.createdAt)}</p>
                  </div>
                  {!device.current && (
                    <Button variant="ghost" size="icon" onClick={() => revokeSessionMutation.mutate(device.id)} aria-label="Encerrar sessão">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma sessão ativa identificada.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ScrollText className="h-5 w-5" /> Registro de auditoria</CardTitle>
          <CardDescription>Atividades recentes na sua conta</CardDescription>
        </CardHeader>
        <CardContent>
          {auditLogs && auditLogs.length > 0 ? (
            <div className="space-y-2">
              {auditLogs.slice(0, 20).map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                  <div>
                    <p className="font-medium">{log.action}</p>
                    <p className="text-muted-foreground">{log.entityType} · {log.entityId}</p>
                  </div>
                  <p className="text-muted-foreground text-xs">{formatDateTime(log.createdAt)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma atividade registrada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}