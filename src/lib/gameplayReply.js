import { Chess } from "chess.js";
import { fastChessReply, isUciMove } from "./fastChessEngine.js";
import { stockfishReply, gameplayNodeBudget } from "./stockfishEngine.js";

function legalReply(fen, move) {
    if (!isUciMove(move)) return false;
    try {
        return Boolean(new Chess(fen).move({ from: move.slice(0, 2), to: move.slice(2, 4), promotion: move[4] }));
    } catch { return false; }
}

function tacticalReply(fen) {
    return new Promise((resolve) => {
        let worker;
        let timer;
        let finished = false;
        function finish(move) {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            worker?.terminate();
            resolve(legalReply(fen, move) ? move : fastChessReply(fen));
        }
        try {
            worker = new Worker(new URL("./tacticalReply.worker.js", import.meta.url), { type: "module" });
            worker.onmessage = ({ data }) => finish(data);
            worker.onerror = () => finish("");
            timer = setTimeout(() => finish(""), 3000);
            worker.postMessage(fen);
        } catch { finish(""); }
    });
}

// Recorded legal replies stay authoritative. Missing/invalid replies use the
// normal engine, with a small tactical recovery search if that engine fails.
export async function gameplayReply(fen, recorded = "", {
    search = stockfishReply,
    recover = tacticalReply,
    nodes = gameplayNodeBudget(),
    random = Math.random,
    wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
} = {}) {
    if (new Chess(fen).isGameOver()) return "";
    if (legalReply(fen, recorded)) {
        // A tiny pause lets the player's move register before the known reply.
        // Only presentation timing varies; the recorded move stays deterministic.
        await wait(40 + random() * 20);
        return recorded;
    }
    try {
        const move = await search(fen, nodes);
        if (legalReply(fen, move)) return move;
    } catch { /* Recover from worker startup/search failures. */ }
    const recovery = await recover(fen);
    return legalReply(fen, recovery) ? recovery : fastChessReply(fen);
}
