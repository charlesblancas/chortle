<script>
    import { createEventDispatcher } from "svelte";

    export let key;
    export let boardKey = false;
    export let status = -1;

    $: glyph = key === "Enter" ? "↵" : key === "Backspace" ? "⌫" : key;

    const dispatch = createEventDispatcher();

    function sendKeyToKeyboard(event) {
        dispatch("key", {
            key,
        });
        event.stopPropagation();
        event.currentTarget.blur();
    }
</script>

<button class:board-key={boardKey} class:status-green={status === 2} class:status-yellow={status === 1} class:status-gray={status === 0} class="key" aria-label={key} title={boardKey ? `${key.toUpperCase()} comes from the chessboard` : key} on:click={sendKeyToKeyboard}><span class:utility-glyph={key === "Enter" || key === "Backspace"}>{glyph}</span></button>

<style>
    .key {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        direction: ltr;
        min-width: 2.15rem;
        min-height: 2.1rem;
        padding: 0.25rem 0.38rem;
        margin-bottom: 0.22rem;
        cursor: pointer;
        font: 700 0.78rem/1 var(--mono);
    }
    .key[aria-label="Enter"] { font-size: 1.18rem; line-height: 0.8; }
    .key[aria-label="Backspace"] { font-size: 1.18rem; line-height: 0.8; }
    .utility-glyph { font-family: Arial, sans-serif; }
    .board-key { color: var(--burgundy); border-color: var(--burgundy); border-style: dashed; opacity: 0.72; cursor: pointer; }
    .status-green, .status-yellow, .status-gray { border-style: solid; opacity: 1; }
    .status-green { background: var(--green); border-color: var(--green); color: var(--panel); }
    .status-yellow { background: var(--yellow); border-color: var(--yellow); color: var(--ink); }
    .status-gray { background: var(--gray); border-color: var(--gray); color: var(--panel); }
    @media (hover: hover) {
        .board-key:hover { color: var(--burgundy); border-color: var(--burgundy); background: transparent; }
    }
</style>
