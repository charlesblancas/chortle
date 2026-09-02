const ENGINE_URL = "/engines/sunfish/sunfish.js";
const SEARCH_TIMEOUT_MS = 300;

let worker;
let ready;
let resolveReady;
let rejectReady;
let pendingSearch;

function reset() {
    worker?.terminate();
    worker = undefined;
    ready = undefined;
    resolveReady = undefined;
    rejectReady = undefined;
    pendingSearch = undefined;
}

function ensureWorker() {
    if (worker) return ready;

    worker = new Worker(ENGINE_URL);
    ready = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
    });

    worker.addEventListener("message", (event) => {
        const line = typeof event.data === "string" ? event.data : "";
        if (line === "readyok") {
            resolveReady?.();
            return;
        }
        if (!line.startsWith("bestmove ") || !pendingSearch) return;
        const move = line.split(/\s+/)[1] || "";
        const { resolve, reject, timer } = pendingSearch;
        pendingSearch = undefined;
        clearTimeout(timer);
        if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) resolve(move);
        else reject(new Error("Sunfish returned no legal move"));
    });

    worker.addEventListener("error", () => {
        const error = new Error("Sunfish worker failed");
        rejectReady?.(error);
        if (pendingSearch?.timer) clearTimeout(pendingSearch.timer);
        pendingSearch?.reject(error);
        reset();
    });

    worker.postMessage("uci");
    worker.postMessage("isready");
    return ready;
}

export function warmSunfish() {
    return ensureWorker().catch(() => undefined);
}

export async function sunfishReply(fen, depth = 2) {
    await ensureWorker();
    if (pendingSearch) throw new Error("Sunfish is already searching");

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            if (!pendingSearch || pendingSearch.resolve !== resolve) return;
            pendingSearch = undefined;
            reset();
            reject(new Error("Sunfish search timed out"));
        }, SEARCH_TIMEOUT_MS);
        pendingSearch = { resolve, reject, timer };
        worker.postMessage("ucinewgame");
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${depth}`);
    });
}
