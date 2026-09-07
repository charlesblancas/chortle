import { test, expect } from "@playwright/test";

test("loads the daily game and closes the first-use instructions", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Chortle Beta/);
    await expect(page.getByRole("heading", { name: /Chortle/ })).toBeVisible();
    const instructions = page.getByRole("dialog", { name: "Find the word through the board." });
    await expect(instructions).toBeVisible();
    await instructions.getByRole("button", { name: "Understood" }).click();
    await expect(instructions).toBeHidden();
    await expect(page.getByRole("region", { name: /Chess board/i })).toBeVisible();
    await expect(page.getByText(/Puzzle \d{4}/)).toBeVisible();
    await expect(page.getByRole("group", { name: "Unused guess row" })).toHaveCount(4);
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
    await expect(page.locator(".mate-banner")).toHaveText(/You are mated\. Press Backspace to revise your last move\./);
    await page.keyboard.press("I");
    await expect(page.locator(".game-error")).toHaveText("Position ended. Press Backspace to revise your last move.");
    await page.keyboard.press("Backspace");
    await expect(page.locator(".mate-banner")).toBeHidden();
    await expect(page.getByRole("button", { name: /G[1-8]/ }).first()).toBeVisible();
});

test("promotion traps keyboard focus and restores it after cancellation", async ({ page }) => {
    await page.goto("/?fixture=promotion-state");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    const controls = page.locator(".square-controls");
    const pawn = controls.getByRole("button", { name: /A7, white pawn; select to choose a move/i });
    await pawn.focus();
    await page.keyboard.press("Enter");
    const destination = controls.getByRole("button", { name: /A8, empty square; legal destination/i });
    await destination.focus();
    await page.keyboard.press("Enter");

    const promotion = page.getByRole("dialog", { name: "Choose a piece" });
    const queen = promotion.getByRole("button", { name: "Promote to Queen" });
    const cancel = promotion.getByRole("button", { name: "Cancel move" });
    await expect(promotion).toBeVisible();
    await expect(queen).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(cancel).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(queen).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(promotion).toBeHidden();
    await expect(pawn).toBeFocused();
});

test("copy result offers manual text when browser clipboard access fails", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText: () => Promise.reject(new Error("Clipboard blocked")) },
        });
        document.execCommand = () => false;
    });
    await page.goto("/?fixture=solution-state");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    const result = page.getByRole("dialog", { name: /Solved in 1\/5/ });
    await result.getByRole("button", { name: "Copy result" }).click();
    await expect(result.getByRole("status")).toHaveText(/Copy failed\. Select the result text below and copy it manually\./);
    await expect(result.getByRole("textbox", { name: "Result text to copy manually" })).toHaveValue(/CHORTLE BETA #0001 1\/5/);
});

test("a solved game can replay its solution without changing the result", async ({ page }) => {
    await page.goto("/?fixture=solution-state");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();

    const resultDialog = page.getByRole("dialog");
    await expect(resultDialog.getByRole("button", { name: "View solution" })).toBeVisible();
    expect(await page.evaluate(() => getComputedStyle(document.body).position)).toBe("fixed");
    await expect(page.locator(".solution-viewer .chess")).toBeVisible();
    await resultDialog.getByRole("button", { name: "View solution" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator(".solution-viewer .chess")).toBeVisible();
    await expect(page.locator(".evaluation-bar")).toBeVisible();
    expect(await page.locator(".white-share").evaluate((node) => getComputedStyle(node).transitionDuration)).toBe("0.24s");
    await expect(page.locator(".replay-board")).toHaveAttribute("data-arrow-source", "puzzle");
    await expect(page.locator(".solution-viewer .cg-shapes [marker-end]")).toHaveCount(1);
    const board = page.locator(".solution-viewer .board");
    await board.scrollIntoViewIfNeeded();
    let box = await board.boundingBox();
    expect(box).not.toBeNull();
    await expect(page.getByText(/Puzzle start · 0\//)).toBeVisible();
    expect(await page.locator(".solution-viewer cg-board square.last-move").evaluateAll((nodes) => nodes.map((node) => node.cgKey).sort())).toEqual(["g4", "h4"]);
    await expect(page.getByRole("button", { name: "Go to puzzle start" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Show previous move" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Show next move" })).toBeEnabled();
    const square = (file, rank) => ({
        x: box.x + ("abcdefgh".indexOf(file) + 0.5) * box.width / 8,
        y: box.y + (8 - rank + 0.5) * box.height / 8,
    });
    await page.mouse.click(square("f", 3).x, square("f", 3).y);
    await page.mouse.click(square("g", 4).x, square("g", 4).y);
    await expect(page.getByText(/Move 1:.*1\//)).toBeVisible();
    await expect(page.locator(".replay-board")).toHaveAttribute("data-arrow-source", "puzzle");

    await page.getByRole("button", { name: "Go to puzzle start" }).click();
    await expect(page.getByText(/Puzzle start · 0\//)).toBeVisible();
    await board.scrollIntoViewIfNeeded();
    box = await board.boundingBox();
    await page.mouse.click(square("c", 3).x, square("c", 3).y);
    await page.mouse.click(square("c", 2).x, square("c", 2).y);
    await expect(page.getByText(/Custom position · 0\//)).toBeVisible();

    await expect(page.getByRole("button", { name: "Show next move" })).toBeDisabled();
    await page.getByRole("button", { name: "Show previous move" }).click();
    await expect(page.getByText(/Puzzle start · 0\//)).toBeVisible();
    await page.getByRole("button", { name: "Show next move" }).click();
    await expect(page.getByText(/Custom position · 0\//)).toBeVisible();
    await page.getByRole("button", { name: "Go to puzzle start" }).click();
    await expect(page.getByText(/Puzzle start · 0\//)).toBeVisible();
    await page.getByRole("button", { name: "Show next move" }).click();
    await expect(page.getByText(/Move 1:/)).toBeVisible();
    await page.getByRole("button", { name: "Go to puzzle start" }).click();
    await expect(page.getByText(/Puzzle start · 0\//)).toBeVisible();
    await page.getByRole("button", { name: "Show next move" }).click();
    await expect(page.getByText(/Move 1:/)).toBeVisible();
    await page.getByRole("button", { name: "Show next move" }).click();
    await page.getByRole("button", { name: "Show next move" }).click();
    await expect(page.getByText(/Move 3:/)).toBeVisible();
    expect(await page.locator(".solution-viewer cg-board square.last-move").evaluateAll((nodes) => nodes.map((node) => node.cgKey).sort())).toEqual(["c4", "c5"]);
    await page.getByRole("button", { name: "Go to puzzle end" }).click();
    await expect(page.getByRole("button", { name: "Go to puzzle end" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Go to puzzle start" })).toBeEnabled();
    await expect(page.locator(".replay-board")).toHaveAttribute("data-arrow-source", "sunfish");
    await expect(page.locator(".solution-viewer .cg-shapes [marker-end]")).toHaveCount(1);

    await page.getByRole("button", { name: "Back to result" }).click();
    await expect(page.getByRole("button", { name: "View solution" })).toBeVisible();
    await expect(page.getByText(/Solved in 1\/5/)).toBeVisible();
});

test("solution replay keeps Backspace as previous", async ({ page }) => {
    await page.goto("/?fixture=solution-state");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "View solution" }).click();
    await page.getByRole("button", { name: "Show next move" }).click();
    await expect(page.getByText(/Move 1:.*1\//)).toBeVisible();
    await page.keyboard.press("Backspace");
    await expect(page.getByText(/Puzzle start · 0\//)).toBeVisible();
});

test("keyboard chess controls retain the selected square", async ({ page }) => {
    await page.goto("/?fixture=solution-state");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "View solution" }).click();

    const controls = page.locator(".solution-viewer .square-controls");
    const king = controls.getByRole("button", { name: /C3, white king; select to choose a move/i });
    await king.focus();
    await page.keyboard.press("Enter");

    const destination = controls.getByRole("button", { name: /C2, empty square; legal destination/i });
    await expect(destination).toBeEnabled();
    await destination.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(/Custom position · 0\//)).toBeVisible();
});
