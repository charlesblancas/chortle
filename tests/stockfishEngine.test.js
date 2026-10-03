import test from "node:test";
import assert from "node:assert/strict";
import { createStockfishClient, normalizeNodeBudget } from "../src/lib/stockfishEngine.js";
import { evaluationLabel } from "../src/lib/solutionReplay.js";
import { shouldHandleReplayKey } from "../src/gameRules.js";

test('replay Backspace ignores modifiers, repeats, and editable controls but works on buttons', () => {
    const key = { key: 'Backspace' };
    assert.equal(shouldHandleReplayKey(key), true);
    for (const flag of ['ctrlKey', 'altKey', 'metaKey', 'shiftKey', 'repeat', 'defaultPrevented']) {
        assert.equal(shouldHandleReplayKey({ ...key, [flag]: true }), false);
    }
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
        assert.equal(shouldHandleReplayKey({ ...key, target: { tagName } }), false);
    }
    assert.equal(shouldHandleReplayKey({ ...key, target: { isContentEditable: true } }), false);
    assert.equal(shouldHandleReplayKey({ ...key, target: { tagName: 'BUTTON' } }), true);
});

function controlledWorker({ startup = true, result } = {}) {
    const messages = [];
    const worker = { messages, terminated: false,
        terminate() { worker.terminated = true; },
        emit(data) { worker.onmessage?.({ data }); },
        postMessage(message) {
            messages.push(message);
            if (startup && ['uci', 'isready'].includes(message)) {
                queueMicrotask(() => worker.emit(message === 'uci' ? 'uciok' : 'readyok'));
            }
            if (message.startsWith('go ') && result) {
                queueMicrotask(() => { worker.emit(result); worker.emit('bestmove e2e4'); });
            }
        },
    };
    return worker;
}

async function flush() { await new Promise(resolve => setTimeout(resolve, 0)); }

test('analysis and replies use the same worker and normalize evaluations to White', async () => {
    let created = 0;
    const fake = controlledWorker({ result: 'info depth 4 score cp 125 pv e2e4' });
    const client = createStockfishClient({ createWorker: () => { created++; return fake; } });
    assert.deepEqual(await client.analyze('8/8/8/8/8/8/8/K6k b - - 0 1', 4), { move: 'e2e4', score: -125 });
    assert.deepEqual(await client.analyze('8/8/8/8/8/8/8/K6k w - - 0 1', 5), { move: 'e2e4', score: 125 });
    assert.equal(await client.reply('position', 20000), 'e2e4');
    assert.equal(created, 1);
    assert.ok(fake.messages.includes('go depth 4'));
    assert.ok(fake.messages.includes('go nodes 20000'));
});

test('progressive analysis preserves hash at the same position, replies always reset it', async () => {
    const fake = controlledWorker({ result: 'info depth 2 score cp 20' });
    const client = createStockfishClient({ createWorker: () => fake });
    await client.analyze('position', 2);
    await client.analyze('position', 3);
    assert.equal(fake.messages.filter(message => message === 'ucinewgame').length, 1);
    await client.reply('position');
    await client.reply('position');
    assert.equal(fake.messages.filter(message => message === 'ucinewgame').length, 3);
});

test('mate scores retain distance and side, including checkmate at zero', async () => {
    for (const [turn, raw, score, mate, label] of [
        ['w', 3, 100000, 3, 'White mates in 3'],
        ['b', 3, -100000, -3, 'Black mates in 3'],
        ['w', -2, -100000, -2, 'Black mates in 2'],
        ['b', 0, 100000, -0, 'White wins by checkmate'],
    ]) {
        const fake = controlledWorker({ result: `info depth 4 score mate ${raw}` });
        const client = createStockfishClient({ createWorker: () => fake });
        const result = await client.analyze(`8/8/8/8/8/8/8/K6k ${turn} - - 0 1`, 4);
        assert.equal(result.score, score);
        assert.equal(result.mate, mate);
        assert.equal(evaluationLabel(result.score, result.mate), label);
    }
});

test('cancellation through startup never launches a stale analysis', async () => {
    const fake = controlledWorker({ startup: false });
    const client = createStockfishClient({ createWorker: () => fake });
    const controller = new AbortController();
    const result = client.analyze('position', 14, { signal: controller.signal });
    await flush();
    controller.abort();
    await assert.rejects(result, { name: 'AbortError' });
    fake.emit('uciok'); fake.emit('readyok');
    await flush();
    assert.equal(fake.terminated, true);
    assert.equal(fake.messages.some(message => message.startsWith('go ')), false);
});

test('late messages from cancelled searches cannot settle replacement analysis', async () => {
    const workers = [];
    const client = createStockfishClient({ createWorker: () => {
        const worker = controlledWorker(); workers.push(worker); return worker;
    } });
    const controller = new AbortController();
    const cancelled = client.analyze('old position', 14, { signal: controller.signal });
    await flush();
    assert.ok(workers[0].messages.includes('go depth 14'));
    controller.abort();
    await assert.rejects(cancelled, { name: 'AbortError' });
    let settled = false;
    const next = client.analyze('new position', 2);
    next.then(() => { settled = true; });
    await flush();
    workers[0].emit('info depth 14 score cp 999');
    workers[0].emit('bestmove a1a2');
    workers[0].onerror();
    await flush();
    assert.equal(settled, false);
    assert.equal(workers[1].terminated, false);
    workers[1].emit('info depth 2 score cp 20');
    workers[1].emit('bestmove e2e4');
    assert.deepEqual(await next, { move: 'e2e4', score: 20 });
});

test('an aborted queued analysis does not interrupt an active reply', async () => {
    const fake = controlledWorker();
    const client = createStockfishClient({ createWorker: () => fake });
    const reply = client.reply('position');
    const controller = new AbortController();
    const analysis = client.analyze('next position', 2, { signal: controller.signal });
    controller.abort();
    await flush();
    assert.equal(fake.terminated, false);
    fake.emit('bestmove e2e4');
    assert.equal(await reply, 'e2e4');
    await assert.rejects(analysis, { name: 'AbortError' });
    assert.equal(fake.messages.some(message => message.startsWith('go depth')), false);
});

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
