import { Chess } from "chess.js";

export const FILE_LETTERS = "ABCDEFGH";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Return a stable integer for a calendar date, independent of the number of
 * elapsed hours in that local day.  Using Date subtraction directly here
 * makes the daily puzzle number jump (or repeat) across daylight-saving
 * transitions, where a local day is not always 24 hours long.
 */
function calendarDayNumber(value) {
    // Treat a date-only ISO string as a calendar date, not as UTC midnight.
    // The latter becomes the previous local date in western time zones.
    if (typeof value === "string") {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (match) {
            const [, year, month, day] = match;
            return Date.UTC(Number(year), Number(month) - 1, Number(day)) / DAY_MS;
        }
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    // Date.UTC gives us a UTC midnight for the local calendar components.  It
    // is only used as an integer day counter; no local timezone offset or DST
    // adjustment can affect the result.
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

export function dailyPuzzleIndex(date = new Date(), startDate = new Date(2026, 8, 1)) {
    const currentDay = calendarDayNumber(date);
    const firstDay = calendarDayNumber(startDate);
    if (currentDay === null || firstDay === null) return 1;
    return Math.max(1, Math.floor(currentDay - firstDay) + 1);
}

// Keep a descriptive alias for callers that prefer a getter-style name.
export const getDailyIndex = dailyPuzzleIndex;
export const dailyIndex = dailyPuzzleIndex;

/**
 * Whether a keydown belongs to the game rather than a browser shortcut or a
 * focused control.  Keeping this predicate pure makes the global keyboard
 * boundary easy to test without mounting the Svelte component.
 */
export function isInteractiveKeyTarget(target) {
    if (!target || typeof target !== "object") return false;
    if (target.isContentEditable) return true;
    const tagName = typeof target.tagName === "string" ? target.tagName.toLowerCase() : "";
    if (["input", "textarea", "select", "button", "a", "summary"].includes(tagName)) return true;
    try {
        return typeof target.closest === "function"
            && Boolean(target.closest("input, textarea, select, button, a, summary, [contenteditable='true']"));
    } catch {
        return false;
    }
}

export function shouldHandleWordGameKey(event) {
    if (!event || event.defaultPrevented || event.repeat) return false;
    // Modifier chords belong to the browser/assistive controls, not the game
    // input surface. Uppercase input still arrives as `event.key` from the
    // on-screen keyboard and does not need a shift chord here.
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
    if (isInteractiveKeyTarget(event.target)) return false;
    return /^[A-Za-z]$/.test(event.key || "") || event.key === "Backspace" || event.key === "Enter";
}

export function scoreWord(guess, target) {
    const remaining = {};
    const result = Array(5).fill(0);
    for (const letter of target) remaining[letter] = (remaining[letter] || 0) + 1;
    for (let i = 0; i < 5; i++) {
        if (guess[i] === target[i]) {
            result[i] = 2;
            remaining[guess[i]]--;
        }
    }
    for (let i = 0; i < 5; i++) {
        if (!result[i] && remaining[guess[i]] > 0) {
            result[i] = 1;
            remaining[guess[i]]--;
        }
    }
    return result;
}

/**
 * Chess feedback occupies the lower portion of an A-H tile. The next required
 * move is green, a move found elsewhere in the puzzle line is yellow, and a
 * move absent from that line is gray. When no chess move is associated with
 * the tile, retain the ordinary Wordle color so it does not look split.
 */
export function chessMoveStatus(action, letterStatus, solutionMoves = []) {
    // An absent file letter has no matching move anywhere in the answer.
    // Keep the tile gray rather than implying the move is merely misplaced.
    if (letterStatus === 0) return 0;
    if (!action) return letterStatus;
    if (action.moveCorrect) return 2;
    return solutionMoves.includes(action.uci) ? 1 : 0;
}

/**
 * Collapse a tile's word and chess feedback into one shareable status.
 * A tile is green only when every applicable signal is green, gray only when
 * every signal is gray, and yellow for every partial or mixed result.
 */
export function combineFeedbackStatuses(statuses) {
    const scored = statuses.filter((status) => Number.isInteger(status) && status >= 0);
    if (scored.every((status) => status === 2)) return 2;
    if (scored.every((status) => status === 0)) return 0;
    return 1;
}

/**
 * Produce the compact, spoiler-free result row used in copied shares. Chess
 * moves contribute only their color; neither UCI move nor piece is exposed.
 */
export function scoreShareRow(word, letterStatuses, actions = [], solutionMoves = []) {
    let actionIndex = 0;
    return Array.from({ length: 5 }, (_, index) => {
        const letterStatus = letterStatuses[index];
        const feedback = [letterStatus];
        if (FILE_LETTERS.includes(word[index] || "")) {
            const action = actions[actionIndex++];
            // A required board action that was never made is incomplete, not
            // secretly correct simply because its letter was typed correctly.
            feedback.push(action ? chessMoveStatus(action, letterStatus, solutionMoves) : 0);
        }
        return combineFeedbackStatuses(feedback);
    });
}

/** A solved row needs the exact word and its complete correct chess sequence. */
export function isSolvedGuess(letterStatuses, word, actions = []) {
    const requiredMoves = [...word].filter((letter) => FILE_LETTERS.includes(letter.toUpperCase())).length;
    return letterStatuses.length === 5
        && letterStatuses.every((status) => status === 2)
        && actions.length === requiredMoves
        && actions.every((action) => action.moveCorrect);
}

/**
 * Determine whether the next player move is still the canonical puzzle move.
 * A previous off-line action keeps the remainder of the row yellow even if a
 * later move happens to use the same UCI coordinates as the solution line.
 */
export function isCanonicalPlayerMove(movesString, actions = [], uci) {
    const line = (movesString || "").trim().split(/\s+/).filter(Boolean);
    const expected = line[1 + actions.length * 2];
    return actions.every((action) => action.moveCorrect !== false) && uci === expected;
}

export function playerMoves(movesString) {
    return movesString.trim().split(/\s+/).filter(Boolean).filter((_, index) => index % 2 === 1);
}

export function fileProjection(movesString) {
    return playerMoves(movesString).map((uci) => uci[0].toUpperCase()).join("");
}

export function validatePuzzleRecord(record, { requireChessLetter = true } = {}) {
    const errors = [];
    if (!record || typeof record !== "object") return ["record is not an object"];
    if (!/^[a-z]{5}$/i.test(record.word || "")) errors.push("word must be five letters");
    if (!record.fen) errors.push("missing fen");
    if (!record.moves) errors.push("missing moves");
    const wordFiles = (record.word || "").toUpperCase().split("").filter((letter) => FILE_LETTERS.includes(letter)).join("");
    const projection = record.moves ? fileProjection(record.moves).slice(0, wordFiles.length) : "";
    if (requireChessLetter && !wordFiles) errors.push("word must contain an A-H letter");
    if (projection !== wordFiles) errors.push(`word file projection ${wordFiles || "(none)"} does not match playable move prefix ${projection || "(none)"}`);
    try {
        const chess = new Chess(record.fen);
        const tokens = record.moves.trim().split(/\s+/).filter(Boolean);
        for (const uci of tokens) {
            const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
            if (!move) throw new Error(`illegal move ${uci}`);
        }
    } catch (error) {
        errors.push(`move line invalid: ${error.message}`);
    }
    return errors;
}

export function isMated(fen) {
    const chess = new Chess(fen);
    return chess.isCheckmate();
}

export function isPlayerMatedAfterReply(chess, playerColor, reply) {
    return Boolean(reply) && chess.isCheckmate() && chess.turn() === playerColor;
}
