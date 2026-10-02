# Manual de Funcionalidades e Menus do OxeDinDin

O **OxeDinDin** é um gerenciador financeiro pessoal completo, seguro e moderno (*Secure by Design* e *Secure by Default*), desenvolvido com arquitetura web moderna (React, TypeScript, Tailwind CSS, Fastify, PostgreSQL via Drizzle ORM e Radix UI) e suporte a Progressive Web App (PWA).

A interface do usuário foi projetada em torno de **6 Hubs de Domínio Financeiro** organizados por abas (`Tabs` sincronizadas via URL `?tab=...`), eliminando duplicações e sobrecargas de menus e proporcionando um fluxo de trabalho ágil e coeso, com retrocompatibilidade total para rotas legadas via redirecionamento automático.

Este documento detalha **cada hub**, **cada aba/tela** e **todas as funcionalidades e regras de negócio** implementadas no sistema.

---

## Sumário

1. [Acesso e Autenticação](#1-acesso-e-autenticação)
2. [Estrutura de Navegação Global (Hubs de Domínio)](#2-estrutura-de-navegação-global-hubs-de-domínio)
3. [Dashboard (Painel Principal)](#3-dashboard-painel-principal)
4. [Hub de Contas & Cartões (`/accounts`)](#4-hub-de-contas--cartões-accounts)
   - 4.1. Contas Bancárias (`?tab=accounts`)
   - 4.2. Cartões de Crédito (`?tab=cards`)
   - 4.3. Faturas de Cartão (`?tab=invoices`)
   - 4.4. Parcelamentos (`?tab=installments`)
5. [Transações e Extrato Financeiro (`/transactions`)](#5-transações-e-extrato-financeiro-transactions)
6. [Contas a Pagar (Avulsas e Recorrentes) (`/bills`)](#6-contas-a-pagar-avulsas-e-recorrentes-bills)
7. [Hub de Dívidas & Contatos (`/debts`)](#7-hub-de-dívidas--contatos-debts)
   - 7.1. Dívidas e Empréstimos Pessoais (`?tab=personal`)
   - 7.2. Dívidas Compartilhadas Bilaterais (`?tab=shared`)
   - 7.3. Gestão de Pessoas e Contatos (`?tab=people`)
8. [Relatórios e Inteligência Financeira (`/reports`)](#8-relatórios-e-inteligência-financeira-reports)
9. [Hub de Configurações (`/settings`)](#9-hub-de-configurações-settings)
   - 9.1. Perfil e Preferências Gerais (`?tab=profile`)
   - 9.2. Segurança, Sessões e Passkeys (`?tab=security`)
   - 9.3. Gestão de Categorias (`?tab=categories`)
   - 9.4. Central de Notificações (`?tab=notifications`)
10. [Recursos de Plataforma (PWA e Offline)](#10-recursos-de-plataforma-pwa-e-offline)
11. [Mapeamento Técnico de Rotas da API (Backend)](#11-mapeamento-técnico-de-rotas-da-api-backend)

---

## 1. Acesso e Autenticação

### 1.1. Login (`/login`)
- **Autenticação Tradicional por E-mail e Senha**:
  - Validação estrita via schema Zod e sanitização de dados.
  - Verificação de hash criptográfico de alta resistência utilizando **Argon2id**.
  - Criação de sessão persistente no banco de dados PostgreSQL via Drizzle ORM, emitindo Access Token JWT (validade de 15 minutos) e Refresh Token (validade de 7 dias).
  - Proteção contra força bruta através de rate limiting global por IP e endpoint.
- **Login sem Senha com Passkey (WebAuthn / Biometria / FIDO2)**:
  - Permite entrar com Touch ID, Face ID, Windows Hello ou chaves físicas de segurança (YubiKey).
  - Fluxo em dois passos: requisição de desafio criptográfico com expiração em memória (`/api/v1/auth/passkey/login/start`) e validação da assinatura da credencial (`/api/v1/auth/passkey/login/finish`).
- **Recuperação de Senha**:
  - Link direto para fluxo de solicitação e redefinição de senha com token temporário e revogação de sessões antigas.
- **Redirecionamento Inteligente**:
  - Usuários já autenticados são automaticamente direcionados para `/dashboard`.

### 1.2. Cadastro de Usuário (`/register`)
- **Criação de Conta**:
  - Campos: Nome Completo, E-mail (único no sistema) e Senha forte (mínimo de 8 caracteres).
  - Inicialização automática das preferências de configuração do usuário (tema padrão, moeda BRL, primeiro dia da semana).
  - Links para os Termos de Uso e Política de Privacidade da plataforma.
  - Registro de evento de auditoria de segurança da criação da conta.

---

## 2. Estrutura de Navegação Global (Hubs de Domínio)

Para prevenir dispersão e duplicação na experiência do usuário, a navegação do OxeDinDin foi consolidada em torno de **6 domínios centrais** mais o Dashboard executivo. Cada hub reúne módulos afins sob navegação instantânea em abas com sincronização na URL:

1. **Dashboard** (`/dashboard`): Visão executiva consolidada.
2. **Transações** (`/transactions`): Extrato e lançamentos.
3. **Contas & Cartões** (`/accounts`): Hub com Contas, Cartões, Faturas e Parcelamentos.
4. **Contas a Pagar** (`/bills`): Despesas avulsas e recorrentes.
5. **Dívidas & Contatos** (`/debts`): Hub com Dívidas Pessoais, Compartilhadas e Pessoas.
6. **Relatórios** (`/reports`): Gráficos analíticos e fluxo de caixa.
7. **Configurações** (`/settings`): Hub com Perfil/Geral, Segurança, Categorias e Notificações.

### 2.1. Barra Lateral (Sidebar Desktop)
- Visível em telas grandes (desktop e tablets horizontais).
- Exibe o logotipo oficial do OxeDinDin.
- 7 links de alto nível para os domínios centrais com destaque visual do menu ativo (`NavLink`).
- Badge de notificação no hub de **Configurações** quando houver notificações não lidas.
- Rodapé com identificação do usuário conectado (foto/avatar, nome e e-mail).
- Menu suspenso de conta com atalho para Configurações, alternador Claro/Escuro e botão de Logout.

### 2.2. Cabeçalho Superior (Header Global)
- Botão hambúrguer no mobile para abertura do Drawer.
- Ícone de Notificações com **Badge contador em tempo real** no canto superior direito, dando acesso rápido à aba de notificações a partir de qualquer tela da aplicação.

### 2.3. Gaveta de Navegação Mobile (Drawer)
- Menu retrátil responsivo para dispositivos móveis acionado pelo ícone hambúrguer no cabeçalho ou pelo botão "Mais" da barra inferior.
- Contém a navegação completa para todos os hubs e opções da conta.

### 2.4. Barra Inferior de Navegação Rápida (Mobile Bottom Bar)
- Fixa na parte inferior de celulares para ergonomia com o polegar:
  1. **Início** (`/dashboard`)
  2. **Transações** (`/transactions`)
  3. **Contas** (`/accounts`)
  4. **Dívidas** (`/debts`)
  5. **Mais** (abre a gaveta lateral completa com Contas a Pagar, Relatórios, Configurações e Logout)

### 2.5. Retrocompatibilidade Total de Rotas
- Links externos, favoritos ou referências a rotas antigas (`/cards`, `/invoices`, `/installments`, `/shared-debts`, `/people`, `/categories`, `/notifications`, `/security`) continuam funcionando com redirecionamento automático (`Navigate replace`) diretamente para a aba correspondente do respectivo hub.

---

## 3. Dashboard (Painel Principal)

**Rota**: `/dashboard`  
**Objetivo**: Oferecer uma visão executiva consolidada da saúde financeira do usuário no mês corrente.

### Funcionalidades:
1. **Cards de Indicadores Chave (KPIs)**:
   - **Saldo Total**: Soma consolidada dos saldos de todas as contas bancárias ativas cadastradas.
   - **Gastos do Mês**: Total de saídas e despesas registradas no mês atual.
   - **Receitas do Mês**: Total de entradas e receitas registradas no mês atual.
   - **Contas Pendentes**: Montante total devido em contas do mês ainda não pagas.
   - **Fluxo Líquido**: Diferença entre receitas e despesas com indicador comparativo de evolução.
2. **Faturas dos Cartões de Crédito**:
   - Exibição das faturas abertas atuais (valor total acumulado, data de vencimento e status).
   - Prévia das próximas faturas estimadas para o próximo ciclo de fechamento.
3. **Próximos Vencimentos**:
   - Lista cronológica unificada dos compromissos financeiros mais próximos, mesclando contas a pagar avulsas e parcelas de compras no cartão.
4. **Visão de Dívidas e Empréstimos**:
   - Bloco resumido destacando:
     - Montante total **A Pagar** (obrigações financeiras assumidas).
     - Montante total **A Receber** (valores emprestados ou a cobrar de terceiros).
5. **Gastos Fixos Mensais**:
   - Cálculo automático do valor total comprometido mensalmente com despesas fixas e recorrentes cadastradas.
6. **Projeção de Fluxo de Caixa Futuro**:
   - Tabela analítica prevendo os próximos meses, detalhando valores já comprometidos em Contas, Parcelas de cartão e Faturas estimadas.
7. **Saldos por Conta Bancária**:
   - Resumo rápido das contas bancárias ativas e o saldo atual de cada uma.

---

## 4. Hub de Contas & Cartões (`/accounts`)

**Rota Principal**: `/accounts`  
**Objetivo**: Centralizar toda a gestão bancária, limites de crédito, ciclos de fatura e planos de parcelamento em um único hub integrado com 4 abas e sincronização por URL (`?tab=...`). As rotas legadas `/cards`, `/invoices` e `/installments` são automaticamente redirecionadas para suas respectivas abas neste hub.

### 4.1. Aba: Contas Bancárias (`?tab=accounts`)

- **Listagem de Contas**:
  - Exibe nome da conta, banco/instituição financeira, tipo, agência, número, saldo atual consolidado e status (`Ativa` ou `Inativa`).
- **Cadastrar Nova Conta**:
  - *Nome da conta* (ex: "Nubank Principal", "Itaú Salário").
  - *Instituição Financeira* (ex: "Nubank", "Banco do Brasil").
  - *Tipo de Conta*:
    - Conta Corrente (`CHECKING`)
    - Poupança (`SAVINGS`)
    - Conta Digital (`DIGITAL`)
    - Salário (`SALARY`)
    - Outra (`OTHER`)
  - *Agência* e *Número da Conta* (opcionais).
  - *Saldo Inicial* (com máscara monetária em R$).
  - *Observações adicionais*.
- **Editar Conta**:
  - Permite atualizar informações cadastrais, notas e alternar o status da conta entre `Ativa` e `Inativa`.
- **Excluir Conta**:
  - Modal de confirmação segura (`ConfirmDeleteDialog`) para evitar remoção acidental.
- **Regra de Saldo**:
  - O saldo é recalculado pelo backend com base no saldo inicial somado às receitas e transferências de entrada, e subtraído de despesas, pagamentos e transferências de saída.

### 4.2. Aba: Cartões de Crédito (`?tab=cards`)

- **Visualização em Cartão Interativo**:
  - Layout visual imitando um cartão de crédito com identificação da bandeira, instituição e últimos 4 dígitos.
  - Indicador numérico de Limite Total e Limite Disponível.
  - Barra de progresso visual de consumo de limite.
  - Exibição do Dia de Fechamento da fatura e Dia de Vencimento.
  - Indicação da conta bancária padrão vinculada (caso configurada).
- **Cadastrar Novo Cartão**:
  - *Nome do Cartão* (ex: "Inter Black", "XP Visa Infinite").
  - *Instituição emissora*.
  - *Bandeira*: Visa, Mastercard, Elo, American Express, Hipercard ou Outro.
  - *4 Últimos Dígitos* (para identificação segura sem armazenar PAN completo).
  - *Limite Total*.
  - *Dia de Fechamento* (1 a 31).
  - *Dia de Vencimento* (1 a 31).
  - *Conta Bancária associada* (opcional).
  - *Observações*.
- **Editar Cartão**:
  - Atualização de limites, datas de ciclo e status (`ACTIVE`, `BLOCKED`, `CANCELLED`).
- **Excluir Cartão**:
  - Remoção com confirmação de segurança.

### 4.3. Aba: Faturas de Cartão (`?tab=invoices`)

- **Filtro de Faturas por Status**:
  - Todas as faturas.
  - Abertas (`OPEN`).
  - Fechadas (`CLOSED`).
  - Vencidas (`OVERDUE`).
  - Pagas (`PAID`).
- **Painel de Próximas Faturas**:
  - Lista de faturas com fechamento próximo com estimativa de total e data de vencimento.
- **Detalhamento da Fatura**:
  - Período de apuração (data de início e término das transações do ciclo).
  - Data de fechamento e data limite de vencimento.
  - Total da fatura, valor amortizado/pago e saldo remanescente.
- **Registrar Pagamento de Fatura**:
  - Botão de pagamento que abre diálogo para informar:
    - Valor a pagar (suporte a pagamento total ou pagamento parcial).
    - Seleção opcional da conta bancária de onde o valor será debitado.
  - Gera automaticamente a baixa no saldo da fatura e o registro de saída no extrato bancário.

### 4.4. Aba: Parcelamentos (`?tab=installments`)

- **Listagem Agrupada por Plano de Parcelamento**:
  - Exibe cada plano de compra (ex: "Geladeira Nova - 10x"), total da compra, cartão utilizado e o status de cada uma das parcelas.
- **Registrar Nova Compra Parcelada**:
  - *Descrição da compra*.
  - *Valor total da compra*.
  - *Quantidade de parcelas* (de 1 até 60 parcelas).
  - *Data da compra* e *Data da primeira fatura*.
  - *Cartão de crédito* de destino.
  - *Categoria* da compra.
  - O sistema gera automaticamente todas as parcelas futuras distribuídas cronologicamente nas faturas correspondentes.
- **Pagamento Individual de Parcela**:
  - Permite dar baixa ou antecipar uma parcela individualmente, com opção de selecionar a conta bancária para debitar o valor.
- **Cancelamento de Plano de Parcelamento**:
  - Cancela todas as parcelas pendentes daquele plano e libera proporcionalmente o limite comprometido no cartão.

---

## 5. Transações e Extrato Financeiro (`/transactions`)

**Rota**: `/transactions`  
**Objetivo**: Extrato financeiro unificado, registro de lançamentos diários e divisão colaborativa de gastos.

### Funcionalidades:
- **Extrato Completo com Paginação**:
  - Visualização de todas as transações com badges de tipo, data de ocorrência, categoria com cor personalizada, conta ou cartão de origem e valor formatado.
- **Filtros Avançados**:
  - Filtro por período (Data Inicial e Data Final).
  - Filtro por Categoria.
  - Filtro por Conta Bancária.
  - Filtro por Cartão de Crédito.
  - Filtro por Tipo de Transação (`Despesa`, `Receita`, `Transferência`).
- **Lançamento de Nova Transação**:
  - *Descrição* da transação.
  - *Valor* (em reais, com máscara de digitação).
  - *Tipo*: Despesa (`EXPENSE`), Receita (`INCOME`) ou Transferência (`TRANSFER`).
  - *Data da transação*.
  - *Forma de Pagamento*: Dinheiro, Cartão de Débito, Cartão de Crédito, PIX, Transferência Bancária, Boleto ou Outro.
  - *Categoria* associada.
  - *Conta Bancária* (obrigatória para débito, PIX, transferência) ou *Cartão de Crédito* (obrigatório para compras a crédito).
  - *Observações adicionais*.
- **Divisão de Despesas (Splits)**:
  - Permite dividir uma despesa com outras pessoas cadastradas na base.
  - **Modo Divisão Igualitária (`equal`)**: O sistema divide o valor da compra em partes iguais entre o usuário e as pessoas selecionadas.
  - **Modo Divisão Personalizada (`custom`)**: Permite estipular o valor exato que cabe a cada contato.
  - A divisão gera automaticamente vínculos financeiros com o módulo de pessoas e valores a receber.
- **Edição e Exclusão**:
  - Edição de qualquer transação com ajuste automático no saldo da conta ou limite do cartão.
  - Exclusão com confirmação e desfazimento do impacto financeiro.
- **Identificação de Compras Parceladas**:
  - Transações geradas a partir de planos de parcelamento são identificadas com badges visuais específicos.

---

## 6. Contas a Pagar (Avulsas e Recorrentes) (`/bills`)

**Rota**: `/bills`  
**Objetivo**: Gerenciar contas de consumo, boletos e assinaturas periódicas.

### Funcionalidades divididas em duas abas:

#### Aba 1: Contas Únicas (Avulsas)
- Destinada a contas esporádicas ou não periódicas (ex: fatura de energia do mês, manutenção do carro, boleto avulso).
- **Cadastro**: Descrição, valor, data de vencimento, conta bancária sugerida, categoria e notas.
- **Pagar Conta**: Ação rápida com um clique para quitar a conta, com diálogo para indicar a conta bancária do pagamento.
- **Cancelamento / Exclusão**: Exclusão segura de contas pendentes.

#### Aba 2: Contas Recorrentes (Assinaturas e Fixas)
- Destinada a compromissos recorrentes contínuos (ex: Aluguel, Condomínio, Netflix, Spotify, Internet).
- **Cadastro**:
  - Descrição da assinatura ou conta fixa.
  - Valor recorrente.
  - Frequência de repetição:
    - Diária (`DAILY`)
    - Semanal (`WEEKLY`)
    - Quinzenal (`BIWEEKLY`)
    - Mensal (`MONTHLY`)
    - Trimestral (`QUARTERLY`)
    - Semestral (`SEMIANNUAL`)
    - Anual (`ANNUAL`)
  - Dia fixo de vencimento no mês (1 a 31).
  - Data inicial de vigência.
- O sistema calcula e alimenta automaticamente a projeção de gastos futuros e o painel de fluxo de caixa do dashboard.

---

## 7. Hub de Dívidas & Contatos (`/debts`)

**Rota Principal**: `/debts`  
**Objetivo**: Centralizar o controle de obrigações assumidas, créditos com terceiros, conciliação bilateral compartilhada e catálogo de contatos em um único hub com 3 abas sincronizadas via URL (`?tab=...`). As rotas legadas `/shared-debts` e `/people` redirecionam automaticamente para suas respectivas abas neste hub.

### 7.1. Aba: Dívidas e Empréstimos Pessoais (`?tab=personal`)

- **Visão de Dívidas a Pagar**:
  - *Registro de Dívidas*: Descrição, valor total devido, vencimento previsto, tipo (Empréstimo Pessoal, Cartão, Compra, etc.), pessoa credora vinculada e notas.
  - *Amortização / Pagamento*: Botão para amortizar ou quitar integralmente a dívida informando o valor pago.
  - *Dividir Dívida (`Split`)*: Ratear a dívida com outras pessoas da sua lista de contatos.
  - *Compartilhar Dívida (`Share`)*: Envia convite por e-mail para que outro usuário do OxeDinDin acompanhe a dívida bilateralmente no módulo de Dívidas Compartilhadas.
- **Visão de Valores a Receber (Créditos)**:
  - *Registro de Valores a Cobrar*: Quantias emprestadas a terceiros com data combinada de devolução e contato devedor.
  - *Baixa de Recebimento*: Registro de recebimentos parciais ou totais.

### 7.2. Aba: Dívidas Compartilhadas Bilaterais (`?tab=shared`)

**Objetivo**: Gestão colaborativa em tempo real entre dois usuários da plataforma OxeDinDin.

- **Papéis Suportados**:
  - *Como Devedor (`role: debtor`)*: Dívidas onde o usuário logado é o responsável pelo pagamento.
  - *Como Credor (`role: creditor`)*: Dívidas onde o usuário logado é quem tem direito ao recebimento.
- **Ciclo de Estados da Dívida Compartilhada**:
  1. `PENDING`: O credor cadastrou e enviou o convite; aguardando resposta do devedor.
  2. `ACCEPTED`: O devedor aceitou e reconheceu a dívida.
  3. `PAYMENT_REPORTED`: O devedor realizou o pagamento e notificou o credor no sistema (informando valor, data do pagamento, método utilizado como PIX/Dinheiro/Boleto e notas explicativas).
  4. `PAYMENT_CONFIRMED`: O credor conferiu sua conta bancária e confirmou o recebimento, quitando ou amortizando a dívida.
  5. `PAYMENT_VERIFYING`: Pagamento sob verificação ou contestação por divergência.
  6. `REJECTED`: O devedor recusou o convite por não reconhecer o valor.
  7. `CANCELLED`: O credor cancelou o compartilhamento da dívida.
- **Recursos**:
  - *Linha do Tempo e Trilha de Auditoria*: Registro completo de quem realizou cada ação (criação, aceite, aviso de pagamento e confirmação) com data e hora.
  - *Notificações Integradas*: Cada alteração de status gera notificações imediatas no app e push para a outra parte.

### 7.3. Aba: Pessoas e Contatos (`?tab=people`)

**Objetivo**: Catálogo central de contatos (Pessoas Físicas e Jurídicas) associados a despesas, dívidas e divisões.

- **Listagem de Contatos**:
  - Cartões exibindo nome, tipo (Pessoa Física ou Pessoa Jurídica), e-mail, telefone formatado, documento (CPF ou CNPJ) e observações.
- **Cadastrar Nova Pessoa com Vínculo Financeiro Rápido**:
  - Dados cadastrais completos com validação de formato de CPF, CNPJ, e-mail e telefone nacional.
  - Opção no próprio cadastro de já vincular a pessoa a:
    - Uma dívida que o usuário precisa pagar a ela (`RESPONSIBLE_PAID`).
    - Uma dívida que ela deve pagar ao usuário (`RESPONSIBLE_OWED`).
    - Uma divisão de dívida existente (`SPLIT`).
- **Botão "Vincular a Dívida"**:
  - Presente em cada card de contato, permite vincular uma obrigação ou crédito a qualquer momento sem sair da tela.
- **Editar e Excluir**:
  - Manutenção completa dos dados do contato.

---

## 8. Relatórios e Inteligência Financeira (`/reports`)

**Rota**: `/reports`  
**Objetivo**: Análise gráfica e estatística do comportamento financeiro para tomada de decisões.

### Relatórios Disponíveis:
1. **Gastos Fixos vs Variáveis**:
   - Cards comparativos calculando o equilíbrio entre despesas fixas, despesas variáveis, compras parceladas e contas recorrentes.
2. **Despesas por Categoria (Gráfico de Pizza)**:
   - Gráfico interativo (`PieChart` via Recharts) com distribuição percentual dos gastos por categoria no mês, acompanhado de legenda e tabela descritiva ordenada por maior volume financeiro.
3. **Evolução Temporal: Receitas vs Despesas (Gráfico de Barras)**:
   - Gráfico comparativo mês a mês (`BarChart`) confrontando entradas versus saídas financeiras para verificar a taxa de poupança do usuário.
4. **Projeção de Fluxo de Caixa Futuro (12 Meses)**:
   - Gráfico de barras projetando o total comprometido para os próximos 12 meses, dividindo os valores entre Contas a vencer, Parcelamentos de cartões e Faturas estimadas.
5. **Relatório Geral de Dívidas e Créditos**:
   - Balanço consolidado de valores totais a pagar e a receber com suas respectivas datas de vencimento.

---

## 9. Hub de Configurações (`/settings`)

**Rota Principal**: `/settings`  
**Objetivo**: Centralizar perfil, credenciais, segurança, passkeys, categorias e notificações em um único hub integrado com 4 abas e sincronização por URL (`?tab=...`). As rotas legadas `/security`, `/categories` e `/notifications` redirecionam automaticamente para suas respectivas abas.

### 9.1. Aba: Perfil e Preferências Gerais (`?tab=profile`)

- **Perfil do Usuário**:
  - Atualização do Nome do usuário e exibição do e-mail.
  - *Upload de Foto de Perfil (Avatar)* com validação estrita (JPG, PNG, WebP até 2 MB) e suporte a remoção.
- **Preferências de Interface e Sistema**:
  - *Tema*: Claro (`light`), Escuro (`dark`) ou Automático do Sistema (`system`).
  - *Idioma*: Português do Brasil (`pt-BR`).
  - *Moeda*: Real Brasileiro (`BRL`).
  - *Primeiro Dia da Semana*: Domingo ou Segunda-feira.
- **Notificações Push Web & Instalação**:
  - Ativação rápida de notificações push no navegador.
  - Botão de instalação PWA e atualização do app.
- **Seção "Sobre"**:
  - Versão da plataforma e dados informativos.

### 9.2. Aba: Segurança, Sessões e Passkeys (`?tab=security`)

- **Alteração de Senha**:
  - Exige validação da senha atual e nova senha. A alteração revoga automaticamente as outras sessões ativas do usuário.
- **Gerador de Senhas Seguras Embutido**:
  - Geração de senhas fortes com tamanho configurável, caracteres especiais e cópia com um clique.
- **Gerenciamento de Passkeys (WebAuthn / Biometria / FIDO2)**:
  - Registro de biometria ou chave física (Touch ID, Face ID, Windows Hello, YubiKey).
  - Listagem com data de criação e último uso, além de revogação a qualquer momento.
- **Monitoramento de Dispositivos e Sessões Ativas**:
  - Lista de sessões persistentes no banco com IP, User-Agent, data de expiração, identificação da sessão atual e encerramento remoto de outras sessões.
- **Log de Auditoria de Segurança**:
  - Trilha imutável de eventos relevantes (login, logout, troca de senha, passkey, revogações).

### 9.3. Aba: Gestão de Categorias (`?tab=categories`)

- **Listagem e Organização**:
  - Categorias padrão do sistema e categorias personalizadas pelo usuário, com cores e ícones customizáveis.
- **Cadastrar / Editar / Excluir Categoria**:
  - Nome, ícone e código de cor hexadecimal (`#RRGGBB`).
- **Inicializar Categorias Padrão**:
  - Botão de restauração do catálogo padrão de categorias financeiras.

### 9.4. Aba: Central de Notificações (`?tab=notifications`)

- **Caixa de Entrada**:
  - Mensagens informativas com status lida/não lida e botão "Marcar todas como lidas".
- **Painel de Preferências Granular**:
  - Ativação ou desativação de 10 gatilhos financeiros (faturas, contas, parcelas, dívidas, pagamentos e alertas de segurança).
  - Controle de canais de entrega: no aplicativo (`inApp`), por e-mail (`email`) e push no navegador (`push`).

---

## 10. Recursos de Plataforma (PWA e Offline)

- **Progressive Web App (PWA)**:
  - Totalmente instalável na tela inicial do Android, iOS, Windows, macOS e Linux.
  - Manifesto web configurado (`manifest.webmanifest`) com ícones responsivos, tema e cores de destaque.
  - Service Worker dedicado (`sw.ts`) com cache de ativos e suporte ao recebimento de push notifications mesmo com o aplicativo fechado.
- **Design Responsivo & Mobile First**:
  - Interface otimizada com Tailwind CSS para celulares, tablets e telas widescreen.
  - Componentes acessíveis baseados em Radix UI com suporte a navegação por teclado e leitores de tela.

---

## 11. Mapeamento Técnico de Rotas da API (Backend)

Todas as rotas da API são prefixadas com `/api/v1/` e utilizam validação estrita via schemas Zod (`fastify-type-provider-zod`).

| Módulo | Método | Rota | Descrição |
|---|---|---|---|
| **Auth** | `POST` | `/auth/register` | Registro de novo usuário |
| **Auth** | `POST` | `/auth/login` | Login com e-mail e senha |
| **Auth** | `POST` | `/auth/logout` | Logout com revogação da sessão |
| **Auth** | `POST` | `/auth/refresh` | Renovação do token de acesso |
| **Auth** | `POST` | `/auth/password/change` | Troca de senha autenticada |
| **Auth** | `POST` | `/auth/password/reset/request` | Solicitação de reset de senha |
| **Auth** | `POST` | `/auth/password/reset/confirm` | Confirmação de reset com token |
| **Auth (Passkeys)** | `POST` | `/auth/passkey/register/start` | Inicia registro de Passkey |
| **Auth (Passkeys)** | `POST` | `/auth/passkey/register/finish` | Finaliza registro de Passkey |
| **Auth (Passkeys)** | `POST` | `/auth/passkey/login/start` | Inicia autenticação com Passkey |
| **Auth (Passkeys)** | `POST` | `/auth/passkey/login/finish` | Conclui autenticação com Passkey |
| **Auth (Passkeys)** | `GET` | `/auth/passkeys` | Lista as Passkeys registradas |
| **Auth (Passkeys)** | `DELETE` | `/auth/passkeys/:id` | Remove uma Passkey |
| **Auth (Sessões)** | `DELETE` | `/auth/sessions/:id` | Encerra uma sessão específica |
| **Usuários** | `GET` | `/users/me` | Dados do perfil do usuário autenticado |
| **Usuários** | `PATCH` | `/users/me` | Atualiza o perfil (ex: nome) |
| **Usuários** | `POST` | `/users/me/avatar` | Upload de avatar com validação de imagem |
| **Usuários** | `DELETE` | `/users/me/avatar` | Remove o avatar do usuário |
| **Contas** | `GET` | `/accounts` | Lista as contas bancárias |
| **Contas** | `POST` | `/accounts` | Cria uma nova conta bancária |
| **Contas** | `PATCH` | `/accounts/:id` | Atualiza dados da conta |
| **Contas** | `DELETE` | `/accounts/:id` | Exclui uma conta bancária |
| **Cartões** | `GET` | `/cards` | Lista os cartões de crédito |
| **Cartões** | `POST` | `/cards` | Cadastra um novo cartão |
| **Cartões** | `PATCH` | `/cards/:id` | Atualiza dados ou limites do cartão |
| **Cartões** | `DELETE` | `/cards/:id` | Remove um cartão |
| **Faturas** | `GET` | `/invoices` | Lista faturas com filtros de status |
| **Faturas** | `GET` | `/invoices/upcoming` | Lista próximas faturas estimadas |
| **Faturas** | `POST` | `/invoices/:id/pay` | Registra pagamento da fatura |
| **Transações** | `GET` | `/transactions` | Extrato de transações com filtros |
| **Transações** | `POST` | `/transactions` | Cria transação (com splits opcionais) |
| **Transações** | `PATCH` | `/transactions/:id` | Atualiza uma transação |
| **Transações** | `DELETE` | `/transactions/:id` | Exclui uma transação |
| **Parcelamentos** | `POST` | `/transactions/installment` | Registra compra parcelada em até 60x |
| **Parcelamentos** | `GET` | `/installments` | Lista parcelamentos e parcelas |
| **Parcelamentos** | `POST` | `/installments/:planId/installments/:number/pay` | Paga uma parcela individual |
| **Parcelamentos** | `DELETE` | `/installments/:planId` | Cancela plano de parcelamento |
| **Contas a Pagar** | `GET` | `/bills` | Lista contas avulsas |
| **Contas a Pagar** | `POST` | `/bills` | Cadastra conta avulsa |
| **Contas a Pagar** | `POST` | `/bills/:id/pay` | Marca conta como paga |
| **Contas a Pagar** | `DELETE` | `/bills/:id` | Cancela/exclui conta |
| **Recorrentes** | `GET` | `/bills/recurring` | Lista contas recorrentes/assinaturas |
| **Recorrentes** | `POST` | `/bills/recurring` | Cria conta recorrente |
| **Recorrentes** | `DELETE` | `/bills/recurring/:id` | Remove conta recorrente |
| **Dívidas** | `GET` | `/debts` | Lista dívidas a pagar |
| **Dívidas** | `POST` | `/debts` | Cria dívida a pagar |
| **Dívidas** | `POST` | `/debts/:id/pay` | Registra pagamento/amortização |
| **Dívidas** | `POST` | `/debts/:id/share` | Compartilha dívida com outro usuário |
| **Dívidas** | `POST` | `/debts/:id/split` | Rateia dívida com pessoas cadastradas |
| **Dívidas** | `GET` | `/debts/owed` | Lista créditos a receber |
| **Dívidas** | `POST` | `/debts/owed` | Registra crédito a receber |
| **Dívidas** | `POST` | `/debts/owed/:id/pay` | Registra baixa de recebimento |
| **Compartilhadas** | `GET` | `/shared-debts` | Lista dívidas compartilhadas (devedor/credor) |
| **Compartilhadas** | `GET` | `/shared-debts/:id` | Detalhes e histórico da dívida compartilhada |
| **Compartilhadas** | `POST` | `/shared-debts/:id/accept` | Aceita convite de dívida compartilhada |
| **Compartilhadas** | `POST` | `/shared-debts/:id/reject` | Recusa convite de dívida compartilhada |
| **Compartilhadas** | `POST` | `/shared-debts/:id/pay` | Devedor informa pagamento realizado |
| **Compartilhadas** | `POST` | `/shared-debts/:id/payments/:pId/confirm` | Credor confirma pagamento recebido |
| **Compartilhadas** | `POST` | `/shared-debts/:id/payments/:pId/dispute` | Credor contesta pagamento informado |
| **Compartilhadas** | `POST` | `/shared-debts/:id/cancel` | Cancela dívida compartilhada |
| **Pessoas** | `GET` | `/people` | Lista contatos e pessoas cadastradas |
| **Pessoas** | `POST` | `/people` | Cadastra pessoa (com vínculos opcionais) |
| **Pessoas** | `PATCH` | `/people/:id` | Atualiza contato |
| **Pessoas** | `DELETE` | `/people/:id` | Exclui contato |
| **Categorias** | `GET` | `/categories` | Lista categorias |
| **Categorias** | `POST` | `/categories` | Cria nova categoria |
| **Categorias** | `PATCH` | `/categories/:id` | Atualiza categoria |
| **Categorias** | `DELETE` | `/categories/:id` | Remove categoria customizada |
| **Categorias** | `POST` | `/categories/initialize-defaults` | Inicializa/restaura categorias padrão |
| **Relatórios** | `GET` | `/reports/summary` | Resumo financeiro consolidado do dashboard |
| **Relatórios** | `GET` | `/reports/spending-by-category` | Despesas agregadas por categoria |
| **Relatórios** | `GET` | `/reports/spending-by-period` | Receitas vs despesas por período |
| **Relatórios** | `GET` | `/reports/fixed-vs-variable` | Análise de custos fixos vs variáveis |
| **Relatórios** | `GET` | `/reports/cashflow` | Projeção de fluxo de caixa futuro |
| **Relatórios** | `GET` | `/reports/debts` | Relatório consolidado de dívidas e créditos |
| **Notificações** | `GET` | `/notifications` | Lista notificações do usuário |
| **Notificações** | `PATCH` | `/notifications/:id/read` | Marca notificação como lida |
| **Notificações** | `PATCH` | `/notifications/read-all` | Marca todas como lidas |
| **Notificações** | `GET` | `/notifications/preferences` | Consulta preferências de alertas e canais |
| **Notificações** | `PATCH` | `/notifications/preferences` | Atualiza preferências de alertas e canais |
| **Segurança** | `GET` | `/security/devices` | Lista sessões e dispositivos ativos |
| **Segurança** | `GET` | `/security/audit-log` | Log de auditoria de eventos de segurança |
| **Segurança** | `POST` | `/security/password/generate` | Gera senha forte e aleatória |
| **Configurações** | `GET` | `/settings` | Consulta configurações do usuário |
| **Configurações** | `PATCH` | `/settings` | Atualiza preferências e parâmetros |
| **Push** | `GET` | `/push/vapid-public-key` | Chave pública VAPID para Web Push |
| **Push** | `POST` | `/push/subscribe` | Registra subscrição de push do navegador |
| **Push** | `POST` | `/push/unsubscribe` | Remove subscrição de push |
