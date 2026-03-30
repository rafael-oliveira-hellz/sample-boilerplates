import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

test('host monta o remote e o fluxo principal React fica visível', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Plataforma corporativa de microfrontends em React')).toBeVisible();
  await expect(page.getByText('Remote montado')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('mfe-json-mapper-react')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Resumo do JSON Mapper')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('MAPPER/LOADED')).toBeVisible({ timeout: 15000 });
});

test('remote standalone aceita importação de origem e destino', async ({ page }) => {
  await page.goto('http://127.0.0.1:4101');

  const sourcePanel = page.getByTestId('react-source-panel');
  const targetPanel = page.getByTestId('react-target-panel');

  await sourcePanel.getByRole('button', { name: 'JSON' }).click();
  await sourcePanel.locator('input[type="file"]').setInputFiles(path.join(currentDir, 'fixtures', 'source-schema.json'));
  await expect(sourcePanel.getByText('source-schema.json')).toBeVisible();

  await targetPanel.getByRole('button', { name: 'JSON' }).click();
  await targetPanel.locator('input[type="file"]').setInputFiles(path.join(currentDir, 'fixtures', 'target-schema.json'));
  await expect(targetPanel.getByText('target-schema.json')).toBeVisible();

  await page.getByTestId('preview-fab').click();
  const previewPanel = page.getByTestId('react-preview-panel');
  await expect(previewPanel.getByRole('button', { name: 'Schema' })).toBeVisible();
  await expect(previewPanel.getByText('marcaDescricao')).toBeVisible();
});
