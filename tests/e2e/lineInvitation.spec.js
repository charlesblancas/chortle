import { test, expect } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });
test('iPhone 15 gameplay Line mode invitation appears once and keeps the daily game intact', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
        localStorage.setItem('chortle:instructions-seen-v1', '1');
        localStorage.setItem('chortle:tutorial-completed-v1', '1');
        localStorage.setItem('progress-sentinel', 'keep');
    });
    await page.goto('/?day=32');
    const dialog = page.getByRole('dialog', { name: 'Hey! Want to experiment?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('link', { name: 'Try Line mode' })).toHaveAttribute('href', '/?day=32');
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Close Line mode invitation' })).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('invitation.png') });
    await dialog.getByRole('button', { name: 'Not now' }).click();
    await page.reload();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('progress-sentinel'))).toBe('keep');
    await page.getByRole('button', { name: 'Show instructions' }).click();
    await expect(page.getByRole('heading', { name: 'Try Line mode' })).toBeVisible();
    await page.locator('.mode-panel').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('help.png') });
    await page.getByRole('dialog').getByRole('link', { name: 'Try Line mode', exact: true }).click();
    await expect(page).not.toHaveURL(/mode=/);
    await page.reload();
    await expect(page.getByText('Line mode · 0/3 moves')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('chortle:game-mode-v1'))).toBe('line');
    await page.getByRole('button', { name: 'Show instructions' }).click();
    await page.getByRole('link', { name: 'Switch to normal mode' }).click();
    await expect(page).not.toHaveURL(/mode=line/);
    expect(await page.evaluate(() => localStorage.getItem('chortle:game-mode-v1'))).toBe('normal');
    await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('iPhone 15 gameplay tutorial takes priority over the experimental invitation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Learn by playing.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hey! Want to experiment?' })).toHaveCount(0);
});
