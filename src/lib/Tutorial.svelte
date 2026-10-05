<script>
    import { createEventDispatcher, onMount, tick } from "svelte";
    import Chess from "./Chess.svelte";
    import Guess from "./Guess.svelte";
    import Keyboard from "./Keyboard.svelte";
    import { shouldHandleWordGameKey, playerMoves } from "../gameRules.js";
    import { createTutorialSession } from "./tutorialSession.js";
    import { tutorialLesson as lesson } from "./tutorialLesson.js";

    export let pieceSet = "cburnett";
    export let active = true;
    const dispatch = createEventDispatcher();
    let session = createTutorialSession(lesson);
    let state = session.getSnapshot();
    let boardReset = 0;
    let heading;
    let preview = "";
    onMount(() => { tick().then(() => heading?.focus()); });
    const solutionMoves = playerMoves(lesson.moves);
    $: step = state.step;
    $: arrow = step.kind === "move" ? { orig: step.uci.slice(0, 2), dest: step.uci.slice(2, 4), brush: "blue" } : null;
    $: explanation = step.kind === "explain" || step.kind === "new-row";

    function update(accepted) {
        state = session.getSnapshot();
        preview = "";
        if (accepted && state.step.kind === "complete") dispatch("complete");
        if (!accepted) boardReset += 1;
        // After completing a step, leave square/button focus so hardware letter
        // input works immediately. Selection itself never advances a step.
        if (accepted) {
            tick().then(() => heading?.focus());
        }
    }
    function input(key) { update(session.key(key)); }
    function handleKey(event) {
        if (!active) return;
        if (event.key === "Escape") return;
        if (!shouldHandleWordGameKey(event)) return;
        event.preventDefault();
        input(event.key);
    }
    function restart() {
        session = createTutorialSession(lesson);
        state = session.getSnapshot();
        boardReset += 1;
        tick().then(() => heading?.focus());
    }
</script>

<svelte:window on:keydown={handleKey} />
<section class="tutorial" aria-labelledby="tutorial-title" style={`--history-height: ${state.row * 2.55}rem`}>
    <header>
        <div><p class="eyebrow">Practice edition · you play Black</p><h1 id="tutorial-title" bind:this={heading} tabindex="-1">Learn by playing.</h1></div>
    </header>
    <div class="coach" role="status" aria-live="polite" aria-atomic="true">
        <p class="progress">{step.kind === "complete" ? "Tutorial complete" : `Practice guess ${state.row + 1} of 3`}</p>
        <p>{step.text}</p>
        {#if state.message}<p class="error">{state.message}</p>{/if}
    </div>
    <div class="practice-rows" aria-label="Tutorial guesses">
        {#each state.rows as row, index}
            <div class="practice-row">
                <Guess word={row.word} status={row.status} actions={row.actions} {solutionMoves} active={index === state.row && !explanation && step.kind !== "complete"} previewLetter={index === state.row ? preview : ""} />
                {#if index === state.row && step.tile !== undefined}<div class="tile-marker" aria-hidden="true" style={`left: calc(${step.tile} * (var(--guess-tile-size) + 0.3rem))`}></div>{/if}
            </div>
        {/each}
    </div>
    <div class="practice-board">
        {#key `${boardReset}:${state.index}`}
            <Chess fen={lesson.fen} movesString={lesson.moves} replay playable replayFen={state.fen} replayMove={state.lastMove} replayArrow={arrow} disabled={step.kind !== "move"} idPrefix="tutorial-chess" {pieceSet} on:replayMove={(event) => update(session.move(event.detail.uci))} on:preview={(event) => preview = event.detail.letter} />
        {/key}
    </div>
    {#if !explanation && step.kind !== "complete"}
        <Keyboard on:key={(event) => input(event.detail.key)} />
    {/if}
    <footer>
        <button type="button" disabled={state.index === 0} on:click={() => update(session.back())}>Back</button>
        {#if step.kind === "complete"}
            <button type="button" on:click={() => dispatch("close")}>Play today's puzzle</button>
            <button type="button" on:click={restart}>Replay tutorial</button>
        {:else if explanation}
            <button type="button" on:click={() => update(session.next())}>{step.kind === "new-row" ? "Try the next guess" : "Continue"}</button>
        {:else}
            <span>{step.kind === "submit" ? "Use Enter or the ↵ key above" : "Follow the instruction above"}</span>
        {/if}
        {#if step.kind !== "complete"}<button type="button" class="text-button" on:click={() => dispatch("instructions")}>Written instructions</button>{/if}
    </footer>
</section>

<style>
    .tutorial { --guess-tile-size: 2.3rem; --guess-letter-size: 1.1rem; --guess-move-size: 0.42rem; --mobile-chess-width: min(22rem, calc(100dvh - 29rem)); --mobile-key-height: 1.8rem; display: flex; flex-direction: column; gap: 0.45rem; }
    header { display: flex; align-items: start; justify-content: space-between; border-bottom: 1px solid var(--ink); padding-bottom: 0.4rem; padding-right: 3rem; }
    h1 { margin: 0.18rem 0 0; font: 700 1.7rem/1 var(--display); letter-spacing: -0.035em; }
    h1:focus { outline: none; }
    .eyebrow, .progress { margin: 0; font: 700 0.6rem/1.3 var(--sans); text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); }
    .coach { min-height: 5.4rem; padding: 0.3rem 0; }
    .coach p:not(.progress) { margin: 0.25rem 0 0; font-size: 0.9rem; line-height: 1.3; }
    .error { color: var(--burgundy); }
    .practice-rows { display: flex; flex-direction: column; gap: 0.25rem; align-items: center; }
    .practice-row { position: relative; }
    .tile-marker { position: absolute; width: var(--guess-tile-size); height: var(--guess-tile-size); top: 0; outline: 3px solid var(--burgundy); outline-offset: 3px; box-shadow: 0 0 0 3px var(--panel); box-sizing: border-box; pointer-events: none; }
    .practice-board :global(.chess) { margin-top: 0.1rem; width: min(100%, max(7rem, calc(var(--mobile-chess-width) - var(--history-height)))); }
    .practice-board :global(.board-grid) { padding-bottom: 1.1rem; }
    .practice-board :global(.file-labels) { height: 1rem; font-size: 0.65rem; }
    .tutorial :global(.keyboard) { padding: 0.2rem 0; margin: 0; }
    .tutorial :global(.key) { min-height: 1.75rem; min-width: 0; font-size: 0.68rem; padding: 0.15rem; margin-bottom: 0.08rem; }
    footer { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; padding-top: 0.35rem; border-top: 1px solid var(--line); }
    footer button { font-size: 0.65rem; min-height: 2.5rem; }
    footer span { font-size: 0.65rem; color: var(--muted); max-width: 16rem; }
    .text-button { border-color: transparent; }
    @media (max-width: 420px) {
        .tutorial { --guess-tile-size: 2rem; --guess-letter-size: 0.95rem; --guess-move-size: 0.37rem; --mobile-chess-width: min(18rem, calc(100dvh - 28rem)); gap: 0.25rem; }
        h1 { font-size: 1.45rem; }
        .coach { min-height: 6.1rem; }
        .coach p:not(.progress) { font-size: 0.82rem; }
        footer { gap: 0.25rem; }
    }
</style>
