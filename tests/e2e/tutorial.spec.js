import { test, expect } from "@playwright/test";
import { tutorialLesson } from "../../src/lib/tutorialLesson.js";
test.use({ storageState: { cookies: [], origins: [] } });
test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) await page.screenshot({ path: testInfo.outputPath("failure.png") });
});

test("iPhone 15 gameplay interactive tutorial uses real feedback without changing daily progress", async ({ page, isMobile }, testInfo) => {
    await page.goto("/?day=32");
    const tutorial = page.locator(".tutorial");
    await expect(tutorial).toBeVisible();
    const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    await expect(page.getByRole("dialog")).toHaveCount(1);
    for (const step of tutorialLesson.steps.slice(0, -1)) {
        await expect(tutorial.locator(".coach")).toContainText(step.text);
        if (step.tile !== undefined) {
            const tile = tutorial.locator('.practice-row').last().locator('[role="img"]').nth(step.tile);
            const expected = step.tile === 0 ? [2, 2] : step.tile === 1 ? [1, 2] : step.tile === 2 && step.text.startsWith("Gray") ? [0, 0] : step.tile === 2 ? [2, 1] : [2, 0];
            await expect(tile).toHaveAttribute("data-status", String(expected[0]));
            await expect(tile).toHaveAttribute("data-move-status", String(expected[1]));
        }
        if (step.kind === "move") {
            if (isMobile) {
                for (const square of [step.uci.slice(0, 2), step.uci.slice(2, 4)]) {
                    const box = await tutorial.locator(".board").boundingBox();
                    await page.touchscreen.tap(box.x + (104 - square.charCodeAt(0) + 0.5) * box.width / 8, box.y + (Number(square[1]) - 0.5) * box.height / 8);
                    if (square === step.uci.slice(0, 2)) await expect(tutorial.locator("square.selected")).toHaveCount(1);
                }
            } else {
                for (const square of [step.uci.slice(0, 2), step.uci.slice(2, 4)]) {
                    const control = tutorial.locator(`[data-square="${square}"]`);
                    await control.focus();
                    await control.press("Enter");
                }
            }
        } else if (step.kind === "key" || step.kind === "shortcut") {
            if (isMobile) await tutorial.getByRole("button", { name: new RegExp(`^${step.key}(?:,|:)`) }).click();
            else await page.keyboard.press(step.key.toLowerCase());
        } else if (step.kind === "undo") {
            await expect(tutorial.locator(".practice-row").last().locator(".letter")).toHaveText(["B", "L", "E", "E", "D"]);
            await expect(tutorial.getByRole("button", { name: "Undo", exact: true })).toHaveCount(0);
            if (isMobile) await tutorial.getByRole("button", { name: /^Backspace/ }).click();
            else await page.keyboard.press("Backspace");
        } else if (step.kind === "submit") {
            await expect(tutorial.getByRole("button", { name: "Submit guess", exact: true })).toHaveCount(0);
            if (isMobile) await tutorial.getByRole("button", { name: /^Enter: submit guess/ }).click();
            else await page.keyboard.press("Enter");
        }
        else await tutorial.getByRole("button", { name: step.kind === "new-row" ? "Try the next guess" : "Continue", exact: true }).click();
        const card = page.getByRole("dialog");
        await expect.poll(() => card.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(2);
    }
    await expect(tutorial.locator(".coach")).toContainText("Tutorial complete");
    const rows = tutorial.locator(".practice-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0).locator('.letter')).toHaveText(["B", "E", "V", "E", "L"]);
    await expect(rows.nth(1).locator('.letter')).toHaveText(["B", "L", "E", "E", "P"]);
    await expect(rows.nth(2).locator('[data-status="2"][data-move-status="2"]')).toHaveCount(5);
    expect(await page.evaluate(() => {
        const saved = { ...localStorage };
        delete saved["chortle:tutorial-completed-v1"];
        delete saved["chortle:instructions-seen-v1"];
        return JSON.stringify(saved);
    })).toBe(stored);
    expect(await page.evaluate(() => localStorage.getItem("chortle:tutorial-completed-v1"))).toBe("1");
    // Let Chessground's resize observer finish positioning pieces after the
    // keyboard leaves the completed lesson, before taking the visual artifact.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const dimensions = await tutorial.locator('cg-board').evaluate((el) => {
        const bounds = el.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
    });
    expect(Math.abs(dimensions.width - dimensions.height)).toBeLessThan(2);
    await page.screenshot({ path: testInfo.outputPath("tutorial-final.png") });
    await tutorial.getByRole("button", { name: "Replay tutorial", exact: true }).click();
    await expect(rows).toHaveCount(1);
    await tutorial.getByRole("button", { name: "Written instructions", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Find the word through the board." })).toBeVisible();
    await page.getByRole("button", { name: "Play tutorial", exact: true }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("dialog")).toHaveCount(0);
});
