import { ai, moves } from "js-chess-engine";

export function isUciMove(move) {
    return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move || "");
}

// The game only needs a quick, legal reply after an off-line move. Level 1
// keeps that reply effectively instantaneous while still using the engine's
// move ordering and tactical checks. randomness: 0 is intentional: a given
// position must always produce the same reply.
export function fastChessReply(fen) {
    try {
        const result = ai(fen, { level: 1, randomness: 0, play: false });
        const move = result?.move;
        const [from, to] = Object.entries(move || {})[0] || [];
        const candidate = from && to ? `${from.toLowerCase()}${to.toLowerCase()}` : "";
        if (isUciMove(candidate)) return candidate;
    } catch {
        // A malformed or unusual puzzle position should still resolve with a
        // legal deterministic reply instead of leaving the board locked.
    }

    const legal = moves(fen);
    const [from, destinations] = Object.entries(legal)
        .sort(([a], [b]) => a.localeCompare(b))[0] || [];
    const to = Array.isArray(destinations) ? [...destinations].sort()[0] : "";
    const safe = from && to ? `${from.toLowerCase()}${to.toLowerCase()}` : "";
    return isUciMove(safe) ? safe : "";
}
