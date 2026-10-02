<script>
    export let message;
</script>

{#if message}<p id="game-error" class="game-error" role="alert" aria-live="assertive">{message}</p>{/if}

<style>
    .game-error {
        position: fixed;
        z-index: 80;
        top: max(env(safe-area-inset-top, 0px), clamp(3.5rem, 8vh, 5rem));
        left: 50%;
        transform: translateX(-50%);
        width: max-content;
        max-width: min(30rem, calc(100vw - 2rem));
        margin: 0;
        padding: 0.55rem 0.8rem;
        border: 1px solid var(--burgundy);
        background: var(--panel);
        box-shadow: 0 0.15rem 0.45rem rgb(38 50 56 / 14%);
        color: var(--burgundy);
        text-align: center;
        font: 700 0.82rem/1.25 var(--sans);
        pointer-events: none;
    }
</style>
