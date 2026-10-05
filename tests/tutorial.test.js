import test from "node:test";
import assert from "node:assert/strict";
import { Chess } from "chess.js";
import { possibilities } from "../src/games/possibilities.js";
import { chessMoveStatus, isSolvedGuess, playerMoves } from "../src/gameRules.js";
import { createTutorialSession } from "../src/lib/tutorialSession.js";
import { tutorialLesson } from "../src/lib/tutorialLesson.js";

test("tutorial uses legal Black moves, real scoring, all split colors, and a final win", () => {
    const lesson = tutorialLesson;
    const session = createTutorialSession(lesson);
    const feedback = [];
    let beforeUndo;
    while (session.getSnapshot().step.kind !== "complete") {
        const state = session.getSnapshot();
        const step = state.step;
        if (step.kind === "move") {
            assert.equal(new Chess(state.fen).turn(), "b", "Black owns each guided move position");
            if (state.rows[state.row].word.length === 4) beforeUndo = state.fen;
            assert.equal(session.move(step.uci), true);
        } else if (step.kind === "key" || step.kind === "shortcut") {
            const priorFen = state.fen;
            assert.equal(session.key(step.key), true);
            if (step.kind === "shortcut") assert.notEqual(session.getSnapshot().fen, priorFen, "confirmed letter plays a real move");
        }
        else if (step.kind === "undo") {
            assert.equal(state.rows[1].word, "BLEED");
            assert.ok(possibilities.includes("bleed"));
            assert.equal(session.key("Backspace"), true);
            assert.equal(session.getSnapshot().fen, beforeUndo);
            assert.equal(session.getSnapshot().rows[1].word, "BLEE");
        } else if (step.kind === "submit") {
            assert.ok(possibilities.includes(state.rows[state.row].word.toLowerCase()));
            session.key("Enter");
            feedback.push(session.getSnapshot().rows[state.row]);
        } else assert.equal(session.next(), true);
    }
    assert.deepEqual(feedback.map((row) => row.word), ["BEVEL", "BLEEP", "BLEEP"]);
    assert.deepEqual(feedback[1].status, [2, 2, 2, 2, 2]);
    const solution = playerMoves(lesson.moves);
    assert.deepEqual(feedback[1].actions.map((action) => chessMoveStatus(action, 2, solution)), [2, 1, 0]);
    assert.equal(chessMoveStatus(feedback[0].actions[1], feedback[0].status[1], solution), 2);
    assert.equal(feedback[0].status[1], 1);
    assert.equal(feedback[0].status[2], 0);
    assert.equal(isSolvedGuess(feedback[0].status, feedback[0].word, feedback[0].actions), false);
    assert.equal(isSolvedGuess(feedback[1].status, feedback[1].word, feedback[1].actions), false);
    assert.equal(isSolvedGuess(feedback[2].status, feedback[2].word, feedback[2].actions), true);
});

test("out-of-order practice move belongs to the real line and is actually legal early", () => {
    const session = createTutorialSession(tutorialLesson);
    while (session.getSnapshot().row === 0) {
        const step = session.getSnapshot().step;
        if (step.kind === "move") session.move(step.uci);
        else if (step.kind === "key") session.key(step.key);
        else if (step.kind === "submit") session.key("Enter");
        else session.next();
    }
    assert.equal(session.key("B"), true, "learned shortcut works before the final shortcut lesson");
    session.key("L");
    assert.equal(session.key("E"), false, "shortcut cannot play the deliberately out-of-order move");
    assert.equal(new Chess(session.getSnapshot().fen).move({ from: "e3", to: "f2" }).san, "Qxf2+");
    assert.equal(playerMoves(tutorialLesson.moves)[2], "e3f2");
});

test("unexpected input is recoverable and cannot advance or mutate practice", () => {
    const session = createTutorialSession(tutorialLesson);
    const before = session.getSnapshot();
    assert.equal(before.step.kind, "move", "practice is playable immediately");
    assert.equal(session.key("B"), false);
    assert.equal(session.key("Enter"), false);
    assert.equal(session.move("a6b5"), false);
    assert.equal(session.getSnapshot().fen, before.fen);
    assert.equal(session.getSnapshot().index, before.index);
    assert.equal(session.move("b6e3"), true);
    assert.equal(session.getSnapshot().message, "");
    const fresh = createTutorialSession(tutorialLesson);
    assert.equal(fresh.getSnapshot().rows[0].word, "");
    assert.equal(fresh.getSnapshot().index, 0);
});

test("Back restores every tutorial step, including scoring, row resets, undo, and shortcuts", () => {
    const session = createTutorialSession(tutorialLesson);
    assert.equal(session.back(), false);
    const perform = (step) => {
        if (step.kind === "move") return session.move(step.uci);
        if (step.kind === "key" || step.kind === "shortcut") return session.key(step.key);
        if (step.kind === "submit") return session.key("Enter");
        if (step.kind === "undo") return session.key("Backspace");
        return session.next();
    };
    while (session.getSnapshot().step.kind !== "complete") {
        const before = session.getSnapshot();
        assert.equal(perform(before.step), true);
        const after = session.getSnapshot();
        assert.equal(session.back(), true);
        assert.deepEqual(session.getSnapshot(), before);
        assert.equal(perform(before.step), true);
        assert.deepEqual(session.getSnapshot(), after);
    }
    while (session.back()) {}
    assert.deepEqual(session.getSnapshot(), createTutorialSession(tutorialLesson).getSnapshot());
});
