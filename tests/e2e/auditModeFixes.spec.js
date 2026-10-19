import { test, expect } from '@playwright/test';
import { games } from '../../src/games/final_games.js';
test.use({ storageState: { cookies: [], origins: [] } });

test('iPhone 15 gameplay plays queued chess with blocked storage', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } }));
    await page.goto('/?day=32');
    const dismissTutorial = async () => {
        const close = page.getByRole('button', { name: 'Close tutorial' });
        if (await close.isVisible()) {
            await close.click();
            await page.getByRole('button', { name: 'Leave tutorial', exact: true }).click();
        }
    };
    await dismissTutorial();

    await expect(page.getByText('0/3 moves')).toBeVisible();
    await expect(page).not.toHaveURL(/mode=/);
});

test('iPhone 15 gameplay completed legacy saves remain visible without invitations', async ({ page }) => {
    const game = games[31];
    const moves = game.moves.split(' ');
    const actions = [0, 1, 2].map((index) => ({ letter: moves[1 + index * 2][0].toUpperCase(), uci: moves[1 + index * 2], reply: moves[2 + index * 2] || '', moveCorrect: true }));
    await page.addInitScript(({ game, actions }) => {
        localStorage.setItem('chortle:instructions-seen-v1', '1');
        localStorage.setItem('chortle:tutorial-completed-v1', '1');
        localStorage.setItem(`chortle:daily:v1:32:${game.puzzleId}`, JSON.stringify({
            guesses: ['STAFF', '', '', ''], statuses: [[2, 2, 2, 2, 2], ...Array.from({ length: 3 }, () => Array(5).fill(-1))],
            currentRow: 0, actions, actionHistory: [actions, [], [], []], keyStatuses: {}, mated: false, terminal: true, solved: true, completed: true,
        }));
    }, { game, actions });
    await page.goto('/?day=32');
    await expect(page.getByRole('heading', { name: 'Solved in 1/4' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('chortle:line-invitation-v1'))).toBeNull();
    await page.goto('/?day=33');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByLabel('Chess move queue')).toBeVisible();
});
