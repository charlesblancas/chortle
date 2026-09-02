<script>
    export let message;
</script>

{#if message}<p class="game-error" role="status">{message}</p>{/if}

<style>
    .game-error { max-width: 30rem; margin: 0.45rem auto 0; padding: 0.35rem 0.5rem; border: 1px solid var(--burgundy); color: var(--burgundy); text-align: center; font: 700 0.78rem/1.25 var(--sans); }
</style>
