import { test, expect } from "@playwright/test";

test("extra moves count accepted off-line moves and survive undo", async ({ page }) => {
    await page.goto("/?fixture=mixed-entry");
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    await expect(page.locator(".meta")).toContainText("Extra moves: 0");
    const board = page.locator(".live-play .board");
    const box = await board.boundingBox();
    const square = (file, rank) => ({ x: box.x + (file.charCodeAt(0) - 97 + 0.5) * box.width / 8, y: box.y + (8 - rank + 0.5) * box.height / 8 });
    await page.mouse.click(square("a", 2).x, square("a", 2).y);
    await page.mouse.click(square("a", 3).x, square("a", 3).y);
    await expect(page.locator(".meta")).toContainText("Extra moves: 1");
    await expect(page.locator(".guess.active")).toContainText("A");
    await expect(page.locator('.live-play .square-control[data-square="a3"]')).toBeEnabled();
    await page.keyboard.press("Backspace");
    await expect(page.locator(".guess.active")).not.toContainText("A");
    await expect(page.locator(".meta")).toContainText("Extra moves: 1");
});
