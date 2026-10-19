import { test, expect } from "@playwright/test";

test.skip(!process.env.PREVIEW, "runs against the production preview only");

test("production preview serves the shipped gameplay and worker assets", async ({ page, request }) => {
    const responses = [];
    page.on("response", (response) => responses.push(response));
    await page.goto("/");
    await expect(page).toHaveTitle(/Chortle \| Find the word/);
    await expect(page.getByRole("dialog", { name: "Find the word. Find the best moves." })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    await expect(page.getByRole("region", { name: /Chess board/i })).toBeVisible();
    expect(await page.locator(".debug-fixtures").count()).toBe(0);
    expect(responses.some((response) => /assets\/.*\.js/.test(response.url()))).toBeTruthy();
    await expect.poll(() => responses.some((response) => /stockfish-19-lite-single\.wasm/.test(response.url()) && response.ok())).toBeTruthy();
    const html = await request.get("/");
    expect(html.ok()).toBeTruthy();
});

test("production preview serves the shipped gameplay and worker assets with explicit analytics only", async ({ page }) => {
    await page.clock.setFixedTime(new Date(2026, 8, 32, 12));
    const events = [];
    await page.route('https://us.i.posthog.com/**', async route => {
        if (route.request().method() === 'POST') events.push(route.request().postDataJSON());
        await route.fulfill({ status: 200, headers: {
            'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type',
        }, body: '{}' });
    });
    // Render local production assets under their allowed hostname, without
    // contacting either the real website or the real analytics project.
    await page.route('https://chortle.charlesblancas.com/**', async route => {
        const url = new URL(route.request().url());
        const response = await route.fetch({ url: `${process.env.PREVIEW_BASE_URL || 'http://127.0.0.1:4173'}${url.pathname}${url.search}` });
        await route.fulfill({ response });
    });
    await page.addInitScript(() => {
        localStorage.setItem('chortle:tutorial-completed-v1', '1');
        localStorage.setItem('chortle:instructions-seen-v1', '1');
        localStorage.setItem('chortle:line-invitation-v1', '1');
        localStorage.setItem('chortle:queued-game-seen-v1', '1');
    });
    await page.goto('https://chortle.charlesblancas.com/');
    await expect(page.getByRole('group', { name: 'Current guess row' })).toBeVisible();
    expect(events).toHaveLength(0);
    for (const [index, uci] of ['a1f1', 'f7f2', 'f1f2'].entries()) {
        for (const square of [uci.slice(0,2), uci.slice(2,4)]) {
            const control = page.locator('[data-square="' + square + '"]');
            await expect(control).toBeEnabled(); await control.focus(); await control.press('Enter');
        }
        await expect(page.locator('.queue-notation')).toHaveCount(index + 1);
        await expect(page.getByRole('button', {name:'Undo move', exact:true})).toBeEnabled();
    }
    await page.locator('.line-count').focus();
    await expect(page.locator('.line-count')).toBeFocused();
    await page.keyboard.type('taffy'); await page.keyboard.press('Enter');
    await expect.poll(() => events.map(event => event.event)).toEqual(['puzzle_started', 'guess_submitted']);
    expect(events[1].properties.mode).toBeUndefined();
    expect(events[1].properties.attempt).toBe(1);
    expect(JSON.stringify(events)).not.toMatch(/TAFFY|taffy|fen|movesString|current_url/);
    await page.reload();
    await expect(page.getByRole('group', { name: 'Submitted guess row, scored' }).first()).toBeVisible();
    expect(events).toHaveLength(2);
    await page.goto('https://chortle.charlesblancas.com/?day=1');
    await page.keyboard.type('pious'); await page.keyboard.press('Enter');
    await expect(page.getByRole('group', { name: 'Submitted guess row, scored' }).first()).toBeVisible();
    expect(events).toHaveLength(2);
});
