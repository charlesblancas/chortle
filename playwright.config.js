import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    timeout: 30_000,
    use: {
        baseURL: "http://127.0.0.1:4173",
        trace: "retain-on-failure",
    },
    webServer: {
        command: process.env.PREVIEW
            ? "npm run preview -- --host 127.0.0.1 --port 4173"
            : "npm run dev -- --host 127.0.0.1 --port 4173",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI && !process.env.PREVIEW,
        timeout: 120_000,
    },
    projects: [
        { name: "chromium", use: { ...devices["Desktop Chrome"] } },
        {
            name: "webkit-mobile",
            grep: /compact iPhone gameplay|short iPhone gameplay|instructions keep keyboard focus inside the dialog|short phones keep the keyboard inside the viewport and controls are isolated|keyboard chess controls retain the selected square|production preview serves the shipped gameplay and worker assets/,
            use: { ...devices["iPhone 13"], browserName: "webkit" },
        },
    ],
});
