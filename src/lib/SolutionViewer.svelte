<script>
    import { createEventDispatcher, onDestroy, onMount } from "svelte";
    import Chess from "./Chess.svelte";
    import { createReplaySession } from "./replaySession.js";
    import { safeStorage } from "./gameStorage";
    import { evaluationLabel, evaluationPercent } from "./solutionReplay";

    export let fen;
    export let movesString;
    export let pieceSet = "cburnett";
    export let interactive = false;
    export let replayStateKey = "";

    const dispatch = createEventDispatcher();

    function replayStorage() {
        return safeStorage(typeof window !== "undefined" ? window.localStorage : null);
    }

    function legacyReplayStorage() {
        return safeStorage(typeof window !== "undefined" ? window.sessionStorage : null);
    }

    const session = createReplaySession({
        fen,
        movesString,
        storage: replayStorage(),
        legacyStorage: legacyReplayStorage(),
        replayStateKey,
    });
    let replay = session.getSnapshot();
    let mounted = false;
    const unsubscribe = session.subscribe((next) => { replay = next; });

    $: position = replay.position;
    $: positions = replay.positions;
    $: positionIndex = replay.positionIndex;
    $: customPosition = replay.customPosition;
    $: displayMove = customPosition
        ? replay.customTrail[replay.customIndex]?.move || ""
        : position.move || position.setup?.move || "";
    $: whiteShare = evaluationPercent(replay.evaluation);
    $: evaluationText = evaluationLabel(replay.evaluation);
    $: positionText = customPosition
        ? `Custom position · ${replay.customBaseIndex}/${positions.length - 1}`
        : positionIndex === 0
        ? "Puzzle start"
        : `Move ${positionIndex}: ${position.san} (${position.move.toUpperCase()})`;
    $: previousDisabled = customPosition ? replay.customIndex < 0 : positionIndex === 0;
    $: nextDisabled = customPosition
        ? replay.customIndex >= replay.customTrail.length - 1
        : positionIndex === positions.length - 1 && !(replay.customTrail.length && positionIndex === replay.customBaseIndex);
    $: if (mounted) session.setInteractive(interactive);

    function goTo(index) {
        session.goTo(index);
    }

    function goPrevious() {
        session.previous();
    }

    function goNext() {
        session.next();
    }

    function handleReplayMove(event) {
        session.playMove(event.detail);
    }

    function handleKeydown(event) {
        if (!interactive || event.key !== "Backspace") return;
        const target = event.target;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) return;
        event.preventDefault();
        goPrevious();
    }

    onMount(() => {
        session.restore();
        mounted = true;
        session.setInteractive(interactive);
    });

    onDestroy(() => {
        unsubscribe();
        session.dispose();
    });
</script>

<div class="solution-viewer" aria-label="Solution chessboard">
    <p class="position" aria-live="polite">{positionText} · {positionIndex}/{positions.length - 1}</p>

    <div class="replay-board" data-arrow-source={replay.arrowSource} aria-label={replay.arrowSource === "both" ? "Puzzle continuation and Sunfish suggestion arrows" : replay.arrowSource === "puzzle" ? "Puzzle continuation arrow" : replay.arrowSource === "sunfish" ? "Sunfish suggestion arrow" : "No move suggestion arrow"}>
        <Chess {fen} {movesString} {pieceSet} replay={true} replayFen={replay.boardFen} replayMove={displayMove} replayArrows={replay.replayArrows} playable={interactive} readOnly={!interactive} disabled={!interactive} on:replayMove={handleReplayMove} />
        <div class="evaluation-wrap">
            <div class="evaluation-bar" aria-label={`Evaluation: ${evaluationText}`} title={`Evaluation: ${evaluationText}`}>
                <span class="white-share" style={`height: ${whiteShare}%`}></span>
            </div>
            <span class="eval-mark black-mark" aria-hidden="true">−</span>
            <span class="eval-mark white-mark" aria-hidden="true">+</span>
        </div>
    </div>
    <p class="arrow-legend" aria-label="Move arrow legend"><span><i class="arrow-swatch sunfish-swatch" aria-hidden="true"></i>Blue: Sunfish</span><span><i class="arrow-swatch puzzle-swatch" aria-hidden="true"></i>Green: puzzle line</span></p>
    <p class="evaluation-text">{evaluationText} <span>({replay.evaluationSource})</span></p>

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
    :global(.solution-viewer .chess) { margin: 0; width: 100%; }
    :global(.solution-viewer .chess .board-grid) { width: 100%; margin-inline: 0; }
    :global(.solution-viewer .chess .rank-labels) { left: -1.3rem; }
    @media (max-width: 420px) {
        .replay-controls button { font-size: 0.56rem; }
        .replay-board { grid-template-columns: minmax(0, 1fr) 0.9rem; gap: 0.3rem; width: calc(100% - 3.5rem); margin-inline: 1.75rem 0; }
        :global(.solution-viewer .chess .rank-labels) { left: -1.3rem; }
    }
    @media (max-width: 420px) and (max-height: 760px) {
        .position { margin-top: 0.35rem; margin-bottom: 0.1rem; }
        .replay-board { width: calc(100% - 4rem); margin-inline: 2rem 0; }
        .arrow-legend { margin-top: 0.2rem; }
        .evaluation-text { margin-top: 0.2rem; }
        .replay-controls { margin-top: 0.5rem; }
        .close { margin-top: 0.35rem; }
    }
    @media (prefers-reduced-motion: reduce) {
        .white-share { transition: none; }
    }
</style>
