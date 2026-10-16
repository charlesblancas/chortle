import { test, expect } from '@playwright/test';

test('iPhone 15 gameplay Line checkmate returns focus for word entry and keeps help usable', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('chortle:game-mode-v1', 'line'));
    await page.goto('/?fixture=player-mate-entry');
    await page.getByRole('button', { name: 'Understood' }).click();
    const origin = page.locator('.live-play [data-square="f7"]');
    await expect(origin).toBeEnabled();
    await origin.focus(); await page.keyboard.press('Enter');
    await page.locator('.live-play [data-square="g7"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.line-count')).toBeFocused();
    await page.keyboard.type('fizzy'); await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Solved in 1/4' })).toBeVisible();
    await page.getByRole('button', { name: 'View solution' }).click();
    await page.getByRole('button', { name: 'Show instructions' }).click();
    await expect(page.getByRole('dialog', { name: 'Find the word. Find the best moves.' })).toBeVisible();
});
