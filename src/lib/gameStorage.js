const STORAGE_VERSION = 1;
const ROWS = 5;
const COLUMNS = 5;
const VALID_STATUS = new Set([-1, 0, 1, 2]);

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
    if (!value.keyStatuses || typeof value.keyStatuses !== "object" || Array.isArray(value.keyStatuses)) return null;
    if (!Object.entries(value.keyStatuses).every(([key, status]) => /^[A-Z]$/.test(key) && VALID_STATUS.has(status))) return null;
    if (typeof value.mated !== "boolean" || typeof value.completed !== "boolean") return null;
    return {
        guesses: [...value.guesses],
        statuses: value.statuses.map((row) => [...row]),
        currentRow: value.currentRow,
        actions: value.actions.map((action) => ({ ...action })),
        keyStatuses: { ...value.keyStatuses },
        mated: value.mated,
        completed: value.completed,
    };
}

export function readSavedGame(storage, key) {
    try {
        return normalizeSavedGame(JSON.parse(storage.getItem(key) || "null"));
    } catch {
        return null;
    }
}

export function writeSavedGame(storage, key, state) {
    try {
        storage.setItem(key, JSON.stringify(state));
        return true;
    } catch {
        return false;
    }
}
