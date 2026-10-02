import { test, expect } from '@playwright/test';

test('off-line move does not animate the player piece back to its origin while searching', async ({ page }) => {
    await page.addInitScript(() => {
        const OriginalWorker = window.Worker;
        window.Worker = class extends OriginalWorker {
            postMessage(message, ...rest) {
                if (typeof message === 'string' && message.startsWith('go nodes')) {
                    setTimeout(() => super.postMessage(message, ...rest), 250);
                } else super.postMessage(message, ...rest);
            }
        };
    });
    await page.goto('/?fixture=mixed-entry');
    await page.getByRole('dialog').getByRole('button', { name: 'Understood' }).click();
    await page.evaluate(() => document.fonts.ready);
    const box = await page.locator('.live-play .board').boundingBox();
    const point = rank => ({ x: box.x + box.width / 16, y: box.y + (8 - rank + .5) * box.height / 8 });
    await page.mouse.click(point(2).x, point(2).y);
    await page.evaluate(() => {
        window.pawnFrames = [];
        window.prefixPawnFrames = [];
        window.captureUntil = performance.now() + 700;
        function frame() {
            const board = document.querySelector('.live-play cg-board');
            const bounds = board.getBoundingClientRect();
            const pawn = [...board.querySelectorAll('piece.white.pawn')].find(piece => {
                const rect = piece.getBoundingClientRect();
                return Math.abs(rect.x - bounds.x) < bounds.width / 16;
            });
            if (pawn) window.pawnFrames.push((pawn.getBoundingClientRect().y - bounds.y) / (bounds.height / 8));
            const prefixPawn = [...board.querySelectorAll('piece.white.pawn')].find(piece => Math.abs(piece.getBoundingClientRect().x - (bounds.x + bounds.width / 2)) < bounds.width / 16);
            if (prefixPawn) window.prefixPawnFrames.push((prefixPawn.getBoundingClientRect().y - bounds.y) / (bounds.height / 8));
            if (performance.now() < window.captureUntil) requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
    });
    await page.mouse.click(point(3).x, point(3).y);
    await expect(page.locator('.live-play .square-control[data-square="a3"]')).toBeEnabled();
    await page.waitForTimeout(700);
    const frames = await page.evaluate(() => window.pawnFrames);
    const prefixFrames = await page.evaluate(() => window.prefixPawnFrames);
    expect(Math.max(...prefixFrames)).toBeLessThan(4.05);
    const moved = frames.findIndex(rank => rank < 5.8);
    expect(moved).toBeGreaterThanOrEqual(0);
    const later = frames.slice(moved);
    expect(Math.max(...later)).toBeLessThan(5.8);
    for (let i = 1; i < later.length; i++) expect(later[i]).toBeLessThanOrEqual(later[i - 1] + .05);
});
