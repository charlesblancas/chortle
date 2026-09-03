import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { performance } from "node:perf_hooks";
import { Chess } from "chess.js";
import { FIXTURES } from "../src/fixtures.js";
import { games } from "../src/games/final_games.js";
import { fileProjection, isMated, isPlayerMatedAfterReply, scoreWord, validatePuzzleRecord } from "../src/gameRules.js";
import { chooseReply, isUciMove } from "../src/lib/tinyEngine.js";
import { applyEngineReply, fastChessReply } from "../src/lib/fastChessEngine.js";
import { gameStorageKey, normalizeSavedGame, readSavedGame, writeSavedGame } from "../src/lib/gameStorage.js";

const mixed = FIXTURES.find((fixture) => fixture.id === "mixed-entry");

function loadSunfish() {
    const source = fs.readFileSync(new URL("../public/engines/sunfish/sunfish.js", import.meta.url), "utf8");
    const context = { module: { exports: {} }, exports: {}, performance, console };
    vm.runInNewContext(source, context, { filename: "sunfish.js" });
    return context.module.exports;
}

function sunfishMove(engine, fen, depth = 2) {
    const output = [];
    engine.engine(`position fen ${fen}`, (line) => output.push(line));
    engine.engine(`go depth ${depth}`, (line) => output.push(line));
    return output.findLast((line) => line.startsWith("bestmove "))?.split(/\s+/)[1] || "";
}

test("published fixture records have valid move projections", () => {
    for (const fixture of FIXTURES.filter((item) => !item.mated)) {
        assert.deepEqual(validatePuzzleRecord(fixture.game), [], fixture.id);
    }
});

test("player move projection ignores the automatic replies", () => {
    assert.equal(fileProjection(mixed.game.moves), "EGE");
});

test("mixed fixture line is legal and stateful", () => {
    const chess = new Chess(mixed.game.fen);
    for (const uci of mixed.game.moves.split(" ")) {
        chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    assert.equal(chess.fen(), "r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/5N2/PPPPKPPP/RNBQ1B1R b kq - 4 4");
});

test("duplicate letters use standard Wordle accounting", () => {
    assert.deepEqual(scoreWord("civic", "cacao"), [2, 0, 0, 0, 1]);
    assert.deepEqual(scoreWord("eerie", "tepee"), [1, 2, 0, 0, 2]);
});

test("mated fixture is recognized as terminal", () => {
    assert.equal(isMated("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1"), true);
    const fixture = FIXTURES.find((item) => item.id === "mate-state");
    const chess = new Chess(fixture.game.fen);
    for (const uci of fixture.game.moves.split(" ")) chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    assert.equal(isMated(chess.fen()), true);
    assert.equal(fixture.initialActions.at(-1).mated, true);
});

test("promotion fixture has a legal player promotion move", () => {
    const fixture = FIXTURES.find((item) => item.id === "promotion-state");
    const position = new Chess(fixture.game.fen);
    const [reply, promotion] = fixture.game.moves.split(" ");
    assert.ok(position.move({ from: reply.slice(0, 2), to: reply.slice(2, 4) }));
    assert.ok(position.move({ from: promotion.slice(0, 2), to: promotion.slice(2, 4), promotion: promotion[4] }));
    assert.equal(position.get("a8").type, "q");
    assert.deepEqual(validatePuzzleRecord(fixture.game), []);
});

test("a malformed projection is rejected by the pipeline", () => {
    const errors = validatePuzzleRecord({ ...mixed.game, word: "apple" });
    assert.ok(errors.some((error) => error.includes("projection")));
});

test("every shipped game has a playable move prefix for its word", () => {
    for (const game of games) assert.deepEqual(validatePuzzleRecord(game), [], game.word);
});

test("only real UCI moves are accepted from the engine", () => {
    assert.equal(isUciMove("e2e4"), true);
    assert.equal(isUciMove("a7a8q"), true);
    assert.equal(isUciMove("(none)"), false);
    assert.equal(isUciMove(""), false);
});

test("day 1649 can finish with h7 after an off-line Kc3 move", () => {
    const game = games[4];
    assert.equal(game.word, "blush");
    const line = game.moves.split(" ");
    const chess = new Chess(game.fen);

    // The first token is the puzzle's automatic setup move. Kc3 is a legal
    // but off-line player move, so the engine must reply before H is played.
    chess.move({ from: line[0].slice(0, 2), to: line[0].slice(2, 4) });
    assert.ok(chess.move({ from: "d4", to: "c3" }));
    const reply = fastChessReply(chess.fen());
    assert.equal(reply, "e6d7");
    assert.equal(applyEngineReply(chess, reply), reply);

    const terminal = chess.move({ from: "h6", to: "h7" });
    assert.equal(terminal?.lan, line[3]);
    assert.equal(line[4], undefined, "h7 is the only canonical player move at the end of this line");
    // The canonical UCI is not enough after Kc3: the position has already
    // diverged, so h7 must use the engine path rather than ending silently.
    const h7MoveCorrect = [{ moveCorrect: false }].every((action) => action.moveCorrect !== false) && terminal.lan === line[3];
    assert.equal(h7MoveCorrect, false);
    const h7Reply = applyEngineReply(chess, "", fastChessReply);
    assert.equal(h7Reply, "e4h7");
    assert.equal(chess.turn(), "w", "the engine reply returns the board to the player");
    assert.equal(chess.isCheckmate(), false);
});

test("an engine fallback is applied before the reply is reported", () => {
    const chess = new Chess("8/5p2/4k2P/3p4/4b3/1BK1P3/8/8 b - - 3 62");
    const reply = applyEngineReply(chess, "not-a-move", () => "e6d7");
    assert.equal(reply, "e6d7");
    assert.equal(chess.fen(), "8/3k1p2/7P/3p4/4b3/1BK1P3/8/8 w - - 4 63");
});

test("the tiny engine is deterministic, legal, and finds immediate mate", () => {
    const position = new Chess();
    for (const uci of ["f2f3", "e7e5", "g2g4"]) {
        position.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    }
    const before = position.fen();
    const reply = chooseReply(position);
    assert.equal(reply, "d8h4");
    assert.equal(position.fen(), before, "engine must not mutate the live board");
    assert.equal(chooseReply(position), reply, "same position must produce the same reply");
    assert.ok(position.move({ from: reply.slice(0, 2), to: reply.slice(2, 4) }));
    assert.equal(position.isCheckmate(), true);
});

test("vendored Sunfish accepts puzzle FEN and gives a deterministic legal reply", () => {
    const position = new Chess();
    for (const uci of ["f2f3", "e7e5", "g2g4"]) {
        position.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    }
    const sunfish = loadSunfish();
    const first = sunfishMove(sunfish, position.fen());
    const second = sunfishMove(sunfish, position.fen());
    assert.equal(first, second);
    assert.equal(first, "d8h4");
    assert.ok(position.move({ from: first.slice(0, 2), to: first.slice(2, 4), promotion: first[4] }));
});

test("a correct mate does not become a self-mate banner", () => {
    const correctMate = games.find((game) => game.word === "quiet");
    const winningBoard = new Chess(correctMate.fen);
    for (const uci of correctMate.moves.split(" ")) winningBoard.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    assert.equal(winningBoard.isCheckmate(), true);
    assert.equal(isPlayerMatedAfterReply(winningBoard, "w", ""), false);

    const selfMate = FIXTURES.find((fixture) => fixture.id === "mate-state");
    const losingBoard = new Chess(selfMate.game.fen);
    for (const uci of selfMate.game.moves.split(" ")) losingBoard.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    assert.equal(isPlayerMatedAfterReply(losingBoard, "w", "d8h4"), true);
});

test("daily game state is safely validated and round-trips through storage", () => {
    const game = games[0];
    const key = gameStorageKey(1, game);
    const storage = new Map();
    const state = {
        guesses: ["C", "", "", "", ""],
        statuses: Array.from({ length: 5 }, () => Array(5).fill(-1)),
        currentRow: 0,
        actions: [{ letter: "C", uci: "c2c4", reply: "e7e5", moveCorrect: true }],
        keyStatuses: { C: -1 },
        mated: false,
        completed: false,
    };
    const browserStorage = { getItem: (name) => storage.get(name) || null, setItem: (name, value) => storage.set(name, value) };
    assert.equal(writeSavedGame(browserStorage, key, state), true);
    assert.deepEqual(readSavedGame(browserStorage, key), state);
    assert.equal(normalizeSavedGame({ ...state, currentRow: 5 }), null);
    assert.equal(normalizeSavedGame({ ...state, actions: [{ ...state.actions[0], uci: "not-a-move" }] }), null);
    assert.equal(normalizeSavedGame({ ...state, guesses: ["T", "", "", "", ""] }), null);
});

test("completed daily game survives storage and remains restorable", () => {
    const game = games[0];
    const key = gameStorageKey(1, game);
    const storage = new Map();
    const completed = {
        guesses: ["BOARD", "", "", "", ""],
        statuses: [[2, 2, 2, 2, 2], ...Array.from({ length: 4 }, () => Array(5).fill(-1))],
        currentRow: 0,
        actions: [
            { letter: "B", uci: "b1b2", moveCorrect: true },
            { letter: "A", uci: "a1a2", moveCorrect: true },
            { letter: "D", uci: "d1d2", moveCorrect: true },
        ],
        keyStatuses: { B: 2, O: 2, A: 2, R: 2, D: 2 },
        mated: false,
        completed: true,
    };
    const browserStorage = { getItem: (name) => storage.get(name) || null, setItem: (name, value) => storage.set(name, value) };
    assert.equal(writeSavedGame(browserStorage, key, completed), true);
    assert.deepEqual(readSavedGame(browserStorage, key), completed);
});
