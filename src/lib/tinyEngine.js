const MATERIAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100000;

export function isUciMove(move) {
    return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move || "");
}

function uci(move) {
    return `${move.from}${move.to}${move.promotion || ""}`;
}

function play(chess, move) {
    return chess.move({ from: move.from, to: move.to, promotion: move.promotion });
}

function evaluate(chess, engineColor) {
    if (chess.isCheckmate()) return chess.turn() === engineColor ? -MATE : MATE;

    let score = 0;
    const board = chess.board();
    for (let row = 0; row < board.length; row++) {
        for (let column = 0; column < board[row].length; column++) {
            const piece = board[row][column];
            if (!piece) continue;
            const direction = piece.color === engineColor ? 1 : -1;
            const center = 3.5 - (Math.abs(column - 3.5) + Math.abs(row - 3.5)) / 2;
            const centerWeight = piece.type === "n" || piece.type === "b" ? 4 : piece.type === "p" ? 1.5 : 0.5;
            const advance = piece.type === "p" ? (piece.color === "w" ? 6 - row : row - 1) * 2 : 0;
            score += direction * (MATERIAL[piece.type] + center * centerWeight + advance);
        }
    }
    if (chess.isCheck()) score += chess.turn() === engineColor ? -18 : 18;
    return score;
}

/**
 * A deliberately small deterministic engine for off-line replies.
 * It searches one move for each side, which is enough to take material,
 * find immediate mates, and avoid obvious one-move blunders.
 */
export function chooseReply(chess) {
    const engineColor = chess.turn();
    const candidates = chess.moves({ verbose: true }).sort((a, b) => uci(a).localeCompare(uci(b)));
    let bestMove = "";
    let bestScore = -Infinity;

    for (const candidate of candidates) {
        const played = play(chess, candidate);
        if (!played) continue;

        let score;
        if (chess.isCheckmate()) {
            chess.undo();
            return uci(candidate);
        } else {
            const counters = chess.moves({ verbose: true }).sort((a, b) => uci(a).localeCompare(uci(b)));
            score = evaluate(chess, engineColor);
            for (const counter of counters) {
                if (counter.san?.includes("#")) {
                    score = -MATE;
                    break;
                }
                if (counter.captured) {
                    if (!play(chess, counter)) continue;
                    score = Math.min(score, evaluate(chess, engineColor));
                    chess.undo();
                } else if (counter.san?.includes("+")) {
                    score = Math.min(score, evaluate(chess, engineColor) - 8);
                }
            }
            if (played.captured) score += MATERIAL[played.captured] * 0.02;
        }

        chess.undo();
        if (score > bestScore) {
            bestScore = score;
            bestMove = uci(candidate);
        }
    }

    return bestMove;
}
