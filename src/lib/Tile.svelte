<script>
    export let letter;
    export let status;
    export let moveStatus = status;
    export let ghost = false;
    export let move = "";
</script>

<div
    class:ghost
    aria-label={move ? `${letter}, move ${move}` : undefined}
    title={move ? `Move ${move}` : undefined}
>
    <span class:green={status === 2} class:yellow={status === 1} class:gray={status === 0} class="letter">{letter}</span>
    <span class:green={moveStatus === 2} class:yellow={moveStatus === 1} class:gray={moveStatus === 0} class="move" aria-hidden="true">{move}</span>
</div>

<style>
    div {
        width: clamp(2.7rem, 10vw, 3.35rem);
        height: clamp(2.7rem, 10vw, 3.35rem);
        border: 1px solid var(--ink);
        display: grid;
        grid-template-rows: minmax(0, 1fr) minmax(0, 0.42fr);
        overflow: hidden;
    }

    .letter, .move { display: grid; place-items: center; }
    .letter { font: 700 clamp(1.15rem, 4vw, 1.45rem)/1 var(--sans); letter-spacing: 0.03em; }
    .move {
        font: 700 clamp(0.42rem, 1.5vw, 0.52rem)/1 var(--mono);
        letter-spacing: -0.035em;
        white-space: nowrap;
    }

    .ghost { border-color: var(--burgundy); border-style: dashed; opacity: 0.58; }
    .ghost .letter, .ghost .move { color: var(--burgundy); background: transparent; }

    .green {
        background-color: var(--green);
        color: var(--panel);
    }

    .yellow {
        background-color: var(--yellow);
        color: var(--ink);
    }

    .gray {
        background-color: var(--gray);
        color: var(--panel);
    }

    @media (max-width: 420px) {
        div { width: 2rem; height: 2rem; }
        .letter { font-size: 0.88rem; }
    }
    @media (max-width: 420px) and (max-height: 760px) {
        div { width: 1.55rem; height: 1.55rem; }
        .letter { font-size: 0.7rem; }
        .move { font-size: 0.31rem; }
    }
</style>
