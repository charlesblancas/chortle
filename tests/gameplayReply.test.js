import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { gameplayReply } from "../src/lib/gameplayReply.js";
import { fastChessReply } from "../src/lib/fastChessEngine.js";

const fen = new Chess().fen();
test("a recorded legal reply is preserved without searching", async () => {
    assert.equal(await gameplayReply(fen, "e2e4", { search: () => assert.fail("Unexpected search") }), "e2e4");
});
test("recorded replies pause around 50 ms without changing the move", async () => {
    for (const sample of [0, 0.5, 0.999]) {
        const delays = [];
        assert.equal(await gameplayReply(fen, "e2e4", {
            random: () => sample,
            wait: async delay => { delays.push(delay); },
            search: () => assert.fail("Unexpected search"),
        }), "e2e4");
        assert.deepEqual(delays, [40 + sample * 20]);
    }
});
test("engine replies do not receive the recorded-line pause", async () => {
    assert.equal(await gameplayReply(fen, "", {
        search: async () => "e2e4",
        wait: () => assert.fail("Unexpected delay"),
    }), "e2e4");
});
test("missing and invalid recorded replies ask the regular engine", async () => {
    for (const recorded of ["", "a1a8", "garbage"]) {
        let calls = 0;
        assert.equal(await gameplayReply(fen, recorded, { search: async (position, depth) => {
            assert.equal(position, fen); assert.equal(depth, 20000); calls++;
            return "e2e4";
        }, recover: () => assert.fail("Unexpected recovery") }), "e2e4");
        assert.equal(calls, 1);
    }
});
test("worker failure and invalid engine moves use tactical recovery", async () => {
    for (const search of [async () => { throw new Error("timeout"); }, async () => "a1a8"]) {
        let recoveries = 0;
        assert.equal(await gameplayReply(fen, "", { search, recover: async position => {
            assert.equal(position, fen); recoveries++; return "d2d4";
        } }), "d2d4");
        assert.equal(recoveries, 1);
    }
});
test("tactical recovery avoids the three benchmark mate-in-one blunders and repeats", async () => {
    for (const position of [
        "8/1p2N3/1kbp1p2/5P2/1P6/2R5/2p3PP/r4R1K w - - 5 33",
        "2r5/ppq4p/3b2k1/1b4P1/3B4/8/P2N4/3K2QR w - - 0 33",
        "4B3/p7/1n2pp2/P1rb1k2/1p2q3/6Qp/5PP1/5RK1 b - - 0 46",
    ]) {
        const options = { search: async () => { throw new Error("Worker failed"); }, recover: fastChessReply };
        const move = await gameplayReply(position, "", options);
        assert.equal(move, await gameplayReply(position, "", options));
        const chess = new Chess(position);
        chess.move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] });
        for (const response of chess.moves({ verbose: true })) {
            chess.move(response);
            assert.equal(chess.isCheckmate(), false, `${move} allows ${response.san}`);
            chess.undo();
        }
    }
});
test("a terminal position needs no reply", async () => {
    const chess = new Chess();
    for (const move of ["f3", "e5", "g4", "Qh4#"]) chess.move(move);
    assert.equal(await gameplayReply(chess.fen(), "", { search: () => assert.fail("Unexpected search") }), "");
});
