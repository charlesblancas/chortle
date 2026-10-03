import { isUciMove } from "./chessNotation.js";
import { cacheAnalysis, getCachedAnalysis, nextAnalysisDepth, seedAnalysis } from "./engineAnalysisCache.js";

export const DEFAULT_GAMEPLAY_NODES = 20000;
const SETTINGS_KEY = "chortle:debug-stockfish-nodes";

export function normalizeNodeBudget(value) {
    const nodes = Number(value);
    return Number.isSafeInteger(nodes) && nodes >= 100 && nodes <= 1000000 ? nodes : DEFAULT_GAMEPLAY_NODES;
}

export function gameplayNodeBudget() {
    if (!import.meta.env?.DEV) return DEFAULT_GAMEPLAY_NODES;
    try {
        const params = new URLSearchParams(window.location.search);
        return normalizeNodeBudget(params.get("engine-nodes") ?? localStorage.getItem(SETTINGS_KEY));
    } catch { return DEFAULT_GAMEPLAY_NODES; }
}

export function setGameplayNodeBudget(nodes) {
    const value = normalizeNodeBudget(nodes);
    try {
        localStorage.setItem(SETTINGS_KEY, String(value));
        const url = new URL(window.location.href);
        url.searchParams.set("engine-nodes", String(value));
        window.history.replaceState(null, "", url);
    } catch { /* Optional debug preferences must not block play. */ }
    return value;
}

export function createStockfishClient({
    createWorker = () => new Worker(`${import.meta.env?.BASE_URL || "/"}engines/stockfish-19/stockfish-19-lite-single.js`),
    timeoutMs = 10000,
} = {}) {
    let worker, ready, waiter;
    let queue = Promise.resolve();
    let searchInfo;
    let analysisPosition = "";

    function reset(error) {
        worker?.terminate();
        worker = undefined;
        ready = undefined;
        analysisPosition = "";
        const previous = waiter;
        waiter = undefined;
        if (previous) { clearTimeout(previous.timer); previous.reject(error); }
    }

    function command(message, pattern, deadline = timeoutMs) {
        return new Promise((resolve, reject) => {
            waiter = { pattern, resolve, reject, timer: Number.isFinite(deadline)
                ? setTimeout(() => reset(new Error("Stockfish timed out")), deadline) : undefined };
            try { worker.postMessage(message); }
            catch (error) { reset(error); }
        });
    }

    function ensureReady() {
        if (ready) return ready;
        try {
            worker = createWorker();
            const owner = worker;
            worker.onmessage = ({ data }) => {
                if (worker !== owner) return;
                for (const line of String(data).split("\n")) {
                    if (line.startsWith("info ") && searchInfo) {
                        const score = /\bscore (cp|mate) (-?\d+)\b/.exec(line);
                        // Bound-only scores are not exact evaluations.
                        if (score && !/\b(lowerbound|upperbound)\b/.test(line)) {
                            const value = Number(score[2]);
                            const sign = searchInfo.fen.split(/\s+/)[1] === "b" ? -1 : 1;
                            searchInfo.score = sign * (score[1] === "mate" ? Math.sign(value || -1) * 100000 : value);
                            searchInfo.mate = score[1] === "mate" ? sign * value : undefined;
                        }
                    }
                    if (!waiter?.pattern.test(line)) continue;
                    const current = waiter; waiter = undefined;
                    clearTimeout(current.timer); current.resolve(line);
                }
            };
            worker.onerror = () => { if (worker === owner) reset(new Error("Stockfish worker failed")); };
            const initializing = (async () => {
                await command("uci", /^uciok$/);
                worker.postMessage("setoption name Hash value 16");
                worker.postMessage("setoption name Threads value 1");
                worker.postMessage("setoption name MultiPV value 1");
                worker.postMessage("setoption name Ponder value false");
                await command("isready", /^readyok$/);
            })();
            ready = initializing;
            initializing.catch(() => { if (ready === initializing) ready = undefined; });
            return initializing;
        } catch (error) { reset(error); return Promise.reject(error); }
    }

    async function search(fen, { nodes, depth, signal } = {}) {
        const cancelled = () => Object.assign(new Error("Engine analysis cancelled"), { name: "AbortError" });
        if (signal?.aborted) throw cancelled();
        // Registered before startup: closing a replay cannot start a stale search.
        const abort = () => reset(cancelled());
        signal?.addEventListener("abort", abort, { once: true });
        try {
            await ensureReady();
            if (signal?.aborted) throw cancelled();
            // Replies clear hash/history to preserve deterministic node choices.
            // Analysis at the same position retains its transposition table.
            if (nodes !== undefined || analysisPosition !== fen) {
                worker.postMessage("ucinewgame");
                analysisPosition = nodes === undefined ? fen : "";
            }
            await command("isready", /^readyok$/);
            if (signal?.aborted) throw cancelled();
            searchInfo = { fen, score: null };
            worker.postMessage(`position fen ${fen}`);
            const instruction = nodes !== undefined ? `go nodes ${normalizeNodeBudget(nodes)}` : `go depth ${depth}`;
            const line = await command(instruction, /^bestmove /, nodes !== undefined ? timeoutMs : Infinity);
            const move = line.split(/\s+/)[1] || "";
            return { move: isUciMove(move) ? move : "", score: searchInfo.score,
                ...(searchInfo.mate !== undefined ? { mate: searchInfo.mate } : {}) };
        } finally {
            signal?.removeEventListener("abort", abort);
            searchInfo = undefined;
        }
    }

    function enqueue(fen, options) {
        const result = queue.then(() => search(fen, options));
        queue = result.catch(() => undefined);
        return result;
    }

    return {
        warm: () => ensureReady().catch(() => undefined),
        reply(fen, nodes = DEFAULT_GAMEPLAY_NODES) {
            return enqueue(fen, { nodes }).then(result => result.move);
        },
        analyze: (fen, depth = 2, { signal } = {}) => enqueue(fen, { depth, signal }),
    };
}

const client = createStockfishClient();
export const warmStockfish = () => client.warm();
export const stockfishReply = (fen, nodes = gameplayNodeBudget()) => client.reply(fen, nodes);
export const stockfishAnalyze = (fen, depth = 2, options) => client.analyze(fen, depth, options);
export const analysisEngine = {
    analyze: stockfishAnalyze,
    getCached: getCachedAnalysis,
    cache: cacheAnalysis,
    nextDepth: nextAnalysisDepth,
    seed: seedAnalysis,
};
