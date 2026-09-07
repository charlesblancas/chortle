<script>
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import Chess from "./Chess.svelte";
    import {
        cacheSunfishAnalysis,
        cancelSunfishAnalysis,
        getCachedSunfishAnalysis,
        seedSunfishAnalysis,
        sunfishAnalyze,
    } from "./sunfishEngine";
    import { buildSolutionPositions, evaluationLabel, evaluationPercent, materialEvaluation } from "./solutionReplay";

    export let fen;
    export let movesString;
    export let pieceSet = "cburnett";
    export let interactive = false;

    const dispatch = createEventDispatcher();
    const positions = buildSolutionPositions(fen, movesString);
    let positionIndex = 0;
    let boardFen = positions[0].fen;
    let customPosition = false;
    let customBaseIndex = 0;
    let customTrail = [];
    let customIndex = -1;
    let evaluation = materialEvaluation(positions[0].fen);
    let evaluationSource = "material fallback";
    let analysisRequest = 0;
    let analysisKey = "";
    let replayArrows = [];
    let arrowSource = "";

    $: position = positions[positionIndex];
    $: displayMove = customPosition ? customTrail[customIndex]?.move || "" : position.move || position.setup?.move || "";
    $: whiteShare = evaluationPercent(evaluation);
    $: evaluationText = evaluationLabel(evaluation);
    $: positionText = customPosition
        ? `Custom position · ${customBaseIndex}/${positions.length - 1}`
        : positionIndex === 0
        ? "Puzzle start"
        : `Move ${positionIndex}: ${position.san} (${position.move.toUpperCase()})`;
    $: previousDisabled = customPosition ? customIndex < 0 : positionIndex === 0;
    $: nextDisabled = customPosition
        ? customIndex >= customTrail.length - 1
        : positionIndex === positions.length - 1 && !(customTrail.length && positionIndex === customBaseIndex);
    $: canonicalMove = customPosition ? "" : positions[positionIndex + 1]?.move || "";
    $: requestedAnalysisKey = interactive ? `${boardFen}\u0000${canonicalMove}` : "";
    $: if (requestedAnalysisKey !== analysisKey) {
        analysisKey = requestedAnalysisKey;
        if (requestedAnalysisKey) requestAnalysis(boardFen, canonicalMove);
        else stopAnalysis();
    }

    function arrowFor(uci, brush) {
        if (!/^[a-h][1-8][a-h][1-8]/.test(uci)) return null;
        return { orig: uci.slice(0, 2), dest: uci.slice(2, 4), brush };
    }

    // The solution replay is allowed to spend time refining the answer. The
    // live game still uses depth 2, but this view keeps asking for deeper
    // searches without a depth or time limit until the position changes or
    // the solution viewer is no longer active.
    const ANALYSIS_TIMEOUT_MS = Infinity;

    function stopAnalysis() {
        analysisRequest += 1;
        cancelSunfishAnalysis();
    }

    function setArrows(canonicalMove = "", sunfishMove = "") {
        const puzzleArrow = arrowFor(canonicalMove, "green");
        const sunfishArrow = arrowFor(sunfishMove, "blue");
        const sameMove = canonicalMove && sunfishMove && canonicalMove.toLowerCase() === sunfishMove.toLowerCase();
        replayArrows = sameMove && puzzleArrow
            ? [puzzleArrow]
            : [puzzleArrow, sunfishArrow].filter(Boolean);
        arrowSource = puzzleArrow && sunfishArrow && !sameMove
            ? "both"
            : puzzleArrow ? "puzzle"
            : sunfishArrow ? "sunfish"
            : "";
    }

    async function requestAnalysis(positionFen, canonicalMove = "") {
        if (typeof document !== "undefined" && document.hidden) return;
        const request = ++analysisRequest;
        cancelSunfishAnalysis();
        const cached = getCachedSunfishAnalysis(positionFen);
        setArrows(canonicalMove, cached?.move);

        const fallback = materialEvaluation(positionFen);
        if (cached && Number.isFinite(cached.score)) {
            evaluation = cached.score;
            evaluationSource = cached.verified
                ? `Sunfish depth ${cached.depth} (cached)`
                : `Sunfish depth ${cached.depth} from the suggested move (checking)`;
        // Keep the last displayed score while the worker evaluates an unseen
        // position. Replacing it immediately with material balance makes the
        // bar visibly jump toward the centre between every move.
        } else if (request === 1) {
            evaluation = fallback;
            evaluationSource = "material fallback";
        }

        const firstDepth = cached?.verified ? cached.depth + 1 : 2;
        for (let depth = firstDepth; request === analysisRequest; depth += 1) {
            if (request !== analysisRequest) return;
            let result;
            for (let attempt = 0; attempt < 8; attempt += 1) {
                if (request !== analysisRequest) return;
                try {
                    result = await sunfishAnalyze(positionFen, depth, ANALYSIS_TIMEOUT_MS);
                    break;
                } catch (error) {
                    // A newer analysis may still be using the shared worker.
                    // Give it a moment to finish before retrying this request.
                    if (error?.message === "Sunfish search timed out") break;
                    await new Promise((resolve) => setTimeout(resolve, 40));
                }
            }
            if (request !== analysisRequest || !result) return;
            cacheSunfishAnalysis(positionFen, depth, result);
            if (Number.isFinite(result.score)) {
                evaluation = result.score;
                evaluationSource = `Sunfish depth ${depth}`;
            }
            const suggestion = arrowFor(result.move, "blue");
            if (suggestion) {
                setArrows(canonicalMove, result.move);
            }
        }
    }

    function goTo(index) {
        positionIndex = Math.max(0, Math.min(positions.length - 1, index));
        customPosition = false;
        customTrail = [];
        customIndex = -1;
        boardFen = positions[positionIndex].fen;
    }

    function showCustomPosition(index) {
        customIndex = Math.max(0, Math.min(customTrail.length - 1, index));
        customPosition = true;
        boardFen = customTrail[customIndex].fen;
    }

    function goPrevious() {
        if (customPosition) {
            if (customIndex > 0) {
                showCustomPosition(customIndex - 1);
            } else {
                customPosition = false;
                positionIndex = customBaseIndex;
                boardFen = positions[positionIndex].fen;
            }
            return;
        }
        if (positionIndex > 0) goTo(positionIndex - 1);
    }

    function goNext() {
        if (customPosition) {
            if (customIndex < customTrail.length - 1) showCustomPosition(customIndex + 1);
            return;
        }
        if (customTrail.length && positionIndex === customBaseIndex) {
            showCustomPosition(0);
            return;
        }
        if (positionIndex < positions.length - 1) goTo(positionIndex + 1);
    }

    function handleReplayMove(event) {
        const cachedParent = getCachedSunfishAnalysis(boardFen);
        if (cachedParent?.move?.toLowerCase() === event.detail.uci.toLowerCase()) {
            seedSunfishAnalysis(event.detail.fen, cachedParent);
        }
        const nextMove = positions[positionIndex + 1]?.move || "";
        if (!customPosition && nextMove && event.detail.uci === nextMove) {
            positionIndex += 1;
            customTrail = [];
            customIndex = -1;
            boardFen = positions[positionIndex].fen;
            return;
        }
        if (!customPosition) {
            customBaseIndex = positionIndex;
            customTrail = [];
            customIndex = -1;
        }
        customTrail = [...customTrail.slice(0, customIndex + 1), { move: event.detail.uci, fen: event.detail.fen }];
        customIndex += 1;
        customPosition = true;
        boardFen = event.detail.fen;
    }

    function handleKeydown(event) {
        if (!interactive || event.key !== "Backspace") return;
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
        event.preventDefault();
        goPrevious();
    }

    onMount(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopAnalysis();
            } else if (interactive) {
                requestAnalysis(boardFen, canonicalMove);
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    });

    onDestroy(stopAnalysis);

</script>

<div class="solution-viewer" aria-label="Solution chessboard">
    <p class="position" aria-live="polite">{positionText} · {positionIndex}/{positions.length - 1}</p>

    <div class="replay-board" data-arrow-source={arrowSource} aria-label={arrowSource === "both" ? "Puzzle continuation and Sunfish suggestion arrows" : arrowSource === "puzzle" ? "Puzzle continuation arrow" : arrowSource === "sunfish" ? "Sunfish suggestion arrow" : "No move suggestion arrow"}>
        <Chess {fen} {movesString} {pieceSet} replay={true} replayFen={boardFen} replayMove={displayMove} {replayArrows} playable={interactive} readOnly={!interactive} disabled={!interactive} on:replayMove={handleReplayMove} />
        <div class="evaluation-wrap">
            <div class="evaluation-bar" aria-label={`Evaluation: ${evaluationText}`} title={`Evaluation: ${evaluationText}`}>
                <span class="white-share" style={`height: ${whiteShare}%`}></span>
            </div>
            <span class="eval-mark black-mark" aria-hidden="true">−</span>
            <span class="eval-mark white-mark" aria-hidden="true">+</span>
        </div>
    </div>
    <p class="arrow-legend" aria-label="Move arrow legend"><span><i class="arrow-swatch sunfish-swatch" aria-hidden="true"></i>Blue: Sunfish</span><span><i class="arrow-swatch puzzle-swatch" aria-hidden="true"></i>Green: puzzle line</span></p>
    <p class="evaluation-text" aria-live="polite">{evaluationText} <span>({evaluationSource})</span></p>

    <div class="replay-controls" aria-label="Solution replay controls">
        <button type="button" aria-label="Go to puzzle start" disabled={!customPosition && positionIndex === 0} on:click={() => goTo(0)}>First</button>
        <button type="button" aria-label="Show previous move" disabled={previousDisabled} on:click={goPrevious}>Previous</button>
        <button type="button" aria-label="Show next move" disabled={nextDisabled} on:click={goNext}>Next</button>
        <button type="button" aria-label="Go to puzzle end" disabled={!customPosition && positionIndex === positions.length - 1} on:click={() => goTo(positions.length - 1)}>Last</button>
    </div>
    {#if interactive}<button class="close" type="button" on:click={() => dispatch("close")}>Back to result</button>{/if}
</div>
<svelte:window on:keydown={handleKeydown} />

<style>
    .solution-viewer { color: var(--text); }
    .position { margin: 0.65rem 0 0.2rem; color: var(--muted); font: 700 0.68rem/1.2 var(--mono); letter-spacing: 0.05em; text-align: center; text-transform: uppercase; }
    .replay-board { display: grid; grid-template-columns: minmax(0, 32rem) 1.1rem; align-items: stretch; gap: 0.45rem; margin: 0 auto; width: min(100%, 33.55rem); }
    .evaluation-wrap { position: relative; min-height: 0; }
    .evaluation-bar { position: absolute; inset: 0; overflow: hidden; border: 1px solid var(--ink); background: #202326; }
    .white-share { position: absolute; right: 0; bottom: 0; left: 0; height: 50%; background: #f4f1e7; transition: height 240ms ease-in-out; will-change: height; }
    .eval-mark { position: absolute; left: 50%; transform: translateX(-50%); color: var(--muted); font: 700 0.55rem/1 var(--mono); }
    .black-mark { top: 0.15rem; color: #f4f1e7; }
    .white-mark { bottom: 0.15rem; color: #202326; }
    .evaluation-text { margin: 0.25rem 0 0; color: var(--muted); font: 700 0.65rem/1 var(--mono); text-align: center; }
    .evaluation-text span { font-weight: 400; }
    .arrow-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.7rem; margin: 0.3rem 0 0; color: var(--muted); font: 600 0.58rem/1 var(--mono); }
    .arrow-legend span { display: inline-flex; align-items: center; gap: 0.22rem; }
    .arrow-swatch { display: inline-block; width: 0.7rem; height: 0.18rem; border-radius: 999px; }
    .sunfish-swatch { background: #003088; }
    .puzzle-swatch { background: #15781b; }
    .replay-controls { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.3rem; margin-top: 0.8rem; }
    .replay-controls button { min-width: 0; padding: 0.5rem 0.25rem; font-size: 0.62rem; }
    .close { display: block; margin: 0.55rem auto 0; padding: 0.45rem 0.6rem; font-size: 0.62rem; }
    button:disabled { cursor: not-allowed; opacity: 0.4; }
    :global(.solution-viewer .chess) { margin: 0; width: 100%; }
    :global(.solution-viewer .chess .board-grid) { width: 100%; margin-inline: 0; }
    :global(.solution-viewer .chess .rank-labels) { left: -1.3rem; }
    @media (max-width: 420px) {
        .replay-controls button { font-size: 0.56rem; }
        .replay-board { grid-template-columns: minmax(0, 1fr) 0.9rem; gap: 0.3rem; width: calc(100% - 1.8rem); margin-inline: 1.8rem 0; }
        :global(.solution-viewer .chess .rank-labels) { left: -1.3rem; }
    }
    @media (prefers-reduced-motion: reduce) {
        .white-share { transition: none; }
    }
</style>
