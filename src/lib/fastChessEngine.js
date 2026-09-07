import { Chess } from "chess.js";
import { chooseReply } from "./tinyEngine.js";

export function isUciMove(move) {
    return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move || "");
}

// The game only needs a quick, legal reply after an off-line move. Level 1
// keeps that reply effectively instantaneous while still using the engine's
// move ordering and tactical checks. randomness: 0 is intentional: a given
// position must always produce the same reply.
export function fastChessReply(fen) {
    try {
        const chess = new Chess(fen);
        const candidate = chooseReply(chess);
        if (isUciMove(candidate)) return candidate;

        // Keep a total deterministic fallback for terminal/odd positions.
        // chess.js owns legality, while lexical ordering makes a tie stable.
        const legal = chess.moves({ verbose: true })
            .map((move) => `${move.from}${move.to}${move.promotion || ""}`)
            .sort();
        return legal.find(isUciMove) || "";
    } catch {
        return "";
    }
}

// Used only when the worker misses its short deadline.  Keep this recovery
// path bounded by move generation so a timeout can never turn into another
// long main-thread search. Lexical ordering makes the result reproducible.
export function firstLegalReply(fen) {
    try {
        const chess = new Chess(fen);
        return chess.moves({ verbose: true })
            .map((move) => `${move.from}${move.to}${move.promotion || ""}`)
            .sort()
            .find(isUciMove) || "";
    } catch {
        return "";
    }
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
