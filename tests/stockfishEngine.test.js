import test from "node:test";
import assert from "node:assert/strict";
import { createStockfishClient, normalizeNodeBudget } from "../src/lib/stockfishEngine.js";

test("node budgets are bounded and invalid input restores the default", () => {
    for (const value of [null, "", -1, 1.5, Infinity, 1000001]) assert.equal(normalizeNodeBudget(value), 20000);
    assert.equal(normalizeNodeBudget("5000"), 5000);
});

test("queued replies reset search state and send each requested node budget", async () => {
    const messages = [];
    const fake = { terminate() {}, postMessage(message) {
        messages.push(message);
        const response = message === "uci" ? "uciok" : message === "isready" ? "readyok" : message.startsWith("go ") ? "bestmove e2e4" : null;
        if (response) queueMicrotask(() => fake.onmessage({ data: response }));
    } };
    const client = createStockfishClient({ createWorker: () => fake });
    await client.warm();
    assert.deepEqual(await Promise.all([client.reply("first", 5000), client.reply("second", 20000)]), ["e2e4", "e2e4"]);
    const first = messages.indexOf("go nodes 5000");
    const second = messages.indexOf("go nodes 20000");
    assert.ok(first < second);
    assert.equal(messages.filter(m => m === "ucinewgame").length, 2);
    assert.equal(messages[first - 1], "position fen first");
    assert.equal(messages[second - 1], "position fen second");
});

test("failed startup can retry on a fresh worker", async () => {
    let created = 0;
    const client = createStockfishClient({ createWorker() {
        created++;
        const fake = { terminate() {}, postMessage(message) {
            if (created === 1) { queueMicrotask(() => fake.onerror()); return; }
            const response = message === "uci" ? "uciok" : message === "isready" ? "readyok" : message.startsWith("go ") ? "bestmove e2e4" : null;
            if (response) queueMicrotask(() => fake.onmessage({ data: response }));
        } };
        return fake;
    } });
    await assert.rejects(client.reply("fen"), /worker failed/);
    assert.equal(await client.reply("fen"), "e2e4");
    assert.equal(created, 2);
});
