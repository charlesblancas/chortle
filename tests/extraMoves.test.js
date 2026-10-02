import test from "node:test";
import assert from "node:assert/strict";
import { isExtraPlayerMove } from "../src/gameRules.js";
import { normalizeSavedGame } from "../src/lib/gameStorage.js";

const line = "h7h6 a2a3 h6h5 b2b3 h5h4 c2c3";
const correct = ["a2a3", "b2b3", "c2c3"].map(uci => ({ uci, moveCorrect: true }));

test("correct prefixes and replayed prefixes are free", () => {
    correct.forEach((action, index) => assert.equal(isExtraPlayerMove(line, correct.slice(0, index), action.uci), false));
});
test("every move from divergence counts, including coincidentally matching moves", () => {
    assert.equal(isExtraPlayerMove(line, [], "a2a4"), true);
    assert.equal(isExtraPlayerMove(line, [{ uci: "a2a4", moveCorrect: false }], "b2b3"), true);
    assert.equal(isExtraPlayerMove(line, [...correct.slice(0, 2), { uci: "c2c4", moveCorrect: false }], "d2d3"), true);
});
test("all continuation moves after a correct complete line are free", () => {
    assert.equal(isExtraPlayerMove(line, correct, "d2d3"), false);
    assert.equal(isExtraPlayerMove(line, [...correct, { uci: "d2d3", moveCorrect: false }], "e2e3"), false);
});

test("three wrong moves remain three after undo and a correct replay", () => {
    let count = 0;
    let actions = [];
    for (const uci of ["a2a4", "b2b4", "c2c4"]) {
        count += Number(isExtraPlayerMove(line, actions, uci));
        actions.push({ uci, moveCorrect: false });
    }
    actions = [];
    for (const action of correct) {
        count += Number(isExtraPlayerMove(line, actions, action.uci));
        actions.push(action);
    }
    assert.equal(count, 3);
});

test("extra move totals survive storage normalization without breaking legacy saves", () => {
    const saved = { guesses: ["", "", "", ""], statuses: Array.from({ length: 4 }, () => Array(5).fill(-1)), currentRow: 0, actions: [], keyStatuses: {}, mated: false, completed: false };
    assert.equal(normalizeSavedGame({ ...saved, extraMoves: 3 }).extraMoves, 3);
    assert.equal(normalizeSavedGame(saved).extraMoves, undefined);
    for (const extraMoves of [-1, "3", NaN, 1.5]) assert.equal(normalizeSavedGame({ ...saved, extraMoves }).extraMoves, 0);
});
