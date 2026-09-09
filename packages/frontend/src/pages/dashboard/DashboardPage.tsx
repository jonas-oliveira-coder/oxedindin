import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatMoney, getStatusColor } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Wallet,
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';

interface DashboardSummary {
  totalBalance: { cents: number; currency: string };
  accountsBalance: Array<{ accountId: string; name: string; balance: { cents: number; currency: string } }>;
  totalExpensesMonth: { cents: number; currency: string };
  totalIncomeMonth: { cents: number; currency: string };
  pendingBillsTotal: { cents: number; currency: string };
  debtsTotal: { cents: number; currency: string };
  owedTotal: { cents: number; currency: string };
  currentInvoices: Array<{ cardId: string; name: string; total: { cents: number; currency: string }; dueDate: string }>;
  upcomingInvoices: Array<{ cardId: string; name: string; estimatedTotal: { cents: number; currency: string }; dueDate: string }>;
  upcomingBills: Array<{ id: string; description: string; amount: { cents: number; currency: string }; dueDate: string }>;
  upcomingInstallments: Array<{ planId: string; description: string; amount: { cents: number; currency: string }; dueDate: string }>;
  fixedExpenses: { cents: number; currency: string };
  cashflowProjection: Array<{ month: string; bills: { cents: number; currency: string }; installments: { cents: number; currency: string }; cards: { cents: number; currency: string }; totalCommitted: { cents: number; currency: string } }>;
}

async function fetchDashboard(): Promise<DashboardSummary> {
  const response = await api.get('/reports/summary');
  return response.data;
}

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    refetchInterval: 1000 * 60 * 5,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-8 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-8 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="mt-4 text-lg font-semibold">Erro ao carregar dashboard</h2>
        <p className="text-muted-foreground">{error instanceof Error ? error.message : 'Erro desconhecido'}</p>
      </div>
    );
  }

  const summary = data!;
  const balance = summary.totalBalance.cents;
  const expenses = summary.totalExpensesMonth.cents;
  const income = summary.totalIncomeMonth.cents;
  const netFlow = income - expenses;

  const stats = [
    {
      name: 'Saldo Total',
      value: formatMoney(balance),
      icon: Wallet,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      trend: netFlow >= 0 ? '+' : '',
      trendValue: formatMoney(Math.abs(netFlow)),
    },
    {
      name: 'Gastos do Mês',
      value: formatMoney(expenses),
      icon: TrendingDown,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
    {
      name: 'Receitas do Mês',
      value: formatMoney(income),
      icon: TrendingUp,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
    {
      name: 'Contas Pendentes',
      value: formatMoney(summary.pendingBillsTotal.cents),
      icon: AlertCircle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Olá! Aqui está seu resumo financeiro de {format(new Date(), 'MMMM', { locale: ptBR })}.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.name}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.name}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  {stat.trend && (
                    <p className="text-xs font-medium mt-1 flex items-center gap-1">
                      <span className={stat.trend.startsWith('+') ? 'text-success' : 'text-destructive'}>
                        {stat.trend}{stat.trendValue} vs mês passado
                      </span>
                    </p>
                  )}
                </div>
                <div className={cn('p-3 rounded-full', stat.bgColor)}>
                  <stat.icon className={cn('h-6 w-6', stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Faturas dos Cartões</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.currentInvoices.length === 0 && summary.upcomingInvoices.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">Nenhum cartão cadastrado</p>
            ) : (
              <div className="space-y-4">
                {summary.currentInvoices.map((invoice) => (
                  <div key={invoice.cardId} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{invoice.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Vence em {format(new Date(invoice.dueDate), 'dd/MM', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatMoney(invoice.total.cents)}</p>
                      <Badge variant="outline" className={getStatusColor('OPEN')}>
                        Aberta
                      </Badge>
                    </div>
                  </div>
                ))}
                {summary.upcomingInvoices.map((invoice) => (
                  <div key={invoice.cardId} className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{invoice.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Próxima: {format(new Date(invoice.dueDate), 'dd/MM', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{formatMoney(invoice.estimatedTotal.cents)}</p>
                      <Badge variant="secondary">Prévia</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Próximos Vencimentos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {[
                ...summary.upcomingBills.slice(0, 5).map((bill) => ({
                  ...bill,
                  type: 'bill' as const,
                  icon: DollarSign,
                  color: 'text-warning',
                })),
                ...summary.upcomingInstallments.slice(0, 5).map((inst) => ({
                  ...inst,
                  type: 'installment' as const,
                  icon: CreditCard,
                  color: 'text-primary',
                })),
              ]
                .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
                .slice(0, 8)
                .map((item, index) => (
                  <div key={`${item.type}-${index}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50">
                    <div className="flex items-center gap-3">
                      <item.icon className={cn('h-5 w-5', item.color)} />
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(item.dueDate), 'dd/MM/yyyy', { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <p className="font-bold">{formatMoney(item.amount.cents)}</p>
                  </div>
                ))}
              {summary.upcomingBills.length === 0 && summary.upcomingInstallments.length === 0 && (
                <p className="text-muted-foreground text-center py-8">Nenhum vencimento próximo</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Dívidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-2">
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <p className="text-sm text-muted-foreground">A pagar</p>
                <p className="text-2xl font-bold text-destructive">{formatMoney(summary.debtsTotal.cents)}</p>
              </div>
              <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                <p className="text-sm text-muted-foreground">A receber</p>
                <p className="text-2xl font-bold text-success">{formatMoney(summary.owedTotal.cents)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gastos Fixos Mensais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{formatMoney(summary.fixedExpenses.cents)}</p>
                <p className="text-sm text-muted-foreground">Comprometido todo mês</p>
              </div>
              <Calendar className="h-12 w-12 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {summary.cashflowProjection.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Projeção de Fluxo de Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left text-sm text-muted-foreground">
                    <th className="pb-2">Mês</th>
                    <th className="pb-2 text-right">Contas</th>
                    <th className="pb-2 text-right">Parcelas</th>
                    <th className="pb-2 text-right">Cartões</th>
                    <th className="pb-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.cashflowProjection.slice(0, 6).map((month) => (
                    <tr key={month.month} className="border-b last:border-0">
                      <td className="py-3 font-medium">{format(new Date(`${month.month}-01`), 'MMMM/yyyy', { locale: ptBR })}</td>
                      <td className="py-3 text-right">{formatMoney(month.bills.cents)}</td>
                      <td className="py-3 text-right">{formatMoney(month.installments.cents)}</td>
                      <td className="py-3 text-right">{formatMoney(month.cards.cents)}</td>
                      <td className="py-3 text-right font-bold">{formatMoney(month.totalCommitted.cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Contas Bancárias</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {summary.accountsBalance.slice(0, 5).map((account) => (
                <div key={account.accountId} className="flex items-center justify-between">
                  <p className="font-medium">{account.name}</p>
                  <p className="font-bold">{formatMoney(account.balance.cents)}</p>
                </div>
              ))}
              {summary.accountsBalance.length === 0 && (
                <p className="text-muted-foreground text-center py-4">Nenhuma conta cadastrada</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}