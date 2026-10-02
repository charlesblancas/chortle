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

    function reset(error) {
        worker?.terminate();
        worker = undefined;
        ready = undefined;
        const previous = waiter;
        waiter = undefined;
        if (previous) { clearTimeout(previous.timer); previous.reject(error); }
    }

    function command(message, pattern) {
        return new Promise((resolve, reject) => {
            waiter = { pattern, resolve, reject, timer: setTimeout(() => reset(new Error("Stockfish timed out")), timeoutMs) };
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

    async function search(fen, nodes) {
        await ensureReady();
        // Clear search history for each position so prior analysis/replies
        // cannot change the move selected at the fixed node budget.
        worker.postMessage("ucinewgame");
        await command("isready", /^readyok$/);
        worker.postMessage(`position fen ${fen}`);
        const line = await command(`go nodes ${normalizeNodeBudget(nodes)}`, /^bestmove /);
        return line.split(/\s+/)[1] || "";
    }

    return {
        warm: () => ensureReady().catch(() => undefined),
        reply(fen, nodes = DEFAULT_GAMEPLAY_NODES) {
            const result = queue.then(() => search(fen, nodes));
            queue = result.catch(() => undefined);
            return result;
        },
    };
}

const client = createStockfishClient();
export const warmStockfish = () => client.warm();
export const stockfishReply = (fen, nodes = gameplayNodeBudget()) => client.reply(fen, nodes);
