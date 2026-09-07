<script>
    export let message;
</script>

{#if message}<p id="game-error" class="game-error" role="alert" aria-live="assertive">{message}</p>{/if}

<style>
    .game-error { max-width: 30rem; margin: 0.55rem auto 0; padding: 0.45rem 0.65rem; border: 1px solid var(--burgundy); background: color-mix(in srgb, var(--panel) 88%, var(--burgundy)); color: var(--burgundy); text-align: center; font: 700 0.82rem/1.25 var(--sans); }
</style>
