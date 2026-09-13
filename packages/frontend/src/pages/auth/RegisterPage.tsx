import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { registerSchema, type RegisterInput } from '@/lib/validation';
import { useAuth } from '@/hooks/use-auth';
import { Logo } from '@/components/shared/logo';
import { FormField, TextInput, EmailInput, PasswordInput } from '@/components/forms';
import { getErrorMessage } from '@/lib/api';
import { Loader2 } from 'lucide-react';

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true);
    try {
      await registerUser(data.email, data.password, data.name);
      toast({ title: 'Conta criada!', description: 'Bem-vindo ao OxeDinDin.' });
      navigate('/dashboard');
    } catch (error) {
      toast({ title: 'Erro ao cadastrar', description: getErrorMessage(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Logo variant="full" className="mx-auto mb-4 h-28 w-auto" />
          <CardTitle className="text-2xl">Criar conta no OxeDinDin</CardTitle>
          <CardDescription>Gerencie suas finanças com segurança</CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField id="name" label="Nome completo" error={errors.name?.message}>
              <TextInput id="name" placeholder="João Silva" {...register('name')} disabled={isLoading} />
            </FormField>

            <FormField id="email" label="Email" error={errors.email?.message}>
              <EmailInput id="email" placeholder="seu@email.com" {...register('email')} disabled={isLoading} />
            </FormField>

            <FormField id="password" label="Senha" error={errors.password?.message} hint="A senha deve ter pelo menos 8 caracteres.">
              <PasswordInput id="password" placeholder="••••••••" {...register('password')} disabled={isLoading} />
            </FormField>

            <Button type="submit" className="w-full" disabled={isLoading} size="lg">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar conta
            </Button>
          </form>

          <Separator className="my-6" />

          <p className="text-center text-sm text-muted-foreground">
            Ao criar uma conta, você concorda com nossos{' '}
            <Link to="/terms" className="text-primary hover:underline">Termos de Uso</Link>{' '}
            e{' '}
            <Link to="/privacy" className="text-primary hover:underline">Política de Privacidade</Link>
          </p>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Já tem conta?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}