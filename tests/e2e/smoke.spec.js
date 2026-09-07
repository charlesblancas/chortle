import { test, expect } from "@playwright/test";

test("loads the daily game and closes the first-use instructions", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Chortle Beta/);
    await expect(page.getByRole("heading", { name: /Chortle/ })).toBeVisible();
    const instructions = page.getByRole("dialog");
    await expect(instructions).toBeVisible();
    await instructions.getByRole("button", { name: "Understood" }).click();
    await expect(instructions).toBeHidden();
    await expect(page.getByRole("region", { name: /Chess board/i })).toBeVisible();
    await expect(page.getByText(/Puzzle \d{4}/)).toBeVisible();
});

test("production page serves the worker and board assets", async ({ page, request }) => {
    const responses = [];
    page.on("response", (response) => responses.push(response));
    await page.goto("/?fixture=mixed-entry");
    await expect(page.getByRole("region", { name: /Chess board/i })).toBeVisible();
    const board = await request.get("/board-diagram.svg");
    expect(board.ok()).toBeTruthy();
    expect(responses.some((response) => /(?:assets\/.*\.js|\/src\/main\.js)/.test(response.url()))).toBeTruthy();
});

test("short phones keep the keyboard inside the viewport and controls are isolated", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    // Enter on the focused help control opens the dialog; it must not submit a
    // guess through the window-level gameplay handler as well.
    await page.locator(".help").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await page.locator(".guess").first().innerText()).toBe("");
});

test("a mated fixture can be undone without leaving the board locked", async ({ page }) => {
    await page.goto("/?fixture=mate-state");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    await expect(page.locator(".mate-banner")).toHaveText("You are mated.");
    await page.keyboard.press("Backspace");
    await expect(page.locator(".mate-banner")).toBeHidden();
    await expect(page.getByRole("button", { name: /G[1-8]/ }).first()).toBeVisible();
});
