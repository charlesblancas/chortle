import { createAnalysisCoordinator } from "./analysisCoordinator.js";
import { buildSolutionPositions, materialEvaluation } from "./solutionReplay.js";

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function validMove(value) {
    return /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(value || "");
}

function readReplayState(storage, legacyStorage, key) {
    if (!key) return null;
    try {
        const raw = storage?.getItem(key) || legacyStorage?.getItem(key) || "null";
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * Own the replay session's cursor, alternate branches, persistence, and
 * progressive analysis behind one small interface. The view only renders the
 * snapshot and sends navigation or move commands through this module.
 */
export function createReplaySession({
    fen,
    movesString,
    storage,
    legacyStorage,
    replayStateKey = "",
    analysisCoordinator = createAnalysisCoordinator(),
} = {}) {
    const positions = buildSolutionPositions(fen, movesString);
    let state = {
        positionIndex: 0,
        customPosition: false,
        customBaseIndex: 0,
        customTrail: [],
        customIndex: -1,
        boardFen: positions[0].fen,
        evaluation: materialEvaluation(positions[0].fen),
        evaluationSource: "material fallback",
        replayArrows: [],
        arrowSource: "",
    };
    let interactive = false;
    let restored = false;
    let analysisKey = "";
    let analysisHasStarted = false;
    const listeners = new Set();

    function snapshot() {
        return { ...state, position: positions[state.positionIndex], positions };
    }

    function publish() {
        const next = snapshot();
        listeners.forEach((listener) => listener(next));
    }

    function subscribe(listener) {
        listeners.add(listener);
        listener(snapshot());
        return () => listeners.delete(listener);
    }

    function save() {
        if (!restored || !replayStateKey) return;
        try {
            storage?.setItem(replayStateKey, JSON.stringify({
                positionIndex: state.positionIndex,
                customPosition: state.customPosition,
                customBaseIndex: state.customBaseIndex,
                customTrail: state.customTrail,
                customIndex: state.customIndex,
                boardFen: state.boardFen,
            }));
        } catch {
            // Replay position is a convenience; storage failure must not stop it.
        }
    }

    function commit(next) {
        state = { ...state, ...next };
        publish();
        save();
        syncAnalysis();
    }

    function restore() {
        const saved = readReplayState(storage, legacyStorage, replayStateKey);
        if (saved && Number.isInteger(saved.positionIndex)) {
            const positionIndex = clamp(saved.positionIndex, 0, positions.length - 1);
            const customBaseIndex = clamp(saved.customBaseIndex || 0, 0, positions.length - 1);
            const customTrail = Array.isArray(saved.customTrail)
                ? saved.customTrail.filter((entry) => entry && validMove(entry.move) && typeof entry.fen === "string")
                : [];
            const customIndex = Number.isInteger(saved.customIndex)
                ? clamp(saved.customIndex, -1, customTrail.length - 1)
                : -1;
            const customPosition = Boolean(saved.customPosition) && customIndex >= 0;
            state = {
                ...state,
                positionIndex,
                customPosition,
                customBaseIndex,
                customTrail,
                customIndex,
                boardFen: customPosition ? customTrail[customIndex].fen : positions[positionIndex].fen,
            };
        }
        restored = true;
        publish();
        syncAnalysis();
    }

    function arrowFor(uci, brush) {
        if (!/^[a-h][1-8][a-h][1-8]/.test(uci || "")) return null;
        return { orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush };
    }

    function setArrows(canonicalMove = "", sunfishMove = "") {
        const puzzleArrow = arrowFor(canonicalMove, "green");
        const sunfishArrow = arrowFor(sunfishMove, "blue");
        const sameMove = canonicalMove && sunfishMove
            && canonicalMove.toLowerCase() === sunfishMove.toLowerCase();
        const replayArrows = sameMove && puzzleArrow
            ? [puzzleArrow]
            : [puzzleArrow, sunfishArrow].filter(Boolean);
        const arrowSource = puzzleArrow && sunfishArrow && !sameMove
            ? "both"
            : puzzleArrow ? "puzzle"
            : sunfishArrow ? "sunfish"
            : "";
        state = { ...state, replayArrows, arrowSource };
        publish();
    }

    function stopAnalysis() {
        analysisCoordinator.stop();
    }

    async function requestAnalysis(positionFen, canonicalMove = "") {
        const fallback = materialEvaluation(positionFen);
        await analysisCoordinator.start(positionFen, canonicalMove, {
            onStart: ({ cached }) => {
                setArrows(canonicalMove, cached?.move);
                const next = { ...state };
                if (cached && Number.isFinite(cached.score)) {
                    next.evaluation = cached.score;
                    next.evaluationSource = cached.verified
                        ? `Sunfish depth ${cached.depth} (cached)`
                        : `Sunfish depth ${cached.depth} from the suggested move (checking)`;
                } else if (!analysisHasStarted) {
                    next.evaluation = fallback;
                    next.evaluationSource = "material fallback";
                } else {
                    next.evaluationSource = "Previous position (checking)";
                }
                state = next;
                analysisHasStarted = true;
                publish();
            },
            onDepth: ({ depth, result }) => {
                const next = { ...state };
                if (Number.isFinite(result.score)) {
                    next.evaluation = result.score;
                    next.evaluationSource = `Sunfish depth ${depth}`;
                }
                state = next;
                if (arrowFor(result.move, "blue")) setArrows(canonicalMove, result.move);
                else publish();
            },
        });
    }

    function syncAnalysis() {
        const canonicalMove = state.customPosition ? "" : positions[state.positionIndex + 1]?.move || "";
        const requested = interactive ? `${state.boardFen}\u0000${canonicalMove}` : "";
        if (requested === analysisKey) return;
        analysisKey = requested;
        if (requested) requestAnalysis(state.boardFen, canonicalMove);
        else stopAnalysis();
    }

    function setInteractive(value) {
        const next = Boolean(value);
        if (next === interactive) return;
        interactive = next;
        syncAnalysis();
    }

    function goTo(index) {
        const nextIndex = clamp(index, 0, positions.length - 1);
        if (!state.customPosition && nextIndex === state.positionIndex + 1) {
            const move = positions[nextIndex].move;
            analysisCoordinator.seedChild(state.boardFen, positions[nextIndex].fen, move);
        }
        commit({
            positionIndex: nextIndex,
            customPosition: false,
            customTrail: [],
            customIndex: -1,
            boardFen: positions[nextIndex].fen,
        });
    }

    function showCustomPosition(index) {
        const customIndex = clamp(index, 0, state.customTrail.length - 1);
        if (!state.customTrail[customIndex]) return;
        commit({
            customPosition: true,
            customIndex,
            boardFen: state.customTrail[customIndex].fen,
        });
    }

    function previous() {
        if (state.customPosition) {
            if (state.customIndex > 0) showCustomPosition(state.customIndex - 1);
            else commit({
                customPosition: false,
                positionIndex: state.customBaseIndex,
                customIndex: -1,
                boardFen: positions[state.customBaseIndex].fen,
            });
            return;
        }
        if (state.positionIndex > 0) goTo(state.positionIndex - 1);
    }

    function next() {
        if (state.customPosition) {
            if (state.customIndex < state.customTrail.length - 1) showCustomPosition(state.customIndex + 1);
            return;
        }
        if (state.customTrail.length && state.positionIndex === state.customBaseIndex) {
            showCustomPosition(0);
            return;
        }
        if (state.positionIndex < positions.length - 1) goTo(state.positionIndex + 1);
    }

    function playMove({ uci, fen: childFen } = {}) {
        if (!validMove(uci) || typeof childFen !== "string" || !childFen) return;
        analysisCoordinator.seedChild(state.boardFen, childFen, uci);
        const canonicalMove = positions[state.positionIndex + 1]?.move || "";
        if (!state.customPosition && canonicalMove && uci.toLowerCase() === canonicalMove.toLowerCase()) {
            commit({
                positionIndex: state.positionIndex + 1,
                customTrail: [],
                customIndex: -1,
                boardFen: childFen,
            });
            return;
        }
        const baseIndex = state.customPosition ? state.customBaseIndex : state.positionIndex;
        const trail = state.customPosition ? state.customTrail.slice(0, state.customIndex + 1) : [];
        const nextTrail = [...trail, { move: uci, fen: childFen }];
        commit({
            customBaseIndex: baseIndex,
            customTrail: nextTrail,
            customIndex: nextTrail.length - 1,
            customPosition: true,
            boardFen: childFen,
        });
    }

    function dispose() {
        stopAnalysis();
        listeners.clear();
    }

    return {
        positions,
        getSnapshot: snapshot,
        subscribe,
        restore,
        setInteractive,
        goTo,
        previous,
        next,
        playMove,
        dispose,
    };
}
