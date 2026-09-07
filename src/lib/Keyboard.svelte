<script>
    import { createEventDispatcher } from "svelte";
    import Key from "./Key.svelte";

    export let keyStatuses = {};

    const topRow = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
    const middleRow = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
    const bottomRow = ["Enter", "z", "x", "c", "v", "b", "n", "m", "Backspace"];
</script>

<div class="keyboard" aria-label="Letter and action keyboard">
    <div class="row row-top">
        {#each topRow as key}
            <Key {key} status={keyStatuses[key.toUpperCase()] ?? -1} boardKey={"abcdefgh".includes(key)} on:key />
        {/each}
    </div>
    <div class="row row-middle">
        {#each middleRow as key}
            <Key {key} status={keyStatuses[key.toUpperCase()] ?? -1} boardKey={"abcdefgh".includes(key)} on:key />
        {/each}
    </div>

    <div class="row row-bottom">
        {#each bottomRow as key}
            <Key {key} status={keyStatuses[key.toUpperCase()] ?? -1} boardKey={"abcdefgh".includes(key)} on:key />
        {/each}
    </div>
</div>

<style>
    .row {
        display: grid;
        align-items: center;
        justify-content: center;
        gap: 0.22rem;
        width: min(100%, 32rem);
    }
    .row-top { grid-template-columns: repeat(10, minmax(0, 1fr)); }
    .row-middle { grid-template-columns: repeat(9, minmax(0, 1fr)); padding-inline: 5%; }
    .row-bottom { grid-template-columns: 1.45fr repeat(7, minmax(0, 1fr)) 1.45fr; }

    .keyboard {
        position: relative;
        padding: 0.85rem 1rem 0.95rem;
        margin: 2rem 0 0;
        background-color: var(--main);
        border-top: 1px solid var(--line);
        color: var(--text);
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 50;
    }
    @media (max-width: 420px) {
        .row { gap: 0.15rem; }
        .keyboard { margin-top: 0.25rem; padding: 0.3rem 0.35rem 0.2rem; }
        .keyboard :global(.key) { min-width: 0; min-height: 2.45rem; margin-bottom: 0.1rem; padding-inline: 0.12rem; font-size: 0.72rem; }
        .keyboard :global(.utility-key) { font-size: 1.05rem; }
    }
</style>
