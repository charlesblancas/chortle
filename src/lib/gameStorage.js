const STORAGE_VERSION = 1;
const ROWS = 5;
const COLUMNS = 5;
const VALID_STATUS = new Set([-1, 0, 1, 2]);

// Browser storage can be unavailable (private browsing, blocked cookies, a
// disabled storage quota, or a non-browser render). Keep all callers on the
// same small interface so one storage failure never prevents the game from
// loading or playing.
const NOOP_STORAGE = Object.freeze({
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
});

export function safeStorage(storage) {
    try {
        storage ??= typeof window !== "undefined" ? window.localStorage : null;
        if (!storage || typeof storage.getItem !== "function" || typeof storage.setItem !== "function") return NOOP_STORAGE;
        // Accessing localStorage may itself throw. Probe once before returning
        // the object so callers can safely use it without wrapping every call.
        const probe = `chortle:storage-probe:${Date.now()}`;
        storage.setItem(probe, "1");
        storage.removeItem?.(probe);
        return storage;
    } catch {
        return NOOP_STORAGE;
    }
}

export function gameStorageKey(day, game) {
    return `chortle:daily:v${STORAGE_VERSION}:${day}:${game.puzzleId || game.word}`;
}

function isWord(value) {
    return typeof value === "string" && /^[A-Z]{0,5}$/.test(value);
}

function isStatusRow(row) {
    return Array.isArray(row) && row.length === COLUMNS && row.every((value) => VALID_STATUS.has(value));
}

function isAction(action) {
    return action
        && typeof action === "object"
        && /^[A-H]$/.test(action.letter || "")
        && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(action.uci || "")
        && (!action.reply || /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(action.reply))
        && typeof action.moveCorrect === "boolean";
}

function chessLetterCount(word) {
    return [...word].filter((letter) => letter >= "A" && letter <= "H").length;
}

export function normalizeSavedGame(value) {
    if (!value || typeof value !== "object") return null;
    if (!Array.isArray(value.guesses) || value.guesses.length !== ROWS || !value.guesses.every(isWord)) return null;
    if (!Array.isArray(value.statuses) || value.statuses.length !== ROWS || !value.statuses.every(isStatusRow)) return null;
    if (!Number.isInteger(value.currentRow) || value.currentRow < 0 || value.currentRow >= ROWS) return null;
    if (!Array.isArray(value.actions) || !value.actions.every(isAction)) return null;
    if (value.actions.length !== chessLetterCount(value.guesses[value.currentRow])) return null;
    const hasStoredActionHistory = Array.isArray(value.actionHistory);
    const hasStoredTerminal = typeof value.terminal === "boolean";
    const actionHistory = value.actionHistory ?? Array.from({ length: ROWS }, () => []);
    if (!Array.isArray(actionHistory) || actionHistory.length !== ROWS) return null;
    if (!actionHistory.every((row) => Array.isArray(row) && row.every(isAction))) return null;
    for (let row = 0; row < ROWS; row++) {
        if (actionHistory[row].length > chessLetterCount(value.guesses[row])) return null;
    }
    if (!value.keyStatuses || typeof value.keyStatuses !== "object" || Array.isArray(value.keyStatuses)) return null;
    if (!Object.entries(value.keyStatuses).every(([key, status]) => /^[A-Z]$/.test(key) && VALID_STATUS.has(status))) return null;
    if (typeof value.mated !== "boolean" || typeof value.completed !== "boolean") return null;
    const solved = typeof value.solved === "boolean"
        ? value.solved
        : hasStoredActionHistory
            ? value.statuses.some((status, row) => status.every((entry) => entry === 2)
                && actionHistory[row].length === chessLetterCount(value.guesses[row])
                && actionHistory[row].every((action) => action.moveCorrect))
            : value.statuses.some((status) => status.every((entry) => entry === 2));
    let currentRow = value.currentRow;
    let actions = value.actions.map((action) => ({ ...action }));
    let completed = value.completed;
    let terminal = hasStoredTerminal ? value.terminal : value.mated;
    // Versions before chess-aware wins could save an exact word with an
    // incorrect move sequence as completed. Resume it on the next attempt.
    if (!solved && completed && currentRow < ROWS - 1 && value.statuses[currentRow].some((entry) => entry >= 0)) {
        currentRow += 1;
        actions = [];
        // A mated board belongs to the row that was just completed.  Never
        // carry that terminal lock into the fresh row after a legacy resume.
        value = { ...value, mated: false, terminal: false };
        terminal = false;
        completed = false;
    }
    const normalized = {
        guesses: [...value.guesses],
        statuses: value.statuses.map((row) => [...row]),
        currentRow,
        actions,
        actionHistory: actionHistory.map((row) => row.map((action) => ({ ...action }))),
        keyStatuses: { ...value.keyStatuses },
        mated: value.mated,
        terminal,
        solved,
        completed,
    };
    // Keep the pre-terminal-state storage shape backwards compatible. Current
    // saves include the flag, while old saves round-trip without gaining a
    // new property that callers did not write.
    if (hasStoredTerminal) normalized.terminal = terminal || normalized.mated;
    else delete normalized.terminal;
    return normalized;
}

export function readSavedGame(storage, key) {
    try {
        return normalizeSavedGame(JSON.parse(safeStorage(storage).getItem(key) || "null"));
    } catch {
        return null;
    }
}

export function writeSavedGame(storage, key, state) {
    try {
        const target = safeStorage(storage);
        target.setItem(key, JSON.stringify(state));
        // The no-op fallback represents an unavailable store, not a durable
        // write. Report that distinction so callers can avoid claiming that
        // persistence succeeded.
        if (target === NOOP_STORAGE) return false;
        return true;
    } catch {
        return false;
    }
}

export function removeSavedGame(storage, key) {
    try {
        safeStorage(storage).removeItem?.(key);
    } catch {
        // Clearing an optional save should never block a new game.
    }
}
