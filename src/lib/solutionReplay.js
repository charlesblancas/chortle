import { Chess } from "chess.js";

const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/**
 * Build the immutable positions used by the solution replay. Position zero is
 * the playable board after the automatic setup move; each following item is
 * after one canonical ply.
 */
export function buildSolutionPositions(fen, movesString = "", { skipInitialSetup = true } = {}) {
    const chess = new Chess(fen);
    const moves = String(movesString).trim().split(/\s+/).filter(Boolean);

    // The runtime applies the first token as the puzzle's automatic setup
    // move before the player can act. Start the replay where the live board
    // starts, while retaining the raw FEN as the source of truth.
    let setup = null;
    if (skipInitialSetup && moves.length) {
        const uci = moves.shift();
        const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
        if (!move) throw new Error(`Invalid solution setup move: ${uci}`);
        setup = { move: uci, san: move.san || move.lan || uci };
    }

    const positions = [{ index: 0, fen: chess.fen(), move: "", san: "", setup }];

    for (const uci of moves) {
        const move = chess.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci[4],
        });
        if (!move) throw new Error(`Invalid solution move: ${uci}`);
        positions.push({ index: positions.length, fen: chess.fen(), move: uci, san: move.san || move.lan || uci, setup: null });
    }

    return positions;
}

/** Return a deterministic white-perspective material score in centipawns. */
export function materialEvaluation(fen) {
    const chess = new Chess(fen);
    let score = 0;
    for (const square of chess.board().flat()) {
        if (!square) continue;
        const value = PIECE_VALUES[square.type] || 0;
        score += square.color === "w" ? value : -value;
    }
    return score;
}

export function evaluationLabel(scoreCp) {
    if (!Number.isFinite(scoreCp) || Math.abs(scoreCp) < 5) return "Equal";
    const pawns = Math.abs(scoreCp / 100).toFixed(1);
    return scoreCp > 0 ? `White +${pawns}` : `Black +${pawns}`;
}

export function evaluationPercent(scoreCp) {
    if (!Number.isFinite(scoreCp)) return 50;
    return Math.max(5, Math.min(95, 50 + scoreCp / 10));
}
