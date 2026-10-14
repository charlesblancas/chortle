import { test, expect } from "@playwright/test";
import { games } from "../../src/games/final_games.js";

test("iPhone 15 gameplay Line mode queues, undoes, restores and rejects nonwords", async ({ page, isMobile }, testInfo) => {
    await page.clock.setFixedTime(new Date(2026, 8, 32, 12));
    await page.addInitScript(() => {
        localStorage.setItem("chortle:instructions-seen-v1", "1");
        localStorage.setItem("chortle:tutorial-completed-v1", "1");
        window.__sharedResult = '';
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__sharedResult = text; } } });
        Object.defineProperty(navigator, 'share', { configurable: true, value: async ({ text }) => { window.__sharedResult = text; } });
    });
    await page.goto("/?day=32&mode=line");
    const current = () => page.locator('.guess-row.active-row .letter');
    const undo = page.getByRole("button", { name: "Undo move", exact: true });
    const move = async (uci) => {
        const before = await page.locator('.move-queue button[aria-label]').count();
        for (const square of [uci.slice(0, 2), uci.slice(2, 4)]) {
            if (isMobile) {
                const box = await page.locator('.live-play .board').boundingBox();
                await page.touchscreen.tap(box.x + (104 - square.charCodeAt(0) + .5) * box.width / 8, box.y + (Number(square[1]) - .5) * box.height / 8);
            } else {
                await expect(page.locator(`[data-square="${square}"]`)).toBeEnabled();
                await page.locator(`[data-square="${square}"]`).focus();
                await page.locator(`[data-square="${square}"]`).press("Enter");
            }
        }
        await expect(page.locator('.move-queue button[aria-label]')).toHaveCount(before + 1);
        await expect(undo).toBeEnabled();
    };
    await expect(page.getByText('Line mode · 0/3 moves', { exact: true })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toContainText('Play 3 chess moves');
    await move('a1f1');
    await expect(current()).toHaveText(['', '', '', '', '']);
    await expect(page.locator('.guess-row.active-row .move')).toHaveText(['', '', '', '', '']);
    await page.keyboard.press('a');
    await expect(current()).toHaveText(['A', '', '', '', '']);
    await page.keyboard.press('Backspace');
    await expect(page.getByText('Line mode · 1/3 moves', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Line mode · 1/3 moves', { exact: true })).toBeVisible();
    await expect(current()).toHaveText(['', '', '', '', '']);
    await undo.click();
    await expect(page.getByText('Line mode · 0/3 moves', { exact: true })).toBeVisible();
    await move('a1f1');
    await move('f7f2');
    await expect(page.getByText('Line mode · 2/3 moves', { exact: true })).toBeVisible();
    await move('f1f2');
    await expect(page.getByText('Line mode · 3/3 moves', { exact: true })).toBeVisible();
    await page.keyboard.type('f');
    await expect(page.getByRole('alert')).toContainText('Place A next');
    await page.keyboard.type('zaffz');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toContainText('not in word list');
    await expect(page.getByText('Attempt 1/4')).toBeVisible();
    await expect(page.getByText('Line mode · 3/3 moves', { exact: true })).toBeVisible();
    for (let index = 0; index < 5; index++) await page.keyboard.press('Backspace');
    await page.keyboard.type('taffy');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Attempt 2/4')).toBeVisible();
    await expect(page.getByText('Line mode · 0/3 moves', { exact: true })).toBeVisible();
    await expect(page.locator('.guess-row').first().locator('.letter')).toHaveText(['T', 'A', 'F', 'F', 'Y']);
    await move('a1f1');
    await move('f7f2');
    await move('f1f2');
    await page.keyboard.type('staff');
    await page.reload();
    await expect(current()).toHaveText(['S', 'T', 'A', 'F', 'F']);
    await expect(page.getByText('Line mode · 3/3 moves', { exact: true })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('heading', { name: 'Solved in 2/4' })).toBeVisible();
    await page.getByRole('button', { name: 'Share result', exact: true }).click();
    await expect.poll(() => page.evaluate(() => window.__sharedResult)).toContain('LINE MODE');
    await page.screenshot({ path: testInfo.outputPath('line-mode-result.png') });
    await page.goto('/?day=32');
    await expect(page.getByText('Attempt 1/4')).toBeVisible();
    await expect(current()).toHaveText(['', '', '', '', '']);
    await page.keyboard.type('zzzzz');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('alert')).toContainText('not in word list');
});

test("iPhone 15 gameplay Line mode handles five queued moves and surplus solution tails", async ({ page }, testInfo) => {
    const day = 581;
    await page.clock.setFixedTime(new Date(2026, 8, day, 12));
    const game = games[day - 1];
    const moves = game.moves.split(' ');
    const actions = Array.from({ length: 5 }, (_, index) => ({ letter: moves[index * 2 + 1][0].toUpperCase(), uci: moves[index * 2 + 1], reply: moves[index * 2 + 2] || '', moveCorrect: true }));
    await page.addInitScript(({ day, game, actions }) => {
        localStorage.setItem('chortle:instructions-seen-v1', '1');
        localStorage.setItem('chortle:tutorial-completed-v1', '1');
        localStorage.setItem(`chortle:daily:v1:${day}:${game.puzzleId}:line`, JSON.stringify({
            mode: 'line', guesses: ['', '', '', ''], statuses: Array.from({ length: 4 }, () => Array(5).fill(-1)),
            currentRow: 0, actions, actionHistory: [[], [], [], []], keyStatuses: {}, mated: false, terminal: false, solved: false, completed: false,
        }));
    }, { day, game, actions });
    for (const width of [390, 320]) {
        await page.setViewportSize({ width, height: 664 });
        await page.goto(`/?day=${day}&mode=line`);
        await page.locator('.debug-fixtures').evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
        await expect(page.getByText('Line mode · 5/5 moves', { exact: true })).toBeVisible();
        await expect(page.locator('.guess-row.active-row .move')).toHaveText(['', '', '', '', '']);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(664);
    }
    await page.screenshot({ path: testInfo.outputPath('line-mode-full-queue.png') });
    await page.getByRole('button', { name: 'Place queued C, move 1' }).click();
    await page.keyboard.type('haff');
    await expect(page.locator('.guess-row.active-row .letter')).toHaveText(['C', 'H', 'A', 'F', 'F']);
    await page.getByRole('button', { name: 'Undo move', exact: true }).click();
    await expect(page.locator('.guess-row.active-row .letter')).toHaveText(['C', 'H', 'A', 'F', '']);
    await expect(page.getByText('Line mode · 4/5 moves', { exact: true })).toBeVisible();
    await page.keyboard.type('z');
    await expect(page.locator('.guess-row.active-row .letter')).toHaveText(['C', 'H', 'A', 'F', 'Z']);
    await page.clock.setFixedTime(new Date(2026, 8, 10, 12));
    await page.goto('/?day=10&mode=line');
    await expect(page.getByText('Line mode · 0/4 moves', { exact: true })).toBeVisible();
});

test("iPhone 15 gameplay Line mode fits supported viewports", async ({ page }, testInfo) => {
    await page.addInitScript(() => {
        localStorage.setItem("chortle:instructions-seen-v1", "1");
        localStorage.setItem("chortle:tutorial-completed-v1", "1");
    });
    for (const viewport of [{ width: 1920, height: 1080 }, { width: 390, height: 664 }, { width: 375, height: 568 }, { width: 320, height: 568 }]) {
        await page.setViewportSize(viewport);
        await page.goto('/?day=32&mode=line');
        await page.locator('.debug-fixtures').evaluateAll((nodes) => nodes.forEach((node) => node.remove()));
        const metrics = await page.evaluate(() => ({
            height: document.documentElement.scrollHeight,
            width: document.documentElement.scrollWidth,
            keyboard: document.querySelector('.keyboard').getBoundingClientRect().bottom,
        }));
        expect(metrics.height).toBeLessThanOrEqual(viewport.height);
        expect(metrics.width).toBeLessThanOrEqual(viewport.width);
        expect(metrics.keyboard).toBeLessThanOrEqual(viewport.height);
        await page.screenshot({ path: testInfo.outputPath(`line-mode-${viewport.width}.png`) });
    }
});
