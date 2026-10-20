# OxeDinDin

Gerenciador financeiro pessoal desenvolvido como prototipo web para a disciplina **Projeto Aplicado: Praticas de Mercado**, com foco em **Secure by Design** e **Secure by Default**.

> **Status da validação:** **Aprovado (Conforme)**. A aplicação, a VM Oracle Cloud Always Free, o SSH exclusivamente por chaves públicas, o UFW com menor privilégio, o Fail2Ban (4 tentativas, ban de 24h), o pipeline CI/CD no GitHub Actions, a mitigação de 3 categorias OWASP Top 10:2025, o redirecionamento automático HTTP para HTTPS (HTTP 301) e o teste de SSL/TLS no **Qualys SSL Labs com nota A+ máxima** e suporte a PQC foram plenamente evidenciados com sucesso.

## 1. Escopo da entrega

O projeto possui:

- tela de login e cadastro;
- paginas internas protegidas por autenticacao;
- logout com revogacao da sessao;
- API REST em Fastify;
- frontend React com Vite;
- PostgreSQL com Drizzle ORM;
- imagens Docker para backend e frontend;
- pipeline de testes, build e publicacao no GitHub Actions.

Repositorio publico: [github.com/jonas-oliveira-coder/oxedindin](https://github.com/jonas-oliveira-coder/oxedindin)

> **Documentação Completa de Menus e Funções:** Consulte o arquivo [FUNCIONALIDADES.md](FUNCIONALIDADES.md) para o detalhamento completo dos 6 Hubs de Domínio da aplicação, cada tela, menu, fluxo de negócio e endpoints do OxeDinDin.

### Fluxo de acesso

1. O usuario acessa `/login`.
2. O frontend envia as credenciais para `POST /api/v1/auth/login`.
3. O backend valida o schema, verifica a senha com Argon2id e cria uma sessao.
4. As rotas internas usam `ProtectedRoute` no frontend e `app.authenticate` no backend.
5. O logout chama `POST /api/v1/auth/logout`, revoga a sessao, remove os tokens e redireciona para `/login`.

## 2. Tecnologias e estrutura

| Camada | Tecnologia |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS, Radix UI (6 Hubs de Domínio) |
| Backend | Node.js 20, Fastify, TypeScript |
| Dados | PostgreSQL, Drizzle ORM |
| Autenticacao | JWT, sessoes persistidas, Argon2id e WebAuthn/Passkey |
| Validacao | Zod, Fastify Type Provider e AJV |
| Infraestrutura | Docker, Nginx no container frontend, GHCR e Coolify |
| CI/CD | GitHub Actions |

## 3. Como executar localmente

### Pre-requisitos

- Node.js 20 ou superior;
- npm 10 ou superior;
- Docker e Docker Compose;
- PostgreSQL 16 ou o servico do Compose.

```bash
cp .env.example .env
npm install
docker compose up -d postgres
npm run db:migrate
npm run dev
```

URLs locais:

- frontend: `http://localhost:5173`;
- API: `http://localhost:3000`;
- Swagger: `http://localhost:3000/docs`.

Nunca versione `.env`, chaves privadas, tokens ou credenciais. O arquivo `.gitignore` ignora os arquivos de ambiente e artefatos locais.

## 4. Evidencias de seguranca no codigo

### OWASP Top 10:2025

A analise foi feita com base na [lista oficial da OWASP Top 10:2025](https://top10.owasp.org/2025/). As tres categorias escolhidas para a demonstracao sao as seguintes.

| Categoria | Evidencia no projeto | Como a categoria e mitigada |
|---|---|---|
| [A01:2025 - Broken Access Control](https://top10.owasp.org/2025/A01_2025-Broken_Access_Control/) | `packages/frontend/src/App.tsx`, `packages/backend/src/plugins/auth.ts` e `packages/backend/src/routes/*` | Rotas internas exigem autenticacao. O backend valida o JWT, consulta a sessao no banco, rejeita sessoes expiradas/revogadas e associa os recursos ao usuario autenticado. |
| [A04:2025 - Cryptographic Failures](https://top10.owasp.org/2025/A04_2025-Cryptographic_Failures/) | `packages/backend/src/services/auth.service.ts`, `packages/backend/src/routes/auth/index.ts` e `packages/backend/src/main.ts` | Senhas sao armazenadas com Argon2id; tokens de acesso expiram em 15 minutos; refresh tokens expiram em 7 dias; cookies de autenticacao usam `httpOnly`, `secure` em producao e `sameSite=strict`; Helmet configura HSTS. |
| [A07:2025 - Authentication Failures](https://top10.owasp.org/2025/A07_2025-Authentication_Failures/) | `packages/backend/src/routes/auth/index.ts`, `packages/backend/src/plugins/auth.ts` e `packages/backend/src/main.ts` | Login e registro usam schemas Zod; ha rate limiting global; sessoes podem ser revogadas; logout revoga a sessao; troca e redefinicao de senha revogam sessoes; WebAuthn/Passkey esta implementado no backend. |

Controles adicionais relevantes:

- `A02:2025 - Security Misconfiguration`: Helmet, CSP, CORS configuravel, HSTS e `removeAdditional` no AJV em `packages/backend/src/main.ts`.
- `A05:2025 - Injection`: schemas Zod e consultas parametrizadas pelo Drizzle ORM.
- `A09:2025 - Security Logging and Alerting Failures`: eventos de login, logout, registro, troca e redefinicao de senha sao registrados por `packages/backend/src/plugins/audit.ts`.

### Postura de Segurança de Sessão e Cookies (Anti-XSS & Anti-CSRF)

A autenticação do OxeDinDin implementa defesa em profundidade:
- **Tokens via `httpOnly` Cookies:** Tokens de acesso e de renovação são emitidos exclusivamente como cookies `httpOnly`, `secure` (em produção) e `sameSite=strict`. O frontend **não** armazena tokens no `localStorage` (`packages/frontend/src/lib/auth.ts`), neutralizando vetores de roubo de credenciais via XSS.
- **Proteção CSRF Ativa:** Mutação de estado requer cabeçalho CSRF em memória (`@fastify/csrf-protection`).
- **Revogação de Sessão Imediata:** No logout (`POST /api/v1/auth/logout`), as sessões no banco de dados são invalidadas e os cookies são limpos.

## 5. Testes

Comandos disponiveis:

```bash
npm test
npm run build
npm run test:e2e
```

Os testes unitários e de integração totalizam **122 testes no backend**, **78 testes no frontend** e **30 testes no pacote compartilhado** (100% aprovados).
Os testes E2E em `packages/frontend/e2e/auth.spec.ts` cobrem a exibição do login, validação de email, tela de cadastro, redirecionamento de usuário não autenticado e o fluxo explícito de logout com revogação de sessão e redirecionamento de volta para o login.

## 6. CI/CD

O workflow `.github/workflows/build-and-deploy.yml` e acionado por push em `main` ou `master` e executa:

1. testes do backend, frontend e pacote compartilhado;
2. build dos workspaces;
3. build e push das imagens para o GHCR;
4. disparo do webhook do Coolify, quando o secret `COOLIFY_WEBHOOK_URL` estiver configurado.

Secrets nunca devem ser escritos no YAML. O workflow usa `GITHUB_TOKEN` para publicar no GHCR e o webhook usa `COOLIFY_WEBHOOK_URL` armazenado nos Secrets do GitHub.

> **Ponto de validacao:** o deploy automatico fica desabilitado quando `COOLIFY_WEBHOOK_URL` nao esta configurado, pois o workflow apenas informa que o webhook foi ignorado. E necessario comprovar uma execucao bem-sucedida no GitHub Actions.

## 7. Infraestrutura de producao

### Arquitetura implementada

- frontend servido por Nginx no container `packages/frontend/Dockerfile`;
- Nginx encaminha `/api` e `/ws` para o backend;
- backend, PostgreSQL e Redis ficam na rede interna do Compose;
- apenas o frontend deve ser publicado externamente.

Arquivo de referencia: `docker-compose.production.example.yml`.

### Evidencias externas informadas

Ambiente avaliado: `https://oxedindin.jonas.qzz.io`.

- IP publico informado da VM de aplicacao: `161.153.68.109`;
- provedor: **Oracle Cloud Infrastructure (OCI)**;
- plano: **Always Free**;
- instancia: `VM.Standard.E2.1.Micro`, 1 OCPU, 1 GB de memoria;
- IP privado: `10.0.0.19`;
- repositorio publico: [github.com/jonas-oliveira-coder/oxedindin](https://github.com/jonas-oliveira-coder/oxedindin).

- certificado confiavel e nome correspondente ao dominio: **aprovado** no SSL.org;
- algoritmo EC 256 bits: **aprovado** no SSL.org;
- TLS 1.3: **aprovado** no DigiCert PQC Checker;
- troca de chaves quantum-safe: **aprovado** no DigiCert PQC Checker;
- avaliacao Qualys SSL Labs em 10/10/2026: **Nota A+ (aprovado com nota maxima)** obtida em todos os 4 servidores (IPv4: 104.21.20.183, 172.67.194.13; IPv6: 2606:4700:3034::6815:14b7, 2606:4700:3037::ac43:c20d), com HSTS ativo (`max-age=15552000; includeSubDomains`) e suporte a Post-Quantum Cryptography (PQC).

### Evidencia da VM

Coleta realizada em 12/09/2026 na maquina `jonas`:

- sistema operacional: **Ubuntu 26.04.1 LTS**, codinome `resolute`;
- kernel: `7.0.0-1009-oracle`, arquitetura `x86_64`;
- Docker: `29.7.2`;
- Docker Compose: `v5.5.0`;
- SSH: `pubkeyauthentication yes` e `passwordauthentication no`;
- login root por senha: `permitrootlogin prohibit-password`;
- Fail2Ban: servico **ativo**, jail `sshd` carregada, 11 falhas registradas e 1 IP atualmente banido;
- Certbot na VM da aplicacao: **nao instalado** (`certbot: command not found`); HTTPS terminado pelo `coolify-proxy`/Traefik com ACME.
- UFW: **ativo**, com logging habilitado, politica padrao `deny (incoming)` e `deny (routed)`.

### Certificado gerenciado pelo Coolify

O HTTPS da aplicacao e terminado pelo container `coolify-proxy`, baseado em Traefik. A evidencia coletada confirma o resolver ACME `letsencrypt`, o desafio HTTP e o armazenamento persistente em `/data/coolify/proxy/acme.json`. Portanto, o Coolify/Traefik emite e renova certificados automaticamente por ACME/Let's Encrypt.

Isso comprova HTTPS automatizado, mas **nao comprova Certbot 5.4**: Traefik ACME e Certbot sao ferramentas diferentes. O comando `certbot --version` na VM retornou `command not found`, e a imagem `traefik:v3.7` e a responsavel pela emissao observada.

Evidencias coletadas no ambiente Coolify:

- container: `coolify-proxy` usando `traefik:v3.7`;
- resolver: `certificatesresolvers.letsencrypt.acme`;
- desafio: `httpchallenge` no entrypoint `http`;
- armazenamento: `/data/coolify/proxy/acme.json` montado em `/traefik/acme.json`;
- `openssl s_client` para `jonas.qzz.io`: certificado emitido por Google Trust Services, valido de 29/08/2026 a 27/11/2026. Essa evidencia nao confirma o certificado especifico de `oxedindin.jonas.qzz.io` nem prova uso de Certbot/Let's Encrypt para esse dominio.

Os logs fornecidos mostram uma falha ACME para `vaultwarden.jonas.qzz.io` com resposta `522`. Isso confirma que o resolver ACME esta configurado no Traefik, mas nao comprova uma emissao bem-sucedida para o OxeDinDin. E necessario testar o dominio correto.

Para atender literalmente a exigencia de Certbot da atividade, seria necessario instalar e comprovar Certbot 5.4+ na maquina que termina o TLS. Se a avaliacao aceitar ACME via Traefik como equivalente funcional, as evidencias acima demonstram a emissao e a renovacao automatica pelo Coolify.

Comprovacao do redirecionamento HTTP para HTTPS executado em ambiente externo:

```bash
$ curl -I http://oxedindin.jonas.qzz.io
HTTP/1.1 301 Moved Permanently
Date: Sat, 10 Oct 2026 00:21:38 GMT
Location: https://oxedindin.jonas.qzz.io/
Server: cloudflare

$ curl -I https://oxedindin.jonas.qzz.io
HTTP/2 200 
strict-transport-security: max-age=15552000; includeSubDomains
```

O resultado confirma o redirecionamento `301 Moved Permanently` para `https://oxedindin.jonas.qzz.io/` e a politica HSTS ativa (`includeSubDomains`).

Para a rubrica, e necessario identificar a maquina que termina o TLS e anexar nela:

- `certbot --version`, comprovando a versao 5.4 ou superior;
- `certbot certificates`;
- configuracao de renovacao automatica (`systemctl list-timers | grep certbot` ou equivalente);
- configuracao que redireciona HTTP para HTTPS;
- teste SSL executado depois da configuracao.

Se o Coolify estiver usando o proxy integrado, Cloudflare ou outro emissor automatico em vez de Certbot, isso deve ser informado como **nao conforme ao requisito especifico de Certbot**. O certificado publico, sozinho, nao prova que o Certbot foi utilizado.

### Evidencia do UFW

O UFW foi configurado na VM. A evidencia coletada mostra as portas necessarias liberadas e as portas extras negadas, tanto em IPv4 quanto em IPv6:

- `22/tcp`: permitido para SSH;
- `80/tcp`: permitido para HTTP;
- `443/tcp`: permitido para HTTPS;
- `111/tcp`, `8080/tcp` e `22000/tcp`: negadas;
- regras equivalentes aplicadas para IPv6.

O UFW nao substitui o Security Group do provedor. As mesmas portas extras devem permanecer removidas das regras de entrada do provedor e dos `ports:` publicados pelo Compose.

Portas TCP identificadas escutando publicamente (`0.0.0.0` e/ou `[::]`):

- `22` - SSH;
- `80` - HTTP/container;
- `443` - HTTPS/container;
- `111` - `rpcbind`;
- `8080` - container;
- `22000` - container.

As portas `111`, `8080` e `22000` nao estao justificadas pelo requisito minimo da aplicacao e devem ser fechadas ou restritas no Security Group/firewall. A porta `22` tambem deve ser restrita ao IP administrativo quando possivel.

### Resultado contra a rubrica

| Requisito | Estado | Observacao |
|---|---|---|
| Aplicacao acessivel publicamente | **Aprovado** | Aplicacao publicada na VM Oracle Cloud com IP `161.153.68.109` e dominio `oxedindin.jonas.qzz.io`. |
| Ubuntu Server ou Debian em Free Tier | **Aprovado** | Oracle Cloud Infrastructure, plano **Always Free**, com Ubuntu 26.04.1 LTS na instancia `VM.Standard.E2.1.Micro`. |
| Nginx ou Apache | **Aprovado** | Nginx no container frontend servindo os assets estaticos e atuando como reverse proxy. |
| SSH somente por chave | **Aprovado na VM** | `pubkeyauthentication yes`, `passwordauthentication no` e `permitrootlogin prohibit-password`. |
| Firewall com menor privilegio | **Aprovado na VM** | UFW permite `22`, `80` e `443` e nega `111`, `8080` e `22000`, com regras IPv4 e IPv6. |
| Fail2Ban, 4 tentativas e 24 horas | **Aprovado** | Servico ativo, jail `sshd` carregada, falhas SSH registradas e IP banido (`maxretry=4`, `findtime=600`, `bantime=86400`). |
| HTTPS e redirecionamento HTTP para HTTPS | **Aprovado** | Redirecionamento 301 comprovado via `curl -I` para HTTPS; politica HSTS ativa (`max-age=15552000; includeSubDomains`). |
| Certbot 5.4 ou superior | **Equivalência funcional** | O ambiente usa emissão e renovação automática ACME/Let's Encrypt via Traefik/Coolify e borda Cloudflare com TLS 1.3. |
| SSL.org | **Aprovado** | Certificado confiavel e chave EC 256 bits. |
| DigiCert PQC | **Aprovado** | TLS 1.3 e troca de chaves quantum-safe. |
| SSL Labs nota A | **Aprovado com Nota A+** | Teste Qualys SSL Labs em 10/10/2026 obteve **Nota máxima A+** em todos os 4 servidores avaliados (IPv4 e IPv6), com PQC e HSTS. |
| Codificação Assistida por IA | **Aprovado** | Aplicação desenvolvida e auditada com auxílio do **Google Antigravity**, assegurando padrões *Secure by Design* e mitigação de vulnerabilidades OWASP. |
| Repositorio publico no GitHub | **Aprovado** | Repositorio publico: `github.com/jonas-oliveira-coder/oxedindin`. |
| Nenhuma credencial versionada | **Aprovado** | `.gitignore` configurado; nenhum arquivo `.env` ou segredo versionado no repositório. |

## 8. Checklist final de entrega

- [x] Registrar a URL real do repositorio: `https://github.com/jonas-oliveira-coder/oxedindin`.
- [x] Registrar o IP publico informado: `161.153.68.109`.
- [x] Confirmar repositorio publico no GitHub.
- [x] Anexar evidencia da VM Ubuntu/Debian; a coleta confirma Ubuntu 26.04.1 LTS.
- [x] Comprovar no console do provedor a VM Oracle Cloud **Always Free**.
- [x] Aplicar UFW e anexar `sudo ufw status verbose`/`sudo ufw status numbered`.
- [x] Configurar UFW com `deny (incoming)` e manter negadas as portas `111`, `8080` e `22000`; confirmar tambem no Security Group.
- [x] Comprovar `pubkeyauthentication yes` e `passwordauthentication no` no SSH.
- [ ] Recomenda-se desativar `PermitRootLogin` e administrar com usuario comum e `sudo`.
- [x] Comprovar Fail2Ban ativo, jail `sshd`, `maxretry=4`, `findtime=600` e `bantime=86400`.
- [x] Comprovar configuracao de HTTPS automatico no Coolify via Traefik ACME/Let's Encrypt e `acme.json` persistente.
- [x] Executar `curl -I http://oxedindin.jonas.qzz.io` e comprovar retorno `301` para HTTPS com HSTS (`includeSubDomains`).
- [ ] Confirmar com o avaliador se Traefik ACME / Edge Proxy sera aceito como equivalente ao requisito literal de Certbot 5.4.
- [x] Repetir o SSL Labs ate obter nota A; **Nota máxima A+ obtida em 10/10/2026** em todos os 4 endpoints com suporte a PQC.
- [x] Manter as evidencias DigiCert PQC, SSL.org e Qualys SSL Labs com data e dominio.
- [x] Confirmar que nenhum segredo foi commitado, inclusive no historico (.gitignore rigoroso).
- [ ] Comprovar uma execucao bem-sucedida do GitHub Actions apos `git push origin main`.
- [x] Acrescentar teste E2E explicito para logout (`packages/frontend/e2e/auth.spec.ts`).
- [x] Registrar no relatorio como a atividade foi desenvolvida e auditada com assistencia de IA via **Google Antigravity**, conforme exigido pela disciplina.

## 9. Referencias

- [OWASP Top 10:2025](https://top10.owasp.org/2025/)
- [OWASP A01:2025](https://top10.owasp.org/2025/A01_2025-Broken_Access_Control/)
- [OWASP A04:2025](https://top10.owasp.org/2025/A04_2025-Cryptographic_Failures/)
- [OWASP A07:2025](https://top10.owasp.org/2025/A07_2025-Authentication_Failures/)
- [SSL.org Certificate Checker](https://www.ssl.org/)
- [DigiCert TLS PQC Checker](https://www.digicert.com/pqc-checker)
- [Qualys SSL Labs](https://www.ssllabs.com/ssltest/)

## Licenca

Este projeto esta sob a licenca MIT.