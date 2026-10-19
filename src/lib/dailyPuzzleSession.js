import { Chess } from "chess.js";
import { FILE_LETTERS, confirmedMoveShortcut, isCanonicalPlayerMove, isExtraPlayerMove, isPlayerMatedAfterReply, isSolvedGuess, scoreWord } from "../gameRules.js";
import { isUciMove } from "./chessNotation.js";
import { gameplayReply } from "./gameplayReply.js";
import { readSavedGame, writeSavedGame } from "./gameStorage.js";
import { track } from "./analytics.js";

const placedMoveCount = word => [...word].filter(letter => FILE_LETTERS.includes(letter)).length;
function placeQueuedLetter(word, actions, letter) {
    if (word.length >= 5) return null;
    return actions[placedMoveCount(word)]?.letter === letter ? word + letter : null;
}
function undoQueuedMove(word, actions) {
    if (!actions.length) return { word, actions };
    if (placedMoveCount(word) === actions.length) {
        const index = [...word].findLastIndex(letter => FILE_LETTERS.includes(letter));
        word = word.slice(0, index);
    }
    return { word, actions: actions.slice(0, -1) };
}
function lineGuessError(word, actions, requiredMoves) {
    if (actions.length !== requiredMoves) return `Play ${requiredMoves} chess moves before submitting.`;
    if (word.length !== 5) return "Not enough letters";
    if ([...word].filter(letter => FILE_LETTERS.includes(letter)).join("") !== actions.map(action => action.letter).join("")) return "Use every queued chess letter in order.";
    return "";
}

/** Own one daily puzzle's word, board, attempts and durable state.
 * The view subscribes to snapshots; only this module accepts moves and replies.
 * Reply and storage adapters keep browser effects outside the session rules.
 */
export function createDailyPuzzleSession({ game, storage, storageKey = "", legacyStorageKey = "", fixture = null, reply = gameplayReply, isWord, day = 0, analytics = track }) {
    const answer = game.word.toUpperCase();
    const requiredMoves = placedMoveCount(answer);
    const line = game.moves.split(" ");
    const chess = new Chess(game.fen);
    const listeners = new Set();
    let disposed = false;
    let revision = 0;
    let guidanceTimer;
    const legacy = !fixture && legacyStorageKey ? readSavedGame(storage, legacyStorageKey) : null;
    const saved = fixture ? null : readSavedGame(storage, storageKey) || (legacy?.completed ? legacy : null);
    let state = saved || {
        guesses: [fixture?.initialGuess?.toUpperCase() || "", "", "", ""],
        statuses: Array.from({ length: 4 }, () => Array(5).fill(-1)),
        currentRow: 0, actions: structuredClone(fixture?.initialActions || []),
        actionHistory: Array.from({ length: 4 }, () => []), keyStatuses: {},
        mated: Boolean(fixture?.mated), terminal: Boolean(fixture?.terminal || fixture?.mated),
        solved: Boolean(fixture?.autoSubmit), completed: Boolean(fixture?.autoSubmit), extraMoves: 0,
    };
    state = { ...state, terminal: Boolean(state.terminal || state.mated), extraMoves: state.extraMoves ?? 0,
        thinking: false, promotionPending: false, message: "", highlightFile: "", restoredCompleted: Boolean(saved?.completed) };
    if (fixture?.autoSubmit) {
        state.statuses[0] = scoreWord(state.guesses[0], answer);
        state.actionHistory[0] = structuredClone(state.actions);
    }
    function report(event, properties = {}, suffix = '') {
        if (fixture) return;
        try { analytics(event, { puzzle_id: game.puzzleId, day, ...properties }, `${storageKey || `${day}:${game.puzzleId}`}${suffix}`); }
        catch { /* Analytics is never part of gameplay correctness. */ }
    }

    function apply(uci) {
        if (!isUciMove(uci)) return false;
        try { return Boolean(chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] })); }
        catch { return false; }
    }
    function rebuild() {
        chess.load(game.fen);
        apply(line[0]);
        for (const action of state.actions) { apply(action.uci); apply(action.reply); }
    }
    rebuild();
    function snapshot() {
        return { ...structuredClone(state), requiredMoves, placedMoves: placedMoveCount(state.guesses[state.currentRow]),
            boardFen: chess.fen(), boardMove: chess.history({ verbose: true }).at(-1)?.lan || "",
            boardDisabled: state.completed || state.mated || state.terminal || state.thinking || state.promotionPending
                || state.actions.length >= requiredMoves };
    }
    function publish() {
        if (disposed) return;
        const value = snapshot();
        for (const listener of listeners) listener(value);
    }
    function persist() {
        if (fixture || disposed || state.thinking) return;
        const { guesses, statuses, currentRow, actions, actionHistory, keyStatuses, mated, terminal, solved, completed, extraMoves } = state;
        // Retain the old queue-format marker so existing saves remain readable.
        writeSavedGame(storage, storageKey, { guesses, statuses, currentRow, actions, actionHistory, keyStatuses, mated, terminal, solved, completed, extraMoves, mode: "line" });
    }
    function clearGuidance() {
        clearTimeout(guidanceTimer);
        state.message = "";
        state.highlightFile = "";
    }
    function guideFile(key) {
        state.message = `${key} comes from a move starting on the ${key}-file.`;
        state.highlightFile = key;
        guidanceTimer = setTimeout(() => { clearGuidance(); publish(); }, 1500);
    }
    function blocked() { return disposed || state.completed || state.thinking || state.promotionPending; }
    function legal(uci) {
        return isUciMove(uci) && chess.moves({ verbose: true }).some(move => move.lan === uci);
    }

    async function play(uci, placeLetter = false) {
        if (blocked() || state.terminal || state.mated || !legal(uci)
            || state.actions.length >= requiredMoves) return false;
        clearGuidance();
        const playerColor = chess.turn();
        report('puzzle_started');
        const index = state.actions.length;
        const moveCorrect = isCanonicalPlayerMove(game.moves, state.actions, uci);
        if (isExtraPlayerMove(game.moves, state.actions, uci)) state.extraMoves += 1;
        apply(uci);
        state.terminal = chess.isGameOver();
        const action = { letter: uci[0].toUpperCase(), uci, reply: "", moveCorrect, mated: false, terminal: state.terminal, pending: !state.terminal };
        state.actions.push(action);
        if (placeLetter) state.guesses[state.currentRow] += action.letter;
        state.mated = false;
        if (state.terminal) { persist(); publish(); return true; }
        state.thinking = true;
        const token = ++revision;
        publish();
        try {
            let response = await reply(chess.fen(), moveCorrect ? line[2 + index * 2] || "" : "");
            if (disposed || token !== revision) return false;
            let applied = response ? apply(response) : false;
            if (!applied) {
                response = await reply(chess.fen());
                if (disposed || token !== revision) return false;
                applied = Boolean(response && apply(response));
            }
            action.reply = applied ? response : "";
            state.mated = isPlayerMatedAfterReply(chess, playerColor, action.reply);
            state.terminal = chess.isGameOver();
            Object.assign(action, { mated: state.mated, terminal: state.terminal, pending: false });
        } finally {
            if (!disposed && token === revision) { state.thinking = false; persist(); publish(); }
        }
        return true;
    }
    function undoMove() {
        if (blocked()) return;
        const revised = undoQueuedMove(state.guesses[state.currentRow], state.actions);
        state.guesses[state.currentRow] = revised.word;
        state.actions = revised.actions;
        state.mated = false;
        state.terminal = false;
        rebuild();
        persist(); publish();
    }
    function undo() {
        const guess = state.guesses[state.currentRow];
        if (!guess) { undoMove(); return; }
        state.guesses[state.currentRow] = guess.slice(0, -1);
        persist(); publish();
    }
    function submit() {
        const guess = state.guesses[state.currentRow];
        const error = lineGuessError(guess, state.actions, requiredMoves);
        if (error) { state.message = error; publish(); return; }
        if (guess.length < 5) { state.message = "Not enough letters"; publish(); return; }
        if (!isWord(guess.toLowerCase())) { state.message = `${guess} not in word list`; publish(); return; }
        const result = scoreWord(guess, answer);
        state.actionHistory[state.currentRow] = structuredClone(state.actions);
        state.statuses[state.currentRow] = result;
        for (let i = 0; i < guess.length; i++) state.keyStatuses[guess[i]] = Math.max(state.keyStatuses[guess[i]] ?? -1, result[i]);
        state.solved = isSolvedGuess(result, guess, state.actions);
        state.completed = state.solved || state.currentRow === state.guesses.length - 1;
        const metrics = { attempt: state.currentRow + 1, solved: state.solved, extra_moves: state.extraMoves };
        report('guess_submitted', metrics, `:row:${state.currentRow}`);
        if (state.completed) report('puzzle_finished', metrics);
        if (!state.completed) {
            if (result.every(x => x === 2)) state.message = "Word right. Replay it with the right board moves.";
            state.currentRow += 1; state.actions = []; state.mated = false; state.terminal = false;
            rebuild();
        }
        persist(); publish();
    }
    function input(key) {
        if (blocked()) return;
        clearGuidance();
        if (/^[A-Za-z]$/.test(key)) {
            key = key.toUpperCase();
            const word = state.guesses[state.currentRow];
            if (word.length >= 5) { publish(); return; }
            report('puzzle_started');
            if (FILE_LETTERS.includes(key)) {
                {
                    const placed = placeQueuedLetter(word, state.actions, key);
                    if (placed !== null) { state.guesses[state.currentRow] = placed; persist(); publish(); return; }
                    if (placedMoveCount(word) !== state.actions.length || state.actions.length >= requiredMoves) {
                        const next = state.actions[placedMoveCount(word)];
                        state.message = next ? `Place ${next.letter} next.` : "All required moves are queued.";
                        publish(); return;
                    }
                }
                const known = confirmedMoveShortcut(key, state.actions, state.guesses, state.statuses, state.actionHistory);
                if (known && !state.terminal && legal(known)) { void play(known, true); return; }
                guideFile(key);
            } else { state.guesses[state.currentRow] += key; persist(); }
            publish();
        } else if (key === "Backspace") undo();
        else if (key === "Enter") submit();
    }
    return {
        subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); },
        snapshot, input, play, undoMove,
        clearGuidance() { clearGuidance(); publish(); },
        setPromotionPending(active) { state.promotionPending = active; publish(); },
        destroy() { disposed = true; revision += 1; clearTimeout(guidanceTimer); listeners.clear(); },
    };
}
