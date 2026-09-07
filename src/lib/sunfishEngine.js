const SEARCH_TIMEOUT_MS = 300;
const READY_TIMEOUT_MS = 1000;
const ANALYSIS_CACHE_LIMIT = 96;

let worker;
let ready;
let resolveReady;
let rejectReady;
let readyTimer;
let pendingSearch;
const analysisCache = new Map();

function cacheAnalysis(fen, entry) {
    // Refreshing the insertion order makes this a small, predictable LRU
    // cache instead of keeping every position the player visits forever.
    analysisCache.delete(fen);
    analysisCache.set(fen, entry);
    if (analysisCache.size > ANALYSIS_CACHE_LIMIT) {
        analysisCache.delete(analysisCache.keys().next().value);
    }
}

function analysisCancelledError() {
    return new Error("Sunfish analysis cancelled");
}

function waitForWorkerReady(signal) {
    if (signal?.aborted) return Promise.reject(analysisCancelledError());
    const workerReady = ensureWorker();
    if (!signal) return workerReady;
    return new Promise((resolve, reject) => {
        const abort = () => {
            signal.removeEventListener("abort", abort);
            reject(analysisCancelledError());
        };
        signal.addEventListener("abort", abort, { once: true });
        workerReady.then(
            (value) => {
                signal.removeEventListener("abort", abort);
                resolve(value);
            },
            (error) => {
                signal.removeEventListener("abort", abort);
                reject(error);
            },
        );
    });
}

/**
 * Return the best in-memory analysis for an exact FEN. A provisional entry
 * inherited from a suggested parent move is deliberately marked unverified.
 */
export function getCachedSunfishAnalysis(fen) {
    const entry = analysisCache.get(fen);
    if (!entry) return null;
    cacheAnalysis(fen, entry);
    return { ...entry };
}

/** Keep the deepest directly-searched result for a FEN. */
export function cacheSunfishAnalysis(fen, depth, result) {
    const existing = analysisCache.get(fen);
    if (existing?.verified && existing.depth > depth) return;
    cacheAnalysis(fen, {
        depth,
        move: result.move || "",
        score: Number.isFinite(result.score) ? result.score : null,
        verified: true,
    });
}

/**
 * A Sunfish-recommended move generally preserves the parent's evaluation.
 * Show that value while the child gets its own real search, but never let it
 * replace a direct result already cached for the child.
 */
export function seedSunfishAnalysis(fen, parent) {
    if (!parent?.verified || !Number.isFinite(parent.score)) return;
    if (analysisCache.get(fen)?.verified) return;
    cacheAnalysis(fen, {
        depth: parent.depth,
        move: "",
        score: parent.score,
        verified: false,
    });
}

function parseScore(line) {
    const match = /^info\s+.*\bscore\s+cp\s+(-?\d+)/.exec(line);
    return match ? Number(match[1]) : null;
}

function scoreFromWhitePerspective(fen, score) {
    // Sunfish searches from the side to move. The viewer displays the usual
    // white-perspective score, so flip black-to-move positions.
    return fen.split(/\s+/)[1] === "b" ? -score : score;
}

function reset() {
    worker?.terminate();
    worker = undefined;
    ready = undefined;
    resolveReady = undefined;
    rejectReady = undefined;
    clearTimeout(readyTimer);
    readyTimer = undefined;
    pendingSearch = undefined;
}

function ensureWorker() {
    if (worker) return ready;

    // Let Vite fingerprint and relocate the worker with the rest of the
    // production assets. A root-relative public URL breaks when the app is
    // deployed below a path and bypasses cache invalidation.
    worker = new Worker(new URL("./sunfish.worker.js", import.meta.url), { type: "classic" });
    ready = new Promise((resolve, reject) => {
        resolveReady = resolve;
        rejectReady = reject;
        readyTimer = setTimeout(() => {
            const error = new Error("Sunfish worker was not ready");
            reject(error);
            reset();
        }, READY_TIMEOUT_MS);
    });

    worker.addEventListener("message", (event) => {
        const line = typeof event.data === "string" ? event.data : "";
        if (line === "readyok") {
            clearTimeout(readyTimer);
            readyTimer = undefined;
            resolveReady?.();
            return;
        }
        if (line.startsWith("info ") && pendingSearch) {
            const score = parseScore(line);
            if (Number.isFinite(score)) pendingSearch.score = score;
            return;
        }
        if (!line.startsWith("bestmove ") || !pendingSearch) return;
        const move = line.split(/\s+/)[1] || "";
        const { resolve, reject, timer, mode, fen, score, cleanup } = pendingSearch;
        pendingSearch = undefined;
        clearTimeout(timer);
        cleanup?.();
        if (mode === "evaluation") {
            if (Number.isFinite(score)) resolve(scoreFromWhitePerspective(fen, score));
            else reject(new Error("Sunfish returned no evaluation"));
            return;
        }
        if (mode === "analysis") {
            if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) {
                resolve({ move, score: Number.isFinite(score) ? scoreFromWhitePerspective(fen, score) : null });
            } else reject(new Error("Sunfish returned no legal move"));
            return;
        }
        if (/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move)) resolve(move);
        else reject(new Error("Sunfish returned no legal move"));
    });

    worker.addEventListener("error", () => {
        const error = new Error("Sunfish worker failed");
        rejectReady?.(error);
        if (pendingSearch?.timer) clearTimeout(pendingSearch.timer);
        pendingSearch?.cleanup?.();
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
        pendingSearch = { resolve, reject, timer, mode: "reply", fen, score: null };
        worker.postMessage("ucinewgame");
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${depth}`);
    });
}

/** Return the current best move and score from one deterministic search. */
export function cancelSunfishAnalysis() {
    if (pendingSearch?.mode !== "analysis") return;
    pendingSearch.cancel?.();
}

export async function sunfishAnalyze(fen, depth = 2, timeoutMs = SEARCH_TIMEOUT_MS, { signal } = {}) {
    await waitForWorkerReady(signal);
    if (signal?.aborted) throw analysisCancelledError();
    if (pendingSearch) throw new Error("Sunfish is already searching");

    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(analysisCancelledError());
            return;
        }
        const cleanup = () => signal?.removeEventListener("abort", cancel);
        const cancel = () => {
            if (!pendingSearch || pendingSearch.resolve !== resolve) return;
            clearTimeout(pendingSearch.timer);
            pendingSearch = undefined;
            cleanup();
            reset();
            reject(analysisCancelledError());
        };
        const timer = Number.isFinite(timeoutMs)
            ? setTimeout(() => {
                if (!pendingSearch || pendingSearch.resolve !== resolve) return;
                pendingSearch = undefined;
                cleanup();
                reset();
                reject(new Error("Sunfish search timed out"));
            }, timeoutMs)
            : undefined;
        pendingSearch = { resolve, reject, timer, mode: "analysis", fen, score: null, cancel, cleanup };
        signal?.addEventListener("abort", cancel, { once: true });
        worker.postMessage("ucinewgame");
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${depth}`);
    });
}

/** Resolve a shallow deterministic evaluation in white-perspective cp. */
export async function sunfishEvaluate(fen, depth = 1) {
    await ensureWorker();
    if (pendingSearch) throw new Error("Sunfish is already searching");

    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            if (!pendingSearch || pendingSearch.resolve !== resolve) return;
            pendingSearch = undefined;
            reset();
            reject(new Error("Sunfish evaluation timed out"));
        }, SEARCH_TIMEOUT_MS);
        pendingSearch = { resolve, reject, timer, mode: "evaluation", fen, score: null };
        worker.postMessage("ucinewgame");
        worker.postMessage(`position fen ${fen}`);
        worker.postMessage(`go depth ${depth}`);
    });
}
