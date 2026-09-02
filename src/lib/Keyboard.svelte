<script>
    import { createEventDispatcher } from "svelte";
    import Key from "./Key.svelte";

    export let keyStatuses = {};

    const topRow = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"];
    const middleRow = ["a", "s", "d", "f", "g", "h", "j", "k", "l"];
    const bottomRow = ["Enter", "z", "x", "c", "v", "b", "n", "m", "Backspace"];
</script>

<div class="keyboard">
    <div class="row">
        {#each topRow as key}
            <Key {key} status={keyStatuses[key.toUpperCase()] ?? -1} boardKey={"abcdefgh".includes(key)} on:key />
        {/each}
    </div>
    <div class="row">
        {#each middleRow as key}
            <Key {key} status={keyStatuses[key.toUpperCase()] ?? -1} boardKey={"abcdefgh".includes(key)} on:key />
        {/each}
    </div>

    <div class="row">
        {#each bottomRow as key}
            <Key {key} status={keyStatuses[key.toUpperCase()] ?? -1} boardKey={"abcdefgh".includes(key)} on:key />
        {/each}
    </div>
</div>

<style>
    .row {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.22rem;
    }

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
        .keyboard { margin-top: 0.25rem; padding: 0.3rem 0.35rem 0; }
        .keyboard :global(.key) { min-height: 2.25rem; margin-bottom: 0.1rem; }
    }
    @media (max-width: 420px) and (max-height: 760px) {
        .keyboard { padding-bottom: 0; }
        .keyboard :global(.key) { min-height: 2.1rem; margin-bottom: 0.05rem; }
    }
</style>
