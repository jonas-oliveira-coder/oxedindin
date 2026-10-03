import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { passwordSchema } from '@oxedindin/shared';
import { Logo } from '@/components/shared/logo';
import { FormField, PasswordInput } from '@/components/forms';
import { api, getErrorMessage } from '@/lib/api';
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { z } from 'zod';

const localResetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

type ResetPasswordFormData = z.infer<typeof localResetPasswordSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(localResetPasswordSchema),
  });

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      toast({
        title: 'Token inválido',
        description: 'O link de redefinição de senha é inválido ou expirou.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await api.post('/auth/password/reset', {
        token,
        password: data.password,
      });
      setIsSuccess(true);
      toast({
        title: 'Senha redefinida!',
        description: 'Sua senha foi alterada com sucesso. Você já pode fazer login.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao redefinir',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/40">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <Logo className="h-12 w-12" />
          </div>
          <CardTitle className="text-2xl font-bold">Redefinir senha</CardTitle>
          <CardDescription>
            {isSuccess
              ? 'Sua nova senha foi salva'
              : !token
              ? 'Link inválido ou expirado'
              : 'Digite sua nova senha abaixo.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {isSuccess ? (
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Sua senha foi redefinida com sucesso. Faça login com a nova senha para acessar sua conta.
              </p>
              <Button className="w-full mt-4" onClick={() => navigate('/login')}>
                Ir para o login
              </Button>
            </div>
          ) : !token ? (
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground">
                O link de redefinição de senha não possui um token válido ou está incompleto.
              </p>
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => navigate('/forgot-password')}
              >
                Solicitar novo link
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField
                id="password"
                label="Nova senha"
                error={errors.password?.message}
                hint="Mínimo 8 caracteres, com maiúscula, minúscula, número e símbolo."
              >
                <PasswordInput
                  id="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...register('password')}
                  disabled={isLoading}
                />
              </FormField>

              <FormField
                id="confirmPassword"
                label="Confirmar nova senha"
                error={errors.confirmPassword?.message}
              >
                <PasswordInput
                  id="confirmPassword"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  {...register('confirmPassword')}
                  disabled={isLoading}
                />
              </FormField>

              <Button type="submit" className="w-full" disabled={isLoading} size="lg">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar nova senha
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex justify-center">
          <Link
            to="/login"
            className="flex items-center text-sm text-primary hover:underline font-medium"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para o login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
