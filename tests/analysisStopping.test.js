import test from "node:test";
import assert from "node:assert/strict";
import { createAnalysisCoordinator } from "../src/lib/analysisCoordinator.js";

function harness(results, cached = null) {
    const calls = [];
    const updates = [];
    const saved = [];
    const coordinator = createAnalysisCoordinator({
        getCached: () => cached,
        nextDepth: () => 2,
        analyze: async (fen, depth) => {
            calls.push(depth);
            assert.ok(results.length, "unexpected extra search");
            return results.shift();
        },
        cache: (fen, depth, result) => saved.push(result),
    });
    return { coordinator, calls, updates, saved,
        run: (fen = "test-position") => coordinator.start(fen, "", {
            onDepth: (update) => updates.push(update),
        }) };
}

test("checkmate and stalemate require no engine search", async () => {
    for (const [fen, score, mate] of [
        ["7k/6Q1/5K2/8/8/8/8/8 b - - 0 1", 100000, 0],
        ["7k/5Q2/6K1/8/8/8/8/8 b - - 0 1", 0, undefined],
    ]) {
        const h = harness([]);
        await h.run(fen);
        assert.deepEqual(h.calls, []);
        assert.equal(h.updates[0].result.score, score);
        assert.equal(h.updates[0].result.mate, mate);
        assert.equal(h.updates[0].depth, 0);
    }
});

test("mate in one stops immediately for either side", async () => {
    for (const mate of [1, -1]) {
        const h = harness([{ move: "a1a2", score: 100000, mate }]);
        await h.run();
        assert.deepEqual(h.calls, [2]);
        assert.equal(h.saved[0].analysisComplete, true);
    }
});

test("longer mate requires three consecutive matching distances and moves", async () => {
    const h = harness([
        { move: "a1a2", mate: 4 },
        { move: "a1b1", mate: 4 },
        { move: "a1b1", mate: 3 },
        { move: "a1b1", score: 400 },
        { move: "a1b1", mate: 3 },
        { move: "a1b1", mate: 3 },
        { move: "a1b1", mate: 3 },
    ]);
    await h.run();
    assert.deepEqual(h.calls, [2, 3, 4, 5, 6, 7, 8]);
    assert.equal(h.saved.at(-1).analysisComplete, true);
});

test("settled verified cache does not resume; provisional cache still searches", async () => {
    for (const verified of [true, false]) {
        const h = harness([{ move: "", score: 0 }], { verified, mate: 3, analysisComplete: true });
        await h.run();
        assert.equal(h.calls.length, verified ? 0 : 1);
    }
});

test("ordinary evaluations keep deepening until cancelled", async () => {
    const h = harness(Array.from({ length: 5 }, () => ({ move: "a1a2", score: 100 })));
    await h.coordinator.start("test-position", "", {
        onDepth: ({ depth }) => { if (depth === 6) h.coordinator.stop(); },
    });
    assert.deepEqual(h.calls, [2, 3, 4, 5, 6]);
    assert.ok(h.saved.every((result) => !result.analysisComplete));
});
