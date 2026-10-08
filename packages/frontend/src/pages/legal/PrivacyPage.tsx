import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/shared/logo';
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Printer,
  Moon,
  Sun,
  EyeOff,
  KeyRound,
  FileCheck2,
  Trash2,
} from 'lucide-react';

export function PrivacyPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    const saved = localStorage.getItem('drizzle-dark-mode');
    return saved ? saved === 'true' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.classList.toggle('dark', darkMode);
    html.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('drizzle-dark-mode', darkMode.toString());
  }, [darkMode]);

  const handlePrint = () => {
    window.print();
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
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
              onClick={handleGoBack}
              className="flex items-center gap-1.5 text-xs sm:text-sm h-9 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>

            {isAuthenticated ? (
              <Button
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-1.5 text-xs sm:text-sm h-9"
              >
                Dashboard
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => navigate('/login')}
                className="flex items-center gap-1.5 text-xs sm:text-sm h-9"
              >
                Entrar
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* HERO BANNER */}
      <div className="border-b border-border/40 bg-muted/20 py-10 px-4 print:py-4">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant="outline" className="border-primary/30 text-primary gap-1 py-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              LGPD e Proteção de Dados
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Última atualização: Outubro de 2026
            </Badge>
            <Badge variant="secondary" className="text-xs">
              Conformidade Lei nº 13.709/2018
            </Badge>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Política de Privacidade
          </h1>
          <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
            No OxeDinDin, sua privacidade financeira é sagrada. Entenda com total transparência como seus dados são
            protegidos, armazenados e tratados exclusivamente para benefício da sua organização pessoal.
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
                Sumário de Privacidade
              </p>
              <nav className="flex flex-col space-y-1 text-xs">
                <button onClick={() => scrollToSection('priv-1')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  1. Nosso Compromisso
                </button>
                <button onClick={() => scrollToSection('priv-2')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  2. Dados Pessoais Coletados
                </button>
                <button onClick={() => scrollToSection('priv-3')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  3. O Que NUNCA Coletamos
                </button>
                <button onClick={() => scrollToSection('priv-4')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  4. Finalidade e Base Legal
                </button>
                <button onClick={() => scrollToSection('priv-5')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  5. Zero Venda de Dados
                </button>
                <button onClick={() => scrollToSection('priv-6')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  6. Criptografia e Segurança
                </button>
                <button onClick={() => scrollToSection('priv-7')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  7. Seus Direitos (LGPD)
                </button>
                <button onClick={() => scrollToSection('priv-8')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  8. Cookies e Armazenamento
                </button>
                <button onClick={() => scrollToSection('priv-9')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  9. Exclusão e Retenção
                </button>
                <button onClick={() => scrollToSection('priv-10')} className="text-left py-1 text-muted-foreground hover:text-primary transition">
                  10. Contato do Encarregado (DPO)
                </button>
              </nav>

              <div className="pt-3 border-t border-border/60">
                <Link
                  to="/terms"
                  className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <FileCheck2 className="h-3 w-3" />
                  Ver Termos de Uso
                </Link>
              </div>
            </div>
          </aside>

          {/* MAIN PRIVACY TEXT */}
          <main className="lg:col-span-3 space-y-8 text-foreground/90 leading-relaxed text-sm sm:text-base">
            {/* CARDS DE PILARES DE PRIVACIDADE */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                  <EyeOff className="h-4 w-4" />
                  Zero Anúncios
                </div>
                <p className="text-xs text-muted-foreground">
                  Não rastreamos você pela web e não vendemos seu perfil a anunciantes.
                </p>
              </div>

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                  <KeyRound className="h-4 w-4" />
                  Passkeys Nativas
                </div>
                <p className="text-xs text-muted-foreground">
                  Autenticação moderna por biometria. Sua chave privada nunca sai do seu celular ou PC.
                </p>
              </div>

              <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold text-sm">
                  <Trash2 className="h-4 w-4" />
                  Exclusão em 1 Clique
                </div>
                <p className="text-xs text-muted-foreground">
                  Se você decidir sair, todos os seus dados e transações são apagados do banco sem burocracia.
                </p>
              </div>
            </div>

            {/* SEÇÃO 1 */}
            <section id="priv-1" className="space-y-3 pt-2">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                Nosso Compromisso com a sua Privacidade
              </h2>
              <p>
                A privacidade e a soberania sobre suas informações financeiras são princípios fundamentais na concepção do <strong>OxeDinDin</strong>. Esta Política descreve de forma clara e objetiva como coletamos, tratamos, protegemos e armazenamos seus dados, respeitando rigorosamente a <strong>Lei Geral de Proteção de Dados Pessoais (LGPD — Lei nº 13.709/2018)</strong> e o Marco Civil da Internet (Lei nº 12.965/2014).
              </p>
            </section>

            {/* SEÇÃO 2 */}
            <section id="priv-2" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
                Dados Pessoais Coletados
              </h2>
              <p>
                Coletamos estritamente os dados necessários para fornecer as funcionalidades operacionais da plataforma:
              </p>
              <ul className="list-disc list-inside space-y-2 text-xs sm:text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Dados Cadastrais Básicos:</strong> Nome completo e endereço de e-mail informados voluntariamente no momento do registro.
                </li>
                <li>
                  <strong className="text-foreground">Credenciais de Autenticação Segura:</strong> Hash criptográfico unidirecional de senha (utilizando algoritmo de alta resistência <em>Argon2id</em>) e/ou credenciais públicas para autenticação por Passkey (WebAuthn).
                </li>
                <li>
                  <strong className="text-foreground">Registros Financeiros Inseridos por Você:</strong> Nomes atribuídos por você a contas (ex: &quot;Conta Corrente&quot;), nomes fictícios ou de apelidos para cartões de crédito (ex: &quot;Cartão Preto&quot;), limites cadastrados manualmente, datas de vencimento/fechamento, registros de transações (receitas e despesas), faturas, categorias e anotações de dívidas ou divisões.
                </li>
                <li>
                  <strong className="text-foreground">Metadados Técnicos de Sessão:</strong> Endereço IP e identificadores de agente de usuário (<em>user-agent</em>) coletados estritamente para prevenção a ataques de força bruta e auditoria de segurança da sessão.
                </li>
              </ul>
            </section>

            {/* SEÇÃO 3 */}
            <section id="priv-3" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
                O Que NUNCA Coletamos nem Armazenamos
              </h2>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-2 text-xs sm:text-sm">
                <p className="font-semibold text-emerald-800 dark:text-emerald-300">
                  Transparência de Segurança Bancária:
                </p>
                <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
                  <li><strong>NUNCA solicitamos sua senha bancária</strong>, token de internet banking ou senhas do cartão físico.</li>
                  <li><strong>NUNCA solicitamos o código de segurança (CVV)</strong> ou o número completo do seu cartão de crédito real.</li>
                  <li><strong>NUNCA armazenamos seus dados biométricos reais</strong> (digitais, reconhecimento facial); o processamento biométrico ocorre exclusivamente de forma isolada dentro do chip do seu smartphone ou computador através do protocolo FIDO2 / WebAuthn.</li>
                </ul>
              </div>
            </section>

            {/* SEÇÃO 4 */}
            <section id="priv-4" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">4</span>
                Finalidade e Base Legal para o Tratamento dos Dados
              </h2>
              <p>
                Nos termos do Artigo 7º da LGPD, o tratamento dos seus dados fundamenta-se nas seguintes bases legais:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Execução de Contrato (Art. 7º, V):</strong> Para disponibilizar o painel financeiro, computar saldos consolidados, calcular faturas de cartão, emitir lembretes de contas a pagar e gerar relatórios gráficos solicitados por você.
                </li>
                <li>
                  <strong className="text-foreground">Legítimo Interesse e Segurança (Art. 7º, IX):</strong> Para proteger sua conta contra tentativas de invasão, auditar logins suspeitos e garantir a integridade do sistema.
                </li>
                <li>
                  <strong className="text-foreground">Cumprimento de Obrigação Legal (Art. 7º, II):</strong> Para guarda de registros de acesso nos termos do Marco Civil da Internet.
                </li>
              </ul>
            </section>

            {/* SEÇÃO 5 */}
            <section id="priv-5" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">5</span>
                Zero Compartilhamento e Zero Venda de Dados
              </h2>
              <p className="font-semibold text-foreground">
                Nós NÃO comercializamos, NÃO alugamos e NÃO cedemos seus dados pessoais ou registros financeiros para terceiros, birôs de crédito, instituições financeiras ou redes de publicidade.
              </p>
              <p>
                O compartilhamento de dados ocorre unicamente com provedores estritamente necessários para a operação tecnológica da infraestrutura (como provedores de hospedagem em nuvem de servidores seguros e banco de dados gerenciado), sob cláusulas estritas de confidencialidade e segurança.
              </p>
            </section>

            {/* SEÇÃO 6 */}
            <section id="priv-6" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">6</span>
                Criptografia e Segurança da Informação
              </h2>
              <p>
                Adotamos salvaguardas técnicas e organizacionais avançadas para salvaguardar suas informações:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Criptografia em Trânsito:</strong> 100% das comunicações utilizam protocolos seguros HTTPS / TLS 1.3 de ponta a ponta.
                </li>
                <li>
                  <strong className="text-foreground">Hashes Criptográficos Modernos:</strong> Senhas são protegidas com <em>Argon2id</em> com salt individual, tornando inviável a recuperação por ataques de dicionário ou tabelas arco-íris.
                </li>
                <li>
                  <strong className="text-foreground">Isolamento Estrito de Contas:</strong> Cada requisição é autenticada e validada contra o identificador unívoco do usuário logado (<em>multi-tenant isolation</em>), impedindo vazamento cruzado de informações entre usuários.
                </li>
              </ul>
            </section>

            {/* SEÇÃO 7 */}
            <section id="priv-7" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">7</span>
                Seus Direitos como Titular de Dados (Art. 18 da LGPD)
              </h2>
              <p>
                Você possui total titularidade sobre seus dados. A LGPD garante a você os seguintes direitos, exercíveis diretamente pela plataforma:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <strong className="text-foreground block">Acesso e Confirmação:</strong>
                  <span className="text-muted-foreground">Visualizar todos os seus dados em tempo real no dashboard.</span>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <strong className="text-foreground block">Correção e Atualização:</strong>
                  <span className="text-muted-foreground">Editar qualquer transação, conta, categoria ou dado cadastral a qualquer momento.</span>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <strong className="text-foreground block">Portabilidade / Exportação:</strong>
                  <span className="text-muted-foreground">Exportar seus dados financeiros em formato legível e aberto (JSON/CSV).</span>
                </div>
                <div className="rounded-lg border bg-card p-3 space-y-1">
                  <strong className="text-foreground block">Eliminação Definitiva:</strong>
                  <span className="text-muted-foreground">Apagar sua conta e todos os registros associados com 1 clique nas configurações.</span>
                </div>
              </div>
            </section>

            {/* SEÇÃO 8 */}
            <section id="priv-8" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">8</span>
                Cookies e Armazenamento Local
              </h2>
              <p>
                Não utilizamos cookies de terceiros para publicidade ou rastreamento comportamental de rede.
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                <li>
                  <strong className="text-foreground">Cookies de Sessão Segura:</strong> Cookies com parâmetros <em>HttpOnly</em>, <em>SameSite</em> e <em>Secure</em>, utilizados unicamente para manter você autenticado no painel com segurança.
                </li>
                <li>
                  <strong className="text-foreground">Armazenamento Local (localStorage):</strong> Utilizado apenas para memorizar sua preferência estética de tema (claro ou escuro) no navegador.
                </li>
              </ul>
            </section>

            {/* SEÇÃO 9 */}
            <section id="priv-9" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">9</span>
                Retenção e Exclusão Total dos Dados
              </h2>
              <p>
                Seus dados permanecem armazenados estritamente enquanto você mantiver sua conta ativa no OxeDinDin.
              </p>
              <p>
                Caso você decida excluir sua conta, todos os registros relacionados — incluindo transações, histórico de faturas, contas bancárias, credenciais e chaves Passkey — serão definitiva e irreversivelmente eliminados de nossas bases de produção.
              </p>
            </section>

            {/* SEÇÃO 10 */}
            <section id="priv-10" className="space-y-3 pt-4 border-t border-border/40">
              <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">10</span>
                Contato do Encarregado de Dados (DPO) e Suporte
              </h2>
              <p>
                Para exercer seus direitos de titular, tirar dúvidas sobre o tratamento de dados pessoais ou enviar sugestões, entre em contato com nosso Encarregado pelo Tratamento de Dados Pessoais através do canal oficial de suporte na plataforma.
              </p>
            </section>

            {/* FOOTER ACTIONS */}
            <div className="pt-8 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
              <Link
                to="/terms"
                className="text-sm text-primary hover:underline font-medium flex items-center gap-1.5"
              >
                <FileCheck2 className="h-4 w-4" />
                Consulte nossos Termos de Uso
              </Link>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleGoBack}
                  className="flex items-center gap-1.5"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar
                </Button>
                {isAuthenticated ? (
                  <Button onClick={() => navigate('/dashboard')} className="flex items-center gap-1.5">
                    Acessar Dashboard
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button onClick={() => navigate('/register')} className="flex items-center gap-1.5">
                    Criar Minha Conta Grátis
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
