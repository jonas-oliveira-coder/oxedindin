import { test, expect } from '@playwright/test';

test.describe('Landing and Legal pages', () => {
  test('renders landing page with title and hero elements', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('button', { name: /Começar Grátis/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Entrar/i }).first()).toBeVisible();
  });

  test('navigates from landing to login page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Entrar', exact: true }).first().click();
    await page.waitForURL('**/login');
    await expect(page.getByRole('heading', { name: 'Entrar no OxeDinDin' })).toBeVisible();
  });

  test('navigates from landing to register page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Começar Grátis', exact: true }).first().click();
    await page.waitForURL('**/register');
    await expect(page.getByRole('heading', { name: 'Criar conta no OxeDinDin' })).toBeVisible();
  });

  test('toggles FAQ item expansion on landing page', async ({ page }) => {
    await page.goto('/');
    const faqButton = page.getByRole('button', { name: /O OxeDinDin é realmente gratuito\?/i });
    await expect(faqButton).toBeVisible();
    await faqButton.click();
    await expect(page.getByText('Sim, 100% gratuito.')).toBeVisible();
  });

  test('renders Terms of Service page with legal structure', async ({ page }) => {
    await page.goto('/terms');
    await expect(page.getByRole('heading', { name: 'Termos de Uso' })).toBeVisible();
    await expect(page.getByText('Aceitação dos Termos')).toBeVisible();
  });

  test('renders Privacy Policy page with LGPD information', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('heading', { name: 'Política de Privacidade' })).toBeVisible();
    await expect(page.getByText(/LGPD/i).first()).toBeVisible();
  });
});
