import { test, expect, devices } from '@playwright/test';

const { defaultBrowserType, ...phone } = devices['iPhone 13'];
test.use(phone);

test('touch promotion cancellation keeps the board playable', async ({ page }) => {
    await page.goto('/?fixture=promotion-state');
    await page.getByRole('button', { name: 'Understood' }).tap();
    const board = page.locator('.board');
    const tapRank = async (rank) => {
        const box = await board.boundingBox();
        await page.touchscreen.tap(box.x + box.width / 16, box.y + (8 - rank + 0.5) * box.height / 8);
    };
    for (let attempt = 0; attempt < 2; attempt++) {
        await tapRank(7);
        await tapRank(8);
        await expect(page.getByRole('dialog', { name: 'Choose a piece' })).toBeVisible();
        await page.getByRole('button', { name: 'Cancel move' }).tap();
        await expect(page.getByRole('dialog', { name: 'Choose a piece' })).toBeHidden();
    }
    await tapRank(7);
    await tapRank(8);
    await page.getByRole('button', { name: 'Promote to Queen' }).tap();
    await expect(page.locator('.guess.active .move').first()).toHaveText('A7→A8=Q');
});
