import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatMoney } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { AlertCircle, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react';

interface Money {
  cents: number;
  currency: string;
}

interface SpendingByCategory {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  total: Money;
  percentage: number;
  transactionCount: number;
}

interface SpendingByPeriod {
  period: string;
  total: Money;
  expenses: Money;
  income: Money;
}

interface FixedVsVariable {
  fixed: Money;
  variable: Money;
  installments: Money;
  recurring: Money;
}

interface CashflowMonth {
  month: string;
  bills: Money;
  installments: Money;
  cards: Money;
  totalCommitted: Money;
}

interface Cashflow {
  months: CashflowMonth[];
  totalProjected: Money;
}

interface DebtsReport {
  toPay: Array<{ id: string; description: string; remaining: Money; dueDate: string }>;
  toReceive: Array<{ id: string; description: string; remaining: Money; dueDate: string }>;
}

const PIE_COLORS = ['#6366F1', '#22C55E', '#F59E0B', '#EF4444', '#06B6D4', '#8B5CF6', '#EC4899', '#84CC16', '#F97316', '#14B8A6'];

async function fetchSpendingByCategory(): Promise<SpendingByCategory[]> {
  const response = await api.get('/reports/spending-by-category');
  return response.data;
}

async function fetchSpendingByPeriod(): Promise<SpendingByPeriod[]> {
  const response = await api.get('/reports/spending-by-period', { params: { interval: 'month' } });
  return response.data;
}

async function fetchFixedVsVariable(): Promise<FixedVsVariable> {
  const response = await api.get('/reports/fixed-vs-variable');
  return response.data;
}

async function fetchCashflow(): Promise<Cashflow> {
  const response = await api.get('/reports/cashflow', { params: { months: 12 } });
  return response.data;
}

async function fetchDebts(): Promise<DebtsReport> {
  const response = await api.get('/reports/debts');
  return response.data;
}

export function ReportsPage() {
  const { data: byCategory, isLoading: loadingCategory } = useQuery({ queryKey: ['reportCategory'], queryFn: fetchSpendingByCategory });
  const { data: byPeriod, isLoading: loadingPeriod } = useQuery({ queryKey: ['reportPeriod'], queryFn: fetchSpendingByPeriod });
  const { data: fixedVsVariable } = useQuery({ queryKey: ['reportFixed'], queryFn: fetchFixedVsVariable });
  const { data: cashflow } = useQuery({ queryKey: ['reportCashflow'], queryFn: fetchCashflow });
  const { data: debtsReport } = useQuery({ queryKey: ['reportDebts'], queryFn: fetchDebts });

  const isLoading = loadingCategory || loadingPeriod;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="animate-pulse h-64 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const categoryChartData = (byCategory ?? []).map((c) => ({
    name: c.categoryName,
    value: c.total.cents / 100,
    percentage: c.percentage,
  }));

  const periodChartData = (byPeriod ?? []).map((p) => ({
    period: p.period,
    Despesas: p.expenses.cents / 100,
    Receitas: p.income.cents / 100,
  }));

  const cashflowData = (cashflow?.months ?? []).map((m) => ({
    month: m.month,
    Contas: m.bills.cents / 100,
    Parcelas: m.installments.cents / 100,
    Cartões: m.cards.cents / 100,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Relatórios</h1>
        <p className="text-muted-foreground">Visualize relatórios e análises financeiras</p>
      </div>

      {fixedVsVariable && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Gastos fixos</p>
                <PiggyBank className="h-5 w-5 text-primary" />
              </div>
              <p className="text-2xl font-bold mt-1">{formatMoney(fixedVsVariable.fixed.cents)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Gastos variáveis</p>
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <p className="text-2xl font-bold mt-1">{formatMoney(fixedVsVariable.variable.cents)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Parcelamentos</p>
                <TrendingUp className="h-5 w-5 text-warning" />
              </div>
              <p className="text-2xl font-bold mt-1">{formatMoney(fixedVsVariable.installments.cents)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">Recorrentes</p>
                <PiggyBank className="h-5 w-5 text-success" />
              </div>
              <p className="text-2xl font-bold mt-1">{formatMoney(fixedVsVariable.recurring.cents)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Gastos por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryChartData.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="60%" height={250}>
                  <PieChart>
                    <Pie data={categoryChartData} dataKey="value" nameKey="name" outerRadius={90} label>
                      {categoryChartData.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-2">
                  {categoryChartData.slice(0, 8).map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                        {entry.name}
                      </span>
                      <span className="text-muted-foreground">{entry.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">Sem despesas no período.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receitas e despesas por mês</CardTitle>
          </CardHeader>
          <CardContent>
            {periodChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={periodChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="Despesas" fill="#EF4444" />
                  <Bar dataKey="Receitas" fill="#22C55E" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">Sem movimentações no período.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {cashflowData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Projeção de fluxo de caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cashflowData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => `R$ ${value.toFixed(2)}`} />
                <Legend />
                <Bar dataKey="Contas" stackId="a" fill="#F59E0B" />
                <Bar dataKey="Parcelas" stackId="a" fill="#6366F1" />
                <Bar dataKey="Cartões" stackId="a" fill="#14B8A6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {debtsReport && (debtsReport.toPay.length > 0 || debtsReport.toReceive.length > 0) && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-destructive" />
                Dívidas a pagar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {debtsReport.toPay.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{d.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(d.dueDate).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <p className="font-bold text-destructive">{formatMoney(d.remaining.cents)}</p>
                </div>
              ))}
              {debtsReport.toPay.length === 0 && <p className="text-muted-foreground text-center py-4">Nenhuma dívida.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-success" />
                Valores a receber
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {debtsReport.toReceive.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">{d.description}</p>
                    <p className="text-xs text-muted-foreground">{new Date(d.dueDate).toLocaleDateString('pt-BR')}</p>
                  </div>
                  <p className="font-bold text-success">{formatMoney(d.remaining.cents)}</p>
                </div>
              ))}
              {debtsReport.toReceive.length === 0 && <p className="text-muted-foreground text-center py-4">Nenhum valor a receber.</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {!categoryChartData.length && !periodChartData.length && !cashflowData.length && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">Sem dados para exibir</h3>
            <p className="mt-2 text-muted-foreground">Registre transações para gerar relatórios.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}