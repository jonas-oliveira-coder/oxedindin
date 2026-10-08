import { useState, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, getErrorMessage } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import {
  Sparkles,
  Copy,
  Check,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileJson,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

export function getAiImportPrompt(referenceDate?: string): string {
  const today = referenceDate || new Date().toISOString().slice(0, 10);
  const [year, month] = today.split('-');

  return `Você é um assistente especialista em finanças pessoais para o aplicativo OxeDinDin.
Sua tarefa é analisar faturas de cartão de crédito, extratos bancários, anotações de gastos ou recibos e convertê-los em um JSON estruturado para popular o sistema.

DATA DE REFERÊNCIA DE HOJE: ${today} (Ano: ${year}, Mês: ${month})
Todas as datas informadas ou inferidas devem tomar como base esta data de referência.

Gere OBRIGATORIAMENTE uma resposta contendo APENAS o JSON válido (sem explicações antes ou depois). Você pode envolver em um bloco \`\`\`json \`\`\`.

### ESPECIFICAÇÃO DO JSON:
{
  "bankAccounts": [
    {
      "name": "Nubank",
      "institution": "Nubank",
      "type": "CHECKING", // Opções: "CHECKING", "SAVINGS", "INVESTMENT", "CASH", "OTHER"
      "initialBalance": 2500.00
    }
  ],
  "creditCards": [
    {
      "name": "Nubank Ultravioleta",
      "institution": "Nubank",
      "brand": "MASTERCARD", // Opções: "VISA", "MASTERCARD", "ELO", "AMEX", "HIPERCARD", "OTHER"
      "limit": 10000.00,
      "closingDay": 25,
      "dueDay": 5
    }
  ],
  "categories": [
    { "name": "Alimentação", "color": "#FF5722", "icon": "utensils" },
    { "name": "Transporte", "color": "#2196F3", "icon": "car" },
    { "name": "Salário", "color": "#4CAF50", "icon": "briefcase" },
    { "name": "Moradia", "color": "#9C27B0", "icon": "home" },
    { "name": "Lazer", "color": "#FF9800", "icon": "film" }
  ],
  "people": [
    { "name": "Maria Silva", "email": "maria@exemplo.com" }
  ],
  "transactions": [
    {
      "description": "Salário Mensal",
      "amount": 5000.00,
      "type": "INCOME", // "INCOME", "EXPENSE", "TRANSFER"
      "date": "${today}", // Formato ISO: YYYY-MM-DD
      "paymentMethod": "PIX", // "CASH", "DEBIT_CARD", "CREDIT_CARD", "PIX", "BANK_TRANSFER", "BOLETO", "OTHER"
      "accountName": "Nubank",
      "categoryName": "Salário"
    },
    {
      "description": "Supermercado Pão de Açúcar",
      "amount": 342.80,
      "type": "EXPENSE",
      "date": "${today}",
      "paymentMethod": "CREDIT_CARD",
      "cardName": "Nubank Ultravioleta",
      "categoryName": "Alimentação"
    },
    {
      "description": "Geladeira Frost Free (restante 7x)",
      "amount": 2100.00, // Valor total das parcelas que RESTAM a pagar a partir de hoje (7 x 300)
      "type": "EXPENSE",
      "date": "${today}",
      "paymentMethod": "CREDIT_CARD",
      "cardName": "Nubank Ultravioleta",
      "categoryName": "Moradia",
      "installmentsCount": 7 // Apenas as parcelas restantes a partir de hoje
    },
    {
      "description": "Almoço Compartilhado",
      "amount": 180.00,
      "type": "EXPENSE",
      "date": "${today}",
      "paymentMethod": "PIX",
      "accountName": "Nubank",
      "categoryName": "Alimentação",
      "splits": [
        { "personName": "Maria Silva", "amount": 90.00 } // Dividido com outras pessoas
      ]
    }
  ],
  "bills": [
    {
      "description": "Aluguel Apartamento",
      "amount": 1800.00,
      "dueDate": "${today}", // Formato ISO: YYYY-MM-DD
      "status": "PENDING", // "PENDING", "PAID", "OVERDUE"
      "categoryName": "Moradia",
      "paymentMethod": "PIX"
    }
  ],
  "debts": [
    {
      "description": "Empréstimo para reforma",
      "totalAmount": 1200.00,
      "dueDate": "${today}",
      "type": "BORROWED_MONEY", // "BORROWED_MONEY" (eu devo) | "LENT_MONEY" (me devem)
      "personName": "Maria Silva"
    }
  ]
}

### REGRAS CRÍTICAS E OBRIGATÓRIAS:
1. NÃO GERAR PARCELAS RETROATIVAS NO PASSADO:
   - O sistema gerencia as contas presentes e futuras. NUNCA crie parcelas em datas retroativas que já foram pagas em faturas anteriores.
   - Se o extrato ou texto contiver uma compra parcelada EM ANDAMENTO (ex: "TV 03/10 de R$ 200,00" ou "Sofá 4/12 de R$ 150,00"):
     a) As parcelas anteriores já foram quitadas no passado.
     b) Conte apenas quantas parcelas AINDA FALTAM pagar da fatura atual em diante. (Exemplo: em 03/10, se a 3ª ainda é a fatura aberta do mês atual, faltam 8 parcelas da 3ª à 10ª).
     c) Calcule o valor total restante: (parcelas restantes) × (valor de cada parcela).
     d) Lance UMA ÚNICA transação com:
        - "amount": valor total restante (ex: 8 × 200 = 1600.00)
        - "installmentsCount": número de parcelas restantes (ex: 8)
        - "date": data de referência de hoje (${today})
        - "paymentMethod": "CREDIT_CARD"
        - "cardName": nome do cartão
     O sistema OxeDinDin criará a 1ª parcela restante na fatura atual e distribuirá as demais parcelas automaticamente nos meses seguintes!
   - Para compras novas parceladas contratadas no mês corrente:
     - "amount": valor total da compra
     - "installmentsCount": total de parcelas
     - "date": data da compra no mês atual

2. DIVISÃO DE CONTAS (SPLITS):
   - Se uma despesa foi dividida com alguém, adicione a pessoa na lista "people" e informe o array "splits" na transação com "personName" e "amount".
   - Se for empréstimo direto sem gasto de consumo, use "debts" com "type": "LENT_MONEY" (se devem a você) ou "BORROWED_MONEY" (se você deve).

3. CARTÕES E CONTAS:
   - Sempre informe "closingDay" (dia de fechamento) e "dueDay" (dia de vencimento) nos cartões.
   - As referências por nome ("accountName", "cardName", "categoryName", "personName") devem bater exatamente com os nomes cadastrados.
   - Use valores numéricos decimais em reais (ex: 150.50).

4. Não inclua comentários nem texto fora do bloco JSON. Responda apenas com o JSON válido.`;
}

export const AI_IMPORT_SYSTEM_PROMPT = getAiImportPrompt();

const SAMPLE_PAYLOAD = {
  bankAccounts: [
    { name: 'Nubank Principal', institution: 'Nubank', type: 'CHECKING', initialBalance: 3200.0 },
    { name: 'Inter Reserva', institution: 'Inter', type: 'SAVINGS', initialBalance: 5000.0 },
  ],
  creditCards: [
    { name: 'Nubank Ultravioleta', institution: 'Nubank', brand: 'MASTERCARD', limit: 8000.0, closingDay: 25, dueDay: 5 },
  ],
  categories: [
    { name: 'Alimentação', color: '#FF5722' },
    { name: 'Transporte', color: '#2196F3' },
    { name: 'Salário', color: '#4CAF50' },
    { name: 'Moradia', color: '#9C27B0' },
    { name: 'Lazer', color: '#FF9800' },
  ],
  people: [
    { name: 'Mariana Souza' },
  ],
  transactions: [
    { description: 'Salário Mensal', amount: 6500.0, type: 'INCOME', date: '2026-03-01', paymentMethod: 'PIX', accountName: 'Nubank Principal', categoryName: 'Salário' },
    { description: 'Supermercado Mensal', amount: 485.3, type: 'EXPENSE', date: '2026-03-04', paymentMethod: 'CREDIT_CARD', cardName: 'Nubank Ultravioleta', categoryName: 'Alimentação' },
    { description: 'Combustível Posto', amount: 160.0, type: 'EXPENSE', date: '2026-03-06', paymentMethod: 'DEBIT_CARD', accountName: 'Nubank Principal', categoryName: 'Transporte' },
    { description: 'Smart TV Sala', amount: 2400.0, type: 'EXPENSE', date: '2026-03-05', paymentMethod: 'CREDIT_CARD', cardName: 'Nubank Ultravioleta', categoryName: 'Lazer', installmentsCount: 6 },
    { description: 'Jantar Restaurante', amount: 220.0, type: 'EXPENSE', date: '2026-03-07', paymentMethod: 'DEBIT_CARD', accountName: 'Nubank Principal', categoryName: 'Alimentação', splits: [{ personName: 'Mariana Souza', amount: 110.0 }] },
  ],
  bills: [
    { description: 'Condomínio', amount: 450.0, dueDate: '2026-03-10', status: 'PENDING', categoryName: 'Moradia', paymentMethod: 'PIX' },
  ],
  debts: [
    { description: 'Jantar compartilhado', totalAmount: 85.0, dueDate: '2026-03-20', type: 'LENT_MONEY', personName: 'Mariana Souza' },
  ],
};

export function cleanJsonInput(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

interface AiBulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ImportSummary {
  bankAccounts: number;
  creditCards: number;
  categories: number;
  people: number;
  transactions: number;
  installmentPlans?: number;
  splits?: number;
  bills: number;
  debts: number;
}

export function AiBulkImportDialog({ open, onOpenChange }: AiBulkImportDialogProps) {
  const [activeTab, setActiveTab] = useState<'prompt' | 'import'>('prompt');
  const [jsonInput, setJsonInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [lastResult, setLastResult] = useState<ImportSummary | null>(null);

  const queryClient = useQueryClient();

  const parsedData = useMemo(() => {
    if (!jsonInput.trim()) return null;
    try {
      const sanitized = cleanJsonInput(jsonInput);
      const parsed = JSON.parse(sanitized);
      if (typeof parsed !== 'object' || parsed === null) return { error: 'O conteúdo deve ser um objeto JSON.' };
      return { data: parsed, error: null };
    } catch (err: any) {
      return { error: err.message || 'JSON inválido' };
    }
  }, [jsonInput]);

  const counts = useMemo(() => {
    if (!parsedData?.data) return null;
    const d = parsedData.data;
    const txs = Array.isArray(d.transactions) ? d.transactions : [];
    const plansCount = txs.filter((t: any) => t.installmentsCount && t.installmentsCount > 1).length;
    const splitsCount = txs.reduce((acc: number, t: any) => acc + (Array.isArray(t.splits) ? t.splits.length : 0), 0);
    return {
      accounts: Array.isArray(d.bankAccounts) ? d.bankAccounts.length : 0,
      cards: Array.isArray(d.creditCards) ? d.creditCards.length : 0,
      categories: Array.isArray(d.categories) ? d.categories.length : 0,
      people: Array.isArray(d.people) ? d.people.length : 0,
      transactions: txs.length,
      plans: plansCount,
      splits: splitsCount,
      bills: Array.isArray(d.bills) ? d.bills.length : 0,
      debts: Array.isArray(d.debts) ? d.debts.length : 0,
    };
  }, [parsedData]);

  const promptText = useMemo(() => getAiImportPrompt(), []);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      toast({
        title: 'Prompt copiado!',
        description: 'Cole na sua IA favorita (ChatGPT, Claude, Gemini, DeepSeek).',
      });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Selecione e copie o texto manualmente.',
        variant: 'destructive',
      });
    }
  };

  const importMutation = useMutation({
    mutationFn: async (payload: any) => {
      const response = await api.post('/transactions/bulk-import', payload);
      return response.data as ImportSummary;
    },
    onSuccess: (data) => {
      setLastResult(data);
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['cards'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['people'] });
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      queryClient.invalidateQueries({ queryKey: ['debts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['reports'] });

      toast({
        title: 'Importação realizada com sucesso!',
        description: `${data.transactions} transações, ${data.bankAccounts} contas e ${data.creditCards} cartões processados.`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Falha na importação',
        description: getErrorMessage(error),
        variant: 'destructive',
      });
    },
  });

  const handleImport = () => {
    if (!parsedData?.data) return;
    importMutation.mutate(parsedData.data);
  };

  const handleLoadSample = () => {
    setJsonInput(JSON.stringify(SAMPLE_PAYLOAD, null, 2));
    setLastResult(null);
  };

  const handleReset = () => {
    setJsonInput('');
    setLastResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl sm:max-w-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <DialogTitle className="text-xl">Importação Inteligente com IA</DialogTitle>
          </div>
          <DialogDescription>
            Gere ou formate uma massa de dados completa (contas, cartões, categorias, transações, faturas) usando IA e importe tudo com 1 clique.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'prompt' | 'import')} className="mt-2">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="prompt" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              1. Prompt para IA
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <FileJson className="h-4 w-4" />
              2. Colar JSON & Importar
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PROMPT */}
          <TabsContent value="prompt" className="space-y-4 pt-3">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Como funciona:</p>
              <ol className="mt-1.5 list-decimal list-inside space-y-1">
                <li>Copie o comando de instrução abaixo.</li>
                <li>Envie no <strong>ChatGPT, Claude, Gemini ou DeepSeek</strong> junto com seus extratos bancários, faturas ou texto com seus gastos.</li>
                <li>Copie o JSON gerado pela IA e cole na aba <strong>&quot;Colar JSON &amp; Importar&quot;</strong>.</li>
              </ol>
            </div>

            {/* Observação para parcelamentos */}
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                <span>Observação importante: Compras parceladas sem cobranças retroativas</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                O prompt foi configurado para que a IA <strong>nunca gere parcelas passadas no histórico</strong>. Se o seu extrato contiver compras já em andamento (ex: &quot;3/10&quot;), a IA calculará e lançará apenas as parcelas restantes a partir de hoje. Isso mantém seu histórico limpo e evita gerar faturas retroativas vencidas!
              </p>
            </div>

            <div className="relative">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Template de Prompt para IA
                </span>
                <Button size="sm" variant="secondary" onClick={handleCopyPrompt} className="h-8 gap-1.5">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar Prompt'}
                </Button>
              </div>

              <div className="max-h-[300px] overflow-y-auto rounded-md border bg-muted/70 p-3 font-mono text-xs whitespace-pre-wrap text-foreground select-all">
                {promptText}
              </div>
            </div>

            <DialogFooter className="pt-2 flex sm:justify-between items-center">
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Dica: Você também pode carregar um exemplo de teste direto na próxima aba.
              </span>
              <Button onClick={() => setActiveTab('import')} className="gap-2">
                Avançar para Importação
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* TAB 2: IMPORTAR */}
          <TabsContent value="import" className="space-y-4 pt-3">
            {lastResult ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 font-semibold">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Importação concluída com sucesso!</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-background/80 p-2 rounded border">
                    <span className="text-muted-foreground block">Contas Bancárias</span>
                    <strong className="text-base">{lastResult.bankAccounts}</strong>
                  </div>
                  <div className="bg-background/80 p-2 rounded border">
                    <span className="text-muted-foreground block">Cartões</span>
                    <strong className="text-base">{lastResult.creditCards}</strong>
                  </div>
                  <div className="bg-background/80 p-2 rounded border">
                    <span className="text-muted-foreground block">Categorias</span>
                    <strong className="text-base">{lastResult.categories}</strong>
                  </div>
                  <div className="bg-background/80 p-2 rounded border">
                    <span className="text-muted-foreground block">Pessoas</span>
                    <strong className="text-base">{lastResult.people}</strong>
                  </div>
                  <div className="bg-background/80 p-2 rounded border">
                    <span className="text-muted-foreground block">Transações</span>
                    <strong className="text-base">{lastResult.transactions}</strong>
                  </div>
                  {typeof lastResult.installmentPlans === 'number' && lastResult.installmentPlans > 0 && (
                    <div className="bg-background/80 p-2 rounded border">
                      <span className="text-muted-foreground block">Parcelamentos</span>
                      <strong className="text-base">{lastResult.installmentPlans}</strong>
                    </div>
                  )}
                  {typeof lastResult.splits === 'number' && lastResult.splits > 0 && (
                    <div className="bg-background/80 p-2 rounded border">
                      <span className="text-muted-foreground block">Divisões</span>
                      <strong className="text-base">{lastResult.splits}</strong>
                    </div>
                  )}
                  <div className="bg-background/80 p-2 rounded border">
                    <span className="text-muted-foreground block">Contas a Pagar</span>
                    <strong className="text-base">{lastResult.bills}</strong>
                  </div>
                  <div className="bg-background/80 p-2 rounded border">
                    <span className="text-muted-foreground block">Dívidas/Empréstimos</span>
                    <strong className="text-base">{lastResult.debts}</strong>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={() => setLastResult(null)}>
                    Nova Importação
                  </Button>
                  <Button size="sm" onClick={() => onOpenChange(false)}>
                    Fechar
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label htmlFor="ai-json-input" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Cole o JSON gerado pela IA:
                    </label>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={handleLoadSample} className="h-7 text-xs">
                        Carregar Exemplo de Teste
                      </Button>
                      {jsonInput && (
                        <Button variant="ghost" size="sm" onClick={handleReset} className="h-7 text-xs text-muted-foreground">
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Limpar
                        </Button>
                      )}
                    </div>
                  </div>

                  <Textarea
                    id="ai-json-input"
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder={'{\n  "bankAccounts": [...],\n  "creditCards": [...],\n  "transactions": [...]\n}'}
                    className="min-h-[220px] max-h-[340px] font-mono text-xs"
                    disabled={importMutation.isPending}
                  />

                  {/* Validation and Preview Status */}
                  {parsedData?.error && (
                    <div className="flex items-center gap-1.5 text-xs text-destructive">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{parsedData.error}</span>
                    </div>
                  )}

                  {counts && !parsedData?.error && (
                    <div className="rounded-md border bg-muted/30 p-2.5 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>JSON Válido. Itens detectados para importação:</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {counts.accounts > 0 && <Badge variant="secondary">{counts.accounts} Contas</Badge>}
                        {counts.cards > 0 && <Badge variant="secondary">{counts.cards} Cartões</Badge>}
                        {counts.categories > 0 && <Badge variant="secondary">{counts.categories} Categorias</Badge>}
                        {counts.people > 0 && <Badge variant="secondary">{counts.people} Pessoas</Badge>}
                        {counts.transactions > 0 && <Badge variant="secondary">{counts.transactions} Transações</Badge>}
                        {counts.plans > 0 && <Badge variant="secondary">{counts.plans} Parcelamentos</Badge>}
                        {counts.splits > 0 && <Badge variant="secondary">{counts.splits} Divisões</Badge>}
                        {counts.bills > 0 && <Badge variant="secondary">{counts.bills} Contas a Pagar</Badge>}
                        {counts.debts > 0 && <Badge variant="secondary">{counts.debts} Dívidas</Badge>}
                      </div>
                    </div>
                  )}
                </div>

                <DialogFooter className="pt-2 flex sm:justify-between items-center">
                  <Button variant="ghost" onClick={() => setActiveTab('prompt')}>
                    Voltar para o Prompt
                  </Button>
                  <Button
                    onClick={handleImport}
                    disabled={!parsedData?.data || !!parsedData?.error || importMutation.isPending}
                    className="gap-2"
                  >
                    {importMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importando dados...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Importar Dados
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
