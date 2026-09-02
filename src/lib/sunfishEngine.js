const ENGINE_URL = "/engines/sunfish/sunfish.js";

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
        const { resolve, reject } = pendingSearch;
        pendingSearch = undefined;
        if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) resolve(move);
        else reject(new Error("Sunfish returned no legal move"));
    });

    worker.addEventListener("error", () => {
        const error = new Error("Sunfish worker failed");
        rejectReady?.(error);
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
        pendingSearch = { resolve, reject };
        worker.postMessage("ucinewgame");
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${depth}`);
    });
}
