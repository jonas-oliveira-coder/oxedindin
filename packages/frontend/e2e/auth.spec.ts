import { test, expect } from '@playwright/test';

test.describe('Auth pages (smoke)', () => {
  test('renders the login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Entrar no OxeDinDin' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Senha')).toBeVisible();
  });

  test('shows a validation error for an invalid email', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByText('Email inválido')).toBeVisible();
  });

  test('renders the register page', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Criar conta no OxeDinDin' })).toBeVisible();
  });

  test('redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('**/login');
  });
});