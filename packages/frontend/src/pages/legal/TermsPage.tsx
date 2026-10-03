import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/shared/logo';
import { ArrowLeft, Shield } from 'lucide-react';

export function TermsPage() {
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
              <Shield className="h-5 w-5" />
              <span className="text-sm font-semibold uppercase tracking-wider">Termos e Condições</span>
            </div>
            <CardTitle className="text-2xl font-bold">Termos de Uso</CardTitle>
            <CardDescription>Última atualização: Outubro de 2026</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 text-sm text-foreground/90 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">1. Aceitação dos Termos</h2>
              <p>
                Ao criar uma conta ou utilizar a plataforma OxeDinDin, você concorda expressamente com os presentes Termos de Uso e com a nossa Política de Privacidade. Caso discorde de qualquer disposição, solicitamos que não utilize nossos serviços.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">2. Descrição dos Serviços</h2>
              <p>
                O OxeDinDin é uma plataforma de gestão financeira pessoal e compartilhamento de despesas, oferecendo ferramentas para planejamento orçamentário, registro de contas, faturas de cartão de crédito e controle de dívidas compartilhadas.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">3. Responsabilidades do Usuário</h2>
              <p>
                Você é responsável por manter a confidencialidade de suas credenciais de acesso (senha e chaves Passkey) e por todas as atividades realizadas em sua conta. Compromete-se a fornecer informações verdadeiras e atualizadas.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">4. Privacidade e Segurança dos Dados</h2>
              <p>
                Seus dados financeiros pertencem exclusivamente a você. O OxeDinDin adota práticas modernas de criptografia e proteção de dados em conformidade com as leis vigentes de proteção de dados (LGPD). Seus dados não são comercializados a terceiros.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">5. Modificações dos Termos</h2>
              <p>
                Reservamo-nos o direito de atualizar estes termos a qualquer momento. Modificações substanciais serão comunicadas diretamente através da plataforma ou por notificação interna.
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
