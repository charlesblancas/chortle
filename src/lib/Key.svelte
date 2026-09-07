<script>
    import { createEventDispatcher } from "svelte";

    export let key;
    export let boardKey = false;
    export let status = -1;

    $: glyph = key === "Enter" ? "↵" : key === "Backspace" ? "⌫" : key;
    $: statusLabel = status === 2 ? "correct" : status === 1 ? "present elsewhere" : status === 0 ? "not in the word" : "not tried";
    $: accessibleLabel = key === "Enter"
        ? `Enter: submit guess, ${statusLabel}`
        : key === "Backspace"
            ? `Backspace: remove the last letter, ${statusLabel}`
            : `${key.toUpperCase()}${boardKey ? ": choose this chess file on the board" : ""}, ${statusLabel}`;

    const dispatch = createEventDispatcher();

    function sendKeyToKeyboard(event) {
        dispatch("key", {
            key,
        });
        event.stopPropagation();
        event.currentTarget.blur();
    }
</script>

<button class:board-key={boardKey} class:status-green={status === 2} class:status-yellow={status === 1} class:status-gray={status === 0} class:utility-key={key === "Enter" || key === "Backspace"} class="key" aria-label={accessibleLabel} title={boardKey ? `${key.toUpperCase()} comes from the chessboard` : key} on:click={sendKeyToKeyboard}><span class:utility-glyph={key === "Enter" || key === "Backspace"}>{glyph}</span><span class="sr-only">{statusLabel}</span></button>

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
    .sr-only { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
    .utility-key { font-size: 1.18rem; line-height: 0.8; }
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
