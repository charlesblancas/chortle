import { test, expect } from '@playwright/test';

test('desktop share requests cannot overlap or overwrite a newer success', async ({ page }) => {
    await page.addInitScript(() => {
        window.copies = [];
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
            writeText: () => new Promise(resolve => window.copies.push(resolve)),
        } });
    });
    await page.goto('/?fixture=solution-state');
    await page.getByRole('button', { name: 'Understood' }).click();
    const share = page.getByRole('button', { name: 'Share result' });
    await share.click();
    await expect(page.getByRole('dialog').locator('.share')).toBeDisabled();
    expect(await page.evaluate(() => window.copies.length)).toBe(1);
    await page.evaluate(() => window.copies[0]());
    await expect(page.getByRole('button', { name: 'Copied', exact: true })).toBeEnabled();
});

test('modified Backspace leaves replay unchanged while plain Backspace goes previous', async ({ page }) => {
    await page.goto('/?fixture=solution-state');
    await page.getByRole('button', { name: 'Understood' }).click();
    await page.getByRole('button', { name: 'View solution' }).click();
    await page.getByRole('button', { name: 'Show next move' }).click();
    for (const chord of ['Control+Backspace', 'Alt+Backspace', 'Meta+Backspace', 'Shift+Backspace']) {
        await page.keyboard.press(chord);
        await expect(page.locator('.solution-viewer .position')).toContainText('Move 1:');
    }
    await page.keyboard.press('Backspace');
    await expect(page.locator('.solution-viewer .position')).toContainText('Puzzle start');
});

test('iPhone 15 gameplay replay uses Stockfish, deepens, stays responsive, and cancels on close', async ({ page }) => {
    await page.addInitScript(() => {
        window.engineCommands = [];
        window.engineWorkers = [];
        const NativeWorker = window.Worker;
        window.Worker = class extends NativeWorker {
            constructor(url, options) {
                super(url, options);
                window.engineWorkers.push(String(url));
            }
            postMessage(message, ...rest) {
                window.engineCommands.push(message);
                super.postMessage(message, ...rest);
            }
        };
    });
    await page.goto('/?fixture=solution-state');
    await page.getByRole('button', { name: 'Understood' }).click();
    await page.getByRole('button', { name: 'View solution' }).click();
    await expect(page.locator('.evaluation-text')).toContainText('Stockfish depth');
    await expect.poll(() => page.evaluate(() => window.engineCommands.some(command => command === 'go depth 4'))).toBe(true);
    expect(await page.evaluate(() => window.engineWorkers.every(url => url.includes('stockfish-19-lite-single.js')))).toBe(true);
    await page.getByRole('button', { name: 'Show next move' }).click();
    await expect(page.locator('.solution-viewer .position')).toContainText('Move 1:');
    await page.getByRole('button', { name: 'Back to result' }).click();
    const searches = await page.evaluate(() => window.engineCommands.filter(command => String(command).startsWith('go ')).length);
    await page.waitForTimeout(150);
    expect(await page.evaluate(() => window.engineCommands.filter(command => String(command).startsWith('go ')).length)).toBe(searches);
    await page.getByRole('button', { name: 'View solution' }).click();
    await expect(page.locator('.evaluation-text')).toContainText('Stockfish');
});
