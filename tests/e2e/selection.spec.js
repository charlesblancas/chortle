import { test, expect } from '@playwright/test';

test('mouse selection and dragging keep the preview aligned with the board', async ({ page }) => {
    await page.goto('/?fixture=mixed-entry');
    await page.getByRole('button', { name: 'Understood' }).click();
    const board = page.locator('.board');
    const preview = page.locator('.guess.active .letter').nth(1);
    const position = async (square) => {
        const box = await board.boundingBox();
        return {
            x: box.x + (square.charCodeAt(0) - 97 + 0.5) * box.width / 8,
            y: box.y + (8 - Number(square[1]) + 0.5) * box.height / 8,
        };
    };
    const clickSquare = async (square) => {
        const { x, y } = await position(square);
        await page.mouse.click(x, y);
    };
    await clickSquare('g1');
    await expect(preview).toHaveText('G');
    await clickSquare('g1');
    await expect(preview).toHaveText('');
    await expect(board.locator('square.selected')).toHaveCount(0);

    const origin = await position('g1');
    const destination = await position('f3');
    await page.mouse.move(origin.x, origin.y);
    await page.mouse.down();
    await expect(preview).toHaveText('G');
    await page.mouse.move(destination.x, destination.y, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('.guess.active .move').nth(1)).toHaveText('G1→F3');
    await expect(page.locator('.guess.active .ghost')).toHaveCount(0);
    await expect(board.locator('square.selected')).toHaveCount(0);

    // Keyboard square controls share the same selection as direct board input.
    const king = page.locator('[data-square="e1"]');
    await king.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.guess.active .letter').nth(2)).toHaveText('E');
    await expect(board.locator('square.selected')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.guess.active .ghost')).toHaveCount(0);
    await expect(board.locator('square.selected')).toHaveCount(0);
    await king.focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-square="e2"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.guess.active .move').nth(2)).toHaveText('E1→E2');
});
