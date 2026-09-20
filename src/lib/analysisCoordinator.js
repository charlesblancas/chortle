import { fenAfterUci } from "./solutionReplay.js";
import {
    cacheSunfishAnalysis,
    cancelSunfishAnalysis,
    getCachedSunfishAnalysis,
    nextSunfishAnalysisDepth,
    seedSunfishAnalysis,
    sunfishAnalyze,
} from "./sunfishEngine.js";

const ANALYSIS_TIMEOUT_MS = Infinity;
const PREFETCH_DEPTH = 2;
const PREFETCH_BUDGET_MS = 100;
const MAX_RETRIES = 8;
const RETRY_DELAY_MS = 40;

const defaultEngine = {
    analyze: (fen, depth, { signal } = {}) => sunfishAnalyze(fen, depth, ANALYSIS_TIMEOUT_MS, { signal }),
    getCached: getCachedSunfishAnalysis,
    cache: cacheSunfishAnalysis,
    nextDepth: nextSunfishAnalysisDepth,
    seed: seedSunfishAnalysis,
    cancel: cancelSunfishAnalysis,
};

function isCancellation(error) {
    return error?.message === "Sunfish analysis cancelled";
}

/**
 * Coordinate long-running replay analysis behind one small interface.
 *
 * The coordinator owns request identity, worker cancellation, progressive
 * depth, cache lookup/seeding, and child prefetch. The view only supplies a
 * position and receives start/depth notifications.
 */
export function createAnalysisCoordinator(engine = defaultEngine) {
    let activeSession;
    let nextSessionId = 0;

    function stop() {
        if (!activeSession) return;
        const session = activeSession;
        activeSession = undefined;
        session.controller.abort();
        engine.cancel?.();
    }

    function isCurrent(session) {
        return activeSession === session && !session.controller.signal.aborted;
    }

    async function prefetchChild(positionFen, session) {
        if (!positionFen || !isCurrent(session)) return;
        if (engine.getCached(positionFen)?.verified) return;
        if (session.prefetched.has(positionFen)) return;
        session.prefetched.add(positionFen);
        const controller = new AbortController();
        const abort = () => controller.abort();
        session.controller.signal.addEventListener("abort", abort, { once: true });
        const timer = setTimeout(abort, PREFETCH_BUDGET_MS);
        try {
            const result = await engine.analyze(positionFen, PREFETCH_DEPTH, { signal: controller.signal });
            if (!isCurrent(session) || controller.signal.aborted) return;
            engine.cache(positionFen, PREFETCH_DEPTH, result);
        } catch (error) {
            // Prefetch is optional. The active position continues refining
            // even when a child is illegal, unavailable, or cancelled.
            if (isCancellation(error) || !isCurrent(session)) return;
        } finally {
            clearTimeout(timer);
            session.controller.signal.removeEventListener("abort", abort);
        }
    }

    async function prefetchLikelyChildren(positionFen, canonicalMove, sunfishMove, session) {
        const childFens = new Set(
            [canonicalMove, sunfishMove]
                .map((move) => fenAfterUci(positionFen, move))
                .filter(Boolean),
        );
        for (const childFen of childFens) {
            if (!isCurrent(session)) return;
            await prefetchChild(childFen, session);
        }
    }

    async function start(positionFen, canonicalMove = "", { onStart = () => {}, onDepth = () => {} } = {}) {
        stop();
        const session = {
            id: ++nextSessionId,
            controller: new AbortController(),
            prefetched: new Set(),
        };
        activeSession = session;

        try {
            const cached = engine.getCached(positionFen);
            if (!isCurrent(session)) return;
            onStart({ positionFen, canonicalMove, cached });

            for (let depth = engine.nextDepth(positionFen); isCurrent(session); depth += 1) {
                let result;
                for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
                    if (!isCurrent(session)) return;
                    try {
                        result = await engine.analyze(positionFen, depth, { signal: session.controller.signal });
                        break;
                    } catch (error) {
                        if (isCancellation(error) || !isCurrent(session)) return;
                        // A competing live reply may still be using the shared
                        // worker. Preserve the old retry behaviour without
                        // leaking that coordination into the view.
                        if (error?.message === "Sunfish search timed out") break;
                        // Contention is temporary, not a failed search. Keep
                        // waiting while this session remains active.
                        if (error?.message === "Sunfish is already searching") attempt -= 1;
                        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
                    }
                }
                if (!isCurrent(session) || !result) return;
                engine.cache(positionFen, depth, result);
                if (!isCurrent(session)) return;
                onDepth({ positionFen, canonicalMove, depth, result });
                if (!isCurrent(session)) return;
                await prefetchLikelyChildren(positionFen, canonicalMove, result.move, session);
            }
        } catch (error) {
            // Cancellation is expected during navigation, closing, and page
            // discard. Other analysis failures are optional too: the caller
            // already has the cached/material fallback to display.
            if (!isCancellation(error)) return;
        } finally {
            if (activeSession === session) activeSession = undefined;
        }
    }

    function seedChild(parentFen, childFen, move) {
        const parent = engine.getCached(parentFen);
        if (!parent?.verified || !parent.move || parent.move.toLowerCase() !== String(move || "").toLowerCase()) return false;
        engine.seed(childFen, parent);
        return true;
    }

    return { start, stop, seedChild };
}
