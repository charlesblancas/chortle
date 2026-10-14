import test from "node:test";
import assert from "node:assert/strict";
import { placeQueuedLetter, undoQueuedMove, lineGuessError, requiredLineMoves } from "../src/lib/lineMode.js";
import { games } from "../src/games/final_games.js";
import { playerMoves } from "../src/gameRules.js";
import { normalizeSavedGame } from "../src/lib/gameStorage.js";

const queue = [..."EAD"].map((letter) => ({ letter }));
test("move count uses the playable word prefix, not surplus replay continuation", () => {
    assert.equal(requiredLineMoves("heath"), 4);
    assert.equal(requiredLineMoves("PIOUS"), 0);
    for (const game of games) {
        const letters = [...game.word.toUpperCase()].filter((letter) => 'ABCDEFGH'.includes(letter)).join('');
        const prefix = playerMoves(game.moves).slice(0, requiredLineMoves(game.word)).map((uci) => uci[0].toUpperCase()).join('');
        assert.equal(prefix, letters, game.word);
    }
});
test("queued letters must be placed in order among typed letters", () => {
    assert.equal(placeQueuedLetter("", queue, "A"), null);
    assert.equal(placeQueuedLetter("", queue, "E"), "E");
    assert.equal(placeQueuedLetter("ER", queue, "A"), "ERA");
    assert.equal(placeQueuedLetter("ERAS", queue, "D"), "ERASD");
    assert.equal(lineGuessError("ERASD", queue, 3), "");
    assert.notEqual(lineGuessError("ARSED", queue, 3), "");
    assert.notEqual(lineGuessError("ERASD", queue.slice(0, 2), 3), "");
});

test("partial queued saves restore only in Line mode and reject invalid placement order", () => {
    const saved = { guesses: ["SA", "", "", ""], statuses: Array.from({ length: 4 }, () => Array(5).fill(-1)), currentRow: 0,
        actions: [{ letter: "A", uci: "a1f1", reply: "g2h2", moveCorrect: true }, { letter: "F", uci: "f7f2", reply: "e2f2", moveCorrect: true }],
        keyStatuses: {}, mated: false, completed: false, mode: "line" };
    assert.equal(normalizeSavedGame(saved).actions.length, 2);
    assert.equal(normalizeSavedGame(saved).mode, "line");
    assert.equal(normalizeSavedGame({ ...saved, mode: undefined }), null);
    assert.equal(normalizeSavedGame({ ...saved, guesses: ["SF", "", "", ""] }), null);
    assert.equal(normalizeSavedGame({ ...saved, mode: "other" }), null);
});
test("nonwords and duplicate-file queues remain submittable", () => {
    const repeated = [..."CCCCC"].map((letter) => ({ letter }));
    assert.equal(lineGuessError("CCCCC", repeated, 5), "");
    assert.equal(placeQueuedLetter("CCCC", repeated, "C"), "CCCCC");
    assert.equal(placeQueuedLetter("CCCCC", repeated, "C"), null);
});
test("board undo removes only the last move and its placement", () => {
    assert.deepEqual(undoQueuedMove("ERASD", queue), { word: "ERAS", actions: queue.slice(0, 2) });
    assert.deepEqual(undoQueuedMove("ERAS", queue), { word: "ERAS", actions: queue.slice(0, 2) });
    assert.deepEqual(undoQueuedMove("ERAS", queue.slice(0, 2)), { word: "ERS", actions: queue.slice(0, 1) });
});
