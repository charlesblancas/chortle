import { test, expect, devices } from '@playwright/test';

const { defaultBrowserType, ...phone } = devices['iPhone 13'];
test.use(phone);

test('touch selection keeps the board and preview letter in sync', async ({ page }) => {
    await page.goto('/?fixture=mixed-entry');
    await page.getByRole('button', { name: 'Understood' }).tap();
    const board = page.locator('.board');
    const preview = page.locator('.guess.active .letter').nth(1);
    const tapSquare = async (square) => {
        const box = await board.boundingBox();
        await page.touchscreen.tap(
            box.x + (square.charCodeAt(0) - 97 + 0.5) * box.width / 8,
            box.y + (8 - Number(square[1]) + 0.5) * box.height / 8,
        );
    };
    for (let attempt = 0; attempt < 3; attempt++) {
        await tapSquare('g1');
        await expect(board.locator('square.selected')).toHaveCount(1);
        await expect(preview).toHaveText('G');
        await tapSquare('g1');
        await expect(board.locator('square.selected')).toHaveCount(0);
        await expect(preview).toHaveText('');
    }
    // Even a blocked piece has a file preview while visibly selected.
    await tapSquare('a1');
    await expect(board.locator('square.selected')).toHaveCount(1);
    await expect(preview).toHaveText('A');
    await tapSquare('g1');
    await tapSquare('b1');
    await expect(preview).toHaveText('B');
    await expect(page.locator('[data-square="b1"]')).toHaveAttribute('aria-label', /selected starting square/);
    await tapSquare('g1');
    await expect(preview).toHaveText('G');

    // A tap outside clears the visual selection as well as its letter.
    await page.locator('.meta').tap();
    await expect(board.locator('square.selected')).toHaveCount(0);
    await expect(preview).toHaveText('');
    await tapSquare('g1');
    await expect(preview).toHaveText('G');
    await tapSquare('f3');
    await expect(page.locator('.guess.active .move').nth(1)).toHaveText('G1→F3');
    await expect(board.locator('square.selected')).toHaveCount(0);
    await expect(page.locator('.guess.active .ghost')).toHaveCount(0);

    // Typing a normal letter or undoing must leave a fresh selection usable.
    await tapSquare('e1');
    await expect(page.locator('.guess.active .letter').nth(2)).toHaveText('E');
    await page.keyboard.type('r');
    await expect(board.locator('square.selected')).toHaveCount(0);
    await expect(page.locator('.guess.active .letter').nth(2)).toHaveText('R');
    await tapSquare('e1');
    await expect(page.locator('.guess.active .letter').nth(3)).toHaveText('E');
    await page.keyboard.press('Backspace');
    await expect(board.locator('square.selected')).toHaveCount(0);
    await tapSquare('e1');
    await expect(page.locator('.guess.active .letter').nth(2)).toHaveText('E');
    await page.keyboard.press('Backspace');
    await tapSquare('g1');
    await expect(preview).toHaveText('G');
});

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
