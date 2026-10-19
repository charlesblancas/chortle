import { test, expect } from '@playwright/test';

test('iPhone 15 gameplay returning players see the rules update once and can replay the tutorial', async ({ page }) => {
    await page.goto('/?day=32');
    await page.evaluate(() => {
        localStorage.setItem('chortle:instructions-seen-v1', '1');
        localStorage.setItem('chortle:tutorial-completed-v1', '1');
        localStorage.removeItem('chortle:queued-game-seen-v1');
    });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'The game has changed.' })).toBeVisible();
    await page.getByRole('button', { name: 'Show me how' }).click();
    await expect(page.getByRole('heading', { name: 'Learn by playing.' })).toBeVisible();
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByRole('dialog')).toHaveCount(0);
});
