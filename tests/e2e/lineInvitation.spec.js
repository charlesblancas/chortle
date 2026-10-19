import { test, expect } from '@playwright/test';

test('iPhone 15 gameplay has one ruleset regardless of obsolete preference or bookmark', async ({ page }) => {
    await page.addInitScript(() => {
        localStorage.setItem('chortle:instructions-seen-v1', '1');
        localStorage.setItem('chortle:tutorial-completed-v1', '1');
        localStorage.setItem('chortle:game-mode-v1', 'normal');
        localStorage.setItem('progress-sentinel', 'keep');
    });
    await page.goto('/?day=32&mode=normal&line-prototype=&variant=A');
    await expect(page).not.toHaveURL(/mode=|line-prototype|variant=/);
    await expect(page.getByText('0/3 moves', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Show instructions' }).click();
    const help = page.getByRole('dialog');
    await expect(help).toContainText('Play the required number of chess moves');
    await expect(help).not.toContainText(/Line mode|normal mode|Experimental|Switch to/i);
    await expect(help.locator('a')).toHaveCount(0);
    await help.getByRole('button', { name: 'Understood', exact: true }).click();
    await page.reload();
    await expect(page.getByText('0/3 moves', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('progress-sentinel'))).toBe('keep');
});
