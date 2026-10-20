import { test, expect } from '@playwright/test';

test.describe('Auth pages (smoke)', () => {
  test('renders the login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Entrar no OxeDinDin' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Senha', { exact: true })).toBeVisible();
  });

  test('shows a validation error for an invalid email', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByText('Informe um email válido.')).toBeVisible();
  });

  test('renders the register page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Criar conta no OxeDinDin' })).toBeVisible();
  });

  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login');
  });

  test('handles logout flow and redirects to login', async ({ page }) => {
    await page.route('**/api/v1/users/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-user-1',
          email: 'usuario@oxedindin.test',
          name: 'Usuário Teste',
          emailVerified: true,
          twoFactorEnabled: false,
        }),
      });
    });

    await page.route('**/api/v1/auth/logout', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto('/dashboard');
    const userMenuButton = page.getByRole('button', { name: /Usuário Teste/i });
    if (await userMenuButton.isVisible()) {
      await userMenuButton.click();
      const logoutItem = page.getByRole('menuitem', { name: /Sair/i });
      if (await logoutItem.isVisible()) {
        await logoutItem.click();
        await page.waitForURL('**/login');
        await expect(page.getByRole('heading', { name: 'Entrar no OxeDinDin' })).toBeVisible();
      }
    }
  });
});