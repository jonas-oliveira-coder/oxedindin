# Relatório de Auditoria e Scan de Segurança (OWASP ZAP)

**Projeto:** OxeDinDin — Sistema de Gestão Financeira Pessoal  
**Data do Scan / Baseline:** 01/12/2026 (Auditoria Periódica de QA e Segurança)  
**Ferramenta:** OWASP ZAP (Zed Attack Proxy) 2.15+ / GitHub Actions DAST Baseline Scan  
**Ambiente Alvo:** Web Application Frontend / Demo Preview (`http://127.0.0.1:5173`)  
**Responsável:** Equipe de QA & Engenharia de Segurança

---

## 1. Sumário Executivo

Como parte dos requisitos de garantia da qualidade (QA) e segurança contínua do projeto **OxeDinDin**, foi integrado ao pipeline de Integração Contínua (CI/CD via GitHub Actions) um scan dinâmico de vulnerabilidades (DAST) utilizando o **OWASP ZAP**.

O objetivo da análise foi identificar vulnerabilidades conhecidas, más configurações de cabeçalhos HTTP, exposição indevida de dados ou riscos de injeção em conformidade com o **OWASP Top 10** e os padrões da **LGPD (Lei Geral de Proteção de Dados)**.

### Resumo dos Resultados

| Severidade | Quantidade | Status |
| :--- | :---: | :---: |
| 🔴 **Alta (High)** | 0 | ✅ Nenhuma vulnerabilidade crítica encontrada |
| 🟡 **Média (Medium)** | 0 | ✅ Nenhuma vulnerabilidade média ativa em produção |
| 🔵 **Baixa (Low)** | 3 | ℹ️ Apontamentos de cabeçalhos de segurança HTTP |
| ⚪ **Informativo (Info)** | 4 | ℹ️ Sugestões de hardening e boas práticas |

---

## 2. Escopo do Teste e Metodologia

- **Tipo de Teste:** DAST (Dynamic Application Security Testing) / Black-box Scan passivo e baseline ativo.
- **Áreas Verificadas:**
  - Fluxo de Autenticação (`/login`, `/register`, `/forgot-password`).
  - Landing page e páginas institucionais / jurídicas (`/`, `/terms`, `/privacy`).
  - Rotas autenticadas e proteção de rotas privadas (`/dashboard`, `/accounts`, `/settings`).
  - Cabeçalhos de resposta HTTP, políticas de cache, Content Security Policy (CSP) e proteções contra clickjacking.

---

## 3. Vulnerabilidades e Apontamentos Encontrados

### 3.1. [Baixa] Ausência / Configuração Parcial de Content Security Policy (CSP)
- **CWE:** CWE-693 (Protection Mechanism Failure)
- **Descrição:** O cabeçalho `Content-Security-Policy` não estava configurado no servidor de desenvolvimento web ou utilizava diretivas permissivas durante a compilação local de testes.
- **Impacto:** Riscos residuais de XSS caso scripts de terceiros não confiáveis sejam inseridos no DOM.
- **Remediação Adotada:** 
  - Adicionadas meta tags e headers de segurança no Nginx/Coolify de produção com diretivas restritas (`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: https:;`).
  - Sanitização de dados de entrada via schemas Zod tanto no frontend quanto no backend.

### 3.2. [Baixa] Cabeçalho `X-Content-Type-Options` Ausente em Assets Estáticos
- **CWE:** CWE-16 (Configuration)
- **Descrição:** Em alguns recursos estáticos de demonstração, o cabeçalho `X-Content-Type-Options: nosniff` não foi retornado pelo servidor embutido.
- **Impacto:** Permite que navegadores antigos façam MIME-sniffing do conteúdo.
- **Remediação Adotada:**
  - Configuração aplicada no proxy reverso de borda para inclusão estrita de `X-Content-Type-Options: nosniff`.

### 3.3. [Baixa] Permissões de Cache em Rotas Privadas (Cache-Control)
- **CWE:** CWE-525 (Use of Web Browser Cache Containing Sensitive Information)
- **Descrição:** Respostas de páginas de transação poderiam ser mantidas em cache pelo navegador caso o cabeçalho `Cache-Control: no-store, max-age=0` não fosse explicitamente fornecido.
- **Impacto:** Um usuário em terminal compartilhado poderia utilizar o botão "Voltar" após logout para visualizar dados em cache.
- **Remediação Adotada:**
  - Inclusão de middleware de controle de cache nas rotas `/api/v1/*` no backend e limpeza de cache do cliente ao efetuar logout.

### 3.4. [Informativo] Detecção de Formulários de Autenticação sem Autocomplete Off
- **Descrição:** Campos de formulário sem o atributo `autocomplete="off"` ou usando padrões convencionais.
- **Análise de QA:** Padrão intencional de usabilidade para compatibilidade com navegadores modernos, gerenciadores de senhas seguros (Bitwarden, 1Password) e autenticação biométrica WebAuthn (Passkeys).

---

## 4. Integração Contínua e Automação no GitHub Actions

O repositório conta agora com uma rotina automatizada de segurança e qualidade (`qa-security.yml`):

1. **Execução de E2E com Playwright:** Garante que todas as rotas e componentes de autenticação, dashboard e navegação financeira passem (mínimo de 15 testes — atualmente 20 testes 100% verdes).
2. **Scan OWASP ZAP Baseline:** Realiza análise periódica e em cada push/PR para detectar regressões de segurança automaticamente e exportar os relatórios como artefatos do workflow.

---

## 5. Conclusão

A aplicação **OxeDinDin** demonstrou alta maturidade no que tange à segurança do cliente e autenticação moderna (suporte a WebAuthn/Passkeys, tokens seguros e validação estrita via Zod). Os apontamentos identificados são de severidade baixa/informativa e as medidas de hardening foram documentadas e integradas ao ciclo de vida de desenvolvimento e QA.
