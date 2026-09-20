import { test, expect, devices } from "@playwright/test";

const { defaultBrowserType: _iPhone13Browser, ...iPhone13 } = devices["iPhone 13"];
const { defaultBrowserType: _iPhoneSEBrowser, ...iPhoneSE } = devices["iPhone SE"];

async function compactGameMetrics(page) {
    return page.evaluate(() => {
        const bounds = (selector) => {
            const rect = document.querySelector(selector)?.getBoundingClientRect();
            return rect && { top: rect.top, bottom: rect.bottom };
        };
        return {
            viewport: window.innerHeight,
            scrollHeight: document.documentElement.scrollHeight,
            touchAction: getComputedStyle(document.querySelector("main")).touchAction,
            active: bounds(".guess.active"),
            board: bounds(".board"),
            keyboard: bounds(".keyboard"),
        };
    });
}

test.describe("compact iPhone gameplay", () => {
    test.use(iPhone13);

    test("keeps the active row, board, and keyboard in one viewport", async ({ page }) => {
        await page.goto("/?fixture=duplicate-score");
        const instructions = page.getByRole("dialog", { name: "Find the word through the board." });
        const understood = instructions.getByRole("button", { name: "Understood" });
        await expect(understood).toBeVisible();
        const instructionBox = await understood.boundingBox();
        expect(instructionBox.y + instructionBox.height).toBeLessThanOrEqual(await page.evaluate(() => innerHeight));
        await understood.click();

        let metrics = await compactGameMetrics(page);
        expect(await page.locator(".guess-row").count()).toBe(5);
        expect(await page.locator(".guess-row").evaluateAll((rows) => rows.every((row) => getComputedStyle(row).display !== "none"))).toBeTruthy();
        expect(await page.locator(".guess-row").evaluateAll((rows) => {
            const widths = rows.map((row) => Math.round(row.getBoundingClientRect().width));
            return new Set(widths).size === 1;
        })).toBeTruthy();
        expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewport);
        expect(metrics.active.top).toBeGreaterThanOrEqual(0);
        expect(metrics.active.bottom).toBeLessThanOrEqual(metrics.viewport);
        expect(metrics.board.bottom).toBeLessThanOrEqual(metrics.viewport);
        expect(metrics.keyboard.bottom).toBeLessThanOrEqual(metrics.viewport);
        expect(metrics.touchAction).toBe("manipulation");
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);

        // A submitted row stays visible as history. Empty future rows are the
        // only rows compact play is allowed to hide.
        await page.keyboard.type("jolly");
        await page.keyboard.press("Enter");
        await expect(page.getByText("Attempt 2/5")).toBeVisible();
        await expect(page.getByRole("group", { name: "Submitted guess row, scored" })).toBeVisible();
        metrics = await compactGameMetrics(page);
        expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewport);
        expect(metrics.active.bottom).toBeLessThanOrEqual(metrics.viewport);
        expect(metrics.keyboard.bottom).toBeLessThanOrEqual(metrics.viewport);

        // Keep every submitted row visible as the history grows. These words
        // deliberately avoid A–H so the test exercises the mobile layout
        // without depending on a particular chess position.
        for (const word of ["intro", "irons", "irony"]) {
            await page.keyboard.type(word);
            await page.keyboard.press("Enter");
            await expect(page.getByRole("group", { name: "Submitted guess row, scored" })).toHaveCount(
                ["intro", "irons", "irony"].indexOf(word) + 2,
            );
            expect(await page.locator(".guess-row").evaluateAll((rows) => {
                const widths = rows.map((row) => Math.round(row.getBoundingClientRect().width));
                return rows.length === 5
                    && rows.every((row) => getComputedStyle(row).display !== "none")
                    && new Set(widths).size === 1;
            })).toBeTruthy();
            metrics = await compactGameMetrics(page);
            expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewport);
            expect(metrics.keyboard.bottom).toBeLessThanOrEqual(metrics.viewport);
        }
    });
});

test.describe("short iPhone gameplay", () => {
    test.use(iPhoneSE);

    test("keeps the mobile controls above the fold", async ({ page }) => {
        await page.goto("/?fixture=mixed-entry");
        await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
        const metrics = await compactGameMetrics(page);
        expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewport);
        expect(metrics.active.bottom).toBeLessThanOrEqual(metrics.viewport);
        expect(metrics.board.bottom).toBeLessThanOrEqual(metrics.viewport);
        expect(metrics.keyboard.bottom).toBeLessThanOrEqual(metrics.viewport);
    });
});

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

test("instructions keep keyboard focus inside the dialog", async ({ page }) => {
    await page.goto("/?fixture=mixed-entry");
    const instructions = page.getByRole("dialog", { name: "Find the word through the board." });
    await expect(instructions).toBeVisible();
    await expect(instructions).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(instructions.getByRole("button", { name: "Understood" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(instructions.getByRole("button", { name: "Close instructions" })).toBeFocused();
});

test("first-use instructions stay dismissed after a reload", async ({ page }) => {
    await page.goto("/?fixture=mixed-entry");
    const instructions = page.getByRole("dialog", { name: "Find the word through the board." });
    await expect(instructions).toBeVisible();
    await instructions.getByRole("button", { name: "Understood" }).click();
    await expect(instructions).toBeHidden();

    await page.reload();

    await expect(page.getByRole("dialog", { name: "Find the word through the board." })).toBeHidden();
    await expect(page.getByRole("region", { name: /Chess board/i })).toBeVisible();
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

test("a full desktop viewport keeps the gameplay surface in view", async ({ page }) => {
    await page.setViewportSize({ width: 2048, height: 1152 });
    await page.goto("/?fixture=mixed-entry");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();

    // Debug fixtures are development-only chrome and are not part of the
    // shipped page. Remove the collapsed inspector so this assertion measures
    // the same gameplay surface users see in production.
    await page.locator(".debug-fixtures").evaluate((node) => node.remove());
    const metrics = await page.evaluate(() => ({
        viewport: innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        keyboardBottom: document.querySelector(".keyboard")?.getBoundingClientRect().bottom,
    }));
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewport);
    expect(metrics.keyboardBottom).toBeLessThanOrEqual(metrics.viewport);
});

test("a 1920px by 1080px desktop viewport never scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/?fixture=mixed-entry");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    await page.locator(".debug-fixtures").evaluate((node) => node.remove());

    const metrics = await page.evaluate(() => ({
        viewport: innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        keyboardBottom: document.querySelector(".keyboard")?.getBoundingClientRect().bottom,
    }));
    expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewport);
    expect(metrics.keyboardBottom).toBeLessThanOrEqual(metrics.viewport);
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

test("checkmating the opponent still allows word entry", async ({ page }) => {
    await page.goto("/?fixture=player-mate-entry");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    const controls = page.locator(".square-controls");
    const queen = controls.getByRole("button", { name: /F7, white queen; select to choose a move/i });
    await queen.focus();
    await page.keyboard.press("Enter");
    const destination = controls.getByRole("button", { name: /G7, empty square; legal destination/i });
    await destination.focus();
    await page.keyboard.press("Enter");

    await expect(page.locator(".mate-banner")).toHaveText("Position ended. Finish the word to submit this guess.");
    await page.getByRole("button", { name: /^I,/ }).click();
    await expect(page.getByRole("group", { name: "Current guess row" }).getByRole("img", { name: "I; letter not scored" })).toBeVisible();
    await expect(page.locator(".game-error")).toBeHidden();
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

test("share result offers manual text when desktop clipboard access fails", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText: () => Promise.reject(new Error("Clipboard blocked")) },
        });
        document.execCommand = () => { throw new Error("execCommand blocked"); };
    });
    await page.goto("/?fixture=solution-state");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    const result = page.getByRole("dialog", { name: /Solved in 1\/5/ });
    await result.getByRole("button", { name: "Share result" }).click();
    await expect(result.getByRole("status")).toHaveText(/Copy failed\. Select the result text below and copy it manually\./);
    await expect(result.getByRole("textbox", { name: "Result text to copy manually" })).toHaveValue(/CHORTLE BETA #0001 1\/5/);
});

test("result modal keeps its size when the share status appears", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: { writeText: async () => {} },
        });
    });
    await page.goto("/?fixture=solution-state");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    const result = page.getByRole("dialog", { name: /Solved in 1\/5/ });
    const before = await result.boundingBox();
    await result.getByRole("button", { name: "Share result" }).click();
    await expect(result.getByRole("status")).toHaveText("Result copied to the clipboard.");
    const after = await result.boundingBox();

    expect(after).not.toBeNull();
    expect(after.width).toBe(before.width);
    expect(after.height).toBe(before.height);
});

test("result actions keep readable text on their scarlet hover state", async ({ page }) => {
    await page.goto("/?fixture=solution-state");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    const result = page.getByRole("dialog", { name: /Solved in 1\/5/ });
    for (const label of ["Share result", "View solution", "Reset puzzle"]) {
        const button = result.getByRole("button", { name: label });
        await button.hover();
        expect(await button.evaluate((node) => {
            const style = getComputedStyle(node);
            return { color: style.color, background: style.backgroundColor };
        })).toEqual({ color: "rgb(249, 248, 242)", background: "rgb(112, 45, 49)" });
    }
});

test("repeated desktop sharing keeps the copied label while clipboard is pending", async ({ page }) => {
    await page.addInitScript(() => {
        let release;
        Object.defineProperty(navigator, "clipboard", {
            configurable: true,
            value: {
                writeText: () => new Promise((resolve) => { release = resolve; }),
            },
        });
        window.__releaseClipboard = () => release?.();
    });
    await page.goto("/?fixture=solution-state");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    const result = page.getByRole("dialog", { name: /Solved in 1\/5/ });
    const share = result.getByRole("button", { name: "Share result" });

    await share.click();
    await page.evaluate(() => window.__releaseClipboard());
    const copied = result.getByRole("button", { name: "Copied" });
    await expect(copied).toBeVisible();
    await expect(copied).toHaveClass(/copied/);
    expect(await copied.evaluate((button) => {
        const style = getComputedStyle(button);
        return { color: style.color, background: style.backgroundColor };
    })).toEqual({ color: "rgb(249, 248, 242)", background: "rgb(0, 121, 107)" });

    await copied.click();
    await expect(copied).toBeVisible();
    await page.evaluate(() => window.__releaseClipboard());
});

test.describe("mobile result copying", () => {
    test.use(iPhoneSE);

    test("focuses the manual result text when mobile clipboard access is blocked", async ({ page }) => {
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
        await result.getByRole("button", { name: "Share result" }).click();

        const manualCopy = result.getByRole("textbox", { name: "Result text to copy manually" });
        await expect(manualCopy).toBeVisible();
        await expect(manualCopy).toBeFocused();
        await expect(manualCopy).toHaveValue(/CHORTLE BETA #0001 1\/5/);
    });

    test("opens the native share sheet when mobile sharing is available", async ({ page }) => {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, "share", {
                configurable: true,
                value: async (payload) => { window.__sharedResult = payload; },
            });
        });
        await page.goto("/?fixture=solution-state");
        await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
        const result = page.getByRole("dialog", { name: /Solved in 1\/5/ });
        await result.getByRole("button", { name: "Share result" }).click();

        await expect(result.getByRole("status")).toHaveText("Result shared.");
        expect(await page.evaluate(() => window.__sharedResult)).toEqual({
            title: "CHORTLE BETA #0001",
            text: "CHORTLE BETA #0001 1/5\nhttps://chortle.charlesblancas.com\n🟩🟩🟩🟩🟩",
        });
    });

    test("does not report an error when the native share sheet is canceled", async ({ page }) => {
        await page.addInitScript(() => {
            Object.defineProperty(navigator, "share", {
                configurable: true,
                value: async () => { throw new DOMException("Canceled", "AbortError"); },
            });
        });
        await page.goto("/?fixture=solution-state");
        await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
        const result = page.getByRole("dialog", { name: /Solved in 1\/5/ });
        await result.getByRole("button", { name: "Share result" }).click();

        await expect(result.getByRole("status")).toHaveCount(0);
        await expect(result.getByRole("button", { name: "Share result" })).toBeEnabled();
    });
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

test.describe("compact solution replay", () => {
    test.use(iPhone13);

    test("keeps the replay inside the phone viewport", async ({ page }) => {
        await page.goto("/?fixture=solution-state");
        await page.getByRole("dialog", { name: "Find the word through the board." }).getByRole("button", { name: "Understood" }).click();
        await page.getByRole("dialog", { name: /Solved in 1\/5/ }).getByRole("button", { name: "View solution" }).click();
        await expect(page.getByRole("button", { name: "Back to result" })).toBeVisible();

        const metrics = await page.evaluate(() => {
            const viewer = document.querySelector(".solution-viewer")?.getBoundingClientRect();
            return {
                viewport: window.innerHeight,
                scrollHeight: document.documentElement.scrollHeight,
                viewerTop: viewer?.top,
                viewerBottom: viewer?.bottom,
            };
        });
        expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewport);
        expect(metrics.viewerTop).toBeGreaterThanOrEqual(0);
        expect(metrics.viewerBottom).toBeLessThanOrEqual(metrics.viewport);
    });
});

test.describe("short solution replay", () => {
    test.use(iPhoneSE);

    test("keeps the replay inside the shortest phone viewport", async ({ page }) => {
        await page.goto("/?fixture=solution-state");
        await page.getByRole("dialog", { name: "Find the word through the board." }).getByRole("button", { name: "Understood" }).click();
        await page.getByRole("dialog", { name: /Solved in 1\/5/ }).getByRole("button", { name: "View solution" }).click();
        await expect(page.getByRole("button", { name: "Back to result" })).toBeVisible();

        const metrics = await page.evaluate(() => ({
            viewport: window.innerHeight,
            scrollHeight: document.documentElement.scrollHeight,
            viewerTop: document.querySelector(".solution-viewer")?.getBoundingClientRect().top,
            viewerBottom: document.querySelector(".solution-viewer")?.getBoundingClientRect().bottom,
        }));
        expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.viewport);
        expect(metrics.viewerTop).toBeGreaterThanOrEqual(0);
        expect(metrics.viewerBottom).toBeLessThanOrEqual(metrics.viewport);
    });
});

test("solution replay releases and reapplies the modal scroll lock", async ({ page }) => {
    await page.goto("/?fixture=solution-state");
    await page.getByRole("dialog", { name: "Find the word through the board." }).getByRole("button", { name: "Understood" }).click();

    const result = page.getByRole("dialog", { name: /Solved in 1\/5/ });
    await expect(result).toBeVisible();
    expect(await page.evaluate(() => ({ position: document.body.style.position, overflow: document.body.style.overflow }))).toEqual({ position: "fixed", overflow: "hidden" });

    await result.getByRole("button", { name: "View solution" }).click();
    await expect(result).toBeHidden();
    expect(await page.evaluate(() => ({ position: document.body.style.position, overflow: document.body.style.overflow }))).toEqual({ position: "", overflow: "" });

    await page.getByRole("button", { name: "Back to result" }).click();
    await expect(result).toBeVisible();
    expect(await page.evaluate(() => ({ position: document.body.style.position, overflow: document.body.style.overflow }))).toEqual({ position: "fixed", overflow: "hidden" });
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

test("switching tabs does not reset the active solution analysis", async ({ page }) => {
    await page.addInitScript(() => {
        const NativeWorker = window.Worker;
        window.__sunfishTerminations = 0;
        window.Worker = class CountingWorker extends NativeWorker {
            terminate() {
                window.__sunfishTerminations += 1;
                return super.terminate();
            }
        };
    });
    await page.goto("/?fixture=solution-state");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "View solution" }).click();
    await expect(page.locator(".evaluation-bar")).toBeVisible();

    const before = await page.evaluate(() => window.__sunfishTerminations);
    await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, value: true });
        document.dispatchEvent(new Event("visibilitychange"));
        Object.defineProperty(document, "hidden", { configurable: true, value: false });
        document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => window.__sunfishTerminations)).toBe(before);
});

test("a restored solution replay keeps its place after a browser reload", async ({ page }) => {
    await page.goto("/?fixture=solution-state");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "View solution" }).click();
    await page.getByRole("button", { name: "Show next move" }).click();
    await expect(page.getByText(/Move 1:.*1\//)).toBeVisible();

    await page.reload();
    await expect(page.locator(".solution-viewer .chess")).toBeVisible();
    await expect(page.getByText(/Move 1:.*1\//)).toBeVisible();
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
