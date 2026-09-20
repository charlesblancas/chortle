import { test, expect } from "@playwright/test";

test.skip(!process.env.PREVIEW, "runs against the production preview only");

test("production preview serves the shipped gameplay and worker assets", async ({ page, request }) => {
    const responses = [];
    page.on("response", (response) => responses.push(response));
    await page.goto("/");
    await expect(page).toHaveTitle(/Chortle Beta/);
    await expect(page.getByRole("dialog", { name: "Find the word through the board." })).toBeVisible();
    await page.getByRole("dialog").getByRole("button", { name: "Understood" }).click();
    await expect(page.getByRole("region", { name: /Chess board/i })).toBeVisible();
    expect(await page.locator(".debug-fixtures").count()).toBe(0);
    expect(responses.some((response) => /assets\/.*\.js/.test(response.url()))).toBeTruthy();
    expect(responses.some((response) => /sunfish\.worker.*\.js/.test(response.url()))).toBeTruthy();
    const html = await request.get("/");
    expect(html.ok()).toBeTruthy();
});
