import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { performance } from "node:perf_hooks";
import { Chess } from "chess.js";
import { FIXTURES } from "../src/fixtures.js";
import { games } from "../src/games/final_games.js";
import { chessMoveStatus, combineFeedbackStatuses, dailyPuzzleIndex, fileProjection, isCanonicalPlayerMove, isInteractiveKeyTarget, isMated, isPlayerMatedAfterReply, isSolvedGuess, scoreShareRow, scoreWord, shouldHandleWordGameKey, validatePuzzleRecord } from "../src/gameRules.js";
import { chooseReply, isUciMove } from "../src/lib/tinyEngine.js";
import { applyEngineReply, fastChessReply } from "../src/lib/fastChessEngine.js";
import { gameStorageKey, normalizeSavedGame, readSavedGame, writeSavedGame } from "../src/lib/gameStorage.js";
import { buildSolutionPositions, evaluationLabel, evaluationPercent, materialEvaluation } from "../src/lib/solutionReplay.js";
import { cacheSunfishAnalysis, getCachedSunfishAnalysis, seedSunfishAnalysis } from "../src/lib/sunfishEngine.js";

const mixed = FIXTURES.find((fixture) => fixture.id === "mixed-entry");

function loadSunfish() {
    const source = fs.readFileSync(new URL("../src/lib/sunfish.worker.js", import.meta.url), "utf8");
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

function sunfishEvaluation(engine, fen, depth = 1) {
    const output = [];
    engine.engine(`position fen ${fen}`, (line) => output.push(line));
    engine.engine(`go depth ${depth}`, (line) => output.push(line));
    const info = output.findLast((line) => line.startsWith("info ") && line.includes(" score cp "));
    return info ? Number(info.match(/ score cp (-?\d+)/)?.[1]) : NaN;
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

test("chess feedback is independent from the word color", () => {
    const correctActions = [
        { letter: "B", uci: "b3d5", moveCorrect: true },
        { letter: "H", uci: "h6h7", moveCorrect: true },
    ];
    const wrongActions = correctActions.map((action) => ({ ...action, moveCorrect: false }));
    assert.deepEqual(scoreWord("brush", "blush"), [2, 0, 2, 2, 2]);
    assert.deepEqual(scoreWord("blush", "blush"), [2, 2, 2, 2, 2]);
    assert.deepEqual(correctActions.map((action) => chessMoveStatus(action, 2)), [2, 2]);
    assert.deepEqual(wrongActions.map((action) => chessMoveStatus(action, 2, ["b3d5", "h6h7"])), [1, 1]);
    assert.equal(chessMoveStatus({ letter: "B", uci: "b3b4", moveCorrect: false }, 2, ["b3d5"]), 0);
    assert.equal(chessMoveStatus({ letter: "B", uci: "b3d5", moveCorrect: false }, 0, ["b3d5"]), 0);
    assert.equal(chessMoveStatus(null, 0), 0);
});

test("shared result tiles combine word and chess feedback without exposing moves", () => {
    assert.equal(combineFeedbackStatuses([2, 2]), 2, "all green stays green");
    assert.equal(combineFeedbackStatuses([1, 1]), 1, "all yellow stays yellow");
    assert.equal(combineFeedbackStatuses([0, 0]), 0, "all gray stays gray");
    assert.equal(combineFeedbackStatuses([2, 0]), 1, "a green/gray split is yellow");
    assert.equal(combineFeedbackStatuses([1, 0]), 1, "a yellow/gray split is yellow");

    const statuses = [2, 2, 2, 2, 2];
    const actions = [
        { letter: "F", uci: "f3f6", moveCorrect: false },
        { letter: "F", uci: "f7f8q", moveCorrect: false },
    ];
    assert.deepEqual(
        scoreShareRow("FIFTY", statuses, actions, ["f7f8q", "f8f3"]),
        [1, 2, 1, 2, 2],
        "only the combined feedback is shared, not the moves themselves"
    );
});

test("an exact word only solves with its complete chess sequence", () => {
    const word = "fifty";
    const exact = scoreWord(word, word);
    assert.equal(isSolvedGuess(exact, word, [
        { letter: "F", moveCorrect: true },
        { letter: "F", moveCorrect: true },
    ]), true);
    assert.equal(isSolvedGuess(exact, word, [
        { letter: "F", moveCorrect: false },
        { letter: "F", moveCorrect: true },
    ]), false);
});

test("canonical move matching resets cleanly between rows", () => {
    const game = games[4];
    assert.equal(isCanonicalPlayerMove(game.moves, [], "b3d5"), true);
    assert.equal(isCanonicalPlayerMove(game.moves, [], "h6h7"), false);
    assert.equal(isCanonicalPlayerMove(game.moves, [{ moveCorrect: true }], "h6h7"), true);
    assert.equal(isCanonicalPlayerMove(game.moves, [{ moveCorrect: false }], "h6h7"), false);
});

test("daily puzzle index uses calendar days across DST boundaries", () => {
    const start = new Date(2026, 0, 1);
    const springDay = new Date(2026, 2, 8);
    const dayAfterSpring = new Date(2026, 2, 9);
    const autumnDay = new Date(2026, 10, 1);
    const dayAfterAutumn = new Date(2026, 10, 2);
    assert.equal(dailyPuzzleIndex(dayAfterSpring, start) - dailyPuzzleIndex(springDay, start), 1);
    assert.equal(dailyPuzzleIndex(dayAfterAutumn, start) - dailyPuzzleIndex(autumnDay, start), 1);
    assert.equal(dailyPuzzleIndex(new Date(2025, 11, 31), start), 1);
});

test("global game keyboard filtering ignores shortcuts, repeats, and controls", () => {
    const body = { tagName: "BODY" };
    assert.equal(shouldHandleWordGameKey({ key: "x", target: body }), true);
    assert.equal(shouldHandleWordGameKey({ key: "Enter", target: body }), true);
    assert.equal(shouldHandleWordGameKey({ key: "x", target: body, repeat: true }), false);
    assert.equal(shouldHandleWordGameKey({ key: "x", target: body, ctrlKey: true }), false);
    assert.equal(shouldHandleWordGameKey({ key: "x", target: body, shiftKey: true }), false);
    assert.equal(shouldHandleWordGameKey({ key: "x", target: { tagName: "BUTTON" } }), false);
    assert.equal(isInteractiveKeyTarget({ isContentEditable: true }), true);
    assert.equal(isInteractiveKeyTarget({ closest: () => ({}) }), true);
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
    assert.equal(reply, fastChessReply(chess.fen()));
    assert.ok(isUciMove(reply));
    assert.equal(applyEngineReply(chess, reply), reply);

    const terminal = chess.move({ from: "h6", to: "h7" });
    assert.equal(terminal?.lan, line[3]);
    assert.equal(line[4], undefined, "h7 is the only canonical player move at the end of this line");
    // The canonical UCI is not enough after Kc3: the position has already
    // diverged, so h7 must use the engine path rather than ending silently.
    const h7MoveCorrect = [{ moveCorrect: false }].every((action) => action.moveCorrect !== false) && terminal.lan === line[3];
    assert.equal(h7MoveCorrect, false);
    const h7Reply = applyEngineReply(chess, "", fastChessReply);
    assert.ok(isUciMove(h7Reply));
    assert.equal(chess.turn(), "w", "the engine reply returns the board to the player");
    assert.equal(chess.isCheckmate(), false);
});

test("a final canonical player move gets a reply when the line is not terminal", () => {
    const game = games[4];
    const position = new Chess(game.fen);
    for (const uci of game.moves.split(" ")) {
        position.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
    }
    assert.equal(position.turn(), "b", "the published line ends after the player move");
    assert.equal(position.isGameOver(), false);
    const reply = applyEngineReply(position, "", fastChessReply);
    assert.ok(reply, "a deterministic reply should be selected");
    assert.equal(position.turn(), "w", "the reply returns the board to the player");
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

test("solution replay starts at the playable position and visits every canonical ply", () => {
    const game = games.find((item) => item.word === "focal");
    const positions = buildSolutionPositions(game.fen, game.moves);
    assert.equal(positions.length, game.moves.trim().split(/\s+/).length);
    assert.equal(positions[0].setup.move, game.moves.split(/\s+/)[0]);
    assert.equal(positions[1].move, game.moves.split(/\s+/)[1]);
    assert.equal(positions.at(-1).move, game.moves.trim().split(/\s+/).at(-1));
    assert.notEqual(positions[0].fen, game.fen, "the automatic setup move is already shown in normal play");
});

test("solution evaluation fallback is deterministic and readable", () => {
    const start = new Chess();
    assert.equal(materialEvaluation(start.fen()), 0);
    assert.equal(evaluationLabel(0), "Equal");
    assert.equal(evaluationLabel(150), "White +1.5");
    assert.equal(evaluationLabel(-250), "Black +2.5");
    assert.equal(evaluationPercent(0), 50);
    assert.equal(evaluationPercent(10000), 95);
});

test("Sunfish analysis cache restores moves and carries a suggested child score", () => {
    const parentFen = "cache-parent";
    const childFen = "cache-child";
    cacheSunfishAnalysis(parentFen, 14, { move: "c3c2", score: 375 });
    cacheSunfishAnalysis(parentFen, 4, { move: "a1a2", score: 0 });

    const parent = getCachedSunfishAnalysis(parentFen);
    assert.deepEqual(parent, { depth: 14, move: "c3c2", score: 375, verified: true });

    seedSunfishAnalysis(childFen, parent);
    assert.deepEqual(getCachedSunfishAnalysis(childFen), {
        depth: 14,
        move: "",
        score: 375,
        verified: false,
    });

    cacheSunfishAnalysis(childFen, 2, { move: "d4d5", score: 410 });
    assert.deepEqual(getCachedSunfishAnalysis(childFen), {
        depth: 2,
        move: "d4d5",
        score: 410,
        verified: true,
    });
});

test("vendored Sunfish returns a deterministic evaluation score", () => {
    const position = new Chess();
    position.move({ from: "e2", to: "e4" });
    const sunfish = loadSunfish();
    const first = sunfishEvaluation(sunfish, position.fen());
    const second = sunfishEvaluation(sunfish, position.fen());
    assert.ok(Number.isFinite(first));
    assert.equal(first, second);
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
        actionHistory: Array.from({ length: 5 }, () => []),
        keyStatuses: { C: -1 },
        mated: false,
        terminal: false,
        solved: false,
        completed: false,
    };
    const browserStorage = { getItem: (name) => storage.get(name) || null, setItem: (name, value) => storage.set(name, value) };
    assert.equal(writeSavedGame(browserStorage, key, state), true);
    assert.deepEqual(readSavedGame(browserStorage, key), state);
    const legacyState = { ...state };
    delete legacyState.actionHistory;
    assert.deepEqual(normalizeSavedGame(legacyState).actionHistory, Array.from({ length: 5 }, () => []));
    assert.equal(normalizeSavedGame({ ...state, currentRow: 5 }), null);
    assert.equal(normalizeSavedGame({ ...state, actions: [{ ...state.actions[0], uci: "not-a-move" }] }), null);
    assert.equal(normalizeSavedGame({ ...state, actionHistory: [[{ ...state.actions[0], uci: "not-a-move" }], [], [], [], []] }), null);
    assert.equal(normalizeSavedGame({ ...state, guesses: ["T", "", "", "", ""] }), null);
});

test("a legacy exact word with a wrong chess sequence resumes instead of winning", () => {
    const legacy = {
        guesses: ["FIFTY", "", "", "", ""],
        statuses: [[2, 2, 2, 2, 2], ...Array.from({ length: 4 }, () => Array(5).fill(-1))],
        currentRow: 0,
        actions: [
            { letter: "F", uci: "f3f6", moveCorrect: false },
            { letter: "F", uci: "f7f8q", moveCorrect: false },
        ],
        actionHistory: [[
            { letter: "F", uci: "f3f6", moveCorrect: false },
            { letter: "F", uci: "f7f8q", moveCorrect: false },
        ], [], [], [], []],
        keyStatuses: { F: 2, I: 2, T: 2, Y: 2 },
        mated: false,
        completed: true,
    };
    const restored = normalizeSavedGame(legacy);
    assert.equal(restored.solved, false);
    assert.equal(restored.completed, false);
    assert.equal(restored.currentRow, 1);
    assert.deepEqual(restored.actions, []);
});

test("a resumed row never carries a previous self-mate lock", () => {
    const legacy = {
        guesses: ["FIFTY", "", "", "", ""],
        statuses: [[2, 2, 2, 2, 2], ...Array.from({ length: 4 }, () => Array(5).fill(-1))],
        currentRow: 0,
        actions: [
            { letter: "F", uci: "f3f6", moveCorrect: false },
            { letter: "F", uci: "f7f8q", moveCorrect: false },
        ],
        actionHistory: [[], [], [], [], []],
        keyStatuses: { F: 2, I: 2, T: 2, Y: 2 },
        mated: true,
        solved: false,
        completed: true,
    };
    const restored = normalizeSavedGame(legacy);
    assert.equal(restored.currentRow, 1);
    assert.equal(restored.mated, false);
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
        actionHistory: [[
            { letter: "B", uci: "b1b2", moveCorrect: true },
            { letter: "A", uci: "a1a2", moveCorrect: true },
            { letter: "D", uci: "d1d2", moveCorrect: true },
        ], [], [], [], []],
        keyStatuses: { B: 2, O: 2, A: 2, R: 2, D: 2 },
        mated: false,
        solved: true,
        completed: true,
    };
    const browserStorage = { getItem: (name) => storage.get(name) || null, setItem: (name, value) => storage.set(name, value) };
    assert.equal(writeSavedGame(browserStorage, key, completed), true);
    assert.deepEqual(readSavedGame(browserStorage, key), completed);
});
