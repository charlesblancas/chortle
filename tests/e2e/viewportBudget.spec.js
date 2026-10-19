import { test, expect } from '@playwright/test';
import { games } from '../../src/games/final_games.js';

for (const [mode, day] of [['line', 32], ['line', 581], ['normal', 32]]) {
test(`iPhone 15 gameplay filled ${mode} day ${day} fits breakpoint boundaries and resizes`, async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const game = games[day - 1];
    const moves = game.moves.split(' ');
    const actions = Array.from({ length: [...game.word].filter((letter) => 'abcdefgh'.includes(letter)).length }, (_, i) => ({ letter: moves[1 + i * 2][0].toUpperCase(), uci: moves[1 + i * 2], reply: moves[2 + i * 2] || '', moveCorrect: true }));
    await page.addInitScript(({ game, actions, mode, day }) => {
        for (const key of ['instructions-seen-v1', 'tutorial-completed-v1', 'line-invitation-v1']) localStorage.setItem('chortle:' + key, '1');
        localStorage.setItem('chortle:game-mode-v1', mode);
        localStorage.setItem(`chortle:daily:v1:${day}:${game.puzzleId}${mode === 'line' ? ':line' : ''}`, JSON.stringify({
            ...(mode === 'line' ? { mode } : {}), guesses: [game.word.toUpperCase(), '', '', ''], statuses: Array.from({ length: 4 }, () => Array(5).fill(-1)), currentRow: 0,
            actions, actionHistory: [[], [], [], []], keyStatuses: {}, mated: false, terminal: true, solved: false, completed: false,
        }));
    }, { game, actions, mode, day });
    await page.goto('/?day=' + day);
    for (const [width, height] of [[1920, 1080], [1366, 768], [1024, 599], [1024, 600], [1024, 601], [800, 400], [511, 700], [510, 700], [430, 799], [430, 800], [430, 801], [430, 740], [421, 700], [420, 655], [393, 654], [393, 655], [393, 656], [390, 664], [375, 568], [320, 568], [1920, 1080]]) {
        await page.setViewportSize({ width, height });
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight), { message: `${width}x${height} settled page` }).toBeLessThanOrEqual(height);
        const metrics = await page.evaluate(() => ({
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
            keyboard: document.querySelector('.keyboard').getBoundingClientRect().bottom,
            board: document.querySelector('.board').getBoundingClientRect().bottom,
        }));
        expect(metrics.width, `${width}x${height} horizontal`).toBeLessThanOrEqual(width);
        expect(metrics.height, `${width}x${height} page`).toBeLessThanOrEqual(height);
        expect(metrics.keyboard, `${width}x${height} keyboard`).toBeLessThanOrEqual(height);
        expect(metrics.board, `${width}x${height} board`).toBeLessThanOrEqual(height);
        const banner = await page.locator('.mate-banner').boundingBox();
        const board = await page.locator('.board').boundingBox();
        if (banner) {
            expect(banner.y).toBeGreaterThanOrEqual(board.y);
            expect(banner.y + banner.height).toBeLessThanOrEqual(board.y + board.height);
        }
        if ((width === 1920 || width === 393 || width === 800) && height !== 654 && height !== 656) await page.screenshot({ path: testInfo.outputPath(`fit-${width}-${height}.png`) });
    }
});

}

test('iPhone 15 gameplay short landscape promotion controls remain visible', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 400 });
    await page.addInitScript(() => {
        for (const key of ['instructions-seen-v1', 'tutorial-completed-v1', 'line-invitation-v1']) localStorage.setItem('chortle:' + key, '1');
        localStorage.setItem('chortle:game-mode-v1', 'line');
    });
    await page.goto('/?fixture=promotion-state');
    for (const square of ['a7', 'a8']) {
        const control = page.locator(`[data-square="${square}"]`);
        await control.focus();
        await control.press('Enter');
    }
    const chooser = page.getByRole('dialog', { name: 'Choose a piece' });
    await expect(chooser).toBeVisible();
    for (const button of await chooser.getByRole('button').all()) {
        const box = await button.boundingBox();
        expect(box.y).toBeGreaterThanOrEqual(0);
        expect(box.y + box.height).toBeLessThanOrEqual(400);
    }
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(400);
    await chooser.getByRole('button', { name: 'Promote to Queen' }).click();
    await expect(chooser).toHaveCount(0);
});

test('iPhone 15 gameplay Line mode unknown file keys highlight their column', async ({ page }) => {
    await page.addInitScript(() => {
        for (const key of ['instructions-seen-v1', 'tutorial-completed-v1', 'line-invitation-v1']) localStorage.setItem('chortle:' + key, '1');
        localStorage.setItem('chortle:game-mode-v1', 'line');
    });
    await page.goto('/?day=32');
    await page.keyboard.press('a');
    await expect(page.locator('.file-highlight')).toBeVisible();
    await expect(page.locator('.file-highlight')).toHaveAttribute('style', /left: 87.5%/);
    await expect(page.getByRole('alert')).toContainText('A-file');
    await expect(page.locator('.guess-row.active-row .letter')).toHaveText(['', '', '', '', '']);
});
