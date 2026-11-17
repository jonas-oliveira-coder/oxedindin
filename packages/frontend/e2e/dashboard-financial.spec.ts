import { test, expect } from '@playwright/test';

test.describe('Dashboard & Financial Modules (Authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock user auth
    await page.route('**/api/v1/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-e2e-1',
          email: 'qa@oxedindin.test',
          name: 'QA Tester',
          emailVerified: true,
          twoFactorEnabled: false,
        }),
      });
    });

    // Mock dashboard reports summary
    await page.route('**/api/v1/reports/summary', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          totalBalance: { cents: 1542050, currency: 'BRL' },
          accountsBalance: [
            { accountId: 'acc-1', name: 'Nubank Principal', balance: { cents: 1042050, currency: 'BRL' } },
            { accountId: 'acc-2', name: 'Inter Reserva', balance: { cents: 500000, currency: 'BRL' } },
          ],
          totalExpensesMonth: { cents: 320000, currency: 'BRL' },
          totalIncomeMonth: { cents: 850000, currency: 'BRL' },
          pendingBillsTotal: { cents: 45000, currency: 'BRL' },
          debtsTotal: { cents: 12000, currency: 'BRL' },
          owedTotal: { cents: 35000, currency: 'BRL' },
          currentInvoices: [
            { cardId: 'card-1', name: 'Cartão Ultravioleta', total: { cents: 125000, currency: 'BRL' }, dueDate: '2026-11-25' },
          ],
          upcomingInvoices: [],
          upcomingBills: [
            { id: 'bill-1', description: 'Energia Elétrica Enel', amount: { cents: 25000, currency: 'BRL' }, dueDate: '2026-11-20' },
          ],
          upcomingInstallments: [],
          fixedExpenses: { cents: 180000, currency: 'BRL' },
          cashflowProjection: [
            {
              month: '2026-11',
              bills: { cents: 45000, currency: 'BRL' },
              installments: { cents: 20000, currency: 'BRL' },
              cards: { cents: 125000, currency: 'BRL' },
              totalCommitted: { cents: 190000, currency: 'BRL' },
            },
          ],
        }),
      });
    });

    // Mock notifications
    await page.route('**/api/v1/notifications', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], meta: { unreadCount: 0 } }),
      });
    });
  });

  test('renders dashboard overview with financial indicators and cards', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Saldo Total')).toBeVisible();
    await expect(page.getByText('Gastos do Mês')).toBeVisible();
    await expect(page.getByText('Receitas do Mês')).toBeVisible();
    await expect(page.getByText('Nubank Principal')).toBeVisible();
  });

  test('renders navigation sidebar with main links', async ({ page }) => {
    await page.goto('/dashboard');
    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: /Dashboard/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Transações/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Contas & Cartões/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Contas a Pagar/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Dívidas & Contatos/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Relatórios/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /Configurações/i })).toBeVisible();
  });

  test('navigates to accounts page and displays bank accounts list', async ({ page }) => {
    await page.route('**/api/v1/accounts', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: [
            {
              id: 'acc-1',
              name: 'Conta Corrente Banco do Brasil',
              institution: 'Banco do Brasil',
              type: 'CHECKING',
              balance: { cents: 450000, currency: 'BRL' },
              initialBalance: { cents: 100000, currency: 'BRL' },
              status: 'ACTIVE',
              createdAt: '2026-01-01',
              updatedAt: '2026-11-01',
            },
          ],
        }),
      });
    });

    await page.goto('/accounts');
    await expect(page.getByRole('heading', { name: 'Contas & Cartões' })).toBeVisible();
    await expect(page.getByText('Conta Corrente Banco do Brasil')).toBeVisible();
    await expect(page.getByRole('button', { name: /Nova Conta/i })).toBeVisible();
  });

  test('navigates between tabs on accounts & cards page', async ({ page }) => {
    await page.route('**/api/v1/accounts', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });
    await page.route('**/api/v1/cards', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) });
    });

    await page.goto('/accounts');
    const cardsTab = page.getByRole('tab', { name: /Cartões/i });
    await expect(cardsTab).toBeVisible();
    await cardsTab.click();
    await expect(page).toHaveURL(/.*tab=cards/);
  });

  test('renders settings page with profile preferences', async ({ page }) => {
    await page.route('**/api/v1/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          theme: 'light',
          language: 'pt-BR',
          currency: 'BRL',
          dateFormat: 'DD/MM/YYYY',
          firstDayOfWeek: 0,
          dashboardLayout: [],
        }),
      });
    });

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Configurações' })).toBeVisible();
    await expect(page.getByText('Perfil & Geral')).toBeVisible();
    await expect(page.getByRole('button', { name: /Salvar preferências/i })).toBeVisible();
  });

  test('allows navigating to settings security tab', async ({ page }) => {
    await page.route('**/api/v1/settings', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          theme: 'light',
          language: 'pt-BR',
          currency: 'BRL',
          dateFormat: 'DD/MM/YYYY',
          firstDayOfWeek: 0,
          dashboardLayout: [],
        }),
      });
    });

    await page.route('**/api/v1/auth/passkey/list', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/settings');
    const securityTab = page.getByRole('tab', { name: /Segurança/i });
    await expect(securityTab).toBeVisible();
    await securityTab.click();
    await expect(page).toHaveURL(/.*tab=security/);
  });
});
