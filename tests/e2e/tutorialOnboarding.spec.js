import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });
for (const returning of [false, true]) {
    test(`iPhone 15 gameplay tutorial opens for ${returning ? "existing" : "new"} users until completed`, async ({ page }) => {
        if (returning) await page.addInitScript(() => {
            localStorage.setItem("chortle:instructions-seen-v1", "1");
            localStorage.setItem("saved-progress-sentinel", "keep me");
        });
        await page.goto("/?day=32");
        await expect(page.getByRole("heading", { name: "Learn by playing." })).toBeVisible();
        await expect(page.getByRole("button", { name: "Understood" })).toHaveCount(0);
        await page.getByRole("button", { name: "Close tutorial" }).click();
        expect(await page.evaluate(() => localStorage.getItem("chortle:tutorial-completed-v1"))).toBeNull();
        await page.reload();
        await expect(page.getByRole("heading", { name: "Learn by playing." })).toBeVisible();
        if (returning) expect(await page.evaluate(() => localStorage.getItem("saved-progress-sentinel"))).toBe("keep me");
    });
}
