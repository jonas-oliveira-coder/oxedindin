import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { forgotPasswordSchema } from '@/lib/validation';
import { Logo } from '@/components/shared/logo';
import { FormField, EmailInput } from '@/components/forms';
import { api, getErrorMessage } from '@/lib/api';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { z } from 'zod';

type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordInput) => {
    setIsLoading(true);
    try {
      await api.post('/auth/password/forgot', { email: data.email });
      setSubmittedEmail(data.email);
      toast({
        title: 'Solicitação enviada',
        description: 'Se o email estiver cadastrado, as instruções foram enviadas.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao solicitar',
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
          <CardTitle className="text-2xl font-bold">Recuperar senha</CardTitle>
          <CardDescription>
            {submittedEmail
              ? 'Verifique sua caixa de entrada'
              : 'Informe seu email cadastrado para receber as instruções de redefinição.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {submittedEmail ? (
            <div className="space-y-4 text-center py-4">
              <div className="flex justify-center">
                <CheckCircle2 className="h-12 w-12 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Enviamos instruções de redefinição para <strong>{submittedEmail}</strong>. Verifique também a sua caixa de spam.
              </p>
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setSubmittedEmail(null)}
              >
                Tentar outro email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormField id="email" label="Email" error={errors.email?.message}>
                <EmailInput
                  id="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  {...register('email')}
                  disabled={isLoading}
                />
              </FormField>

              <Button type="submit" className="w-full" disabled={isLoading} size="lg">
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enviar instruções
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
