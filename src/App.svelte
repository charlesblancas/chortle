<script>
    import WordGame from "./lib/WordGame.svelte";
    import DebugFixtures from "./lib/DebugFixtures.svelte";
    import { fixtureById } from "./fixtures";
    import { showInstructions } from "./stores";

    const fixture = import.meta.env.DEV ? fixtureById(new URLSearchParams(window.location.search).get("fixture")) : null;
    const dayOverride = import.meta.env.DEV ? Number(new URLSearchParams(window.location.search).get("day")) : NaN;
    const PIECE_SET_KEY = "chortle:piece-set-v2";
    const PIECE_SETS = new Set(["glyph", "chessnut", "cburnett", "berlin", "leipzig", "alpha", "merida", "maestro", "fantasy", "caliente", "horsey", "pixel", "mono"]);
    const savedPieceSet = localStorage.getItem(PIECE_SET_KEY);
    let pieceSet = PIECE_SETS.has(savedPieceSet) ? savedPieceSet : "cburnett";

    function toggleInstructions() {
        showInstructions.update((visible) => !visible);
    }

    function selectPieceSet(event) {
        pieceSet = event.detail;
        localStorage.setItem(PIECE_SET_KEY, pieceSet);
    }
</script>

<main>
    <header class="masthead">
        <p class="edition">Daily edition</p>
        <h1 class="title">Chortle <span class="beta">Beta</span></h1>
        <button class="help" type="button" aria-label={$showInstructions ? "Close instructions" : "Show instructions"} title={$showInstructions ? "Close instructions" : "Show instructions"} on:click={(event) => { toggleInstructions(); event.currentTarget.blur(); }}>?</button>
    </header>
    {#if import.meta.env.DEV}<DebugFixtures selected={fixture?.id || ""} {pieceSet} on:pieceSet={selectPieceSet} />{/if}
    <WordGame {fixture} {dayOverride} {pieceSet} />
</main>

<style>
    main { width: min(calc(100% - 2rem), 39rem); margin: 0 auto; padding: 0.45rem 0.35rem 0; }
    .masthead { position: relative; margin-bottom: 0.55rem; padding: 0.32rem 0 0.38rem; text-align: center; }
    .edition { margin: 0; color: var(--muted); font: 700 0.6rem/1 var(--sans); letter-spacing: 0.14em; text-transform: uppercase; }
    .title { margin: 0.25rem 0 0; font: 700 clamp(2.25rem, 7vw, 3.35rem)/0.88 var(--display); letter-spacing: -0.07em; text-transform: uppercase; }
    .beta { display: inline-block; margin-left: 0.18em; color: var(--burgundy); font: 700 0.24em/1 var(--mono); letter-spacing: 0.12em; vertical-align: middle; }
    .help { position: absolute; top: 0.18rem; right: 0; width: 2rem; height: 2rem; min-width: 0; padding: 0; border: 1px solid var(--line); color: var(--muted); font: 700 1rem/1 var(--sans); letter-spacing: 0; }
    @media (hover: hover) { .help:hover { color: var(--panel); border-color: var(--burgundy); } }
    @media (max-width: 420px) {
        main { width: min(calc(100% - 1.25rem), 39rem); padding: 0.3rem 0.35rem 0; }
        .masthead { margin-bottom: 0.2rem; padding: 0.12rem 0 0.18rem; }
        .edition { font-size: 0.56rem; }
        .title { margin-top: 0.12rem; font-size: clamp(1.9rem, 11vw, 2.45rem); }
        .help { top: 0.12rem; right: 0.1rem; }
    }
    @media (max-width: 420px) and (max-height: 760px) {
        .title { font-size: 1.85rem; }
        .masthead { margin-bottom: 0.1rem; padding-bottom: 0.1rem; }
    }
</style>
