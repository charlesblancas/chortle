import { test, expect } from "@playwright/test";

test("debug node budget controls real Stockfish replies", async ({ page }) => {
    await page.addInitScript(() => {
        window.engineCommands = [];
        const OriginalWorker = window.Worker;
        window.Worker = class extends OriginalWorker {
            constructor(url, options) { super(url, options); this.engineUrl = String(url); }
            postMessage(message, ...rest) {
                if (this.engineUrl.includes('stockfish-19')) window.engineCommands.push(message);
                return super.postMessage(message, ...rest);
            }
        };
    });
    await page.goto('/?fixture=mixed-entry');
    await page.getByRole('dialog').getByRole('button', { name: 'Understood' }).click();
    await page.locator('.debug-fixtures summary').click();
    await page.getByLabel('Stockfish reply nodes').fill('5000');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page).toHaveURL(/engine-nodes=5000/);
    await page.locator('.debug-fixtures summary').click();
    async function movePawn(rank) {
        await expect(page.locator('.live-play .square-control[data-square="a2"]')).toBeEnabled();
        const box = await page.locator('.live-play .board').boundingBox();
        const point = r => ({ x: box.x + box.width / 16, y: box.y + (8 - r + .5) * box.height / 8 });
        await page.mouse.click(point(2).x, point(2).y);
        await page.mouse.click(point(rank).x, point(rank).y);
        await expect(page.locator(`.live-play .square-control[data-square="a${rank}"]`)).toBeEnabled();
    }
    await movePawn(3);
    expect(await page.evaluate(() => window.engineCommands)).toContain('go nodes 5000');
    await page.getByRole('button', { name: /Backspace: remove/ }).click();
    await page.locator('.debug-fixtures summary').click();
    await page.getByLabel('Stockfish reply nodes').fill('20000');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await page.locator('.debug-fixtures summary').click();
    await movePawn(4);
    expect(await page.evaluate(() => window.engineCommands)).toContain('go nodes 20000');
});

test("failed Stockfish startup recovers with a tactical worker and unlocks the board", async ({ page }) => {
    await page.route('**/stockfish-19-lite-single.js', route => route.abort());
    await page.goto('/?fixture=mixed-entry');
    await page.getByRole('dialog').getByRole('button', { name: 'Understood' }).click();
    const box = await page.locator('.live-play .board').boundingBox();
    const square = rank => ({ x: box.x + box.width / 16, y: box.y + (8 - rank + .5) * box.height / 8 });
    const recoveryWorker = page.waitForEvent('worker', { predicate: worker => worker.url().includes('tacticalReply.worker') });
    await page.mouse.click(square(2).x, square(2).y);
    await page.mouse.click(square(3).x, square(3).y);
    await recoveryWorker;
    await expect(page.locator('.live-play .square-control[data-square="a3"]')).toBeEnabled();
    await page.keyboard.press('Backspace');
    await expect(page.locator('.guess.active')).not.toContainText('A');
});
