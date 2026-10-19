<script>
    import { createEventDispatcher } from "svelte";
    import { formatUciMove } from "./chessNotation.js";
    export let actions = [];
    export let requiredMoves = 0;
    export let placedMoves = 0;
    export let disabled = false;
    export let undoDisabled = false;
    export let canPlace = () => true;
    export let statusElement;
    const dispatch = createEventDispatcher();
</script>

<div class="board-with-line has-line">
    <slot />
    <div class="line-controls" aria-label="Chess move queue">
        <div class="move-queue">
            {#each actions as action, index}
                <button type="button" class:placed={index < placedMoves} aria-label={`Place queued ${action.letter}, move ${index + 1}, ${formatUciMove(action.uci)}`} title={formatUciMove(action.uci)} disabled={disabled || index !== placedMoves || !canPlace(action, index)} on:click={(event) => { dispatch("place", action.letter); event.currentTarget.blur(); }}>
                    <span class="queue-index">{index + 1}</span><span class="queue-letter">{action.letter}</span><small class="queue-notation">{formatUciMove(action.uci)}</small>
                </button>
            {/each}
            {#each Array(Math.max(0, requiredMoves - actions.length)) as _, index}
                <div class="empty-move" aria-label={`Move ${actions.length + index + 1}, not played`}><span class="queue-index">{actions.length + index + 1}</span><span aria-hidden="true">—</span></div>
            {/each}
        </div>
        <button type="button" class="undo-move" aria-label="Undo move" disabled={!actions.length || undoDisabled} on:click={(event) => { dispatch("undo"); event.currentTarget.blur(); }}>↶ <span>Undo move</span></button>
        <span class="line-count" bind:this={statusElement} tabindex="-1" role="status">{actions.length}/{requiredMoves} moves</span>
    </div>
</div>

<style>
    .board-with-line.has-line { display:grid; grid-template-columns:clamp(2.75rem, 9vw, 3.65rem) minmax(0,1fr); gap:.75rem; align-items:start; margin-top:.5rem; }
    /* Desktop rank labels extend 1.65rem left of the board. Keep their gutter
       clear of the move tiles; phones already reserve it inside board-grid. */
    @media (min-width:511px) { .board-with-line.has-line { column-gap:1.9rem; } }
    .has-line :global(.chess) { grid-column:2; grid-row:1; width:100%; margin-top:0; min-width:0; }
    .line-controls { grid-column:1; grid-row:1; display:flex; flex-direction:column; gap:.35rem; margin:0; min-width:0; }
    .move-queue { display:flex; flex-direction:column; gap:.25rem; }
    .move-queue button, .empty-move { position:relative; width:100%; height:clamp(1.8rem, min(4.8vh, calc(var(--viewport-board-limit, 500px) / 7)), 3.65rem); min-height:0; padding:.35rem .05rem .2rem; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.15rem; border:1px solid var(--line); }
    .empty-move { color:var(--line); font-size:1.25rem; }
    .move-queue button { border-color:var(--burgundy); color:var(--burgundy); background:#702d3108; }
    .move-queue button:disabled { opacity:1; }
    .move-queue button.placed { color:var(--green); border-color:var(--green); background:#00796b08; }
    .queue-index { position:absolute; top:.15rem; left:.2rem; font:400 .4rem/1 var(--mono); color:var(--muted); }
    .queue-letter { font-size:1.3rem; line-height:1; }
    .queue-notation { font:700 clamp(.36rem, 1.45vw, .48rem)/1 var(--mono); white-space:nowrap; }
    .undo-move { width:100%; padding:.6rem .05rem; font-size:.5rem; line-height:1.2; border-color:var(--line); }
    .line-count { color:var(--muted); font-size:.46rem; line-height:1.4; text-align:center; }
    .line-count:focus { outline: none; }
    @media (max-height:700px) {
        .line-controls { gap:.15rem; }
        .move-queue { gap:.1rem; }
        .move-queue button, .empty-move { height:min(4.8vh, calc(var(--viewport-board-limit, 500px) / 8)); padding:.15rem .05rem; gap:.05rem; }
        .queue-letter { font-size:min(1.1rem, 2.8vh); }
        .queue-index { font-size:.32rem; top:.08rem; left:.1rem; }
        .queue-notation { font-size:.36rem; }
        .undo-move { padding:.3rem .05rem; }
        .line-count { font-size:.4rem; line-height:1.2; }
    }
</style>
