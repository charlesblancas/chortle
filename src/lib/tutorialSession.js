import { Chess } from "chess.js";
import { confirmedMoveShortcut, isCanonicalPlayerMove, scoreWord } from "../gameRules.js";

// Guided input is deliberately separate from daily-game stores and storage.
// All board changes still go through chess.js and all feedback through the
// same rules as a real guess. Scripted replies make practice repeatable.
export function createTutorialSession(lesson) {
    const initial = new Chess(lesson.fen);
    const trigger = lesson.moves.split(" ")[0];
    initial.move({ from: trigger.slice(0, 2), to: trigger.slice(2, 4), promotion: trigger[4] });
    const startFen = initial.fen();
    let index = 0;
    let row = 0;
    let fen = startFen;
    let lastMove = trigger;
    let message = "";
    let rows = [{ word: "", actions: [], status: Array(5).fill(-1) }];
    let history = [];

    function snapshot() {
        return { index, row, fen, lastMove, message, step: lesson.steps[index],
            rows: rows.map((entry) => ({ ...entry, actions: entry.actions.map((a) => ({ ...a })), status: [...entry.status] })) };
    }

    function reject() {
        message = "Try the move or key shown above.";
        return false;
    }

    function advance() {
        index += 1;
        message = "";
        checkpoints.push(checkpoint());
        return true;
    }

    function checkpoint() {
        return { ...snapshot(), history: structuredClone(history) };
    }

    function back() {
        if (index === 0) return false;
        checkpoints.pop();
        const previous = structuredClone(checkpoints.at(-1));
        ({ index, row, fen, lastMove, rows, history } = previous);
        message = "";
        return true;
    }

    function playMove(uci) {
        const step = lesson.steps[index];
        if (uci !== step.uci) return reject();
        const board = new Chess(fen);
        const before = { fen, lastMove, word: rows[row].word, actions: [...rows[row].actions] };
        try {
            board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
            if (step.reply) board.move({ from: step.reply.slice(0, 2), to: step.reply.slice(2, 4), promotion: step.reply[4] });
        } catch { return reject(); }
        history.push(before);
        const action = { uci, reply: step.reply || "", moveCorrect: isCanonicalPlayerMove(lesson.moves, rows[row].actions, uci) };
        rows[row] = { ...rows[row], word: rows[row].word + uci[0].toUpperCase(), actions: [...rows[row].actions, action] };
        fen = board.fen();
        lastMove = step.reply || uci;
        return advance();
    }

    function move(uci) {
        if (lesson.steps[index].kind !== "move") return reject();
        return playMove(uci);
    }

    function key(value) {
        const step = lesson.steps[index];
        if (step.kind === "shortcut" || step.kind === "move") {
            const known = confirmedMoveShortcut(value.toUpperCase(), rows[row].actions,
                rows.map((entry) => entry.word), rows.map((entry) => entry.status), rows.map((entry) => entry.actions));
            return known === step.uci ? playMove(known) : reject();
        }
        if (step.kind === "key" && value.toUpperCase() === step.key) {
            history.push({ fen, lastMove, word: rows[row].word, actions: [...rows[row].actions] });
            rows[row] = { ...rows[row], word: rows[row].word + step.key };
            return advance();
        }
        if (step.kind === "undo" && value === "Backspace") {
            const previous = history.pop();
            if (!previous) return reject();
            fen = previous.fen;
            lastMove = previous.lastMove;
            rows[row] = { ...rows[row], word: previous.word, actions: previous.actions };
            return advance();
        }
        if (step.kind === "submit" && value === "Enter" && rows[row].word.length === 5) {
            rows[row] = { ...rows[row], status: scoreWord(rows[row].word, lesson.answer) };
            return advance();
        }
        return reject();
    }

    function next() {
        const step = lesson.steps[index];
        if (step.kind !== "explain" && step.kind !== "new-row") return reject();
        if (step.kind === "new-row") {
            rows.push({ word: "", actions: [], status: Array(5).fill(-1) });
            row += 1;
            fen = startFen;
            lastMove = trigger;
            history = [];
        }
        return advance();
    }

    const checkpoints = [checkpoint()];
    return { getSnapshot: snapshot, move, key, next, back };
}
