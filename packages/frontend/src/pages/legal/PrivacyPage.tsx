import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/logo';
import { ArrowLeft, Lock } from 'lucide-react';

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-muted/40 py-10 px-4 flex flex-col items-center">
      <div className="w-full max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="h-9 w-9" />
            <span className="text-xl font-bold tracking-tight">OxeDinDin</span>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/register" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 text-primary mb-1">
              <Lock className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">Privacidade e Proteção</span>
            </div>
            <CardTitle className="text-2xl font-bold">Política de Privacidade</CardTitle>
            <CardDescription>Última atualização: Outubro de 2026</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-foreground/90 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">1. Coleta de Informações</h2>
              <p>
                Coletamos apenas as informações estritamente necessárias para o funcionamento do serviço: seu nome, endereço de email, credenciais criptografadas de acesso e os registros financeiros (transações, contas e dívidas) que você optar por cadastrar no sistema.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">2. Uso e Finalidade dos Dados</h2>
              <p>
                Os seus dados são utilizados unicamente para fornecer relatórios, cálculos de saldo, lembretes de vencimento e funcionalidades de conciliação financeira solicitadas por você. Nunca vendemos nem alugamos suas informações para anunciantes ou terceiros.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">3. Criptografia e Armazenamento Seguro</h2>
              <p>
                Todas as conexões são protegidas com criptografia de ponta a ponta (TLS/HTTPS). Senhas são protegidas com algoritmos de hash seguros (Argon2id) e oferecemos suporte nativo a autenticação sem senha (Passkeys / WebAuthn).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">4. Direitos do Titular (LGPD)</h2>
              <p>
                Você possui total controle sobre seus dados. A qualquer momento, você pode exportar, alterar ou excluir sua conta e todos os dados associados diretamente pelo painel de configurações da aplicação.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">5. Contato e Dúvidas</h2>
              <p>
                Se você tiver qualquer dúvida ou solicitação referente à sua privacidade, sinta-se à vontade para entrar em contato com nossa equipe de suporte.
              </p>
            </section>

            <div className="pt-4 border-t flex justify-end">
              <Button asChild>
                <Link to="/register">Entendi e concordo</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
