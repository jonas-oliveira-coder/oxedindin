import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Logo } from '@/components/shared/logo';
import { cn, formatMoney } from '@/lib/utils';
import {
  ArrowRight,
  CreditCard,
  Users,
  Receipt,
  Sparkles,
  ShieldCheck,
  KeyRound,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Moon,
  Sun,
  Menu,
  X,
  TrendingDown,
  Lock,
  Layers,
} from 'lucide-react';

export function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

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

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* HEADER / NAVBAR */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <Logo className="h-9 w-9" />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              OxeDinDin
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <button onClick={() => scrollToSection('features')} className="transition hover:text-foreground">
              Funcionalidades
            </button>
            <button onClick={() => scrollToSection('comparison')} className="transition hover:text-foreground">
              Diferenciais
            </button>
            <button onClick={() => scrollToSection('security')} className="transition hover:text-foreground">
              Segurança
            </button>
            <button onClick={() => scrollToSection('faq')} className="transition hover:text-foreground">
              FAQ
            </button>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label="Alternar tema"
              className="text-muted-foreground hover:text-foreground"
            >
              {darkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5 text-slate-700" />}
            </Button>

            {isAuthenticated ? (
              <Button onClick={() => navigate('/dashboard')} className="gap-2 font-semibold">
                Ir para o Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/login')} className="font-medium">
                  Entrar
                </Button>
                <Button onClick={() => navigate('/register')} className="font-semibold shadow-sm">
                  Começar Grátis
                </Button>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDarkMode((prev) => !prev)}
              aria-label="Alternar tema"
              className="text-muted-foreground"
            >
              {darkMode ? <Sun className="h-5 w-5 text-amber-400" /> : <Moon className="h-5 w-5" />}
            </Button>
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
              aria-label="Menu principal"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="border-b border-border bg-background px-4 py-4 md:hidden animate-in slide-in-from-top-2">
            <nav className="flex flex-col gap-3 text-sm font-medium">
              <button
                onClick={() => scrollToSection('features')}
                className="flex items-center justify-between py-2 text-left text-muted-foreground hover:text-foreground"
              >
                Funcionalidades
              </button>
              <button
                onClick={() => scrollToSection('comparison')}
                className="flex items-center justify-between py-2 text-left text-muted-foreground hover:text-foreground"
              >
                Diferenciais
              </button>
              <button
                onClick={() => scrollToSection('security')}
                className="flex items-center justify-between py-2 text-left text-muted-foreground hover:text-foreground"
              >
                Segurança
              </button>
              <button
                onClick={() => scrollToSection('faq')}
                className="flex items-center justify-between py-2 text-left text-muted-foreground hover:text-foreground"
              >
                FAQ
              </button>
              <div className="pt-2 border-t flex flex-col gap-2">
                {isAuthenticated ? (
                  <Button onClick={() => navigate('/dashboard')} className="w-full justify-center">
                    Ir para o Dashboard
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => navigate('/login')} className="w-full justify-center">
                      Entrar
                    </Button>
                    <Button onClick={() => navigate('/register')} className="w-full justify-center font-semibold">
                      Criar Conta Gratuita
                    </Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* HERO SECTION */}
      <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-32">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/15 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Gestão financeira pessoal descomplicada</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-foreground leading-[1.15]">
              O controle do seu dindin.{' '}
              <span className="bg-gradient-to-r from-primary via-cyan-500 to-sky-600 bg-clip-text text-transparent">
                Sem planilhas chatas, sem complicação.
              </span>
            </h1>

            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
              Controle cartões de crédito, parcelamentos futuros, despesas divididas com amigos e boletos a pagar em um app rápido, transparente e direto ao ponto.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              {isAuthenticated ? (
                <Button size="lg" onClick={() => navigate('/dashboard')} className="w-full sm:w-auto h-12 px-8 text-base font-semibold gap-2 shadow-lg shadow-primary/20">
                  Acessar meu Dashboard
                  <ArrowRight className="h-5 w-5" />
                </Button>
              ) : (
                <>
                  <Button size="lg" onClick={() => navigate('/register')} className="w-full sm:w-auto h-12 px-8 text-base font-semibold gap-2 shadow-lg shadow-primary/20">
                    Criar Conta Gratuita
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                  <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="w-full sm:w-auto h-12 px-6 text-base font-medium">
                    Já tenho uma conta
                  </Button>
                </>
              )}
            </div>

            <div className="pt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                100% Gratuito
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Sem propagandas invasivas
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Login com Biometria (Passkey)
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Privacidade garantida
              </span>
            </div>
          </div>

          {/* REALISTIC HERO UI PREVIEW */}
          <div className="mt-14 sm:mt-16 relative">
            <div className="rounded-2xl border border-border/80 bg-card p-3 sm:p-5 shadow-2xl shadow-primary/10">
              {/* Window Frame Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3 mb-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-rose-500/80 inline-block" />
                    <span className="h-3 w-3 rounded-full bg-amber-500/80 inline-block" />
                    <span className="h-3 w-3 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <span className="ml-2 font-mono text-[11px] text-muted-foreground hidden sm:inline">app.oxedindin.com.br</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                    Ao vivo
                  </Badge>
                  <span className="font-medium text-foreground">Visão Geral</span>
                </div>
              </div>

              {/* Mock Dashboard Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                <div className="p-3 sm:p-4 rounded-xl border bg-background">
                  <p className="text-xs text-muted-foreground font-medium">Saldo em Contas</p>
                  <p className="text-lg sm:text-2xl font-bold mt-1 text-foreground">{formatMoney(485000)}</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">+R$ 1.250 este mês</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl border bg-background">
                  <p className="text-xs text-muted-foreground font-medium">Fatura Atual</p>
                  <p className="text-lg sm:text-2xl font-bold mt-1 text-destructive">{formatMoney(142080)}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Fecha em 5 dias</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl border bg-background">
                  <p className="text-xs text-muted-foreground font-medium">Parcelamentos Ativos</p>
                  <p className="text-lg sm:text-2xl font-bold mt-1 text-foreground">R$ 689,90</p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">3 compras parceladas</p>
                </div>
                <div className="p-3 sm:p-4 rounded-xl border bg-background">
                  <p className="text-xs text-muted-foreground font-medium">Contas a Pagar</p>
                  <p className="text-lg sm:text-2xl font-bold mt-1 text-foreground">R$ 1.800,00</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Aluguel & Internet</p>
                </div>
              </div>

              {/* Two Column Mock Content */}
              <div className="grid md:grid-cols-12 gap-4">
                {/* Cartão de Crédito Widget */}
                <div className="md:col-span-5 p-4 rounded-xl border bg-background space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                      <span className="font-semibold text-sm">Nubank Ultravioleta</span>
                    </div>
                    <Badge variant="secondary" className="text-[11px]">Mastercard</Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Limite Disponível</span>
                      <span className="font-bold text-foreground">{formatMoney(857920)}</span>
                    </div>
                    <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: '14.2%' }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>Usado: {formatMoney(142080)}</span>
                      <span>Total: {formatMoney(1000000)}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t flex justify-between text-xs text-muted-foreground">
                    <span>Fechamento: dia <strong>25</strong></span>
                    <span>Vencimento: dia <strong>05</strong></span>
                  </div>
                </div>

                {/* Transações Recentes Widget */}
                <div className="md:col-span-7 p-4 rounded-xl border bg-background space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">Transações Recentes</span>
                    <span className="text-xs text-primary font-medium">Ver todas</span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">Notebook Dell (3/10)</p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary shrink-0">
                            Parcela
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Cartão Ultravioleta · Tecnologia</p>
                      </div>
                      <span className="font-bold text-destructive shrink-0">-R$ 389,90</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                      <div className="min-w-0">
                        <p className="font-medium truncate">Supermercado Pão de Açúcar</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Cartão Ultravioleta · Alimentação</p>
                      </div>
                      <span className="font-bold text-destructive shrink-0">-R$ 246,50</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate">Churrasco com a Turma</p>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-cyan-500/30 text-cyan-600 dark:text-cyan-400 shrink-0">
                            Dividido
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Dividido com Maria e Lucas</p>
                      </div>
                      <span className="font-bold text-destructive shrink-0">-R$ 75,00</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM VS SOLUTION SECTION */}
      <section id="comparison" className="py-20 border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-14 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Por que você precisa do OxeDinDin?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              A maioria das pessoas perde o controle financeiro não por falta de disciplina, mas por usar ferramentas que dão trabalho demais ou não mostram a realidade do futuro.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
            {/* O jeito antigo */}
            <div className="rounded-2xl border border-destructive/20 bg-card p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">O jeito confuso e cansativo</h3>
                  <p className="text-xs text-muted-foreground">Planilhas manuais e apps comerciais</p>
                </div>
              </div>

              <ul className="space-y-3.5 text-sm text-muted-foreground">
                <li className="flex items-start gap-2.5">
                  <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>Planilhas abandonadas na segunda semana porque anotar cada café dá preguiça.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>Susto na fatura do cartão porque você esqueceu quantas compras parceladas ainda faltam cair.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>Cobrar amigos no WhatsApp por contas divididas gera constrangimento e confusão de valores.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <X className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>Apps cheios de anúncios de empréstimo e que exigem senhas bancárias invasivas.</span>
                </li>
              </ul>
            </div>

            {/* Com o OxeDinDin */}
            <div className="rounded-2xl border border-primary/30 bg-card p-6 sm:p-8 space-y-5 shadow-lg shadow-primary/5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">Com o OxeDinDin</h3>
                  <p className="text-xs text-muted-foreground">Tudo claro, rápido e no seu controle</p>
                </div>
              </div>

              <ul className="space-y-3.5 text-sm text-foreground">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span><strong>Visão real do futuro:</strong> saiba exatamente quanto do seu limite já está comprometido nos próximos meses.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span><strong>Parcelas são transações de verdade:</strong> acompanhe parcela por parcela na fatura sem surpresas.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span><strong>Divisão justa de contas:</strong> registre com quem dividiu e quite o valor com 1 toque.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span><strong>Importador inteligente:</strong> transforme extratos e notas em dados completos em segundos.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CORE FEATURES SECTION */}
      <section id="features" className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16 space-y-3">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
              Funcionalidades Essenciais
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Tudo o que você precisa para dominar suas finanças
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Projetado com carinho e focado no que realmente importa no dia a dia do brasileiro.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Feature 1 */}
            <div className="rounded-2xl border bg-card p-6 space-y-3 transition hover:shadow-md hover:border-primary/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CreditCard className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg">Cartões & Faturas Transparentes</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Cadastre seus cartões, acompanhe o dia de fechamento e vencimento, e veja o limite disponível atualizado a cada lançamento.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-2xl border bg-card p-6 space-y-3 transition hover:shadow-md hover:border-primary/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Layers className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg">Compras Parceladas de Verdade</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Chega de parcelas invisíveis. Cada compra parcelada gera transações reais para cada mês correspondente, impactando o fluxo com precisão.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-2xl border bg-card p-6 space-y-3 transition hover:shadow-md hover:border-primary/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500">
                <Users className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg">Divisão de Despesas (Splits)</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Dividiu o almoço, a viagem ou o aluguel? Adicione pessoas aos gastos e saiba exatamente quem já pagou e quem ainda deve para você.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-2xl border bg-card p-6 space-y-3 transition hover:shadow-md hover:border-primary/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Receipt className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg">Contas a Pagar & Recorrentes</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Organize seus boletos, assinaturas (Netflix, Spotify) e custos fixos. Veja o status pendente ou pago antes de vencer para não pagar juros.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="rounded-2xl border bg-card p-6 space-y-3 transition hover:shadow-md hover:border-primary/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10 text-purple-500">
                <Sparkles className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg">Importador Inteligente</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Cole o extrato ou texto da fatura na sua IA favorita com nosso prompt pronto e importe tudo em 1 clique sem gerar parcelas retroativas no passado.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="rounded-2xl border bg-card p-6 space-y-3 transition hover:shadow-md hover:border-primary/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500">
                <BarChart3 className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-lg">Projeção & Fluxo de Caixa</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Gráficos claros de gastos por categoria e tabela de projeção dos próximos 12 meses para você planejar metas sem medo.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY & PRIVACY SECTION */}
      <section id="security" className="py-20 border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16 space-y-3">
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10">
              Privacidade & Segurança
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Seu dinheiro é assunto particular seu. Ponto final.
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Não vendemos seus dados, não exibimos anúncios e usamos os padrões de segurança mais modernos da indústria.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6 max-w-5xl mx-auto">
            <div className="rounded-2xl border bg-card p-6 space-y-3 text-center sm:text-left">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 mx-auto sm:mx-0">
                <KeyRound className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-base text-foreground">Passkeys & Biometria</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Acesse sua conta com Touch ID, Face ID ou Windows Hello via WebAuthn. O padrão ouro que substitui senhas vulneráveis.
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-6 space-y-3 text-center sm:text-left">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary mx-auto sm:mx-0">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-base text-foreground">Sem Open Banking Invasivo</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Você nunca precisará digitar senhas de agência ou dar acesso de leitura total à sua conta bancária a terceiros.
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-6 space-y-3 text-center sm:text-left">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-500 mx-auto sm:mx-0">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-base text-foreground">Criptografia Robusta</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Senhas protegidas com Argon2id, tokens com rotação automática e bancos de dados isolados para proteção integral.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS (3 STEPS) */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16 space-y-3">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Comece a organizar suas finanças em 3 passos
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground">
              Sem burocracia, sem pedir dados desnecessários.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto relative">
            <div className="rounded-2xl border bg-card p-6 space-y-4 relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-base">
                1
              </div>
              <h3 className="font-bold text-lg text-foreground">Crie sua conta gratuita</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Cadastre-se com seu e-mail em menos de 1 minuto. Você pode habilitar login por biometria logo em seguida.
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-6 space-y-4 relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-base">
                2
              </div>
              <h3 className="font-bold text-lg text-foreground">Adicione cartões e despesas</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Cadastre seus cartões de crédito e contas ou use nossa importação inteligente para carregar tudo de uma vez.
              </p>
            </div>

            <div className="rounded-2xl border bg-card p-6 space-y-4 relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-base">
                3
              </div>
              <h3 className="font-bold text-lg text-foreground">Acompanhe com tranquilidade</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Veja o impacto das compras parceladas, saiba quem lhe deve e pague suas faturas e boletos em dia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ SECTION */}
      <section id="faq" className="py-20 border-t border-border/60 bg-muted/20">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14 space-y-3">
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
              Dúvidas Frequentes
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Tudo o que você precisa saber
            </h2>
            <p className="text-base text-muted-foreground">
              Transparência é um dos nossos maiores compromissos.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'O OxeDinDin é realmente gratuito?',
                a: 'Sim, 100% gratuito. Você pode gerenciar suas contas bancárias, cartões de crédito, compras parceladas, despesas divididas e relatórios sem nenhuma cobrança oculta.',
              },
              {
                q: 'Preciso conectar minha conta de banco ou informar senhas bancárias?',
                a: 'Não! O OxeDinDin não solicita senhas de banco nem exige conexão de Open Banking invasiva. Você tem controle total dos seus dados.',
              },
              {
                q: 'Como o OxeDinDin calcula as compras parceladas?',
                a: 'Ao lançar uma compra parcelada no cartão, o sistema divide o valor e cria as parcelas automaticamente nas faturas dos meses subsequentes, permitindo que você veja exatamente o limite comprometido ao longo do tempo.',
              },
              {
                q: 'Como funciona a importação inteligente com IA?',
                a: 'Na aba de Transações, você pode clicar em "Importar com IA". O sistema disponibiliza um comando pronto para você colar no ChatGPT, Claude ou Gemini junto com o texto do seu extrato ou fatura. A IA gera um JSON estruturado e o sistema importa tudo com 1 clique, sem criar parcelas retroativas no passado.',
              },
              {
                q: 'Como funciona o login por biometria (Passkey)?',
                a: 'Você pode cadastrar o sensor biométrico do seu celular (Touch ID / Face ID) ou do seu computador (Windows Hello / leitor biométrico) nas configurações. Assim, você faz login instantaneamente com segurança máxima.',
              },
              {
                q: 'Posso acessar no celular e no computador?',
                a: 'Sim! O OxeDinDin foi projetado para funcionar perfeitamente em telas de celulares, tablets e computadores, com layout totalmente responsivo e touch-friendly.',
              },
            ].map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={faq.q} className="rounded-xl border bg-card overflow-hidden transition">
                  <button
                    onClick={() => toggleFaq(index)}
                    className="flex w-full items-center justify-between p-4 sm:p-5 text-left font-semibold text-foreground hover:bg-accent/50"
                  >
                    <span className="text-sm sm:text-base pr-4">{faq.q}</span>
                    <ChevronDown
                      className={cn('h-5 w-5 text-muted-foreground shrink-0 transition-transform duration-200', isOpen && 'rotate-180 text-primary')}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1 text-sm text-muted-foreground leading-relaxed border-t border-border/40">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINAL CTA SECTION */}
      <section className="py-20 relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-primary/30 bg-gradient-to-b from-primary/10 via-primary/5 to-background p-8 sm:p-12 lg:p-16 text-center space-y-6 max-w-4xl mx-auto shadow-xl shadow-primary/5">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
              Pronto para colocar o seu dindin nos trilhos?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
              Crie sua conta gratuita em menos de 1 minuto e sinta a paz de espírito de saber exatamente para onde vai cada centavo.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" onClick={() => navigate('/register')} className="w-full sm:w-auto h-12 px-8 text-base font-semibold gap-2 shadow-lg shadow-primary/20">
                Criar Conta Gratuita
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/login')} className="w-full sm:w-auto h-12 px-6 text-base font-medium">
                Acessar Minha Conta
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border/60 bg-muted/10 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <Logo className="h-7 w-7" />
              <span className="font-bold text-lg tracking-tight">OxeDinDin</span>
              <span className="text-xs text-muted-foreground ml-2">© {new Date().getFullYear()}</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <NavLink to="/terms" className="hover:text-foreground transition">
                Termos de Uso
              </NavLink>
              <NavLink to="/privacy" className="hover:text-foreground transition">
                Política de Privacidade
              </NavLink>
              <button onClick={() => scrollToSection('features')} className="hover:text-foreground transition">
                Funcionalidades
              </button>
              <button onClick={() => scrollToSection('faq')} className="hover:text-foreground transition">
                Perguntas Frequentes
              </button>
              <NavLink to="/login" className="hover:text-foreground transition">
                Entrar
              </NavLink>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border/40 text-center text-xs text-muted-foreground">
            Feito para simplificar o seu dindin com carinho, velocidade e segurança.
          </div>
        </div>
      </footer>
    </div>
  );
}
