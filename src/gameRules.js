import { Chess } from "chess.js";

export const FILE_LETTERS = "ABCDEFGH";

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
