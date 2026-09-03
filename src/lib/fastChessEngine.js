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

/**
 * Apply a candidate reply, recovering with a deterministic legal move when
 * the candidate is missing or malformed. The returned UCI move is the move
 * actually applied to `chess`, or an empty string when the side to move has
 * no legal move.
 *
 * Keeping the fallback application beside the fallback selection is
 * important: returning a fallback without applying it leaves the live board
 * on the opponent's turn and can make the UI look frozen.
 */
export function applyEngineReply(chess, candidate, fallback = fastChessReply) {
    const apply = (uci) => {
        if (!isUciMove(uci)) return false;
        try {
            return Boolean(chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }));
        } catch {
            return false;
        }
    };

    if (apply(candidate)) return candidate;

    try {
        const replacement = fallback(chess.fen());
        return apply(replacement) ? replacement : "";
    } catch {
        return "";
    }
}
