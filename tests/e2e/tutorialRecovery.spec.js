import { test, expect } from "@playwright/test";

test("iPhone 15 gameplay tutorial recovers from an unexpected move and contains keyboard focus", async ({ page, isMobile }) => {
    await page.goto("/?day=32");
    const instructionsClose = await page.getByRole("dialog").getByRole("button", { name: "Close instructions" }).boundingBox();
    await page.getByRole("button", { name: "Play tutorial", exact: true }).click();
    const tutorialClose = await page.getByRole("button", { name: "Close tutorial" }).boundingBox();
    expect(tutorialClose.width).toBe(instructionsClose.width);
    expect(tutorialClose.height).toBe(instructionsClose.height);
    const tutorial = page.locator(".tutorial");
    await expect(tutorial.getByRole("heading", { name: "Learn by playing." })).toBeFocused();
    await expect(tutorial.getByRole("button", { name: "Back", exact: true })).toBeDisabled();
    await page.keyboard.press("Shift+Tab");
    await expect(tutorial.getByRole("button", { name: "Written instructions" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Close tutorial" })).toBeFocused();
    const duplicateIds = await page.evaluate(() => {
        // Chessground repeats an identical internal SVG blur filter. Check
        // application IDs, particularly the accessible board headings/help.
        const ids = [...document.querySelectorAll("[id]")].filter((el) => !el.closest("svg")).map((el) => el.id);
        return ids.filter((id, index) => ids.indexOf(id) !== index);
    });
    expect(duplicateIds).toEqual([]);
    await expect(tutorial.getByRole("button", { name: "Start practice" })).toHaveCount(0);
    const square = async (name) => {
        const box = await tutorial.locator(".board").boundingBox();
        const x = box.x + (104 - name.charCodeAt(0) + 0.5) * box.width / 8;
        const y = box.y + (Number(name[1]) - 0.5) * box.height / 8;
        if (isMobile) await page.touchscreen.tap(x, y);
        else await page.mouse.click(x, y);
    };
    await square("a6");
    await expect(tutorial.locator("square.selected")).toHaveCount(1);
    await square("b5");
    await expect(tutorial.locator(".error")).toBeVisible();
    await expect(tutorial.locator(".letter").first()).toHaveText("");
    await square("b6");
    await expect(tutorial.locator("square.selected")).toHaveCount(1);
    await square("e3");
    await expect(tutorial.locator(".coach")).toContainText("Move your knight");
    await expect(tutorial.locator(".error")).toHaveCount(0);
    await expect(tutorial.locator(".letter").first()).toHaveText("B");
    await tutorial.getByRole("button", { name: "Back", exact: true }).click();
    await expect(tutorial.locator(".letter").first()).toHaveText("");
    await expect(tutorial.getByRole("button", { name: "Back", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
});
