<script>
    import Tile from "./Tile.svelte";

    export let status;
    export let word;
    export let active = false;
    export let compact = false;
    export let previewLetter = "";
</script>

<div class:active class:compact class="guess">
    <div class="tiles">
        <Tile letter={word[0] || (active && word.length === 0 ? previewLetter : "")} status={status[0]} {compact} ghost={active && word.length === 0 && !!previewLetter} />
        <Tile letter={word[1] || (active && word.length === 1 ? previewLetter : "")} status={status[1]} {compact} ghost={active && word.length === 1 && !!previewLetter} />
        <Tile letter={word[2] || (active && word.length === 2 ? previewLetter : "")} status={status[2]} {compact} ghost={active && word.length === 2 && !!previewLetter} />
        <Tile letter={word[3] || (active && word.length === 3 ? previewLetter : "")} status={status[3]} {compact} ghost={active && word.length === 3 && !!previewLetter} />
        <Tile letter={word[4] || (active && word.length === 4 ? previewLetter : "")} status={status[4]} {compact} ghost={active && word.length === 4 && !!previewLetter} />
    </div>
</div>

<style>
    .guess {
        display: flex;
        gap: 0.5rem;
    }

    .compact .tiles { gap: 0.18rem; }

    .tiles {
        display: flex;
        gap: 0.3rem;
    }
</style>
