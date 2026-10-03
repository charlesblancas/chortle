import { isUciMove } from "./chessNotation.js";

const LIMIT = 96;
// Scores from different engines are not interchangeable.
const STORAGE_KEY = "chortle:stockfish-19-analysis-v1";
const entries = new Map();
let restored = false;

function storage() {
    try { return typeof window === "undefined" ? null : window.localStorage; }
    catch { return null; }
}

function restore() {
    if (restored) return;
    restored = true;
    try {
        const saved = JSON.parse(storage()?.getItem(STORAGE_KEY) || "[]");
        if (!Array.isArray(saved)) return;
        for (const item of saved.slice(-LIMIT)) {
            if (!Array.isArray(item)) continue;
            const [fen, entry] = item;
            if (typeof fen !== "string" || !entry || !Number.isInteger(entry.depth) || entry.depth < 1
                || !(entry.move === "" || isUciMove(entry.move))
                || !(entry.score === null || Number.isFinite(entry.score))
                || typeof entry.verified !== "boolean") continue;
            entries.set(fen, { ...entry });
        }
    } catch { /* Optional cache must not prevent opening the board. */ }
}

function put(fen, entry) {
    entries.delete(fen);
    entries.set(fen, entry);
    if (entries.size > LIMIT) entries.delete(entries.keys().next().value);
    try { storage()?.setItem(STORAGE_KEY, JSON.stringify([...entries])); }
    catch { /* Keep the in-memory cache when storage is unavailable. */ }
}

export function getCachedAnalysis(fen) {
    restore();
    const entry = entries.get(fen);
    if (!entry) return null;
    // Touch LRU in memory; merely reading need not write browser storage.
    entries.delete(fen);
    entries.set(fen, entry);
    return { ...entry };
}

export function cacheAnalysis(fen, depth, result) {
    restore();
    if (!Number.isInteger(depth) || depth < 1 || !result) return;
    if (entries.get(fen)?.depth > depth) return;
    put(fen, {
        depth, move: isUciMove(result.move) ? result.move : "",
        score: Number.isFinite(result.score) ? result.score : null,
        verified: true,
        ...(result.analysisComplete === true ? { analysisComplete: true } : {}),
        ...(Number.isFinite(result.mate) ? { mate: result.mate } : {}),
    });
}

export function nextAnalysisDepth(fen) {
    const entry = getCachedAnalysis(fen);
    return entry?.depth ? Math.max(2, entry.depth + 1) : 2;
}

export function seedAnalysis(fen, parent) {
    restore();
    if (!parent?.verified || !Number.isFinite(parent.score)) return;
    const existing = entries.get(fen);
    if (existing?.verified || existing?.depth >= parent.depth) return;
    put(fen, { depth: parent.depth, move: "", score: parent.score, verified: false });
}
