import { test, expect } from '@playwright/test';
import { games } from '../../src/games/final_games.js';
import { gameStorageKey } from '../../src/lib/gameStorage.js';

function savedRow(rows = 4, correct = false) {
    const game = games[0];
    const line = game.moves.split(' ');
    const actions = line.filter((_, index) => index % 2 === 1).map((uci, index) => ({
        letter: uci[0].toUpperCase(), uci, reply: line[index * 2 + 2] || '', moveCorrect: correct,
    }));
    return {
        guesses: Array(rows).fill(game.word.toUpperCase()),
        statuses: Array.from({ length: rows }, (_, index) => Array(5).fill(index === rows - 1 ? -1 : 2)),
        currentRow: rows - 1, actions,
        actionHistory: Array.from({ length: rows }, (_, index) => index === rows - 1 ? [] : actions),
        keyStatuses: {}, mated: false, terminal: false, solved: false, completed: false,
    };
}

test.describe('iPhone 15 gameplay end state', () => {
for (const rows of [4, 5]) {
    test(`correct word with wrong chess line loses on attempt ${rows} and can analyze after reload`, async ({ page }) => {
        const key = gameStorageKey(1, games[0]);
        await page.addInitScript(({ key, state }) => {
            if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
            Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
                writeText: async text => { window.sharedEndResult = text; },
            } });
            Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
        }, { key, state: savedRow(rows) });
        await page.goto('/?day=1');
        await page.getByRole('button', { name: 'Understood' }).click();
        await page.keyboard.press('Enter');
        const result = page.getByRole('dialog', { name: 'Out of attempts' });
        await expect(result).toBeVisible();
        await expect(result.locator('[aria-label="Result grid"]')).not.toHaveText('');
        await result.getByRole('button', { name: 'Share result' }).click();
        await expect(result.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
        expect(await page.evaluate(() => window.sharedEndResult)).toContain(`CHORTLE BETA #0001 X/${rows}`);
        await result.getByRole('button', { name: 'View solution' }).click();
        await page.getByRole('button', { name: 'Show next move' }).click();
        await page.reload();
        await expect(page.locator('.solution-viewer')).toBeVisible();
        await page.getByRole('button', { name: 'Back to result' }).click();
        await expect(result).toBeVisible();
        await page.reload();
        await expect(result).toBeVisible();
        await expect(page.locator('.live-play')).toHaveCount(0);
        const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
        expect(saved.completed).toBe(true);
        expect(saved.solved).toBe(false);
        expect(saved.currentRow).toBe(rows - 1);
    });
}

test('an exact word with wrong moves before the final attempt starts a fresh row', async ({ page }) => {
    const state = savedRow();
    state.guesses = ['CIGAR', '', '', ''];
    state.statuses = Array.from({ length: 4 }, () => Array(5).fill(-1));
    state.actionHistory = Array.from({ length: 4 }, () => []);
    state.currentRow = 0;
    await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
        key: gameStorageKey(1, games[0]), state,
    });
    await page.goto('/?day=1');
    await page.getByRole('button', { name: 'Understood' }).click();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Attempt 2/4')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.locator('.live-play')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Current guess row' }).locator('.letter')).toHaveText(['', '', '', '', '']);
});

test('a final-attempt win stays won after analysis and has a complete share grid', async ({ page }) => {
    await page.addInitScript(({ key, state }) => {
        if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    }, { key: gameStorageKey(1, games[0]), state: savedRow(4, true) });
    await page.goto('/?day=1');
    await page.getByRole('button', { name: 'Understood' }).click();
    await page.keyboard.press('Enter');
    const result = page.getByRole('dialog', { name: 'Solved in 4/4' });
    await expect(result).toBeVisible();
    await expect(result.locator('[aria-label="Result grid"]')).toHaveText(Array(4).fill('🟩🟩🟩🟩🟩').join('\n'));
    await result.getByRole('button', { name: 'View solution' }).click();
    await page.getByRole('button', { name: 'Back to result' }).click();
    await page.reload();
    await expect(result).toBeVisible();
});

test('an orphaned replay-open preference cannot hide an unfinished game result', async ({ page }) => {
    await page.addInitScript(key => {
        if (!sessionStorage.getItem('end-state-seeded')) {
            localStorage.setItem(`chortle:replay-open:${key}`, 'open');
            sessionStorage.setItem('end-state-seeded', '1');
        }
    }, gameStorageKey(1, games[0]));
    await page.goto('/?day=1');
    await page.getByRole('button', { name: 'Understood' }).click();
    await expect(page.locator('.live-play')).toBeVisible();
    expect(await page.evaluate(key => localStorage.getItem(`chortle:replay-open:${key}`), gameStorageKey(1, games[0]))).toBeNull();
    for (const word of ['jolly', 'intro', 'irons', 'irony']) {
        await page.keyboard.type(word);
        await page.keyboard.press('Enter');
    }
    await expect(page.getByRole('dialog', { name: 'Out of attempts' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('dialog', { name: 'Out of attempts' })).toBeVisible();
});

test('a lost game can analyze the solution and return to its unchanged result', async ({ page }) => {
    await page.goto('/?fixture=duplicate-score');
    await page.getByRole('button', { name: 'Understood' }).click();
    for (const word of ['jolly', 'intro', 'irons', 'irony']) {
        await page.keyboard.type(word);
        await page.keyboard.press('Enter');
    }
    const result = page.getByRole('dialog', { name: 'Out of attempts' });
    await expect(result).toBeVisible();
    await result.getByRole('button', { name: 'View solution' }).click();
    await expect(result).toBeHidden();
    await page.getByRole('button', { name: 'Show next move' }).click();
    await page.getByRole('button', { name: 'Back to result' }).click();
    await expect(result).toBeVisible();
    await expect(page.getByRole('group', { name: 'Submitted guess row, scored' })).toHaveCount(4);
});
});
