import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/shared/logo';
import {
  ArrowLeft,
  Lock,
  CheckCircle2,
  Printer,
  Moon,
  Sun,
  Scale,
} from 'lucide-react';

export function TermsPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('drizzle-dark-mode');
    return saved ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', darkMode);
    html.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('drizzle-dark-mode', darkMode.toString());
  }, [darkMode]);

  const handlePrint = () => {
    window.print();
  };

  const handleBack = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate(-1);
    }
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-md print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <Logo className="h-8 w-8 sm:h-9 sm:w-9" />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              OxeDinDin
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label="Alternar tema"
              className="text-muted-foreground hover:text-foreground"
            >
              {darkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-700" />}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs h-9"
            >
              <Printer className="h-3.5 w-3.5" />
              Imprimir
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="flex items-center gap-1.5 text-xs sm:text-sm h-9"
            >
              <ArrowLeft className="h-4 w-4" />
              {isAuthenticated ? 'Ir para Dashboard' : 'Voltar'}
            </Button>
          </div>
        </div>
      </header>

      {/* HERO BANNER */}
      <div className="border-b border-border/40 bg-muted/20 py-10 px-4 print:py-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="outline" className="border-primary/30 text-primary gap-1 py-1">
              <Scale className="h-3.5 w-3.5" />
              Documento Jurídico
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Última atualização: Outubro de 2026
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Versão 1.2
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Termos de Uso
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
            Bem-vindo ao OxeDinDin. Estes termos regulam os direitos e responsabilidades ao utilizar nossa plataforma
            de inteligência financeira, gestão de contas, cartões e divisão de despesas.
          </p>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 print:py-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* SIDEBAR NAVIGATION (DESKTOP) */}
          <aside className="hidden lg:block lg:col-span-1 print:hidden">
            <div className="sticky top-24 space-y-3 rounded-xl border border-border/60 bg-card/60 p-4 text-sm shadow-sm backdrop-blur-sm">
              <p className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                Sumário do Documento
              </p>
              <nav className="flex flex-col space-y-1 text-xs">
                <button onClick={() => scrollToSection('sec-1')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  1. Apresentação e Aceite
                </button>
                <button onClick={() => scrollToSection('sec-2')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  2. Elegibilidade e Cadastro
                </button>
                <button onClick={() => scrollToSection('sec-3')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  3. Natureza dos Serviços
                </button>
                <button onClick={() => scrollToSection('sec-4')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  4. Segurança e Acesso (Passkeys)
                </button>
                <button onClick={() => scrollToSection('sec-5')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  5. Importação Inteligente e IA
                </button>
                <button onClick={() => scrollToSection('sec-6')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  6. Divisão de Despesas e Dívidas
                </button>
                <button onClick={() => scrollToSection('sec-7')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  7. Propriedade Intelectual
                </button>
                <button onClick={() => scrollToSection('sec-8')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  8. Limitação de Responsabilidade
                </button>
                <button onClick={() => scrollToSection('sec-9')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  9. Cancelamento e Exclusão Total
                </button>
                <button onClick={() => scrollToSection('sec-10')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  10. Modificações dos Termos
                </button>
                <button onClick={() => scrollToSection('sec-11')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  11. Legislação e Foro
                </button>
                <button onClick={() => scrollToSection('sec-12')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  12. Fale Conosco
                </button>
              </nav>

              <div className="pt-3 border-t border-border/60">
                <Link
                  to="/privacy"
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <Lock className="h-3 w-3" />
                  Política de Privacidade
                </Link>
              </div>
            </div>
          </aside>

          {/* MAIN LEGAL TEXT */}
          <main className="lg:col-span-3 space-y-8 text-foreground/90 leading-relaxed text-sm sm:text-base">
            {/* CARD RESUMO EXECUTIVO */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5">
              <h2 className="font-semibold text-foreground text-sm sm:text-base flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
                Resumo em Linguagem Simples (Transparência Total)
              </h2>
              <ul className="mt-2 text-xs sm:text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>O OxeDinDin é uma ferramenta de organização financeira pessoal para você tomar o controle do seu dinheiro.</li>
                <li><strong>Nós não somos um banco</strong> e não realizamos transferências ou saques por você.</li>
                <li><strong>Não pedimos suas senhas bancárias</strong> e não comercializamos seus dados com anunciantes.</li>
                <li>Você tem liberdade total para exportar ou apagar sua conta e todos os seus registros a qualquer momento.</li>
              </ul>
            </div>

            {/* SEÇÃO 1 */}
            <section id="sec-1" className="space-y-3 pt-2">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                Apresentação e Aceitação dos Termos
              </h2>
              <p>
                Bem-vindo ao <strong>OxeDinDin</strong>. Ao acessar o site, registrar uma conta de usuário ou utilizar qualquer funcionalidade do aplicativo, você declara que leu, compreendeu e concorda integralmente com estes Termos de Uso e com a nossa{' '}
                <Link to="/privacy" className="text-primary hover:underline font-medium">Política de Privacidade</Link>.
              </p>
              <p>
                Estes Termos constituem um contrato vinculante entre você (o &quot;Usuário&quot;) e os desenvolvedores e mantenedores do OxeDinDin. Caso você não concorde com qualquer disposição aqui estabelecida, solicitamos que não prossiga com o cadastro e encerre o uso de nossos serviços.
              </p>
            </section>

            {/* SEÇÃO 2 */}
            <section id="sec-2" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
                Elegibilidade e Cadastro
              </h2>
              <p>
                Para criar uma conta e utilizar o OxeDinDin, você deve ser uma pessoa física com idade igual ou superior a 18 (dezoito) anos, ou estar devidamente assistido ou representado nos termos da legislação brasileira aplicável.
              </p>
              <p>
                Você se compromete a fornecer informações cadastrais precisas, verdadeiras e atualizadas (como seu nome e endereço de e-mail). É expressamente proibido criar contas utilizando identidade de terceiros ou endereços de e-mail fraudulentos.
              </p>
            </section>

            {/* SEÇÃO 3 */}
            <section id="sec-3" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
                Natureza dos Serviços Prestados
              </h2>
              <p>
                O OxeDinDin é uma aplicação de <em>software</em> destinada exclusivamente ao gerenciamento orçamentário pessoal, controle de fluxo de caixa, acompanhamento de faturas de cartão de crédito, divisão de contas entre pessoas e planejamento financeiro.
              </p>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs sm:text-sm text-foreground/90 space-y-1">
                <p className="font-semibold text-amber-700 dark:text-amber-300">
                  Importante — O OxeDinDin NÃO é uma Instituição Financeira:
                </p>
                <p className="text-muted-foreground">
                  O OxeDinDin não realiza intermediação financeira, custódia de dinheiro, liquidação de pagamentos, cobrança compulsória, concessão de empréstimos nem consultoria formal de investimentos. Todos os dados exibidos derivam exclusivamente dos lançamentos e parametrizações fornecidos pelo próprio Usuário.
                </p>
              </div>
            </section>

            {/* SEÇÃO 4 */}
            <section id="sec-4" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">4</span>
                Segurança, Senhas e Acesso por Biometria (Passkeys)
              </h2>
              <p>
                A segurança da sua conta é uma responsabilidade compartilhada:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-muted-foreground text-xs sm:text-sm">
                <li>
                  <strong className="text-foreground">Guarda de Credenciais:</strong> Você é o único responsável pela guarda e confidencialidade de sua senha, chaves de segurança físicas e dispositivos biométricos vinculados.
                </li>
                <li>
                  <strong className="text-foreground">Passkeys / Biometria:</strong> Ao ativar o acesso via Passkeys (WebAuthn), a autenticação biométrica (leitor de digital, Face ID ou Windows Hello) ocorre localmente no hardware do seu próprio aparelho. O OxeDinDin nunca tem acesso às suas impressões digitais ou fotos biométricas.
                </li>
                <li>
                  <strong className="text-foreground">Notificação de Violação:</strong> Caso suspeite de qualquer uso indevido ou invasão de sua conta, você deve alterar sua senha imediatamente e contatar nossa equipe.
                </li>
              </ul>
            </section>

            {/* SEÇÃO 5 */}
            <section id="sec-5" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">5</span>
                Funcionalidades de Importação Inteligente e Inteligência Artificial
              </h2>
              <p>
                O OxeDinDin disponibiliza comandos (<em>prompts</em>) e formatos estruturados (JSON) para facilitar a importação em lote de transações, faturas e contas, auxiliado por ferramentas externas de inteligência artificial de livre escolha do Usuário (como ChatGPT, Claude, Gemini, DeepSeek).
              </p>
              <p>
                O Usuário reconhece expressamente que modelos de IA podem cometer erros de interpretação em textos de extratos ou datas. O Usuário é o único responsável por conferir o resumo de validação antes de confirmar a gravação definitiva dos registros no sistema.
              </p>
            </section>

            {/* SEÇÃO 6 */}
            <section id="sec-6" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">6</span>
                Divisão de Despesas e Dívidas Compartilhadas
              </h2>
              <p>
                As funcionalidades de divisão de despesas e registro de débitos entre amigos ou familiares possuem caráter estritamente organizativo e de conveniência interna.
              </p>
              <p>
                O OxeDinDin não emite boletos de cobrança judicial, não atua como garantidor de pagamentos de terceiros e não possui qualquer responsabilidade jurídica ou financeira pelo inadimplemento de qualquer pessoa com quem você tenha compartilhado uma despesa.
              </p>
            </section>

            {/* SEÇÃO 7 */}
            <section id="sec-7" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">7</span>
                Propriedade Intelectual
              </h2>
              <p>
                Todo o conteúdo da plataforma OxeDinDin — incluindo código-fonte, arquitetura de sistemas, logotipos, elementos visuais, textos explicativos e banco de componentes — é protegido pela legislação de direitos autorais e propriedade intelectual.
              </p>
              <p>
                É proibida a engenharia reversa, cópia não autorizada, comercialização ou distribuição da plataforma sem prévia autorização por escrito dos mantenedores do projeto.
              </p>
            </section>

            {/* SEÇÃO 8 */}
            <section id="sec-8" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">8</span>
                Limitação de Responsabilidade
              </h2>
              <p>
                Empregamos as melhores práticas técnicas de engenharia de software e segurança cibernética para manter o sistema estável e seguro. Todavia, o serviço é disponibilizado &quot;no estado em que se encontra&quot; (<em>as is</em>) e &quot;conforme disponível&quot;.
              </p>
              <p>
                O OxeDinDin não se responsabiliza por:
              </p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs sm:text-sm">
                <li>Instabilidades temporárias ocasionadas por falhas na conexão de internet do usuário ou provedores de nuvem.</li>
                <li>Erros em cálculos resultantes de lançamentos manuais incorretos ou datas retroativas inconsistentes lançadas pelo Usuário.</li>
                <li>Decisões pessoais de consumo, investimento ou endividamento tomadas pelo Usuário com base nas métricas visuais do aplicativo.</li>
              </ul>
            </section>

            {/* SEÇÃO 9 */}
            <section id="sec-9" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">9</span>
                Cancelamento, Encerramento e Exclusão Total da Conta
              </h2>
              <p>
                Você pode interromper o uso do OxeDinDin e solicitar a exclusão total da sua conta a qualquer momento diretamente pelo painel de <strong>Configurações &gt; Segurança e Dados</strong>.
              </p>
              <p>
                Em conformidade com a LGPD (Lei Geral de Proteção de Dados), ao confirmar a exclusão da sua conta, todos os seus dados cadastrais, contas bancárias, cartões, despesas e transações serão permanentemente eliminados de nossos bancos de dados principais, de forma irreversível.
              </p>
            </section>

            {/* SEÇÃO 10 */}
            <section id="sec-10" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">10</span>
                Modificações destes Termos
              </h2>
              <p>
                Reservamo-nos o direito de atualizar e aprimorar estes Termos de Uso periodicamente para refletir novas funcionalidades da ferramenta ou adequações a novos dispositivos legais.
              </p>
              <p>
                Sempre que houver atualizações relevantes, indicaremos a data da última revisão no topo deste documento e notificaremos os usuários através de avisos em destaque no painel da aplicação.
              </p>
            </section>

            {/* SEÇÃO 11 */}
            <section id="sec-11" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">11</span>
                Legislação Aplicável e Foro
              </h2>
              <p>
                Estes Termos de Uso são regidos e interpretados em conformidade com as leis da <strong>República Federativa do Brasil</strong>, em especial o Código Civil Brasileiro (Lei nº 10.406/2002), o Marco Civil da Internet (Lei nº 12.965/2014) e a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018).
              </p>
              <p>
                Fica eleito o foro do domicílio do Usuário para dirimir eventuais controvérsias decorrentes destes Termos, ressalvadas as hipóteses em que a legislação consumerista determine foro diverso.
              </p>
            </section>

            {/* SEÇÃO 12 */}
            <section id="sec-12" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">12</span>
                Canal de Atendimento e Dúvidas
              </h2>
              <p>
                Se você tiver qualquer dúvida sobre estes Termos de Uso ou precisar de auxílio com a sua conta, entre em contato com nossa equipe através dos canais de suporte oficiais disponibilizados na plataforma.
              </p>
            </section>

            {/* FOOTER ACTIONS */}
            <div className="pt-8 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
              <Link
                to="/privacy"
                className="text-sm text-primary hover:underline font-medium flex items-center gap-1.5"
              >
                <Lock className="h-4 w-4" />
                Conheça nossa Política de Privacidade
              </Link>

              <div className="flex items-center gap-3">
                <Button variant="outline" onClick={handleBack}>
                  Voltar
                </Button>
                <Button onClick={() => navigate(isAuthenticated ? '/dashboard' : '/register')}>
                  {isAuthenticated ? 'Voltar ao Dashboard' : 'Criar Minha Conta Grátis'}
                </Button>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
