import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { createDailyPuzzleSession } from "../src/lib/dailyPuzzleSession.js";
import { FIXTURES } from "../src/fixtures.js";
import { games } from "../src/games/final_games.js";
import { playerMoves } from "../src/gameRules.js";

const mixed = FIXTURES.find(f => f.id === "mixed-entry");
const dictionary = word => ["egret", "egres", "fizzy", "pious", "staff"].includes(word);
const flush = () => new Promise(resolve => setImmediate(resolve));
function memoryStorage() {
    const items = new Map();
    return { getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: key => items.delete(key) };
}
function create(options = {}) {
    const storage = options.storage || memoryStorage();
    return createDailyPuzzleSession({ game: mixed.game, storageKey: "daily", storage, isWord: dictionary,
        reply: async (fen, recorded) => recorded || new Chess(fen).moves({ verbose: true })[0]?.lan || "", ...options });
}
function type(session, word) { for (const key of word) session.input(key); }

test("Classic commits a complete word and line, persists it and restores the same result", async () => {
    const storage = memoryStorage();
    const session = create({ storage });
    await session.play("e2e4"); await session.play("g1f3"); session.input("R");
    await session.play("e1e2"); session.input("T"); session.input("Enter");
    const state = session.snapshot();
    assert.equal(state.guesses[0], "EGRET");
    assert.equal(state.completed, true); assert.equal(state.solved, true);
    assert.equal(state.extraMoves, 0);
    const restored = create({ storage }).snapshot();
    assert.equal(restored.restoredCompleted, true);
    assert.deepEqual(restored.actionHistory, state.actionHistory);
    assert.equal(restored.boardFen, state.boardFen);
    session.destroy();
});

test("Line queues separately, places in order, rejects nonwords and preserves undo semantics", async () => {
    const session = create({ mode: "line" });
    await session.play("e2e4"); await session.play("g1f3");
    assert.equal(session.snapshot().guesses[0], "");
    session.input("G"); assert.match(session.snapshot().message, /Place E next/);
    type(session, "EGR");
    await session.play("e1e2"); type(session, "EX"); session.input("Enter");
    assert.match(session.snapshot().message, /not in word list/);
    session.input("Backspace");
    assert.equal(session.snapshot().actions.length, 3);
    session.undoMove();
    assert.equal(session.snapshot().guesses[0], "EGR");
    assert.equal(session.snapshot().actions.length, 2);
    await session.play("e1e2"); type(session, "ET"); session.input("Enter");
    assert.equal(session.snapshot().solved, true);
    session.destroy();
});

test("pending replies lock every command and never replace the last durable state", async () => {
    const storage = memoryStorage();
    let resolveReply;
    const session = create({ storage, reply: () => new Promise(resolve => resolveReply = resolve) });
    session.input("R");
    const durable = storage.getItem("daily");
    const pending = session.play("e2e4");
    assert.equal(session.snapshot().thinking, true);
    assert.equal(session.snapshot().actions[0].pending, true);
    type(session, "T"); session.input("Backspace"); session.input("Enter"); session.undoMove();
    assert.equal(await session.play("g1f3"), false);
    assert.equal(session.snapshot().guesses[0], "RE");
    assert.equal(storage.getItem("daily"), durable);
    resolveReply("g8f6"); await pending;
    const saved = JSON.parse(storage.getItem("daily"));
    assert.equal(saved.actions[0].reply, "g8f6"); assert.equal(saved.actions[0].pending, false);
    assert.equal(new Chess(session.snapshot().boardFen).turn(), "w");
    session.destroy();
});

test("invalid replies recover before unlocking; late replies cannot write after disposal", async () => {
    const calls = [];
    const session = create({ reply: async (fen, recorded) => { calls.push(recorded); return calls.length === 1 ? "bad" : "g8f6"; } });
    await session.play("e2e4");
    assert.deepEqual(calls, ["g8f6", undefined]);
    assert.equal(session.snapshot().actions[0].reply, "g8f6");
    session.destroy();
    const storage = memoryStorage(); let resolveReply;
    const abandoned = create({ storage, reply: () => new Promise(resolve => resolveReply = resolve) });
    let notifications = 0; abandoned.subscribe(() => notifications++);
    const pending = abandoned.play("e2e4");
    abandoned.destroy(); const count = notifications;
    resolveReply("g8f6"); await pending;
    assert.equal(notifications, count); assert.equal(storage.getItem("daily"), null);
});

test("off-line moves remain off-line and extra-move counting survives undo and reload", async () => {
    const storage = memoryStorage();
    const requests = [];
    const session = create({ storage, reply: async (fen, recorded) => { requests.push(recorded); return "g8f6"; } });
    await session.play("d2d4");
    assert.equal(session.snapshot().actions[0].moveCorrect, false);
    assert.equal(session.snapshot().extraMoves, 1); assert.equal(requests[0], "");
    session.input("Backspace");
    assert.equal(session.snapshot().actions.length, 0);
    assert.equal(create({ storage }).snapshot().extraMoves, 1);
    await session.play("e2e4");
    assert.equal(session.snapshot().extraMoves, 1);
    session.destroy();
});

test("green keyboard moves use the session transaction in both modes", async () => {
    for (const mode of ["normal", "line"]) {
        const session = create({ mode });
        await session.play("e2e4"); if (mode === "line") session.input("E");
        await session.play("g1f3"); if (mode === "line") session.input("G");
        session.input("R"); await session.play("e1e2"); if (mode === "line") session.input("E");
        session.input("S"); session.input("Enter");
        assert.equal(session.snapshot().currentRow, 1);
        session.input("E"); await flush();
        assert.equal(session.snapshot().guesses[1], "E");
        assert.equal(session.snapshot().actions[0].uci, "e2e4");
        session.input("Backspace");
        assert.equal(session.snapshot().actions.length, mode === "line" ? 1 : 0);
        session.destroy();
    }
});

test("terminal player moves need no reply and ordinary letters still complete the word", async () => {
    const fixture = FIXTURES.find(f => f.id === "player-mate-entry");
    const session = create({ game: fixture.game, reply: () => { throw Error("must not search mate"); } });
    await session.play("f7g7");
    assert.equal(session.snapshot().terminal, true);
    type(session, "IZZY"); session.input("Enter");
    assert.equal(session.snapshot().solved, true);
    session.destroy();
});

test("self-mate blocks Classic letters until undo, but Line placement remains editable", () => {
    const fixture = FIXTURES.find(f => f.id === "mate-state");
    const normal = create({ game: fixture.game, fixture });
    normal.input("O"); assert.equal(normal.snapshot().guesses[0], "FG");
    normal.input("Backspace"); assert.equal(normal.snapshot().mated, false);
    assert.equal(normal.snapshot().guesses[0], "F"); normal.destroy();
    const line = create({ game: fixture.game, fixture, mode: "line" });
    line.input("O"); assert.equal(line.snapshot().guesses[0], "FGO"); line.destroy();
});

test("promotion pending blocks input until chosen or cancelled; underpromotion is accepted", async () => {
    const game = FIXTURES.find(f => f.id === "promotion-state").game;
    const session = create({ game });
    const start = session.snapshot().boardFen;
    session.setPromotionPending(true); session.input("P");
    assert.equal(await session.play("a7a8n"), false);
    assert.equal(session.snapshot().boardFen, start);
    session.setPromotionPending(false);
    assert.equal(await session.play("a7a8n"), true);
    assert.equal(new Chess(session.snapshot().boardFen).get("a8").type, "n");
    session.input("Backspace"); assert.equal(session.snapshot().boardFen, start);
    session.destroy();
});

test("legacy five-attempt games and partial Line queues restore unchanged", async () => {
    const storage = memoryStorage();
    const session = create({ storage, mode: "line" });
    await session.play("e2e4"); await session.play("g1f3"); session.input("E");
    const saved = JSON.parse(storage.getItem("daily"));
    saved.guesses.push(""); saved.statuses.push(Array(5).fill(-1)); saved.actionHistory.push([]);
    storage.setItem("daily", JSON.stringify(saved));
    const restored = create({ storage, mode: "line" });
    assert.equal(restored.snapshot().guesses.length, 5);
    assert.equal(restored.snapshot().actions.length, 2);
    assert.equal(restored.snapshot().guesses[0], "E");
    assert.equal(restored.snapshot().boardFen, session.snapshot().boardFen);
    session.destroy(); restored.destroy();
});

test("move budget follows word letters, not surplus canonical continuation", () => {
    for (const game of games) {
        const session = create({ game, mode: "line" });
        const required = session.snapshot().requiredMoves;
        assert.equal(playerMoves(game.moves).slice(0, required).map(uci => uci[0]).join(""), [...game.word].filter(l => "abcdefgh".includes(l)).join(""), game.word);
        session.destroy();
    }
});

test("snapshots cannot mutate the session and blocked storage does not prevent play", async () => {
    const session = create({ storage: { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } } });
    const snapshot = session.snapshot(); snapshot.guesses[0] = "BROKE";
    await session.play("e2e4"); assert.equal(session.snapshot().guesses[0], "E");
    session.destroy();
});

test("invalid queue order or mode cannot restore a partial Line save", async () => {
    const storage = memoryStorage();
    const session = create({ storage, mode: "line" });
    await session.play("e2e4"); await session.play("g1f3"); session.input("E");
    const saved = JSON.parse(storage.getItem("daily"));
    for (const invalid of [{ ...saved, mode: undefined }, { ...saved, mode: "other" }, { ...saved, guesses: ["G", "", "", ""] }]) {
        storage.setItem("daily", JSON.stringify(invalid));
        const restored = create({ storage, mode: "line" });
        assert.equal(restored.snapshot().actions.length, 0);
        restored.destroy();
    }
    session.destroy();
});
