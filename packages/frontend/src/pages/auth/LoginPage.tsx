import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { loginSchema, type LoginInput } from '@/lib/validation';
import { useAuth } from '@/hooks/use-auth';
import { Logo } from '@/components/shared/logo';
import { FormField, EmailInput, PasswordInput } from '@/components/forms';
import { api, getErrorMessage } from '@/lib/api';
import { authenticatePasskey, isPasskeySupported } from '@/lib/passkey';
import { Loader2 } from 'lucide-react';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithPasskey } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    try {
      await login(data.email, data.password);
      toast({ title: 'Bem-vindo!', description: 'Login realizado com sucesso.' });
      navigate('/dashboard');
    } catch (error) {
      toast({ title: 'Erro ao entrar', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    if (!isPasskeySupported()) {
      toast({ title: 'Passkey indisponível', description: 'Seu navegador não suporta passkeys.', variant: 'destructive' });
      return;
    }
    setPasskeyLoading(true);
    try {
      const start = await api.post('/auth/passkey/login/start', {});
      const options = start.data;
      const credential = await authenticatePasskey(options);
      await loginWithPasskey(options.challengeId, credential);
      toast({ title: 'Bem-vindo!', description: 'Login com passkey realizado com sucesso.' });
      navigate('/dashboard');
    } catch (error) {
      toast({ title: 'Falha na passkey', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Logo className="mx-auto mb-4 h-28 w-64" />
          <CardTitle className="text-2xl">Entrar no OxeDinDin</CardTitle>
          <CardDescription>Gerencie suas finanças com segurança</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField id="email" label="Email" error={errors.email?.message}>
              <EmailInput
                id="email"
                placeholder="seu@email.com"
                {...register('email')}
                disabled={isLoading}
              />
            </FormField>

            <FormField id="password" label="Senha" error={errors.password?.message}>
              <PasswordInput
                id="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password')}
                disabled={isLoading}
              />
            </FormField>

            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                Esqueceu a senha?
              </Link>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading} size="lg">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </form>

          <Separator className="my-6" />

          <Button variant="outline" className="w-full" onClick={handlePasskeyLogin} disabled={passkeyLoading || isLoading}>
            {passkeyLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
              </svg>
            )}
            Entrar com Passkey
          </Button>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Não tem conta?{' '}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Cadastre-se
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}